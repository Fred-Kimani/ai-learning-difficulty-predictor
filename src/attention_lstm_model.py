import torch
import torch.nn as nn


class LSTMWithAttention(nn.Module):
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 64,
        num_classes: int = 2,
    ):
        super().__init__()

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            batch_first=True,
        )

        self.attention = nn.Linear(hidden_size, 1)
        self.fc = nn.Linear(hidden_size, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        lstm_out, _ = self.lstm(x)

        attention_scores = self.attention(lstm_out)
        attention_weights = torch.softmax(attention_scores, dim=1)

        context = torch.sum(attention_weights * lstm_out, dim=1)

        output = self.fc(context)

        return output