"""
AQI ML Service — FastAPI
Statistical fallback used when models not trained.
All endpoints return valid responses even without ML models.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

from app.models.aqi_predictor import AQIPredictor
from app.models.detectors import SourceDetector, HotspotDetector

app = FastAPI(title="AQI ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialise models at startup
predictor = AQIPredictor()
detector  = SourceDetector()
hotspot   = HotspotDetector()


# ── Schemas ────────────────────────────────────────────────────────────────
class SensorFeature(BaseModel):
    pm25:           Optional[float] = None
    pm10:           Optional[float] = None
    co:             Optional[float] = None
    no2:            Optional[float] = None
    so2:            Optional[float] = None
    o3:             Optional[float] = None
    aqi_calculated: Optional[float] = None
    temperature:    Optional[float] = None
    humidity:       Optional[float] = None
    wind_speed:     Optional[float] = None
    hour_of_day:    Optional[float] = None
    day_of_week:    Optional[float] = None

class PredictRequest(BaseModel):
    wardId:   int
    features: List[SensorFeature]

class SourceRequest(BaseModel):
    features: Dict[str, Any]

class SensorPoint(BaseModel):
    ward_id:        int
    aqi_calculated: float
    lat:            float
    lng:            float

class HotspotRequest(BaseModel):
    sensors:   List[SensorPoint]
    threshold: int = 150


# ── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status":    "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "models": {
            "lstm":    predictor.model is not None,
            "xgboost": detector.model  is not None,
        }
    }


@app.post("/predict/aqi")
def predict_aqi(req: PredictRequest):
    if len(req.features) < 2:
        raise HTTPException(422, "Need at least 2 time steps for prediction")
    try:
        df     = pd.DataFrame([f.dict() for f in req.features]).ffill().fillna(0)
        result = predictor.predict(df, req.wardId)
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {str(e)}")

    now      = datetime.utcnow()
    timeline = []
    for i, pt in enumerate(result.get('timeline', [])):
        timeline.append({
            "time":     (now + timedelta(hours=i - 8)).strftime("%I %p"),
            "forecast": int(pt.get('forecast', 0)),
            "upper":    int(pt.get('upper',   0)),
            "lower":    int(pt.get('lower',   0)),
            "isActual": bool(pt.get('actual', False)),
        })

    return {
        "wardId":         req.wardId,
        "forecast_6h":    int(result['forecast_6h']),
        "forecast_12h":   int(result['forecast_12h']),
        "forecast_24h":   int(result['forecast_24h']),
        "ci_low_6h":      int(result['ci_low_6h']),
        "ci_high_6h":     int(result['ci_high_6h']),
        "ci_low_12h":     int(result['ci_low_12h']),
        "ci_high_12h":    int(result['ci_high_12h']),
        "model":          result['model'],
        "confidence_pct": result['confidence_pct'],
        "timeline":       timeline,
        "trend":          result['trend'],
    }


@app.post("/detect/source")
def detect_source(req: SourceRequest):
    try:
        result = detector.predict(req.features)
    except Exception as e:
        raise HTTPException(500, f"Source detection failed: {str(e)}")
    return {
        "predicted_source": result['label'],
        "confidence":       round(result['confidence'], 3),
        "probabilities":    {k: round(v, 3) for k, v in result['probs'].items()},
        "recommendations":  result['recommendations'],
        "model":            "xgboost_v1" if detector.model else "rule_based",
    }


@app.post("/detect/hotspots")
def detect_hotspots(req: HotspotRequest):
    if len(req.sensors) < 2:
        return {"hotspots": [], "total": 0}
    try:
        clusters = hotspot.detect(
            [(s.lat, s.lng, s.aqi_calculated, s.ward_id) for s in req.sensors],
            req.threshold
        )
    except Exception as e:
        return {"hotspots": [], "total": 0, "error": str(e)}
    return {"hotspots": clusters, "total": len(clusters)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
