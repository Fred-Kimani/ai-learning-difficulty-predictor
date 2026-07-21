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
            raw_predicted_class = torch.argmax(probs, dim=1).item()

        predicted_class = raw_predicted_class  # may be overridden below

        # ── Key stats ─────────────────────────────────────────────────────
        overall_correct = df_window['correct'].mean()
        recent_correct = df_window['correct'].tail(3).mean()
        recent_attempts = df_window['attempt_count'].tail(3).mean()
        time_variance = df_window['ms_first_response'].tail(3).std()
        avg_time = df_window['ms_first_response'].mean()
        max_confidence = probs[0].max().item()
        student_is_strong = overall_correct >= 0.7

        # Track which guardrails fire (for logging / debug endpoint)
        guardrails_fired = []

        # ── Input data guardrail: response-time outlier warning ───────────
        # Flag sequences with extreme response times (> 5 min = 300 000 ms)
        # which can heavily distort scaled features.
        OUTLIER_THRESHOLD_MS = 300_000
        max_response_time = df_window['ms_first_response'].max()
        has_time_outlier = bool(max_response_time > OUTLIER_THRESHOLD_MS)
        if has_time_outlier:
            guardrails_fired.append("response_time_outlier")

        # ── Prediction guardrails ─────────────────────────────────────────

        # Rule 1: High success rate override
        #   If ≥ 9/10 correct → never return High Risk.
        if overall_correct >= 0.9 and predicted_class == 2:
            predicted_class = 0 if probs[0, 0].item() > probs[0, 1].item() else 1
            guardrails_fired.append("high_success_override")

        # Rule 2: Low confidence override
        #   If max confidence < 0.45 AND success rate ≥ 0.7 → force Low Risk.
        if max_confidence < 0.45 and overall_correct >= 0.7:
            predicted_class = 0
            guardrails_fired.append("low_confidence_override")

        # Rule 3: Minimum confidence threshold
        #   If max confidence < 0.35 → honest "Uncertain" instead of forcing
        #   a risk class the model is basically guessing about.
        #   BUT suppress uncertainty when the student is clearly performing
        #   well — a correct/strong student shouldn't be flagged as uncertain.
        raw_uncertain = max_confidence < 0.35
        is_uncertain = raw_uncertain and overall_correct < 0.7 and recent_correct < 0.8
        if is_uncertain:
            guardrails_fired.append("uncertain_prediction")
        elif raw_uncertain and not is_uncertain:
            guardrails_fired.append("uncertain_suppressed_strong_student")

        # Rule 4: Attempt + correctness consistency
        #   High attempts + high correctness → prefer Medium over High.
        #   Prevents over-flagging effortful but successful students.
        if recent_attempts >= 2.0 and recent_correct >= 0.7 and predicted_class == 2:
            predicted_class = 1
            guardrails_fired.append("effort_correctness_consistency")

        # ── Explainability Reason Codes ───────────────────────────────────
        reasons = []

        # Guardrail: Force positive diagnostic when success rate is high
        if overall_correct >= 0.8:
            if overall_correct >= 0.9:
                reasons.append(
                    "Excellent work — getting almost everything right. "
                    "This student is clearly on track."
                )
            else:
                reasons.append(
                    "Strong performance overall — getting the majority of "
                    "questions right with a solid understanding."
                )
            guardrails_fired.append("forced_positive_diagnostic")
        else:
            # 1. Comprehension & Foundation
            if recent_correct <= 0.33:
                reasons.append(
                    "Seems to have hit a wall with the newest material. "
                    "A quick 1-on-1 review of this week's foundation "
                    "might help clear the roadblock."
                )
            elif recent_correct >= 0.8:
                reasons.append("Grasping recent concepts very clearly.")

            # 2. Effort & Frustration
            #    Only show "spinning their wheels" when actually struggling.
            if recent_attempts >= 2.0 and recent_correct < 0.7:
                reasons.append(
                    "They are putting in the effort, but spinning their "
                    "wheels on these problems. Might be stuck on a specific "
                    "misconception."
                )
            elif recent_attempts >= 2.0 and recent_correct >= 0.7:
                reasons.append(
                    "Putting in extra effort and it's paying off — multiple "
                    "attempts but ultimately getting the answers right."
                )

            # 3. Pacing & Cognitive Load
            if pd.notna(time_variance) and time_variance > (avg_time * 1.5):
                if student_is_strong:
                    reasons.append(
                        "Response times vary quite a bit, but they're still "
                        "landing on the right answers — likely just thinking "
                        "some problems through more carefully than others."
                    )
                else:
                    reasons.append(
                        "Pacing is very uneven right now — they might be "
                        "rushing through some questions and getting completely "
                        "stuck on others."
                    )

        # Contradictory language blocker:
        #   Never show warning/concern language when recent correctness ≥ 0.8.
        if recent_correct >= 0.8:
            reasons = [
                r for r in reasons
                if not any(w in r.lower() for w in [
                    "wall", "struggling", "spinning", "stuck",
                    "roadblock", "rushing", "concern"
                ])
            ]
            if "contradictory_language_blocked" not in guardrails_fired:
                guardrails_fired.append("contradictory_language_blocked")

        # Response time outlier note
        if has_time_outlier:
            reasons.append(
                "Note: This sequence contains response times over 5 minutes, "
                "which may indicate the student stepped away — treat timing "
                "insights with some caution."
            )

        # Steady State Fallback
        if not reasons:
            reasons.append(
                "Cruising along nicely. No immediate interventions "
                "needed right now."
            )

        # ── Attention highlight post-processing ──────────────────────────
        raw_focus = int(torch.argmax(attention[0]).item())  # 0-indexed
        focus_timestep = raw_focus + 1  # 1-indexed for display

        # Attention peak sanity check:
        # If the peak step is correct AND response time < average → de-emphasize.
        attention_note = None
        suppress_attention_peak = False
        row_at_focus = df_window.iloc[raw_focus]
        if row_at_focus['correct'] == 1 and row_at_focus['ms_first_response'] < avg_time:
            suppress_attention_peak = True
            attention_note = (
                "The model's attention peaks at this step, but the student "
                "answered correctly and quickly here — no specific concern."
            )
            guardrails_fired.append("attention_peak_softened")

        # ── Build the final risk label ────────────────────────────────────
        if is_uncertain:
            display_risk = "Uncertain"
        else:
            display_risk = self.risk_labels[predicted_class]

        # ── Log overridden predictions ────────────────────────────────────
        if guardrails_fired:
            import logging
            logger = logging.getLogger("api")
            logger.info(
                "Guardrails fired: %s | Raw: %s (%.1f%%) → Final: %s | "
                "Correct: %.0f%% | Confidence: %.1f%%",
                ", ".join(guardrails_fired),
                self.risk_labels[raw_predicted_class],
                probs[0, raw_predicted_class].item() * 100,
                display_risk,
                overall_correct * 100,
                max_confidence * 100,
            )

        result = {
            "predicted_risk_class": display_risk,
            "confidence_scores": {
                "low_risk": round(probs[0, 0].item(), 4),
                "medium_risk": round(probs[0, 1].item(), 4),
                "high_risk": round(probs[0, 2].item(), 4)
            },
            "attention_focus_timestep": focus_timestep,
            "suppress_attention_peak": suppress_attention_peak,
            "diagnostic_reasons": reasons,
            "is_uncertain": is_uncertain,
            "guardrails_applied": guardrails_fired,
        }
        if attention_note:
            result["attention_note"] = attention_note

        return result