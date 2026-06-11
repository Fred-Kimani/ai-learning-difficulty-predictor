import pandas as pd
import random
from src.data_preprocessing import load_and_clean_data

class InferenceDataRouter:
    def __init__(self, raw_data_path: str):
        print("Initializing Data Router: Loading database into memory...")
        self.db = load_and_clean_data(raw_data_path)
        
    def get_live_student_window(self, user_id: int, window_size: int = 10) -> pd.DataFrame:
        student_data = self.db[self.db['user_id'] == user_id]
        student_data = student_data.sort_values('start_time')
        
        if len(student_data) < window_size:
            raise ValueError(f"Student {user_id} does not have enough history ({window_size} required).")
            
        return student_data.tail(window_size)

    def get_random_demo_student(self, window_size: int = 10) -> tuple[int, pd.DataFrame]:
        interaction_counts = self.db['user_id'].value_counts()
        valid_users = interaction_counts[interaction_counts >= window_size].index.tolist()
        random_user = random.choice(valid_users)
        
        df_window = self.get_live_student_window(random_user, window_size)
        return random_user, df_window

    def get_class_summary_batch(self, class_user_ids: list[int], window_size: int = 10) -> dict:
        batch_data = {}
        for uid in class_user_ids:
            try:
                batch_data[uid] = self.get_live_student_window(uid, window_size)
            except ValueError:
                batch_data[uid] = None 
                
        return batch_data