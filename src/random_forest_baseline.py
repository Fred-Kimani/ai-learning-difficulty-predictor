import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
import joblib


def build_random_forest_features(X_seq):
    features = []

    for seq in X_seq:
        avg_time = np.mean(seq[:, 0])
        avg_attempts = np.mean(seq[:, 1])
        avg_correct = np.mean(seq[:, 2])
        max_attempts = np.max(seq[:, 1])
        time_std = np.std(seq[:, 0])
        correct_std = np.std(seq[:, 2])
        attempt_std = np.std(seq[:, 1])

        features.append([
            avg_time,
            avg_attempts,
            avg_correct,
            max_attempts,
            time_std,
            correct_std,
            attempt_std
        ])

    return np.array(features, dtype=np.float32)


X_rf = build_random_forest_features(X_scaled)

X_rf_train, X_rf_test, y_rf_train, y_rf_test = train_test_split(
    X_rf,
    y_seq,
    test_size=0.2,
    stratify=y_seq,
    random_state=RANDOM_STATE
)

rf_model = RandomForestClassifier(
    n_estimators=100,
    random_state=RANDOM_STATE,
    class_weight=None
)

rf_model.fit(X_rf_train, y_rf_train)

rf_predictions = rf_model.predict(X_rf_test)
print("Saving Random Forest baseline to disk...")
joblib.dump(rf_model, "rf_baseline.pkl")

print("Random Forest Baseline evaluation")
print(classification_report(y_rf_test, rf_predictions))
print(confusion_matrix(y_rf_test, rf_predictions))