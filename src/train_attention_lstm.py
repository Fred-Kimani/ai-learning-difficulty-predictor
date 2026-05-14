import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader

from src.attention_lstm_model import LSTMWithAttention
from src.config import BATCH_SIZE, EPOCHS, LEARNING_RATE, HIDDEN_SIZE, NUM_CLASSES


def arrays_to_tensors(
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train: np.ndarray,
    y_test: np.ndarray,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    X_train_tensor = torch.tensor(X_train, dtype=torch.float32)
    X_test_tensor = torch.tensor(X_test, dtype=torch.float32)

    y_train_tensor = torch.tensor(y_train, dtype=torch.long)
    y_test_tensor = torch.tensor(y_test, dtype=torch.long)

    return X_train_tensor, X_test_tensor, y_train_tensor, y_test_tensor


def create_class_weighted_loss(y_train: np.ndarray) -> nn.CrossEntropyLoss:
    class_counts = np.bincount(y_train)

    if len(class_counts) < 2:
        raise ValueError("Both classes must exist in y_train.")

    class_weights = len(y_train) / (2 * class_counts)
    weights = torch.tensor(class_weights, dtype=torch.float32)

    return nn.CrossEntropyLoss(weight=weights)


def train_attention_lstm(
    X_train: np.ndarray,
    y_train: np.ndarray,
    input_size: int,
    hidden_size: int = HIDDEN_SIZE,
    num_classes: int = NUM_CLASSES,
    batch_size: int = BATCH_SIZE,
    epochs: int = EPOCHS,
    learning_rate: float = LEARNING_RATE,
) -> LSTMWithAttention:
    X_train_tensor = torch.tensor(X_train, dtype=torch.float32)
    y_train_tensor = torch.tensor(y_train, dtype=torch.long)

    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
    )

    model = LSTMWithAttention(
        input_size=input_size,
        hidden_size=hidden_size,
        num_classes=num_classes,
    )

    criterion = create_class_weighted_loss(y_train)
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0

        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()

            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)

            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        average_loss = total_loss / len(train_loader)

        print(f"Epoch {epoch + 1}/{epochs}, Loss: {average_loss:.4f}")

    return model