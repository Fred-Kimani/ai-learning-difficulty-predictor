import numpy as np
from sklearn.preprocessing import StandardScaler

from src.config import CORRECT_FEATURE_INDEX


def scale_sequence_features(
    X_train: np.ndarray,
    X_test: np.ndarray,
    correct_feature_index: int = CORRECT_FEATURE_INDEX,
) -> tuple[np.ndarray, np.ndarray, dict[int, StandardScaler]]:
    X_train_scaled = X_train.copy().astype("float32")
    X_test_scaled = X_test.copy().astype("float32")

    num_features = X_train_scaled.shape[2]
    scalers = {}

    for feature_index in range(num_features):
        if feature_index == correct_feature_index:
            continue

        scaler = StandardScaler()

        train_values = X_train_scaled[:, :, feature_index].reshape(-1, 1)
        test_values = X_test_scaled[:, :, feature_index].reshape(-1, 1)

        X_train_scaled[:, :, feature_index] = scaler.fit_transform(
            train_values
        ).reshape(X_train_scaled.shape[0], X_train_scaled.shape[1])

        X_test_scaled[:, :, feature_index] = scaler.transform(
            test_values
        ).reshape(X_test_scaled.shape[0], X_test_scaled.shape[1])

        scalers[feature_index] = scaler

    return X_train_scaled, X_test_scaled, scalers