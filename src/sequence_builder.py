import numpy as np
import pandas as pd
from src.config import WINDOW_SIZE, FUTURE_SIZE


def compute_risk_score(future_window, global_response_time_median):
    future_correct = future_window["correct"].values
    future_attempts = future_window["attempt_count"].values
    future_response_time = future_window["ms_first_response"].values

    wrong_rate = np.mean(future_correct == 0)

    attempt_burden = np.mean(future_attempts)
    attempt_burden = min(attempt_burden / 3, 1.0)

    response_delay = np.mean(future_response_time)
    response_delay = min(response_delay / global_response_time_median, 3.0) / 3.0

    risk_score = (
        0.60 * wrong_rate +
        0.25 * attempt_burden +
        0.15 * response_delay
    )

    return risk_score


def build_sequences_multiclass_quantile(df, window_size=WINDOW_SIZE, future_size=FUTURE_SIZE):
    X_sequences = []
    risk_scores = []

    global_response_time_median = df["ms_first_response"].median()

    for user_id, group in df.groupby("user_id"):
        group = group.sort_values("start_time")

        if len(group) < window_size + future_size:
            continue

        for i in range(len(group) - window_size - future_size):
            past_window = group.iloc[i:i + window_size]
            future_window = group.iloc[i + window_size:i + window_size + future_size]

            seq = past_window[
                ["ms_first_response", "attempt_count", "correct"]
            ].values

            response_time = seq[:, 0]
            attempts = seq[:, 1]
            correct = seq[:, 2]

            correct_diff = np.diff(correct, prepend=correct[0])
            attempt_diff = np.diff(attempts, prepend=attempts[0])

            rolling_correctness = past_window["correct"].rolling(
                3, min_periods=1
            ).mean().values

            rolling_attempts = past_window["attempt_count"].rolling(
                3, min_periods=1
            ).mean().values

            #handle possible zero division in rolling mean of relative_time if mean is 0
            mean_rt = past_window["ms_first_response"].mean()
            if mean_rt == 0:
                relative_time = np.ones(window_size)
            else:
                relative_time = (past_window["ms_first_response"] / mean_rt).values

            correct_std = np.full(window_size, np.std(correct))
            time_std = np.full(window_size, np.std(response_time))
            attempt_std = np.full(window_size, np.std(attempts))

            decay_rate = 0.2
            distances = np.arange(window_size - 1, -1, -1)
            temporal_decay = np.exp(-decay_rate * distances)

            new_seq = np.column_stack([
                response_time,
                attempts,
                correct,
                correct_diff,
                attempt_diff,
                rolling_correctness,
                rolling_attempts,
                relative_time,
                correct_std,
                time_std,
                attempt_std,
                temporal_decay
            ])

            risk_score = compute_risk_score(
                future_window,
                global_response_time_median
            )

            X_sequences.append(new_seq)
            risk_scores.append(risk_score)

    X_seq = np.array(X_sequences, dtype=np.float32)
    risk_scores = np.array(risk_scores, dtype=np.float32)

    if len(risk_scores) == 0:
        return X_seq, np.array([], dtype=np.int64), risk_scores

    low_cutoff = np.quantile(risk_scores, 0.33)
    high_cutoff = np.quantile(risk_scores, 0.66)

    y_labels = []

    for score in risk_scores:
        if score <= low_cutoff:
            label = 0
        elif score <= high_cutoff:
            label = 1
        else:
            label = 2

        y_labels.append(label)

    y_seq = np.array(y_labels, dtype=np.int64)

    print("Risk score cutoffs:")
    print("Low / Medium cutoff:", low_cutoff)
    print("Medium / High cutoff:", high_cutoff)

    return X_seq, y_seq, risk_scores