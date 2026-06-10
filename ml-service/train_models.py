#!/usr/bin/env python3
"""
Train ML models for AQI Dashboard.
Run AFTER collecting at least 7+ days of sensor data.

Usage:
  python train_models.py --model xgboost   # fast, works day 1 with synthetic data
  python train_models.py --model lstm      # needs 30+ days real data
  python train_models.py --model all       # both
"""
import argparse, os, sys
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
SAVE_DIR = Path('app/models/saved')
SAVE_DIR.mkdir(parents=True, exist_ok=True)

CLASSES = ['construction_dust','vehicle_emissions','biomass_burning','industrial','dust_storm','unknown']
FEATURE_COLS = ['pm25','pm10','co','no2','so2','o3','wind_speed','wind_direction',
                'temperature','humidity','vehicle_density','congestion_index','pm25_pm10_ratio','so2_no2_ratio']


def train_xgboost():
    """Trains on synthetic data — works immediately without real sensor history."""
    print('\n🤖 Training XGBoost source detector…')
    from xgboost import XGBClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report

    np.random.seed(42)
    n = 4000

    def profile(pm25, ratio, no2, so2, co, vd=150, ci=5):
        d = {
            'pm25': np.random.normal(pm25, pm25*.2, n).clip(0),
            'pm10': np.random.normal(pm25*ratio, pm25*.15, n).clip(0),
            'no2':  np.random.normal(no2, no2*.25, n).clip(0),
            'so2':  np.random.normal(so2, so2*.3, n).clip(0),
            'co':   np.random.normal(co, co*.2, n).clip(0),
            'o3':   np.random.normal(40, 10, n).clip(0),
            'wind_speed':  np.random.normal(2, 1, n).clip(0),
            'wind_direction': np.random.uniform(0, 360, n),
            'temperature': np.random.normal(28, 4, n),
            'humidity':    np.random.normal(65, 12, n),
            'vehicle_density': np.random.normal(vd, 50, n).clip(0),
            'congestion_index': np.random.normal(ci, 2, n).clip(0, 10),
        }
        df = pd.DataFrame(d)
        df['pm25_pm10_ratio'] = df['pm25'] / (df['pm10']+.001)
        df['so2_no2_ratio']   = df['so2']  / (df['no2'] +.001)
        return df

    frames = [
        profile(120, 2.5, 30, 12, 1.5, 80, 3),   # construction_dust
        profile(90,  1.8, 75, 20, 12,  300, 8),   # vehicle_emissions
        profile(110, 2.0, 25, 18, 18,  80, 3),    # biomass_burning
        profile(80,  1.6, 90, 65, 8,   100, 4),   # industrial
        profile(200, 3.0, 15, 8,  1,   60, 2),    # dust_storm
        profile(50,  1.7, 35, 15, 5,   120, 5),   # unknown
    ]
    data = pd.concat([f.assign(label=i) for i,f in enumerate(frames)]).sample(frac=1, random_state=42)
    X = data[FEATURE_COLS]
    y = data['label']

    X_tr, X_v, y_tr, y_v = train_test_split(X, y, test_size=.15, stratify=y, random_state=42)
    model = XGBClassifier(n_estimators=300, max_depth=6, learning_rate=0.08,
                          subsample=.85, colsample_bytree=.8, random_state=42,
                          eval_metric='mlogloss')
    model.fit(X_tr, y_tr, eval_set=[(X_v, y_v)], verbose=False)
    print(classification_report(y_v, model.predict(X_v), target_names=CLASSES))
    joblib.dump(model, SAVE_DIR / 'source_xgb.pkl')
    print(f'✅ XGBoost saved → {SAVE_DIR}/source_xgb.pkl')


def train_lstm():
    """Trains LSTM on real DB data. Needs 30+ days of readings."""
    import psycopg2
    print('\n🧠 Training LSTM AQI predictor…')
    try:
        conn = psycopg2.connect(
            host=os.getenv('PG_HOST','localhost'), port=5432,
            dbname=os.getenv('PG_DB','aqi_db'),
            user=os.getenv('PG_USER','postgres'),
            password=os.getenv('PG_PASS','secret123')
        )
    except Exception as e:
        print(f'❌ DB connection failed: {e}'); return

    import tensorflow as tf
    from sklearn.preprocessing import MinMaxScaler

    FCOLS = ['pm25','pm10','co','no2','so2','o3','temperature','humidity','wind_speed','hour_of_day','day_of_week']
    df = pd.read_sql("""
        SELECT ward_id, pm25, pm10, co, no2, so2, o3, aqi_calculated,
               temperature, humidity, wind_speed,
               EXTRACT(HOUR FROM recorded_at)::int AS hour_of_day,
               EXTRACT(DOW  FROM recorded_at)::int AS day_of_week
        FROM sensor_readings
        WHERE recorded_at > NOW() - INTERVAL '90 days'
          AND aqi_calculated IS NOT NULL
        ORDER BY ward_id, recorded_at
    """, conn)
    conn.close()

    print(f'  Loaded {len(df):,} rows, {df.ward_id.nunique()} wards')
    if len(df) < 5000:
        print('⚠️  Not enough data yet (need ~30 days). Run the simulator longer first.'); return

    scaler = MinMaxScaler()
    SEQ = 72
    all_X, all_y = [], []
    for wid, wdf in df.groupby('ward_id'):
        wdf = wdf[FCOLS+['aqi_calculated']].ffill().fillna(0)
        if len(wdf) < SEQ + 24: continue
        vals = wdf[FCOLS].values
        tgts = wdf['aqi_calculated'].values
        for i in range(SEQ, len(vals)-24):
            all_X.append(vals[i-SEQ:i])
            all_y.append([tgts[min(i+5,len(tgts)-1)], tgts[min(i+11,len(tgts)-1)], tgts[min(i+23,len(tgts)-1)]])

    if not all_X: print('❌ Still insufficient sequences.'); return
    X = np.array(all_X, dtype=np.float32)
    y = np.array(all_y, dtype=np.float32)
    flat = X.reshape(-1, X.shape[-1])
    scaler.fit(flat)
    X_sc = scaler.transform(flat).reshape(X.shape)
    s = int(len(X_sc)*.85)

    from app.models.aqi_predictor import AQIPredictor
    model = AQIPredictor.build_training_model()
    model.fit(X_sc[:s], y[:s], validation_data=(X_sc[s:],y[s:]),
              epochs=60, batch_size=64, callbacks=[
                  tf.keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True),
                  tf.keras.callbacks.ReduceLROnPlateau(patience=4),
              ], verbose=1)
    model.save(SAVE_DIR / 'aqi_lstm.h5')
    joblib.dump(scaler, SAVE_DIR / 'aqi_scaler.pkl')
    print(f'✅ LSTM saved → {SAVE_DIR}/aqi_lstm.h5')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--model', choices=['all','xgboost','lstm'], default='xgboost')
    args = p.parse_args()
    if args.model in ('all','xgboost'): train_xgboost()
    if args.model in ('all','lstm'):    train_lstm()
    print('\n🎉 Done! Restart ml-service to load new models.')
