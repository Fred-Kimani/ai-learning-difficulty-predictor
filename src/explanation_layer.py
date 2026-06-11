import numpy as np
import torch
import torch.nn.functional as F

RISK_LABELS = {0: "low", 1: "medium", 2: "high"}
RISK_TEXT = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk"}
REASON_TEXT = {
    "LOW_CORRECTNESS": "Student's recent accuracy has dropped below expected thresholds.",
    "HIGH_ATTEMPTS": "Student is requiring multiple attempts to solve recent problems.",
    "STEADY_PROGRESS": "Student is maintaining consistent performance."
}


def generate_reason_codes_from_array(sequence_array):
    reasons = []
    
    attempts = sequence_array[:, 1]
    
    #Check if the sequence array is scaled.

    is_scaled = False
    if sequence_array.shape[1] > 0 and np.abs(sequence_array[:, 0].mean()) < 10.0:
        is_scaled = True

    if is_scaled:
        #try loading the scalers to unscale it.
        try:
            from src.config import INFERENCE_SCALER_PATH
            import joblib
            scaler_path = INFERENCE_SCALER_PATH
            if scaler_path.exists():
                scalers = joblib.load(scaler_path)
                attempts_scaler = scalers.get(1)
                if attempts_scaler is not None:
                    attempts = attempts_scaler.inverse_transform(attempts.reshape(-1, 1)).flatten()
            else:
                #fallback to typical scaling parameters
                attempts = attempts * 1.031 + 1.306
        except Exception:
            #fallback
            attempts = attempts * 1.031 + 1.306

    recent_steps = sequence_array[-3:]
    recent_attempts_mean = attempts[-3:].mean()

    if recent_steps[:, 2].mean() < 0.5:
        reasons.append("LOW_CORRECTNESS")
    if recent_attempts_mean > 1.5:
        reasons.append("HIGH_ATTEMPTS")
    if not reasons:
        reasons.append("STEADY_PROGRESS")
    return reasons


def recommend_intervention(risk_level, reason_codes):
    interventions = []
    if risk_level == "high":
        interventions.append("Immediate teacher review recommended.")
    elif risk_level == "medium":
        interventions.append("Assign targeted practice and monitor closely.")
    else:
        interventions.append("No immediate intervention needed. Continue monitoring.")

    if "LOW_CORRECTNESS" in reason_codes:
        interventions.append("Review the recent topic because correctness is declining.")
    if "HIGH_ATTEMPTS" in reason_codes:
        interventions.append("Provide a worked example because the student needs more attempts.")

    return interventions


def build_student_prediction_result(model, student_sequence_tensor, student_sequence_array, student_id):
    model.eval()

    with torch.no_grad():
        #handle models that return attention weights
        try:
            outputs, _ = model(student_sequence_tensor, return_attention=True)
        except Exception:
            outputs = model(student_sequence_tensor)

        probs = F.softmax(outputs, dim=1)
        predicted_class = torch.argmax(probs, dim=1).item()

    risk_level = RISK_LABELS[predicted_class]

    probabilities = {
        "low_risk_probability": round(probs[0, 0].item(), 4),
        "medium_risk_probability": round(probs[0, 1].item(), 4),
        "high_risk_probability": round(probs[0, 2].item(), 4)
    }

    reason_codes = generate_reason_codes_from_array(student_sequence_array)
    explanations = [REASON_TEXT[reason] for reason in reason_codes]
    interventions = recommend_intervention(risk_level, reason_codes)

    return {
        "student_id": student_id,
        "predicted_risk_class": RISK_TEXT[predicted_class],
        "risk_level": risk_level,
        "probabilities": probabilities,
        "reason_codes": reason_codes,
        "explanations": explanations,
        "recommended_interventions": interventions
    }