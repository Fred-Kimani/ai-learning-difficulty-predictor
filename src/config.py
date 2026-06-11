import os
from pathlib import Path
import torch

RANDOM_STATE = 42

PROJECT_ROOT = Path(__file__).resolve().parents[1]

#data path
DATA_PATH = Path("/kaggle/input/datasets/nicolaswattiez/skillbuilder-data-2009-2010/2012-2013-data-with-predictions-4-final.csv")

#local fallback
if not DATA_PATH.exists():
    DATA_PATH = PROJECT_ROOT / "data" / "2012-2013-data-with-predictions-4-final.csv"

MODEL_DIR = PROJECT_ROOT / "models"
KAGGLE_MODEL_DIR = MODEL_DIR / "kaggle"
TRAINED_MODEL_DIR = MODEL_DIR / "trained"

#paths used for live inference
INFERENCE_ATTENTION_LSTM_PATH = KAGGLE_MODEL_DIR / "attention_lstm.pt"
INFERENCE_RANDOM_FOREST_PATH = KAGGLE_MODEL_DIR / "random_forest_baseline.joblib"
INFERENCE_SCALER_PATH = KAGGLE_MODEL_DIR / "sequence_scalers.pkl"

#paths where training/tuning pipelines
ATTENTION_LSTM_MODEL_PATH = TRAINED_MODEL_DIR / "attention_lstm.pt"
RANDOM_FOREST_MODEL_PATH = TRAINED_MODEL_DIR / "random_forest_baseline.joblib"
TRAINED_SCALER_PATH = TRAINED_MODEL_DIR / "sequence_scalers.pkl"

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

#sequence features (12)
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

#random Forest features (7)
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