from pathlib import Path
import os
import torch

RANDOM_STATE = 42

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATA_PATH = os.getenv(
    "DATA_PATH", 
    default="./data/raw/2012-2013-data-with-predictions-4-final.csv"
)

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

TEST_SIZE = 0.2

BATCH_SIZE = 32
EPOCHS = 15
LEARNING_RATE = 0.0005
NUM_CLASSES = 3

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


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