import joblib
import torch
from sklearn.model_selection import train_test_split

from src.config import (
    DATA_PATH,
    MODEL_DIR,
    RANDOM_FOREST_MODEL_PATH,
    ATTENTION_LSTM_MODEL_PATH,
    TEST_SIZE,
    RANDOM_STATE,
    THRESHOLDS_TO_TEST,
)

from src.data_preprocessing import (
    load_dataset,
    clean_interaction_data,
    sample_rows,
    print_dataset_summary,
)

from src.sequence_builder import (
    build_sequences,
    print_sequence_summary,
)

from src.scaling import scale_sequence_features

from src.random_forest_baseline import (
    train_random_forest_baseline,
    evaluate_random_forest_baseline,
)

from src.train_attention_lstm import (
    arrays_to_tensors,
    train_attention_lstm,
)

from src.evaluation import evaluate_thresholds

from src.explanation_layer import build_student_prediction_result


def main() -> None:
    MODEL_DIR.mkdir(exist_ok=True)

    print("\nLoading dataset...")
    df = load_dataset(DATA_PATH)

    print("\nCleaning dataset...")
    df = clean_interaction_data(df)
    print_dataset_summary(df)

    print("\nSampling rows for faster training...")
    df = sample_rows(df, sample_size=200_000, random_state=RANDOM_STATE)

    print("\nBuilding future-window sequences...")
    X_seq, y_seq = build_sequences(df)
    print_sequence_summary(X_seq, y_seq)

    print("\nSplitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(
        X_seq,
        y_seq,
        test_size=TEST_SIZE,
        stratify=y_seq,
        random_state=RANDOM_STATE,
    )

    print("\nScaling sequence features...")
    X_train_scaled, X_test_scaled, scalers = scale_sequence_features(
        X_train,
        X_test,
    )

    print("\nTraining Random Forest baseline...")
    random_forest_model = train_random_forest_baseline(
        X_train_scaled,
        y_train,
        random_state=RANDOM_STATE,
    )

    evaluate_random_forest_baseline(
        random_forest_model,
        X_test_scaled,
        y_test,
    )

    print("\nSaving Random Forest model...")
    joblib.dump(random_forest_model, RANDOM_FOREST_MODEL_PATH)

    print("\nConverting arrays to PyTorch tensors...")
    X_train_tensor, X_test_tensor, y_train_tensor, y_test_tensor = arrays_to_tensors(
        X_train_scaled,
        X_test_scaled,
        y_train,
        y_test,
    )

    print("\nTraining Attention LSTM...")
    input_size = X_train_scaled.shape[2]

    attention_model = train_attention_lstm(
        X_train=X_train_scaled,
        y_train=y_train,
        input_size=input_size,
    )

    print("\nEvaluating Attention LSTM thresholds...")
    evaluate_thresholds(
        model=attention_model,
        X_test_tensor=X_test_tensor,
        y_test_tensor=y_test_tensor,
        thresholds=THRESHOLDS_TO_TEST,
    )

    print("\nSaving Attention LSTM model...")
    torch.save(attention_model.state_dict(), ATTENTION_LSTM_MODEL_PATH)

    print("\nTesting one student prediction explanation...")
    student_index = 0

    student_sequence_tensor = X_test_tensor[student_index].unsqueeze(0)
    student_sequence_array = X_test_scaled[student_index]

    result = build_student_prediction_result(
        model=attention_model,
        student_sequence_tensor=student_sequence_tensor,
        student_sequence_array=student_sequence_array,
        student_id=f"test_student_{student_index}",
    )

    print(result)


if __name__ == "__main__":
    main()