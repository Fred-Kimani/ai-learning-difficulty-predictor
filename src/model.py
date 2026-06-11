import torch
import torch.nn as nn

class LSTMWithAttention(nn.Module):
    def __init__(self, input_size=12, hidden_size=64, num_classes=3):
        super().__init__()
        #optuna parameters
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            batch_first=True,
            num_layers=1,
            dropout=0.0 
        )
        self.attention = nn.Linear(hidden_size, 1)
        self.fc = nn.Linear(hidden_size, num_classes)

    def forward(self, x, return_attention=False):
        lstm_out, _ = self.lstm(x)
        attention_scores = self.attention(lstm_out)
        attention_weights = torch.softmax(attention_scores, dim=1)
        context = torch.sum(attention_weights * lstm_out, dim=1)
        output = self.fc(context)

        if return_attention:
            return output, attention_weights
        return output