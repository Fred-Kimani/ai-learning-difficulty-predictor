# Methodology: AI Learning Difficulty Prediction

This document describes the design, preprocessing steps, features, label definition, and model architectures of the AI Learning Difficulty Prediction system, as defined in `ai-learning-difficulty-prediction-system.ipynb`.

## 1. Data Preprocessing & Cleaning

The interaction logs are cleaned and prepared as follows:
- **Column Selection**: Retains only the columns: `user_id`, `start_time`, `correct`, `attempt_count`, and `ms_first_response`.
- **Type Casting**:
  - `correct` is cast to integer (`0` or `1`).
  - `attempt_count` is cast to float.
  - `ms_first_response` is cast to float.
  - `start_time` is parsed as datetime (with mixed formats).
- **Sorting**: Interactions are ordered sequentially per student: sorted by `user_id` then `start_time`.
- **Sampling**: A random sample of 200,000 interactions is extracted for scalable model training.

## 2. Sequence Construction

For each student, the system constructs sequential windows:
- **Window Size**: 10 past interactions.
- **Future Size**: 5 upcoming interactions (used for target label definition).
- **Sequence Features (12 dimensions)**:
  1. `response_time` (raw interaction response time)
  2. `attempts` (number of attempts)
  3. `correctness` (correct/incorrect)
  4. `correct_diff` (difference in correctness from previous step)
  5. `attempt_diff` (difference in attempt count from previous step)
  6. `rolling_correctness` (rolling mean of correctness with window size 3)
  7. `rolling_attempts` (rolling mean of attempts with window size 3)
  8. `relative_time` (response time relative to the sequence mean)
  9. `correct_std` (standard deviation of correctness across the sequence)
  10. `time_std` (standard deviation of response time across the sequence)
  11. `attempt_std` (standard deviation of attempt count across the sequence)
  12. `temporal_decay` (exponential decay weights computed as $e^{-0.2 \cdot \text{distance}}$ where distance is the step index relative to the most recent interaction)

## 3. Label Definition (Quantile-Based Risk Scoring)

Unlike simple binary struggle definitions, the target labels are determined by a weighted **risk score** computed from the 5 future interactions:
$$RiskScore = 0.60 \times WrongRate + 0.25 \times AttemptBurden + 0.15 \times ResponseDelay$$
where:
- $WrongRate$ is the fraction of incorrect attempts in the future window.
- $AttemptBurden = \min(\text{mean attempts} / 3.0, 1.0)$.
- $ResponseDelay = \min(\text{mean response time} / \text{global response time median}, 3.0) / 3.0$.

The risk scores are binarized into three quantiles:
- **Low Risk (Class 0)**: Risk score $\le$ 33% quantile.
- **Medium Risk (Class 1)**: 33% quantile $<$ Risk score $\le$ 66% quantile.
- **High Risk (Class 2)**: Risk score $>$ 66% quantile.

## 4. Normalization

Sequence features (excluding the `correctness` feature at index 2) are standardized using `StandardScaler` fitted on the entire dataset reshaped to 2D, and then reshaped back to 3D. The scaling parameter dictionary is saved as `sequence_scalers.pkl`.

## 5. Model Architectures

### Random Forest Baseline
- Extracts 7 aggregated features from scaled sequences:
  - Average response time
  - Average attempts
  - Average correctness
  - Maximum attempts
  - Response time standard deviation
  - Correctness standard deviation
  - Attempts standard deviation
- Trained as a multiclass classifier (`class_weight=None`).

### Plain LSTM
- Sequence encoder that feeds the last hidden state of the LSTM (`hidden[-1]`) to a Linear classifier.

### Attention LSTM
- Sequence encoder that applies a self-attention layer over all LSTM hidden states across the 10 timesteps.
- Attention weights are computed via `torch.softmax` and used to produce a weighted sum context vector.
- The context vector is classified into 3 classes.

## 6. Training & Experiments

- **Class Weighting**: Compares unweighted loss against mild weighting (weights exponent $= 0.4$) and strong weighting (weights exponent $= 1.0$) to counter class imbalance and optimize recall of the high-risk class.
- **Hyperparameter Optimization**: Uses Optuna to tune:
  - LSTM hidden size (`[32, 64, 128]`)
  - Learning rate (`1e-4` to `1e-2`)
  - Dropout (`0.1` to `0.5`)
  - Number of layers (`1` or `2`)
