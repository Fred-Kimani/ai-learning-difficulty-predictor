import os
from pathlib import Path
import torch

RANDOM_STATE = 42

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Default notebook data path
DATA_PATH = Path("/kaggle/input/datasets/nicolaswattiez/skillbuilder-data-2009-2010/2012-2013-data-with-predictions-4-final.csv")

# Local fallback if notebook path doesn't exist
if not DATA_PATH.exists():
    DATA_PATH = PROJECT_ROOT / "data" / "2012-2013-data-with-predictions-4-final.csv"

MODEL_DIR = PROJECT_ROOT / "models"
ATTENTION_LSTM_MODEL_PATH = MODEL_DIR / "attention_lstm.pt"
RANDOM_FOREST_MODEL_PATH = MODEL_DIR / "random_forest_baseline.joblib"

REQUIRED_COLUMNS = [
    "user_id",
    "start_time",
    "correct",
    "attempt_count",
    "ms_first_response"
]

SAMPLE_SIZE = 200_000
WINDOW_SIZE = 10
FUTURE_SIZE = 5

BATCH_SIZE = 32
EPOCHS = 15
LEARNING_RATE = 0.00064
HIDDEN_SIZE = 64
NUM_CLASSES = 3

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Sequence features (12 features in total)
SEQUENCE_FEATURES = [
    "response_time",
    "attempts",
    "correctness",
    "correct_diff",
    "attempt_diff",
    "rolling_correctness",
    "rolling_attempts",
    "relative_time",
    "correct_std",
    "time_std",
    "attempt_std",
    "temporal_decay"
]

# Random Forest features (7 features in total)
RF_FEATURE_NAMES = [
    "Average Response Time",
    "Average Attempts",
    "Average Correctness",
    "Maximum Attempts",
    "Response Time Std",
    "Correctness Std",
    "Attempts Std"
]

CORRECT_FEATURE_INDEX = 2