import pandas as pd
from src.config import REQUIRED_COLUMNS, RANDOM_STATE, SAMPLE_SIZE


def load_and_clean_data(path):
    df = pd.read_csv(path, low_memory=False)

    df = df[REQUIRED_COLUMNS].copy()

    df["correct"] = pd.to_numeric(df["correct"], errors="coerce")
    df["attempt_count"] = pd.to_numeric(df["attempt_count"], errors="coerce")
    df["ms_first_response"] = pd.to_numeric(df["ms_first_response"], errors="coerce")
    df["start_time"] = pd.to_datetime(df["start_time"], format="mixed", errors="coerce")

    df = df.dropna()

    df["correct"] = df["correct"].astype(int)
    df["attempt_count"] = df["attempt_count"].astype(float)
    df["ms_first_response"] = df["ms_first_response"].astype(float)

    df = df.sort_values(by=["user_id", "start_time"]).reset_index(drop=True)

    return df


def sample_data(df, sample_size=SAMPLE_SIZE, random_state=RANDOM_STATE):
    if len(df) < sample_size:
        sample_size = len(df)
    df_sample = df.sample(n=sample_size, random_state=random_state)
    df_sample = df_sample.sort_values(by=["user_id", "start_time"]).reset_index(drop=True)
    return df_sample