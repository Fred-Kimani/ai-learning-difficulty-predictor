import os
import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from pathlib import Path

#custom MLOps modules
from src.data_router import InferenceDataRouter
from src.inference_engine import RiskPredictor


# ── Environment ──────────────────────────────────────────────────────────────

load_dotenv()

API_KEY = os.getenv("API_KEY", "").strip()
ALLOWED_ORIGINS = [
    o.strip() for o in
    os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]
DATA_CSV_PATH = Path(os.getenv("DATA_CSV_PATH", "data/2012-2013-data-with-predictions-4-final.csv"))
MODEL_DIR = os.getenv("MODEL_DIR", "models/kaggle")
LOG_LEVEL = os.getenv("LOG_LEVEL", "info").upper()

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("api")


# ── Global State (set during lifespan) ────────────────────────────────────────

data_router: InferenceDataRouter | None = None
predictor: RiskPredictor | None = None
boot_error: str | None = None
boot_time: float = time.time()


# ── Rate Limiter ──────────────────────────────────────────────────────────────

limiter = Limiter(key_func=get_remote_address)


# ── Lifespan (replaces module-level loading) ──────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Graceful startup: load model & data, but stay up even on failure."""
    global data_router, predictor, boot_error, boot_time
    boot_time = time.time()
    logger.info("Booting up AI microservice...")
    try:
        data_router = InferenceDataRouter(raw_data_path=str(DATA_CSV_PATH))
        predictor = RiskPredictor()
        logger.info("✓ Model and data loaded successfully.")
    except Exception as e:
        boot_error = str(e)
        logger.error(f"CRITICAL: startup failed — {e}")
        logger.error("The /health endpoint will report this. Fix and restart.")
    yield
    logger.info("Shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="AI Learning Difficulty Predictor",
    description="Real-time inference API for predicting student struggle via sequence modeling.",
    version="3.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Middleware: Logging + API-Key ─────────────────────────────────────────────

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log every request with method, path, status, and duration."""
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    logger.info(
        "%s %s → %s (%.0fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


def _verify_api_key(request: Request):
    """Dependency: reject requests without a valid X-API-Key (when API_KEY is set)."""
    if not API_KEY:
        return  # auth disabled in dev mode
    key = request.headers.get("X-API-Key", "")
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")


def _require_ready():
    """Dependency: ensure model & data are loaded before serving predictions."""
    if data_router is None or predictor is None:
        raise HTTPException(
            status_code=503,
            detail=f"Service not ready. Boot error: {boot_error or 'unknown'}",
        )


# ── Pydantic Models (with validation) ────────────────────────────────────────

class ClassSummaryRequest(BaseModel):
    user_ids: list[int] = Field(..., max_length=20, description="List of student IDs (max 20 for demo).")

class InteractionStep(BaseModel):
    correct: int = Field(..., ge=0, le=1, description="0 or 1")
    attempt_count: int = Field(..., ge=1, description="Must be ≥ 1")
    ms_first_response: float = Field(..., ge=0, le=300_000, description="0–300000 ms (5 min cap)")

class CustomPredictionRequest(BaseModel):
    steps: list[InteractionStep] = Field(..., min_length=10, max_length=10)


# ── API Endpoints ─────────────────────────────────────────────────────────────

@app.get("/")
def root():
    """Quick liveness check (backwards compat)."""
    return {"status": "online", "model": "LSTMWithAttention v3.1"}


@app.get("/health")
def health_check():
    """Detailed health status with model/data readiness and uptime."""
    uptime_s = round(time.time() - boot_time, 1)
    model_ok = predictor is not None
    data_ok = data_router is not None

    status = "healthy" if (model_ok and data_ok) else "degraded"
    payload = {
        "status": status,
        "uptime_seconds": uptime_s,
        "model_loaded": model_ok,
        "data_loaded": data_ok,
    }
    if boot_error:
        payload["boot_error"] = boot_error

    code = 200 if status == "healthy" else 503
    return JSONResponse(content=payload, status_code=code)


@app.get("/demo/random")
@limiter.limit("30/minute")
def get_random_demo_prediction(request: Request, _key=Depends(_verify_api_key)):
    """SCENARIO 2: Picks a random valid student and predicts their risk."""
    _require_ready()
    try:
        user_id, df_window = data_router.get_random_demo_student(window_size=10)
        prediction_result = predictor.predict(df_window)
        
        df_clean = df_window.copy()
        df_clean["start_time"] = df_clean["start_time"].astype(str)
        history = df_clean[["start_time", "correct", "attempt_count", "ms_first_response"]].to_dict(orient="records")
        
        return {
            "user_id": int(user_id),
            "prediction": prediction_result,
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/student/{user_id}")
@limiter.limit("30/minute")
def get_student_prediction(user_id: int, request: Request, _key=Depends(_verify_api_key)):
    """SCENARIO 1: Analyzes the risk of a specific student by ID."""
    _require_ready()
    try:
        df_window = data_router.get_live_student_window(user_id, window_size=10)
        prediction_result = predictor.predict(df_window)
        
        df_clean = df_window.copy()
        df_clean["start_time"] = df_clean["start_time"].astype(str)
        history = df_clean[["start_time", "correct", "attempt_count", "ms_first_response"]].to_dict(orient="records")
        
        return {
            "user_id": user_id,
            "prediction": prediction_result,
            "history": history
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/custom")
@limiter.limit("10/minute")
def predict_custom_sequence(request: Request, body: CustomPredictionRequest, _key=Depends(_verify_api_key)):
    """SCENARIO 4: Accepts a custom 10-step interaction sequence for live prediction."""
    _require_ready()
    import pandas as pd
    from datetime import datetime, timedelta

    # Build a DataFrame that matches the format expected by the inference engine
    base_time = datetime.now()
    rows = []
    for i, step in enumerate(body.steps):
        rows.append({
            "user_id": 0,
            "start_time": base_time + timedelta(minutes=i),
            "correct": step.correct,
            "attempt_count": step.attempt_count,
            "ms_first_response": step.ms_first_response,
        })
    
    df_window = pd.DataFrame(rows)
    
    try:
        prediction_result = predictor.predict(df_window)
        history = [{
            "correct": s.correct,
            "attempt_count": s.attempt_count,
            "ms_first_response": s.ms_first_response
        } for s in body.steps]
        
        return {
            "user_id": "custom",
            "prediction": prediction_result,
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/class/summary")
@limiter.limit("10/minute")
def get_class_summary(request: Request, body: ClassSummaryRequest, _key=Depends(_verify_api_key)):
    """SCENARIO 3: Analyzes a whole list of students at once."""
    _require_ready()
    batch_windows = data_router.get_class_summary_batch(body.user_ids, window_size=10)
    
    results = {}
    for uid, df_window in batch_windows.items():
        if df_window is None:
            results[uid] = {"error": "Insufficient data history for this student."}
        else:
            results[uid] = predictor.predict(df_window)
            
    return {"batch_results": results}


@app.get("/debug/predict/{user_id}")
@limiter.limit("10/minute")
def debug_predict(user_id: int, request: Request, _key=Depends(_verify_api_key)):
    """Protected debug endpoint: returns raw probabilities + guardrail metadata."""
    _require_ready()
    try:
        df_window = data_router.get_live_student_window(user_id, window_size=10)
        prediction_result = predictor.predict(df_window)

        # Add raw stats for debugging
        prediction_result["_debug"] = {
            "overall_correct": round(float(df_window['correct'].mean()), 4),
            "recent_correct_3": round(float(df_window['correct'].tail(3).mean()), 4),
            "recent_attempts_3": round(float(df_window['attempt_count'].tail(3).mean()), 4),
            "avg_response_time_ms": round(float(df_window['ms_first_response'].mean()), 1),
            "max_response_time_ms": round(float(df_window['ms_first_response'].max()), 1),
        }
        return prediction_result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))