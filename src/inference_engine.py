import torch
import joblib
import numpy as np
import pandas as pd
import torch.nn.functional as F
from pathlib import Path

from src.model import LSTMWithAttention
from src.config import INFERENCE_ATTENTION_LSTM_PATH, INFERENCE_SCALER_PATH

class RiskPredictor:
    def __init__(self):
        print("Initializing Inference Engine...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        #Load MLOps Artifacts
        scaler_path = INFERENCE_SCALER_PATH
        weights_path = INFERENCE_ATTENTION_LSTM_PATH
        
        self.scalers = joblib.load(scaler_path)
        
        #Instantiate/load the Neural Network
        self.model = LSTMWithAttention(input_size=12, hidden_size=64, num_classes=3)
        self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()

        self.risk_labels = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk"}

    def _preprocess_live_window(self, df_window: pd.DataFrame) -> torch.Tensor:
        """Transforms a live 10-row dataframe into our 12-feature tensor."""
        window_size = len(df_window)
        
        #Extract base features
        base_sequence = df_window[["ms_first_response", "attempt_count", "correct"]].values
        response_time = base_sequence[:, 0]
        attempts = base_sequence[:, 1]
        correctness = base_sequence[:, 2]

        #Calculate deltas and rolling stats
        correct_diff = np.diff(correctness, prepend=correctness[0])
        attempt_diff = np.diff(attempts, prepend=attempts[0])
        rolling_correctness = df_window["correct"].rolling(3, min_periods=1).mean().values
        rolling_attempts = df_window["attempt_count"].rolling(3, min_periods=1).mean().values
        
        mean_time = response_time.mean()
        relative_time = np.ones(window_size) if mean_time == 0 else response_time / mean_time
        
        correct_std = np.full(window_size, np.std(correctness))
        time_std = np.full(window_size, np.std(response_time))
        attempt_std = np.full(window_size, np.std(attempts))

        #Explicit Temporal Decay
        decay_rate = 0.2
        distances = np.arange(window_size - 1, -1, -1)
        temporal_decay = np.exp(-decay_rate * distances)

        #Stack into 11 features. excluding the decay temporarily for scaling
        raw_features = np.column_stack([
            response_time, attempts, correctness, correct_diff, attempt_diff,
            rolling_correctness, rolling_attempts, relative_time,
            correct_std, time_std, attempt_std
        ])

        #Apply the saved scalers 
        for idx in range(11):
            if idx == 2: continue
            raw_features[:, idx] = self.scalers[idx].transform(raw_features[:, idx].reshape(-1, 1)).flatten()

        #Append Temporal Decay after scaling
        final_sequence = np.column_stack([raw_features, temporal_decay])
        
        #Reshape for PyTorch
        final_tensor = torch.tensor(final_sequence, dtype=torch.float32).unsqueeze(0)
        return final_tensor.to(self.device)

    def predict(self, df_window: pd.DataFrame) -> dict:
        """Runs the prediction and translates the math into a teacher-friendly JSON."""
        tensor_input = self._preprocess_live_window(df_window)
        
        with torch.no_grad():
            outputs, attention = self.model(tensor_input, return_attention=True)
            probs = F.softmax(outputs, dim=1)
            predicted_class = torch.argmax(probs, dim=1).item()

        #Explainability Reason Codes
        recent_correct = df_window['correct'].tail(3).mean()
        recent_attempts = df_window['attempt_count'].tail(3).mean()
        
        reasons = []
        if recent_correct < 0.5: reasons.append("Consistently failing recent concepts.")
        if recent_attempts > 1.5: reasons.append("Requiring excessive attempts to solve.")
        if not reasons: reasons.append("Maintaining steady progress.")

        return {
            "predicted_risk_class": self.risk_labels[predicted_class],
            "confidence_scores": {
                "low_risk": round(probs[0, 0].item(), 4),
                "medium_risk": round(probs[0, 1].item(), 4),
                "high_risk": round(probs[0, 2].item(), 4)
            },
            "attention_focus_timestep": int(torch.argmax(attention[0]).item() + 1),
            "diagnostic_reasons": reasons
        }