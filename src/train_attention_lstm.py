import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from src.config import DEVICE, BATCH_SIZE, EPOCHS, LEARNING_RATE


def train_model(
    model,
    X_train_tensor,
    y_train_tensor,
    epochs=EPOCHS,
    batch_size=BATCH_SIZE,
    lr=LEARNING_RATE,
    use_class_weights=False,
    weight_strength=1.0
):
    model = model.to(DEVICE)

    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    if use_class_weights:
        class_counts = np.bincount(y_train_tensor.cpu().numpy())
        class_weights = len(y_train_tensor) / (len(class_counts) * class_counts)

        # soften weights if needed
        class_weights = class_weights ** weight_strength

        class_weights = torch.tensor(
            class_weights,
            dtype=torch.float32
        ).to(DEVICE)

        print("Using class weights:", class_weights)

        criterion = nn.CrossEntropyLoss(weight=class_weights)
    else:
        print("Using unweighted loss")
        criterion = nn.CrossEntropyLoss()

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    for epoch in range(epochs):
        model.train()
        total_loss = 0

        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()

            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)

            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        print(f"Epoch {epoch + 1}/{epochs}, Loss: {total_loss:.4f}")

    return model