import optuna
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.metrics import f1_score
from src.config import DEVICE


def run_optuna_search(X_train_tensor, y_train_tensor, n_trials=15):
    input_size = X_train_tensor.shape[2]

    def objective(trial):
        #Define the search space
        hidden_size = trial.suggest_categorical("hidden_size", [32, 64, 128])
        lr = trial.suggest_float("lr", 1e-4, 1e-2, log=True)
        dropout_rate = trial.suggest_float("dropout", 0.1, 0.5)

        num_layers = trial.suggest_int("num_layers", 1, 2)

        if num_layers > 1:
            dropout_rate = trial.suggest_float("dropout", 0.1, 0.5)
        else:
            dropout_rate = 0.0

        #Build model with trial parameters
        class TuningLSTM(nn.Module):
            def __init__(self):
                super().__init__()
                self.lstm = nn.LSTM(
                    input_size,
                    hidden_size,
                    batch_first=True,
                    dropout=dropout_rate if hidden_size > 32 else 0
                )
                self.attention = nn.Linear(hidden_size, 1)
                self.fc = nn.Linear(hidden_size, 3)

            def forward(self, x):
                lstm_out, _ = self.lstm(x)
                attn_scores = self.attention(lstm_out)
                attn_weights = torch.softmax(attn_scores, dim=1)
                context = torch.sum(attn_weights * lstm_out, dim=1)
                return self.fc(context)

        model = TuningLSTM().to(DEVICE)
        optimizer = optim.Adam(model.parameters(), lr=lr)
        criterion = nn.CrossEntropyLoss()


        dataset = torch.utils.data.TensorDataset(X_train_tensor, y_train_tensor)
        # Split train into train/val for tuning
        train_size = int(0.8 * len(dataset))
        val_size = len(dataset) - train_size
        train_ds, val_ds = torch.utils.data.random_split(dataset, [train_size, val_size])

        train_loader = torch.utils.data.DataLoader(train_ds, batch_size=64, shuffle=True)
        val_loader = torch.utils.data.DataLoader(val_ds, batch_size=64)

        #Short training loop
        for epoch in range(5):
            model.train()
            for batch_x, batch_y in train_loader:
                optimizer.zero_grad()
                out = model(batch_x)
                loss = criterion(out, batch_y)
                loss.backward()
                optimizer.step()

        #F1
        model.eval()
        all_preds, all_labels = [], []
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                out = model(batch_x)
                preds = torch.argmax(out, dim=1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(batch_y.cpu().numpy())

        val_f1 = f1_score(all_labels, all_preds, average='macro')

        return val_f1

    print(f"Starting Optuna Hyperparameter Search ({n_trials} trials)...")
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials)

    print("\nBest Trial:")
    print("  Value (Macro F1): ", study.best_trial.value)
    print("  Params: ")
    for key, value in study.best_trial.params.items():
        print(f"    {key}: {value}")

    return study
