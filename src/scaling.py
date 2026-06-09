import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
from src.config import CORRECT_FEATURE_INDEX


def normalize_sequence_features(X_seq, skip_indices=[CORRECT_FEATURE_INDEX]):
    X_seq = X_seq.astype(np.float32)

    num_samples, seq_len, num_features = X_seq.shape
    X_reshaped = X_seq.reshape(-1, num_features)

    scalers = {}

    for feature_idx in range(num_features):
        if feature_idx in skip_indices:
            continue

        scaler = StandardScaler()
        X_reshaped[:, feature_idx] = scaler.fit_transform(
            X_reshaped[:, feature_idx].reshape(-1, 1)
        ).flatten()

        scalers[feature_idx] = scaler

    X_scaled = X_reshaped.reshape(num_samples, seq_len, num_features)

    #print("Saving sequence scalers to disk...")
    #joblib.dump(scalers, "sequence_scalers.pkl")

    return X_scaled, scalers


def scale_with_existing_scalers(X_seq, scalers, skip_indices=[CORRECT_FEATURE_INDEX]):
    """
    Scale features using already fitted scalers.
    """
    X_seq = X_seq.astype(np.float32)

    num_samples, seq_len, num_features = X_seq.shape
    X_reshaped = X_seq.reshape(-1, num_features)

    for feature_idx in range(num_features):
        if feature_idx in skip_indices:
            continue

        if feature_idx in scalers:
            scaler = scalers[feature_idx]
            X_reshaped[:, feature_idx] = scaler.transform(
                X_reshaped[:, feature_idx].reshape(-1, 1)
            ).flatten()

    X_scaled = X_reshaped.reshape(num_samples, seq_len, num_features)

    return X_scaled