"""
AQI Time-Series Predictor
Primary:  LSTM (loaded from saved/aqi_lstm.h5 if exists)
Fallback: Statistical exponential smoothing — always works without training
"""
import numpy as np
import pandas as pd
import os
from pathlib import Path

TARGET_COL   = 'aqi_calculated'
FEATURE_COLS = ['pm25','pm10','co','no2','so2','o3','temperature','humidity','wind_speed','hour_of_day','day_of_week']
SEQUENCE_LEN = 72
MODEL_PATH   = Path(__file__).parent / 'saved' / 'aqi_lstm.h5'
SCALER_PATH  = Path(__file__).parent / 'saved' / 'aqi_scaler.pkl'


class AQIPredictor:
    def __init__(self):
        self.model  = None
        self.scaler = None
        self._try_load()

    def _try_load(self):
        if MODEL_PATH.exists() and SCALER_PATH.exists():
            try:
                import tensorflow as tf
                import joblib
                self.model  = tf.keras.models.load_model(str(MODEL_PATH))
                self.scaler = joblib.load(str(SCALER_PATH))
                print('✅ LSTM model loaded')
            except Exception as e:
                print(f'⚠️  LSTM load failed: {e} — using statistical fallback')
                self.model = None
        else:
            print('ℹ️  No saved LSTM model — using statistical fallback')

    def predict(self, df: pd.DataFrame, ward_id: int) -> dict:
        df = df.copy().ffill().fillna(0)
        last_aqi = float(df[TARGET_COL].iloc[-1]) if TARGET_COL in df.columns and len(df) > 0 else 100.0

        if self.model is not None and len(df) >= SEQUENCE_LEN:
            try:
                return self._lstm_predict(df, last_aqi)
            except Exception as e:
                print(f'LSTM predict failed: {e} — falling back to statistical')

        return self._stat_predict(df, last_aqi)

    def _lstm_predict(self, df, last_aqi):
        import tensorflow as tf
        avail = [c for c in FEATURE_COLS if c in df.columns]
        X = df[avail].values[-SEQUENCE_LEN:]
        if X.shape[1] < len(FEATURE_COLS):
            pad = np.zeros((X.shape[0], len(FEATURE_COLS) - X.shape[1]))
            X   = np.hstack([X, pad])
        X_scaled = self.scaler.transform(X.reshape(-1, X.shape[-1])).reshape(1, SEQUENCE_LEN, len(FEATURE_COLS))
        preds    = self.model.predict(X_scaled, verbose=0)[0]
        f6, f12, f24 = [max(0, min(500, int(p))) for p in preds[:3]]
        return self._build_result(f6, f12, f24, last_aqi, df, 'LSTM', 87)

    def _stat_predict(self, df, last_aqi):
        vals = df[TARGET_COL].values if TARGET_COL in df.columns and len(df) > 1 else np.array([last_aqi] * 24)
        if len(vals) > 12:
            trend = float(np.mean(np.diff(vals[-12:])))
        else:
            trend = 0.0
        # Damped trend forecasts
        f6  = max(0, min(500, int(last_aqi + trend * 6  * 0.5)))
        f12 = max(0, min(500, int(last_aqi + trend * 12 * 0.4)))
        f24 = max(0, min(500, int(last_aqi + trend * 24 * 0.25)))
        return self._build_result(f6, f12, f24, last_aqi, df, 'StatFallback', 65)

    def _build_result(self, f6, f12, f24, last_aqi, df, model_name, conf):
        trend = ('deteriorating' if f12 > last_aqi * 1.05 else
                 'improving'     if f12 < last_aqi * 0.95 else 'stable')
        timeline = self._build_timeline(df, f6, f12, f24, last_aqi)
        ci_pct = {6: 0.12, 12: 0.18, 24: 0.25}
        return {
            'forecast_6h':    f6,
            'forecast_12h':   f12,
            'forecast_24h':   f24,
            'ci_low_6h':      int(f6  * (1 - ci_pct[6])),
            'ci_high_6h':     int(f6  * (1 + ci_pct[6])),
            'ci_low_12h':     int(f12 * (1 - ci_pct[12])),
            'ci_high_12h':    int(f12 * (1 + ci_pct[12])),
            'model':           model_name,
            'confidence_pct':  conf,
            'trend':           trend,
            'timeline':        timeline,
        }

    def _build_timeline(self, df, f6, f12, f24, last_aqi):
        recent_vals = list(df[TARGET_COL].values[-8:]) if TARGET_COL in df.columns else [last_aqi] * 8
        timeline = []
        for v in recent_vals:
            timeline.append({'actual': True, 'forecast': int(v), 'upper': int(v), 'lower': int(v)})
        for h in range(1, 25):
            v    = int(np.interp(h, [0, 6, 12, 24], [last_aqi, f6, f12, f24]))
            band = 0.12 + h * 0.005
            timeline.append({
                'actual':   False,
                'forecast': v,
                'upper':    int(v * (1 + band)),
                'lower':    int(v * max(0, 1 - band)),
            })
        return timeline

    @staticmethod
    def build_training_model():
        import tensorflow as tf
        m = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(SEQUENCE_LEN, len(FEATURE_COLS))),
            tf.keras.layers.LSTM(128, return_sequences=True),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.LSTM(64),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(32, activation='relu'),
            tf.keras.layers.Dense(3),
        ])
        m.compile(optimizer='adam', loss='huber', metrics=['mae'])
        return m
