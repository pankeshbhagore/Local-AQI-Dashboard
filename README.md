# 🌿 Hyper-Local AQI & Pollution Mitigation Dashboard

A full-stack, AI-powered smart-city environmental monitoring platform.  
Real-time sensor data · ML predictions · Hotspot detection · Citizen reports · Admin dashboard

---

## ⚡ Quick Start (Docker — 5 minutes)

```bash
# 1. Clone / enter the project
cd aqi-project

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set PG_PASS, JWT_SECRET at minimum

# 3. Start everything
docker-compose up -d

# 4. Run the IoT sensor simulator
cd tools && npm install mqtt && node sensor-simulator.js

# 5. Open the dashboard
open http://localhost:3000

# Login: admin@aqi.com / admin123
```

That's it. All 8 services start automatically.

---

## 🏗️ Architecture

```
IoT Sensors (MQTT) ──► MQTT Broker ──► Node.js Backend ──► PostgreSQL+PostGIS
Satellite APIs ──────────────────────► Kafka Stream  ──► MongoDB (reports)
Weather/Traffic APIs ────────────────► Python ML Service ──► Redis (cache)
Citizen Mobile App ──────────────────► REST API + Socket.IO ──► React Dashboard
```

## 📦 Services

| Service        | Port  | Description                          |
|----------------|-------|--------------------------------------|
| Frontend       | 3000  | React admin dashboard                |
| Backend API    | 5000  | Node.js / Express + Socket.IO        |
| ML Service     | 8000  | Python FastAPI — LSTM + XGBoost      |
| PostgreSQL     | 5432  | Sensor readings + geospatial (PostGIS)|
| MongoDB        | 27017 | Reports, alerts, users               |
| MQTT Broker    | 1883  | IoT sensor data ingestion            |
| Kafka          | 9092  | High-volume streaming buffer         |
| Redis          | 6379  | Caching + session storage            |

---

## 🛠️ Local Development (without Docker)

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15 with PostGIS
- MongoDB 6+
- Mosquitto MQTT broker

### Step 1 — Database Setup
```bash
createdb aqi_db
psql -d aqi_db -c "CREATE EXTENSION postgis;"
psql -d aqi_db -f database/schema.sql
```

### Step 2 — Backend
```bash
cd backend
npm install
cp ../.env.example .env   # edit values
npm run dev               # starts on :5000
```

### Step 3 — ML Service
```bash
cd ml-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Step 4 — Frontend
```bash
cd frontend
npm install
echo "REACT_APP_API_URL=http://localhost:5000" > .env
npm start    # opens browser on :3000
```

### Step 5 — Sensor Simulator
```bash
cd tools
npm install mqtt
node sensor-simulator.js   # publishes fake sensor data to MQTT every 5s
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint                | Description            |
|--------|-------------------------|------------------------|
| POST   | /api/v1/auth/login      | Login → JWT token      |
| POST   | /api/v1/auth/register   | Register new user      |
| POST   | /api/v1/auth/refresh    | Refresh access token   |

### AQI Data
| Method | Endpoint                     | Description                   |
|--------|------------------------------|-------------------------------|
| GET    | /api/v1/aqi/map              | All ward AQI as GeoJSON       |
| GET    | /api/v1/aqi/ward/:id         | Single ward current + history |
| GET    | /api/v1/aqi/city             | City average stats            |
| GET    | /api/v1/aqi/trend            | 24h hourly trend              |

### Predictions
| Method | Endpoint                          | Description               |
|--------|-----------------------------------|---------------------------|
| GET    | /api/v1/predictions/ward/:id      | 6h/12h/24h AQI forecast   |
| GET    | /api/v1/predictions/hotspots      | DBSCAN cluster detection  |
| GET    | /api/v1/predictions/source/:id    | XGBoost source detection  |

### Reports & Alerts
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | /api/v1/reports             | Submit citizen report    |
| GET    | /api/v1/reports             | List reports (admin)     |
| PATCH  | /api/v1/reports/:id/verify  | Verify/reject report     |
| GET    | /api/v1/alerts              | Get all alerts           |

---

## 🤖 ML Models

### 1. AQI Predictor (LSTM)
- **Input**: 72-hour window of [PM2.5, PM10, CO, NO2, SO2, O3, temperature, humidity, wind]
- **Output**: AQI forecast at +6h, +12h, +24h with confidence intervals
- **Fallback**: Statistical exponential smoothing if model not trained

### 2. Source Detector (XGBoost)
- **Input**: Current pollutant readings + weather + traffic density
- **Output**: Source class (construction/traffic/biomass/industrial) + confidence %
- **Fallback**: Rule-based attribution

### 3. Hotspot Detector (DBSCAN)
- **Input**: GPS coordinates of high-AQI sensors
- **Output**: GeoJSON cluster polygons with severity labels

### Training new models
```bash
cd ml-service
python -c "
from app.models.aqi_predictor import AQIPredictor
model = AQIPredictor.build_training_model()
# Load your training data → model.fit(X_train, y_train, epochs=50)
model.save('app/models/saved/aqi_lstm.h5')
print('Model saved.')
"
```

---

## 🔔 Real-Time Features (Socket.IO)

Connect from your frontend:
```javascript
const socket = io('http://localhost:5000');
socket.emit('subscribe:ward', 8);     // subscribe to ward 8 updates
socket.on('aqi:update', (data) => console.log(data));
socket.on('alert:new',  (alert) => console.log(alert));
socket.on('city:update',(data)  => console.log(data));
```

---

## 📁 Project Structure

```
aqi-project/
├── backend/                   Node.js API
│   └── src/
│       ├── routes/            REST API endpoints
│       ├── services/          MQTT, Kafka, Alerts, AQI Calculator
│       ├── models/            MongoDB schemas
│       └── middleware/        Auth, error handler
├── ml-service/                Python FastAPI
│   └── app/
│       ├── main.py            API endpoints
│       └── models/            LSTM, XGBoost, DBSCAN
├── frontend/                  React TypeScript dashboard
│   └── src/
│       ├── pages/             Dashboard, Map, Forecast, etc.
│       ├── components/        Charts, MetricCards
│       ├── context/           Auth, Socket providers
│       └── services/          Axios API calls
├── database/
│   └── schema.sql             PostgreSQL + PostGIS schema
├── infra/
│   ├── nginx/nginx.conf       Reverse proxy config
│   └── mosquitto/             MQTT broker config
├── tools/
│   └── sensor-simulator.js   IoT data simulator
├── docker-compose.yml         Full stack orchestration
└── .env.example               Environment template
```

---

## 🚀 Production Deployment

### AWS / GCP Checklist
- [ ] Change all passwords in .env (PG_PASS, JWT_SECRET, etc.)
- [ ] Set FRONTEND_URL to your domain
- [ ] Enable HTTPS in nginx (add SSL cert)
- [ ] Set S3_BUCKET for citizen report photos
- [ ] Set Firebase credentials for push notifications
- [ ] Set up pg_cron for materialized view refresh
- [ ] Configure Kafka retention policies
- [ ] Set up CloudWatch / Prometheus monitoring

### Scale horizontally
```bash
docker-compose up -d --scale backend=3 --scale ml-service=2
```

---

## 🧪 Testing

```bash
# Backend unit tests
cd backend && npm test

# ML service tests
cd ml-service && pytest

# E2E tests
cd frontend && npm test

# API smoke test
curl http://localhost:5000/health
curl http://localhost:8000/health
```

---

## 📞 Support

Open an issue on GitHub or refer to the full project documentation (`AQI_Project_Documentation.docx`).
