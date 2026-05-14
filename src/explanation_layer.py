import numpy as np
import torch
import torch.nn.functional as F


REASON_TEXT = {
    "DECLINING_CORRECTNESS": "The student's recent correctness is lower than earlier in the sequence.",
    "INCREASING_ATTEMPTS": "The student is needing more attempts in recent interactions.",
    "SLOW_RESPONSE_TIME": "The student is taking longer than usual to respond recently.",
    "RECENT_FAILURE_STREAK": "The student recently answered several questions incorrectly in a row.",
}


def predict_probability(
    model: torch.nn.Module,
    sequence_tensor: torch.Tensor,
) -> float:
    """
    Predict probability that one student sequence is struggling.

    Expected shape:
        sequence_tensor: (1, 10, 11)
    """
    model.eval()

    with torch.no_grad():
        outputs = model(sequence_tensor)
        probabilities = F.softmax(outputs, dim=1)
        struggling_probability = probabilities[:, 1].item()

    return struggling_probability


def get_risk_level(probability: float) -> str:
    if probability >= 0.65:
        return "high"
    elif probability >= 0.45:
        return "medium"
    else:
        return "low"


def get_confidence(probability: float) -> str:
    if probability >= 0.75:
        return "very confident struggling"
    elif probability >= 0.50:
        return "confident struggling"
    elif probability >= 0.25:
        return "uncertain / monitor closely"
    else:
        return "low risk confidence"


def generate_reason_codes_from_array(sequence: np.ndarray) -> list[str]:
    """
    Expected sequence shape:
        (10, 11)

    Feature order:
        0 = response time
        1 = attempt count
        2 = correct
        3 = correctness change
        4 = attempt change
        5 = rolling correctness
        6 = rolling attempts
        7 = relative time
        8 = correct std
        9 = time std
        10 = attempt std
    """
    reasons = []

    response_time = sequence[:, 0]
    attempts = sequence[:, 1]
    correctness = sequence[:, 2]

    if correctness[-3:].sum() < correctness[:3].sum():
        reasons.append("DECLINING_CORRECTNESS")

    if attempts[-3:].sum() > attempts[:3].sum():
        reasons.append("INCREASING_ATTEMPTS")

    if response_time[-3:].mean() > response_time.mean() * 1.25:
        reasons.append("SLOW_RESPONSE_TIME")

    if correctness[-3:].sum() == 0:
        reasons.append("RECENT_FAILURE_STREAK")

    return reasons


def recommend_intervention(
    risk_level: str,
    reason_codes: list[str],
) -> list[str]:
    interventions = []

    if risk_level == "high":
        interventions.append("Immediate teacher review recommended.")
    elif risk_level == "medium":
        interventions.append("Assign targeted practice and monitor closely.")
    else:
        interventions.append("No immediate intervention needed. Continue monitoring.")

    if "DECLINING_CORRECTNESS" in reason_codes:
        interventions.append("Review the recent topic because correctness is declining.")

    if "INCREASING_ATTEMPTS" in reason_codes:
        interventions.append("Provide a worked example because the student needs more attempts.")

    if "SLOW_RESPONSE_TIME" in reason_codes:
        interventions.append(
            "Check for hesitation or confusion; consider giving a hint or simpler warm-up question."
        )

    if "RECENT_FAILURE_STREAK" in reason_codes:
        interventions.append(
            "Pause progression and give remedial practice before introducing harder questions."
        )

    return interventions


def build_student_prediction_result(
    model: torch.nn.Module,
    student_sequence_tensor: torch.Tensor,
    student_sequence_array: np.ndarray,
    student_id: str,
) -> dict:
    probability = predict_probability(model, student_sequence_tensor)
    risk_level = get_risk_level(probability)
    confidence = get_confidence(probability)

    reason_codes = generate_reason_codes_from_array(student_sequence_array)
    explanations = [REASON_TEXT[reason] for reason in reason_codes]
    interventions = recommend_intervention(risk_level, reason_codes)

    return {
        "student_id": student_id,
        "risk_probability": round(probability, 4),
        "risk_level": risk_level,
        "confidence": confidence,
        "reason_codes": reason_codes,
        "explanations": explanations,
        "recommended_interventions": interventions,
    }