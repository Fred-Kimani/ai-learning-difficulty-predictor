# AI Learning Difficulty Predictor

This project predicts early learning difficulty from student interaction sequences. 

The model uses past learning behavior such as response time, attempt count, correctness, correctness change, and attempt change to predict whether a learner is at Low, Medium, or High risk of struggling in upcoming interactions.

## Repository Structure

- `notebooks/`: Experimental notebooks
- `src/`: Reusable training, preprocessing, model definitions, and pipeline code
- `docs/`: Methodology and project notes
- `reports/`: Model results, confusion matrices, and experiment plots

## Models

This project compares several models:

1. **Random Forest baseline**
   - Uses 7 aggregated features from each 10-interaction student sequence.
   - Provides a simple, interpretable baseline.

2. **Plain LSTM**
   - Encodes sequential interaction histories to predict risk class from the final hidden state.

3. **Attention LSTM**
   - Uses the full temporal sequence of student interactions.
   - An attention layer learns which time steps in the sequence are most important for predicting future risk.

## Label Definition (Quantile Risk Scoring)

For every student sequence, the system looks at 10 past interactions and predicts their risk level based on the next 5 interactions. 

The future risk score is calculated as:
$$RiskScore = 0.60 \times WrongRate + 0.25 \times AttemptBurden + 0.15 \times ResponseDelay$$

Students are categorized into three classes using the 33% and 66% quantiles of the risk score:
- **Low Risk (Class 0)**
- **Medium Risk (Class 1)**
- **High Risk (Class 2)**

## Feature Set

Each interaction in a sequence contains 12 features:

1. Response Time
2. Attempt Count
3. Correctness
4. Correctness Difference
5. Attempt Count Difference
6. Rolling Correctness (window size 3)
7. Rolling Attempt Count (window size 3)
8. Relative Response Time
9. Correctness Standard Deviation
10. Response Time Standard Deviation
11. Attempt Count Standard Deviation
12. Temporal Decay ($e^{-0.2 \cdot \text{distance}}$)

## How to Run

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Place the dataset `2012-2013-data-with-predictions-4-final.csv` inside the `data/` directory.

3. Run the end-to-end training and evaluation pipeline:
   ```bash
   python3 -m src.train_pipeline
   ```

4. Verify the pipeline works end-to-end with a synthetic test run:
   ```bash
   python3 -m src.verify_pipeline
   ```