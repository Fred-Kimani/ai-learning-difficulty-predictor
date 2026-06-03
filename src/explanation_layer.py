import numpy as np

# 1. Add the missing explanation dictionary
REASON_TEXT = {
    "LOW_CORRECTNESS": "Student's recent accuracy has dropped below expected thresholds.",
    "HIGH_ATTEMPTS": "Student is requiring multiple attempts to solve recent problems.",
    "STEADY_PROGRESS": "Student is maintaining consistent performance."
}

# 2. Add the missing array parsing logic
def generate_reason_codes_from_array(sequence_array):
    reasons = []
    # Analyze the most recent 3 interactions in the sliding window
    recent_steps = sequence_array[-3:] 
    
    avg_correct = recent_steps[:, 2].mean()
    avg_attempts = recent_steps[:, 1].mean()
    
    if avg_correct < 0.5:
        reasons.append("LOW_CORRECTNESS")
    if avg_attempts > 1.5:
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
    return interventions