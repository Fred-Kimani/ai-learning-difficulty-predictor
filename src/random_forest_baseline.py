import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_curve,
    auc,
    precision_recall_curve,
    average_precision_score,
    roc_auc_score
)
from sklearn.preprocessing import label_binarize
from src.config import RANDOM_STATE, RF_FEATURE_NAMES, MODEL_DIR, PROJECT_ROOT


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


def train_random_forest_baseline(X_train, y_train):
    rf_model = RandomForestClassifier(
        n_estimators=100,
        random_state=RANDOM_STATE,
        class_weight=None
    )
    rf_model.fit(X_train, y_train)
    return rf_model


def evaluate_random_forest_baseline(rf_model, X_test, y_test, save_plots=True):
    rf_predictions = rf_model.predict(X_test)
    rf_probabilities = rf_model.predict_proba(X_test)

    print("RANDOM FOREST BASELINE EVALUATION")
    print("\nClassification Report:")
    print(classification_report(y_test, rf_predictions))

    cm = confusion_matrix(y_test, rf_predictions)
    print("\nConfusion Matrix:")
    print(cm)

    # Feature Importance Plot
    importances = rf_model.feature_importances_
    sorted_indices = np.argsort(importances)

    plt.figure(figsize=(8, 5))
    plt.barh(
        np.array(RF_FEATURE_NAMES)[sorted_indices],
        importances[sorted_indices]
    )
    plt.xlabel("Importance Score")
    plt.title("Random Forest Feature Importance")
    if save_plots:
        plt.savefig(PROJECT_ROOT / "reports" / "rf_feature_importance.png")
        plt.close()
    else:
        plt.show()

    # Confusion Matrix Heatmap
    plt.figure(figsize=(6, 5))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Low Risk", "Medium Risk", "High Risk"],
        yticklabels=["Low Risk", "Medium Risk", "High Risk"]
    )
    plt.title("Random Forest Confusion Matrix")
    plt.xlabel("Predicted Label")
    plt.ylabel("True Label")
    if save_plots:
        plt.savefig(PROJECT_ROOT / "reports" / "rf_confusion_matrix.png")
        plt.close()
    else:
        plt.show()

    # Multiclass ROC Curve
    classes = [0, 1, 2]
    y_test_binarized = label_binarize(y_test, classes=classes)
    class_names = ["Low Risk", "Medium Risk", "High Risk"]

    plt.figure(figsize=(7, 5))
    for i, class_name in enumerate(class_names):
        fpr, tpr, _ = roc_curve(
            y_test_binarized[:, i],
            rf_probabilities[:, i]
        )
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, label=f"{class_name} AUC = {roc_auc:.3f}")

    plt.plot([0, 1], [0, 1], linestyle="--")
    plt.title("Random Forest Multiclass ROC Curve")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.legend()
    plt.tight_layout()
    if save_plots:
        plt.savefig(PROJECT_ROOT / "reports" / "rf_roc_curve.png")
        plt.close()
    else:
        plt.show()

    macro_auc = roc_auc_score(
        y_test_binarized,
        rf_probabilities,
        average="macro",
        multi_class="ovr"
    )
    print(f"Macro ROC AUC: {macro_auc:.4f}")

    # Multiclass PR Curve
    plt.figure(figsize=(7, 5))
    for i, class_name in enumerate(class_names):
        precision, recall, _ = precision_recall_curve(
            y_test_binarized[:, i],
            rf_probabilities[:, i]
        )
        avg_precision = average_precision_score(
            y_test_binarized[:, i],
            rf_probabilities[:, i]
        )
        plt.plot(
            recall,
            precision,
            label=f"{class_name} AP = {avg_precision:.3f}"
        )

    plt.title("Random Forest Multiclass Precision-Recall Curve")
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.legend()
    plt.tight_layout()
    if save_plots:
        plt.savefig(PROJECT_ROOT / "reports" / "rf_precision_recall_curve.png")
        plt.close()
    else:
        plt.show()

    macro_ap = average_precision_score(
        y_test_binarized,
        rf_probabilities,
        average="macro"
    )
    print(f"Macro Average Precision: {macro_ap:.4f}")

    # Print raw importances
    for name, score in zip(RF_FEATURE_NAMES, importances):
        print(f"{name}: {score:.4f}")

    return rf_predictions, rf_probabilities