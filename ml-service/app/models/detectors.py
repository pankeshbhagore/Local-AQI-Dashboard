"""
SourceDetector  — XGBoost multi-class pollution source classifier with rule-based fallback
HotspotDetector — DBSCAN geospatial clustering (no training needed)
"""
import numpy as np
import pandas as pd
from pathlib import Path

CLASSES = ['construction_dust', 'vehicle_emissions', 'biomass_burning', 'industrial', 'dust_storm', 'unknown']
FEATURES = ['pm25','pm10','co','no2','so2','o3','wind_speed','wind_direction',
            'temperature','humidity','vehicle_density','congestion_index','pm25_pm10_ratio','so2_no2_ratio']

RECOMMENDATIONS = {
    'construction_dust': ['Deploy water sprinklers within 500m','Install dust barrier screens','Issue compliance notice','Schedule field inspection'],
    'vehicle_emissions': ['Optimize traffic signals','Restrict heavy diesel vehicles','Deploy traffic police','Issue route diversion'],
    'biomass_burning':   ['Dispatch enforcement team','Issue Section 144 notice','Alert fire department','Register PCB complaint'],
    'industrial':        ['Alert Pollution Control Board','Request emission log','Emergency stack inspection','Issue show-cause notice'],
    'dust_storm':        ['Broadcast advisory','Consider school closures','Activate health centers','Monitor every 30 min'],
    'unknown':           ['Increase monitoring frequency','Field investigation recommended','Deploy mobile sensor unit'],
}

MODEL_PATH = Path(__file__).parent / 'saved' / 'source_xgb.pkl'


class SourceDetector:
    def __init__(self):
        self.model = None
        if MODEL_PATH.exists():
            try:
                import joblib
                self.model = joblib.load(str(MODEL_PATH))
                print('✅ XGBoost source detector loaded')
            except Exception as e:
                print(f'⚠️  XGBoost load failed: {e}')
        else:
            print('ℹ️  No saved XGBoost — using rule-based fallback (run train_models.py to train)')

    def predict(self, features: dict) -> dict:
        f = self._engineer(features)
        if self.model is not None:
            try:
                X     = np.array([[f.get(c, 0) for c in FEATURES]], dtype=np.float32)
                probs = self.model.predict_proba(X)[0]
                src   = CLASSES[int(np.argmax(probs))]
                return {
                    'label': src,
                    'confidence': float(np.max(probs)),
                    'probs': dict(zip(CLASSES, [float(p) for p in probs])),
                    'recommendations': RECOMMENDATIONS.get(src, []),
                }
            except Exception as e:
                print(f'XGBoost predict failed: {e} — using rule-based')

        return self._rule_based(f)

    def _engineer(self, f: dict) -> dict:
        pm25 = float(f.get('pm25') or 0)
        pm10 = float(f.get('pm10') or 1)
        so2  = float(f.get('so2')  or 0)
        no2  = float(f.get('no2')  or 1)
        return {
            **{k: float(v or 0) for k, v in f.items()},
            'pm25_pm10_ratio': pm25 / max(pm10, 0.001),
            'so2_no2_ratio':   so2  / max(no2,  0.001),
            'vehicle_density': float(f.get('vehicle_density')  or 0),
            'congestion_index':float(f.get('congestion_index') or 0),
        }

    def _rule_based(self, f: dict) -> dict:
        pm25  = float(f.get('pm25') or 0)
        pm10  = float(f.get('pm10') or 1)
        so2   = float(f.get('so2')  or 0)
        no2   = float(f.get('no2')  or 0)
        co    = float(f.get('co')   or 0)
        ratio = pm25 / max(pm10, 0.001)

        if   so2 > 50 and no2 > 80:          src = 'industrial'
        elif co  > 15 and no2 > 60:          src = 'vehicle_emissions'
        elif ratio < 0.35 and pm10 > 200:    src = 'construction_dust'
        elif pm25 > 100 and co > 10:         src = 'biomass_burning'
        elif pm10 > 350:                     src = 'dust_storm'
        else:                                src = 'unknown'

        probs = {c: 0.04 for c in CLASSES}
        probs[src] = 0.76
        return {
            'label': src,
            'confidence': 0.76,
            'probs': probs,
            'recommendations': RECOMMENDATIONS.get(src, []),
        }


class HotspotDetector:
    """DBSCAN-based geospatial pollution hotspot detector."""
    def __init__(self, eps_km: float = 0.8, min_samples: int = 2):
        self.eps_rad    = eps_km / 6371.0  # km to radians
        self.min_samples = min_samples

    def detect(self, sensors: list, threshold: int = 150) -> list:
        """
        sensors: list of (lat, lng, aqi, ward_id)
        Returns list of hotspot cluster dicts.
        """
        if len(sensors) < self.min_samples:
            return []

        try:
            from sklearn.cluster import DBSCAN
        except ImportError:
            print('sklearn not available — skipping DBSCAN')
            return []

        coords = np.radians([[s[0], s[1]] for s in sensors])
        labels = DBSCAN(
            eps=self.eps_rad,
            min_samples=self.min_samples,
            algorithm='ball_tree',
            metric='haversine'
        ).fit_predict(coords)

        hotspots = []
        for cid in set(labels):
            if cid == -1:
                continue
            mask   = [i for i, l in enumerate(labels) if l == cid]
            lats   = [sensors[i][0] for i in mask]
            lngs   = [sensors[i][1] for i in mask]
            aqis   = [float(sensors[i][2]) for i in mask]
            wards  = list(set(int(sensors[i][3]) for i in mask))
            avg_aqi = int(np.mean(aqis))
            max_aqi = int(np.max(aqis))

            hotspots.append({
                'clusterId':     int(cid),
                'centroid':      {'lat': float(np.mean(lats)), 'lng': float(np.mean(lngs))},
                'avgAQI':        avg_aqi,
                'maxAQI':        max_aqi,
                'sensorCount':   len(mask),
                'affectedWards': wards,
                'severity':      'critical' if avg_aqi > 250 else 'high' if avg_aqi > 200 else 'moderate',
            })

        return sorted(hotspots, key=lambda h: h['avgAQI'], reverse=True)
