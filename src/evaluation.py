import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support


def get_struggling_probabilities(
    model: torch.nn.Module,
    X_test_tensor: torch.Tensor,
) -> torch.Tensor:
    model.eval()

    with torch.no_grad():
        outputs = model(X_test_tensor)
        probabilities = F.softmax(outputs, dim=1)
        struggling_probs = probabilities[:, 1]

    return struggling_probs


def evaluate_at_threshold(
    struggling_probs: torch.Tensor,
    y_test_tensor: torch.Tensor,
    threshold: float,
) -> torch.Tensor:
    predictions = (struggling_probs >= threshold).long()

    print("\n" + "=" * 60)
    print(f"Threshold: {threshold}")
    print(classification_report(y_test_tensor.numpy(), predictions.numpy()))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test_tensor.numpy(), predictions.numpy()))

    return predictions


def evaluate_thresholds(
    model: torch.nn.Module,
    X_test_tensor: torch.Tensor,
    y_test_tensor: torch.Tensor,
    thresholds: list[float],
) -> torch.Tensor:
    struggling_probs = get_struggling_probabilities(model, X_test_tensor)

    for threshold in thresholds:
        evaluate_at_threshold(
            struggling_probs=struggling_probs,
            y_test_tensor=y_test_tensor,
            threshold=threshold,
        )

    return struggling_probs


def summarize_threshold_results(
    struggling_probs: torch.Tensor,
    y_test_tensor: torch.Tensor,
    thresholds: list[float],
) -> list[dict]:
    results = []

    y_true = y_test_tensor.numpy()

    for threshold in thresholds:
        predictions = (struggling_probs >= threshold).long().numpy()

        precision, recall, f1, _ = precision_recall_fscore_support(
            y_true,
            predictions,
            average="binary",
            zero_division=0,
        )

        results.append(
            {
                "threshold": threshold,
                "precision": precision,
                "recall": recall,
                "f1": f1,
            }
        )

    return results


def inspect_false_cases(
    X_test: np.ndarray,
    y_test_tensor: torch.Tensor,
    predictions: torch.Tensor,
) -> None:
    y_true = y_test_tensor.numpy()
    y_pred = predictions.numpy()

    false_negative_indices = np.where((y_true == 1) & (y_pred == 0))[0]
    false_positive_indices = np.where((y_true == 0) & (y_pred == 1))[0]

    if len(false_negative_indices) > 0:
        i = false_negative_indices[0]
        print("\nFalse Negative Example: actual struggling, model missed it")
        print(X_test[i])
    else:
        print("\nNo false negatives found.")

    if len(false_positive_indices) > 0:
        i = false_positive_indices[0]
        print("\nFalse Positive Example: actual not struggling, model raised alert")
        print(X_test[i])
    else:
        print("\nNo false positives found.")