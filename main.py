from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

#custom MLOps modules
from src.data_router import InferenceDataRouter
from src.inference_engine import RiskPredictor


app = FastAPI(
    title="AI Learning Difficulty Predictor",
    description="Real-time inference API for predicting student struggle via sequence modeling.",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)


DATA_PATH = Path("data/2012-2013-data-with-predictions-4-final.csv")

print("Booting up AI microservice...")
try:
    data_router = InferenceDataRouter(raw_data_path=str(DATA_PATH))
    predictor = RiskPredictor()
except Exception as e:
    print(f"CRITICAL ERROR during startup: {e}")
    print("Ensure your CSV is in the data/ folder and .pkl/.pth files are in models/")



class ClassSummaryRequest(BaseModel):
    user_ids: list[int]

class InteractionStep(BaseModel):
    correct: int
    attempt_count: int
    ms_first_response: float

class CustomPredictionRequest(BaseModel):
    steps: list[InteractionStep]


#Api endpoints

@app.get("/")
def health_check():
    """Verifies the server is running."""
    return {"status": "online", "model": "LSTMWithAttention v3.0"}

@app.get("/demo/random")
def get_random_demo_prediction():
    """SCENARIO 2: Picks a random valid student and predicts their risk."""
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
def get_student_prediction(user_id: int):
    """SCENARIO 1: Analyzes the risk of a specific student by ID."""
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
def predict_custom_sequence(request: CustomPredictionRequest):
    """SCENARIO 4: Accepts a custom 10-step interaction sequence for live prediction."""
    import pandas as pd
    from datetime import datetime, timedelta

    if len(request.steps) != 10:
        raise HTTPException(status_code=400, detail="Exactly 10 interaction steps are required.")
    
    # Build a DataFrame that matches the format expected by the inference engine
    base_time = datetime.now()
    rows = []
    for i, step in enumerate(request.steps):
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
        } for s in request.steps]
        
        return {
            "user_id": "custom",
            "prediction": prediction_result,
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/class/summary")
def get_class_summary(request: ClassSummaryRequest):
    """SCENARIO 3: Analyzes a whole list of students at once."""
    batch_windows = data_router.get_class_summary_batch(request.user_ids, window_size=10)
    
    results = {}
    for uid, df_window in batch_windows.items():
        if df_window is None:
            results[uid] = {"error": "Insufficient data history for this student."}
        else:
            results[uid] = predictor.predict(df_window)
            
    return {"batch_results": results}