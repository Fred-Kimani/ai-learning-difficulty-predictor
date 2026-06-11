import os
import pandas as pd
import numpy as np
import torch
from pathlib import Path

#paths
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
DATA_FILE = DATA_DIR / "2012-2013-data-with-predictions-4-final.csv"


def generate_mock_data():
    print("Generating mock dataset...")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    np.random.seed(42)
    num_users = 6000
    interactions_per_user = 40
    total_rows = num_users * interactions_per_user

    user_ids = np.repeat(np.arange(1, num_users + 1), interactions_per_user)

    #sequential time
    base_time = pd.Timestamp("2013-01-01 00:00:00")
    start_times = [
        (base_time + pd.Timedelta(minutes=int(i) + int(uid) * 60)).strftime("%Y-%m-%d %H:%M:%S")
        for uid, i in zip(user_ids, np.tile(np.arange(interactions_per_user), num_users))
    ]

    correct = np.random.choice([0, 1], size=total_rows, p=[0.33, 0.67])
    attempt_count = np.random.choice([1, 2, 3, 4], size=total_rows, p=[0.7, 0.15, 0.1, 0.05])
    ms_first_response = np.random.exponential(scale=15000.0, size=total_rows) + 500.0

    df = pd.DataFrame({
        "user_id": user_ids,
        "start_time": start_times,
        "correct": correct,
        "attempt_count": attempt_count,
        "ms_first_response": ms_first_response
    })

    #adding noise or bad formats to test cleaning
    df["correct"] = df["correct"].astype(object)
    df.loc[10:20, "correct"] = "unknown"
    df.loc[30:35, "attempt_count"] = np.nan

    df.to_csv(DATA_FILE, index=False)
    print(f"Mock dataset written to {DATA_FILE} ({len(df)} rows).")


def run_pipeline():
    print("Modifying config parameters for fast test run...")
    import src.config as config
    config.SAMPLE_SIZE = 15000
    config.EPOCHS = 1  # 1 epoch for quick test
    config.BATCH_SIZE = 128

    #run main
    from src.train_pipeline import main
    import src.optuna_tuning as optuna_tuning
    import src.data_preprocessing as dp
    import src.train_pipeline as tp

    #for verification sequence integrity
    dp.sample_data = lambda df, sample_size, random_state: df.head(sample_size)
    tp.sample_data = lambda df, sample_size, random_state: df.head(sample_size)


    original_run_optuna = optuna_tuning.run_optuna_search

    def fast_run_optuna_search(X_train_tensor, y_train_tensor, n_trials=2):
        return original_run_optuna(X_train_tensor, y_train_tensor, n_trials=2)

    optuna_tuning.run_optuna_search = fast_run_optuna_search

    print("Executing training pipeline...")
    main()
    print("Pipeline executed successfully!")


if __name__ == "__main__":
    generate_mock_data()
    run_pipeline()
