import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix


def create_random_forest_features(X: np.ndarray) -> np.ndarray:
    response_time = X[:, :, 0]
    attempts = X[:, :, 1]
    correctness = X[:, :, 2]
    correct_diff = X[:, :, 3]
    attempt_diff = X[:, :, 4]
    rolling_correctness = X[:, :, 5]
    rolling_attempts = X[:, :, 6]
    relative_time = X[:, :, 7]

    features = np.column_stack(
        [
            response_time.mean(axis=1),
            response_time.std(axis=1),
            response_time.max(axis=1),
            attempts.mean(axis=1),
            attempts.max(axis=1),
            correctness.mean(axis=1),
            correctness[:, -3:].mean(axis=1),
            correct_diff.mean(axis=1),
            attempt_diff.mean(axis=1),
            rolling_correctness[:, -1],
            rolling_attempts[:, -1],
            relative_time.mean(axis=1),
        ]
    )

    return features


def train_random_forest_baseline(
    X_train: np.ndarray,
    y_train: np.ndarray,
    random_state: int = 42,
) -> RandomForestClassifier:
    X_train_rf = create_random_forest_features(X_train)

    model = RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced",
        random_state=random_state,
    )

    model.fit(X_train_rf, y_train)

    return model


def evaluate_random_forest_baseline(
    model: RandomForestClassifier,
    X_test: np.ndarray,
    y_test: np.ndarray,
) -> None:
    X_test_rf = create_random_forest_features(X_test)

    predictions = model.predict(X_test_rf)

    print("\nRandom Forest Baseline")
    print("=" * 60)
    print(classification_report(y_test, predictions))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, predictions))