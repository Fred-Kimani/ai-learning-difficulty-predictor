import numpy as np
import pandas as pd
import joblib
from sklearn.preprocessing import StandardScaler

from src.config import (
    WINDOW_SIZE,
    FUTURE_SIZE,
    STRUGGLE_WRONG_THRESHOLD,
    FEATURE_NAMES,
)

def build_sequences(
    df: pd.DataFrame,
    window_size: int = WINDOW_SIZE,
    future_size: int = FUTURE_SIZE,
    struggle_wrong_threshold: int = STRUGGLE_WRONG_THRESHOLD,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Transforms flat student interaction logs into chronological sliding windows.
    """
    X_sequences = []
    y_labels = []

    for user_id, group in df.groupby("user_id"):
        group = group.sort_values("start_time").reset_index(drop=True)

        if len(group) < window_size + future_size:
            continue

        for i in range(len(group) - window_size - future_size + 1):
            past_window = group.iloc[i : i + window_size]
            future_window = group.iloc[i + window_size : i + window_size + future_size]

            base_sequence = past_window[
                ["ms_first_response", "attempt_count", "correct"]
            ].values

            correctness = base_sequence[:, 2]
            attempts = base_sequence[:, 1]
            response_time = base_sequence[:, 0]

            correct_diff = np.diff(correctness, prepend=correctness[0])
            attempt_diff = np.diff(attempts, prepend=attempts[0])

            rolling_correctness = (
                past_window["correct"].rolling(3, min_periods=1).mean().values
            )
            rolling_attempts = (
                past_window["attempt_count"].rolling(3, min_periods=1).mean().values
            )

            mean_response_time = past_window["ms_first_response"].mean()
            if mean_response_time == 0:
                relative_time = np.ones(window_size)
            else:
                relative_time = (past_window["ms_first_response"] / mean_response_time).values

            correct_std = np.full(window_size, np.std(correctness))
            time_std = np.full(window_size, np.std(response_time))
            attempt_std = np.full(window_size, np.std(attempts))

            sequence = np.column_stack([
                response_time, attempts, correctness, correct_diff, attempt_diff,
                rolling_correctness, rolling_attempts, relative_time,
                correct_std, time_std, attempt_std,
            ])

            future_correct = future_window["correct"].values
            num_wrong = (future_correct == 0).sum()
            label = int(num_wrong >= struggle_wrong_threshold)

            X_sequences.append(sequence)
            y_labels.append(label)

    X_seq = np.array(X_sequences, dtype=np.float32)
    y_seq = np.array(y_labels, dtype=np.int64)

    return X_seq, y_seq


def normalize_sequence_features(X_seq: np.ndarray, skip_indices: list[int] = None) -> tuple[np.ndarray, dict]:
    """
    Normalizes continuous sequence features using StandardScaler and saves the state to disk.
    """
    if skip_indices is None:
        skip_indices = [2]  # Default to skipping the 'correctness' binary flag

    X_seq_scaled = X_seq.astype(np.float32).copy()
    num_samples, seq_len, num_features = X_seq_scaled.shape
    
    # Flatten to 2D to fit the scaler across all timesteps
    X_reshaped = X_seq_scaled.reshape(-1, num_features)
    scalers = {}

    for feature_idx in range(num_features):
        if feature_idx in skip_indices:
            continue

        scaler = StandardScaler()
        X_reshaped[:, feature_idx] = scaler.fit_transform(
            X_reshaped[:, feature_idx].reshape(-1, 1)
        ).flatten()

        scalers[feature_idx] = scaler

    # Reshape back to 3D sequence format
    X_scaled = X_reshaped.reshape(num_samples, seq_len, num_features)

    # Save the MLOps state inside the correct scope!
    print("Saving sequence scalers to disk for FastAPI inference...")
    joblib.dump(scalers, "sequence_scalers.pkl")

    return X_scaled, scalers


def print_sequence_summary(X_seq: np.ndarray, y_seq: np.ndarray) -> None:
    """Prints diagnostic information about the generated sequence tensors."""
    print("Sequence tensor shape:", X_seq.shape)
    print("Labels shape:", y_seq.shape)
    print("Feature count:", X_seq.shape[2])
    try:
        print("Feature names:", FEATURE_NAMES)
    except NameError:
        pass # Handle case where FEATURE_NAMES isn't imported correctly
    print("Label counts:", np.bincount(y_seq))
    print("Label distribution:", np.bincount(y_seq) / len(y_seq))