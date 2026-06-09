import numpy as np
import torch
import torch.nn.functional as F
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score
)
from src.config import PROJECT_ROOT


def evaluate_multiclass(model, X_test_tensor, y_test_tensor, model_name="Model", has_attention=False, save_plots=True):
    model.eval()

    with torch.no_grad():
        if has_attention:
            outputs, attention_weights = model(X_test_tensor, return_attention=True)
        else:
            outputs = model(X_test_tensor)

        probs = F.softmax(outputs, dim=1)
        predictions = torch.argmax(probs, dim=1)

    y_true = y_test_tensor.cpu().numpy()
    y_pred = predictions.cpu().numpy()

    target_names = ["Low Risk", "Medium Risk", "High Risk"]

    print("\n" + "=" * 60)
    print(f"{model_name} Evaluation")
    print("=" * 60)

    print("\nClassification Report:")
    print(classification_report(y_true, y_pred, target_names=target_names))

    cm = confusion_matrix(y_true, y_pred)
    print("\nConfusion Matrix:")
    print(cm)

    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=target_names)
    disp.plot(values_format="d")
    plt.title(f"{model_name} Confusion Matrix")
    plt.tight_layout()
    if save_plots:
        plt.savefig(PROJECT_ROOT / "reports" / f"{model_name.lower().replace(' ', '_')}_confusion_matrix.png")
        plt.close()
    else:
        plt.show()

    return predictions, probs


def get_experiment_metrics(model, X_test, y_test, has_attention=False):
    model.eval()
    with torch.no_grad():
        if has_attention:
            outputs, _ = model(X_test, return_attention=True)
        else:
            outputs = model(X_test)
        preds = torch.argmax(F.softmax(outputs, dim=1), dim=1)

    y_true = y_test.cpu().numpy()
    y_pred = preds.cpu().numpy()

    return {
        "Accuracy": accuracy_score(y_true, y_pred),
        "Macro Precision": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "Macro Recall": recall_score(y_true, y_pred, average="macro", zero_division=0),
        "Macro F1": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "High Risk Recall": recall_score(y_true, y_pred, labels=[2], average=None, zero_division=0)[0]
    }


def analyze_attention_distribution(model, X_test_tensor, y_test_tensor, save_plots=True):
    model.eval()

    # 1. Extract all attention weights
    with torch.no_grad():
        _, attention_weights = model(X_test_tensor, return_attention=True)

    # attention_weights shape: (batch_size, window_size, 1) or (batch_size, window_size)
    if attention_weights.dim() == 3:
        weights_np = attention_weights.squeeze(-1).cpu().numpy()
    else:
        weights_np = attention_weights.cpu().numpy()

    y_true_np = y_test_tensor.cpu().numpy()

    window_size = weights_np.shape[1]
    positions = np.arange(1, window_size + 1)

    # 2. Global Average Attention
    global_avg_weights = np.mean(weights_np, axis=0)

    # 3. Class-Specific Average Attention
    class_weights = {}
    class_names = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk"}

    for class_idx, class_name in class_names.items():
        mask = (y_true_np == class_idx)
        if np.any(mask):
            class_weights[class_name] = np.mean(weights_np[mask], axis=0)
        else:
            class_weights[class_name] = np.zeros(window_size)

    # Visualization
    fig, axes = plt.subplots(1, 2, figsize=(16, 6))

    # Plot A: Average Attention Line Plot across Classes
    for class_name, weights in class_weights.items():
        axes[0].plot(positions, weights, marker='o', label=class_name, linewidth=2)

    axes[0].plot(positions, global_avg_weights, linestyle='--', color='black', label="Global Average", linewidth=2)
    axes[0].set_title("Average Attention Weights by Timestep & Class", fontsize=14)
    axes[0].set_xlabel("Timestep (1 = Oldest, 10 = Most Recent)", fontsize=12)
    axes[0].set_ylabel("Attention Weight", fontsize=12)
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    # Plot B: Heatmap of first 50 students (Sample distribution)
    sample_size = min(50, weights_np.shape[0])
    sns.heatmap(weights_np[:sample_size], cmap="viridis", ax=axes[1], cbar_kws={'label': 'Attention Weight'})
    axes[1].set_title(f"Attention Heatmap (Sample of {sample_size} sequences)", fontsize=14)
    axes[1].set_xlabel("Timestep", fontsize=12)
    axes[1].set_ylabel("Student Sequence ID", fontsize=12)
    axes[1].set_xticks(positions - 0.5)
    axes[1].set_xticklabels(positions)

    plt.tight_layout()
    if save_plots:
        plt.savefig(PROJECT_ROOT / "reports" / "attention_distribution.png")
        plt.close()
    else:
        plt.show()

    return global_avg_weights, class_weights