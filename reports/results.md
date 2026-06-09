# Experiment Results Summary

This document summarizes the model evaluation results and findings from the learning difficulty prediction experiments.

## 1. Random Forest Baseline Results

The Random Forest baseline model was trained on 7 aggregated sequence features and evaluated on the test set:
- **Accuracy**: 49%
- **Macro F1-score**: 0.49

### Confusion Matrix
```
[[1395  636  538]  (Actual Low Risk)
 [ 672 1067  829]  (Actual Medium Risk)
 [ 529  763 1355]] (Actual High Risk)
```

### Feature Importance Scores
1. **Average Response Time**: 28.5%
2. **Response Time Std**: 30.5%
3. **Attempts Std**: 13.1%
4. **Average Attempts**: 10.5%
5. **Average Correctness**: 7.9%
6. **Correctness Std**: 6.2%
7. **Maximum Attempts**: 3.3%

*Key Finding*: Temporal response metrics (average response time and response time variance) carry the highest predictive power for predicting downstream student risk.

## 2. Attention LSTM vs. Plain LSTM

### Plain LSTM Baseline
- Trained using unweighted loss.
- High bias towards the majority class (tended to overpredict Low Risk).
- Accuracy: ~34%, Macro F1: ~18%.

### Attention LSTM Class Weighting Experiments
To optimize detection of High Risk students, class weights were applied with different scaling strengths:

| Experiment | Accuracy | Macro Precision | Macro Recall | Macro F1 | High Risk Recall |
|---|---|---|---|---|---|
| **No Weights (0.0)** | 0.3482 | 0.2374 | 0.3333 | 0.2333 | 0.0000 |
| **Mild Weights (0.4)** | 0.3765 | 0.4236 | 0.3791 | 0.2724 | 0.0119 |
| **Strong Weights (1.0)** | 0.3360 | 0.2251 | 0.3921 | 0.2406 | 0.7976 |

- **No Weights** fails completely to predict the High Risk class.
- **Mild Weights** provides the best overall balance and macro F1 score.
- **Strong Weights** drastically improves the recall for the **High Risk class to 79.8%**, which is highly desirable for early student support systems (minimizing false negatives).

## 3. Hyperparameter Optimization (Optuna)

A search over 15 trials optimized validation Macro F1 score:
- **Best Validation Macro F1**: 0.4065
- **Optimal Hyperparameters**:
  - `hidden_size`: 64
  - `learning_rate`: 0.00099
  - `dropout`: 0.34
  - `num_layers`: 1

## 4. Attention Analysis

The self-attention distribution indicates that the Attention LSTM allocates weights across the 10 timesteps of the sequence:
- **Global Average Weights**: Shows relatively uniform or slightly increasing focus towards more recent interactions.
- Class-specific weights show distinct attention behaviors for High Risk vs. Low Risk students.

*Generated Visualizations (saved in `reports/`)*:
- [Random Forest Feature Importance](rf_feature_importance.png)
- [Random Forest Confusion Matrix](rf_confusion_matrix.png)
- [Random Forest Multiclass ROC Curve](rf_roc_curve.png)
- [Random Forest Multiclass Precision-Recall Curve](rf_precision_recall_curve.png)
- [Plain LSTM Confusion Matrix](plain_lstm_confusion_matrix.png)
- [Attention LSTM Confusion Matrix](attention_lstm_confusion_matrix.png)
- [Attention Distribution Plot & Heatmap](attention_distribution.png)
