#Explanability and Intervention functions
import torch
import torch.nn.functional as F
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

def evaluate_torch_model(model, X_test_tensor, y_test_tensor, has_attention=False):
    model.eval()

    with torch.no_grad():
        if has_attention:
            # Safely unpack the tuple for the attention model
            outputs, attention_weights = model(X_test_tensor, return_attention=True)
        else:
            # Handle the single tensor for the plain LSTM
            outputs = model(X_test_tensor)
            
        probs = F.softmax(outputs, dim=1)
        predictions = torch.argmax(probs, dim=1)

    y_true = y_test_tensor.cpu().numpy()
    y_pred = predictions.cpu().numpy()

    return {
        "Accuracy": accuracy_score(y_true, y_pred),
        "Macro Precision": precision_score(y_true, y_pred, average="macro", zero_division=0),
        "Macro Recall": recall_score(y_true, y_pred, average="macro", zero_division=0),
        "Macro F1": f1_score(y_true, y_pred, average="macro", zero_division=0),
        "Weighted F1": f1_score(y_true, y_pred, average="weighted", zero_division=0)
    }