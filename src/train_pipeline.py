import os
import joblib
import pandas as pd
import numpy as np
import torch
from sklearn.model_selection import train_test_split

from src.config import (
    DATA_PATH,
    MODEL_DIR,
    TRAINED_MODEL_DIR,
    TRAINED_SCALER_PATH,
    ATTENTION_LSTM_MODEL_PATH,
    RANDOM_FOREST_MODEL_PATH,
    SAMPLE_SIZE,
    WINDOW_SIZE,
    FUTURE_SIZE,
    BATCH_SIZE,
    EPOCHS,
    LEARNING_RATE,
    RANDOM_STATE,
    DEVICE
)
from src.data_preprocessing import load_and_clean_data, sample_data
from src.sequence_builder import build_sequences_multiclass_quantile
from src.scaling import normalize_sequence_features
from src.random_forest_baseline import (
    build_random_forest_features,
    train_random_forest_baseline,
    evaluate_random_forest_baseline
)
from src.attention_lstm_model import LSTMWithAttention, LearningDifficultyLSTM
from src.train_attention_lstm import train_model
from src.evaluation import evaluate_multiclass, get_experiment_metrics, analyze_attention_distribution
from src.explanation_layer import build_student_prediction_result
from src.optuna_tuning import run_optuna_search


def main() -> None:
    #check directories exist
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    TRAINED_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(MODEL_DIR), "reports"), exist_ok=True)

    print("\n1.Loading and Cleaning Data")
    print(f"Loading data from {DATA_PATH}...")
    df = load_and_clean_data(DATA_PATH)
    print("Full cleaned data shape:", df.shape)
    print(df.head())
    print("Correctness distribution:")
    print(df["correct"].value_counts(normalize=True))

    print("\n-2.Sampling Data")
    print(f"Sampling {SAMPLE_SIZE} interactions...")
    df_sample = sample_data(df, sample_size=SAMPLE_SIZE, random_state=RANDOM_STATE)
    print("Sampled data shape:", df_sample.shape)
    print(df_sample.head())

    print("\n3.Sequence Building and Multi-Class Quantile Labeling")
    X_seq, y_seq, risk_scores = build_sequences_multiclass_quantile(
        df_sample,
        window_size=WINDOW_SIZE,
        future_size=FUTURE_SIZE
    )
    print("X_seq shape:", X_seq.shape)
    print("y_seq shape:", y_seq.shape)
    print("Class distribution:", np.bincount(y_seq))

    print("\n4.Feature Normalization")
    X_scaled, scalers = normalize_sequence_features(X_seq, skip_indices=[2])
    
    #save sequence scalers to disk
    scalers_path = TRAINED_SCALER_PATH
    print(f"Saving sequence scalers to {scalers_path}...")
    joblib.dump(scalers, scalers_path)

    print("\n5.Splitting Dataset and Converting to Tensors")
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled,
        y_seq,
        test_size=0.2,
        stratify=y_seq,
        random_state=RANDOM_STATE
    )

    X_train_tensor = torch.tensor(X_train, dtype=torch.float32).to(DEVICE)
    X_test_tensor = torch.tensor(X_test, dtype=torch.float32).to(DEVICE)
    y_train_tensor = torch.tensor(y_train, dtype=torch.long).to(DEVICE)
    y_test_tensor = torch.tensor(y_test, dtype=torch.long).to(DEVICE)

    print("X_train shape:", X_train.shape)
    print("X_test shape:", X_test.shape)
    print("y_train distribution:", np.bincount(y_train))
    print("y_test distribution:", np.bincount(y_test))

    print("\n6. Random Forest Baseline Model")
    X_rf = build_random_forest_features(X_scaled)
    X_rf_train, X_rf_test, y_rf_train, y_rf_test = train_test_split(
        X_rf,
        y_seq,
        test_size=0.2,
        stratify=y_seq,
        random_state=RANDOM_STATE
    )

    print("Training Random Forest Baseline...")
    rf_model = train_random_forest_baseline(X_rf_train, y_rf_train)
    evaluate_random_forest_baseline(rf_model, X_rf_test, y_rf_test, save_plots=True)

    print(f"Saving Random Forest model to {RANDOM_FOREST_MODEL_PATH}...")
    joblib.dump(rf_model, RANDOM_FOREST_MODEL_PATH)

    print("\n7.Plain LSTM Baseline Model")
    input_size = X_train_tensor.shape[2]
    print("Training Plain LSTM Baseline...")
    plain_lstm_model = LearningDifficultyLSTM(input_size=input_size, num_classes=3)
    plain_lstm_model = train_model(
        plain_lstm_model,
        X_train_tensor,
        y_train_tensor,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        lr=LEARNING_RATE,
        use_class_weights=False,
        weight_strength=0.0
    )

    print("\n8.Attention LSTM Class Weighting Experiments")
    weight_experiments = {
        "No Weights (0.0)": 0.0,
        "Mild Weights (0.4)": 0.4,
        "Strong Weights (1.0)": 1.0
    }

    experiment_results = []
    models_dict = {}

    for exp_name, strength in weight_experiments.items():
        print(f"\nTraining Attention LSTM with {exp_name}...")
        exp_model = LSTMWithAttention(input_size=input_size, hidden_size=64, num_classes=3)
        exp_model = train_model(
            exp_model,
            X_train_tensor,
            y_train_tensor,
            epochs=EPOCHS,
            batch_size=BATCH_SIZE,
            lr=LEARNING_RATE,
            use_class_weights=(strength > 0.0),
            weight_strength=strength
        )

        metrics = get_experiment_metrics(exp_model, X_test_tensor, y_test_tensor, has_attention=True)
        experiment_results.append((exp_name, metrics))
        models_dict[exp_name] = exp_model

    #weighting experiment results table
    results_df = pd.DataFrame(
        [res[1] for res in experiment_results],
        index=[res[0] for res in experiment_results]
    )
    print("\nClass Weighting Experiment Results:")
    print(results_df.round(4))

    #overwrite 'attention_model' with the best balanced model (Mild Weights)
    attention_model = models_dict["Mild Weights (0.4)"]

    print(f"Saving Attention LSTM model to {ATTENTION_LSTM_MODEL_PATH}...")
    torch.save(attention_model.state_dict(), ATTENTION_LSTM_MODEL_PATH)

    print("\nEvaluating Plain LSTM Baseline...")
    evaluate_multiclass(plain_lstm_model, X_test_tensor, y_test_tensor, model_name="Plain LSTM", has_attention=False, save_plots=True)

    print("\nEvaluating Attention LSTM (Mild Weights)...")
    evaluate_multiclass(attention_model, X_test_tensor, y_test_tensor, model_name="Attention LSTM", has_attention=True, save_plots=True)

    print("\n9.Optuna Hyperparameter Search (15 trials)")
    # speed and verification - Optuna study
    run_optuna_search(X_train_tensor, y_train_tensor, n_trials=15)

    print("\10.Single Student Prediction Demonstration")
    student_index = 0
    student_sequence_tensor = X_test_tensor[student_index].unsqueeze(0)
    student_sequence_array = X_test[student_index]

    prediction_result = build_student_prediction_result(
        attention_model,
        student_sequence_tensor,
        student_sequence_array,
        student_id=f"test_student_{student_index}"
    )
    print("\nPrediction Demo Result:")
    import pprint
    pprint.pprint(prediction_result)

    print("\n11.Attention Weight Distribution Analysis")
    print("Generating attention analysis...")
    global_weights, class_avg_weights = analyze_attention_distribution(
        attention_model,
        X_test_tensor,
        y_test_tensor,
        save_plots=True
    )
    print("Global average attention weights:")
    print(global_weights)


if __name__ == "__main__":
    main()