# AI Learning Difficulty Predictor

This project predicts early learning difficulty from student interaction sequences.

The model uses past learning behavior such as response time, attempt count, correctness, correctness change, and attempt change to predict whether a learner is likely to struggle in upcoming interactions.

## Models

This project compares two models:

1. **Random Forest baseline**
   - Uses aggregated features from each 10-interaction student sequence.
   - Provides a simple, interpretable baseline.

2. **Attention LSTM**
   - Uses the full temporal sequence of student interactions.
   - The LSTM captures sequential learning behavior.
   - The attention layer learns which time steps in the sequence are most important for predicting future struggle.

## Label Definition

For every student, the system looks at 10 past interactions and predicts whether the student will struggle in the next 5 interactions.

A sequence is labeled as struggling if at least 3 of the next 5 interactions are incorrect.

## Evaluation

The models are evaluated using precision, recall, and F1-score, with special focus on recall for the struggling class because the goal is early detection.

## Repository Structure

- `notebooks/`: experimental notebooks
- `src/`: reusable training and preprocessing code
- `docs/`: methodology and project notes
- `reports/`: model results and experiment summaries

## Feature Set

Each interaction in a sequence contains 11 features:

1. response time
2. attempt count
3. correctness
4. correctness change
5. attempt change
6. rolling correctness
7. rolling attempts
8. relative response time
9. correctness standard deviation
10. response time standard deviation
11. attempt count standard deviation

## Data

Raw dataset files are not included in this repository due to dataset size and usage restrictions. See `docs/methodology.md` for preprocessing details.