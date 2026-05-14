from pathlib import Path

RANDOM_STATE = 42

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATA_PATH = PROJECT_ROOT / "data" / "2012-2013-data-with-predictions-4-final.csv"

MODEL_DIR = PROJECT_ROOT / "models"
ATTENTION_LSTM_MODEL_PATH = MODEL_DIR / "attention_lstm.pt"
RANDOM_FOREST_MODEL_PATH = MODEL_DIR / "random_forest_baseline.joblib"

REQUIRED_COLUMNS = [
    "user_id",
    "start_time",
    "correct",
    "attempt_count",
    "ms_first_response",
]

WINDOW_SIZE = 10
FUTURE_SIZE = 5
STRUGGLE_WRONG_THRESHOLD = 3

TEST_SIZE = 0.2

BATCH_SIZE = 32
EPOCHS = 15
LEARNING_RATE = 0.0005
HIDDEN_SIZE = 64
NUM_CLASSES = 2

THRESHOLDS_TO_TEST = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50]

FEATURE_NAMES = [
    "response_time",
    "attempt_count",
    "correct",
    "correct_diff",
    "attempt_diff",
    "rolling_correctness",
    "rolling_attempts",
    "relative_time",
    "correct_std",
    "time_std",
    "attempt_std",
]

CORRECT_FEATURE_INDEX = 2