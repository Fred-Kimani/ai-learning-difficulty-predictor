import pandas as pd

from src.config import REQUIRED_COLUMNS


def load_dataset(file_path: str) -> pd.DataFrame:
    df = pd.read_csv(file_path)
    return df


def clean_interaction_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df[REQUIRED_COLUMNS].copy()

    df["start_time"] = pd.to_datetime(
        df["start_time"],
        format="mixed",
        errors="coerce",
    )

    df["correct"] = pd.to_numeric(df["correct"], errors="coerce")
    df["attempt_count"] = pd.to_numeric(df["attempt_count"], errors="coerce")
    df["ms_first_response"] = pd.to_numeric(
        df["ms_first_response"],
        errors="coerce",
    )

    df = df.dropna(subset=REQUIRED_COLUMNS)

    df["correct"] = df["correct"].astype(int)
    df["attempt_count"] = df["attempt_count"].astype(float)
    df["ms_first_response"] = df["ms_first_response"].astype(float)

    df = df.sort_values(by=["user_id", "start_time"]).reset_index(drop=True)

    return df


def sample_rows(
    df: pd.DataFrame,
    sample_size: int | None = 200_000,
    random_state: int = 42,
) -> pd.DataFrame:
    if sample_size is None:
        return df

    if len(df) <= sample_size:
        return df

    sampled_df = df.sample(n=sample_size, random_state=random_state)
    sampled_df = sampled_df.sort_values(
        by=["user_id", "start_time"]
    ).reset_index(drop=True)

    return sampled_df


def print_dataset_summary(df: pd.DataFrame) -> None:
    print("Dataset shape:", df.shape)
    print("Number of students:", df["user_id"].nunique())
    print("Correctness distribution:")
    print(df["correct"].value_counts(normalize=True))