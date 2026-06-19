-- AQI Dashboard — PostgreSQL + PostGIS Schema (Delhi)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS wards (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    zone        VARCHAR(50),
    population  INTEGER,
    area_sqkm   DECIMAL(8,2),
    hospital_respiratory_admissions INTEGER DEFAULT 0,
    elderly_population_pct DECIMAL(5,2) DEFAULT 0.0,
    boundary    GEOGRAPHY(POLYGON, 4326),
    centroid    GEOGRAPHY(POINT, 4326),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensors (
    id           SERIAL PRIMARY KEY,
    sensor_id    VARCHAR(50) UNIQUE NOT NULL,
    ward_id      INTEGER REFERENCES wards(id) ON DELETE CASCADE,
    name         VARCHAR(100),
    model        VARCHAR(50),
    location     GEOGRAPHY(POINT, 4326),
    address      TEXT,
    installed_at TIMESTAMPTZ,
    last_seen    TIMESTAMPTZ,
    is_active    BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sensors_ward ON sensors(ward_id);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id                 BIGSERIAL PRIMARY KEY,
    sensor_id          VARCHAR(50),
    ward_id            INTEGER REFERENCES wards(id),
    pm25               DECIMAL(8,2),
    pm10               DECIMAL(8,2),
    co                 DECIMAL(8,3),
    no2                DECIMAL(8,2),
    so2                DECIMAL(8,2),
    o3                 DECIMAL(8,2),
    aqi_calculated     INTEGER,
    dominant_pollutant VARCHAR(10),
    temperature        DECIMAL(5,1),
    humidity           DECIMAL(5,1),
    wind_speed         DECIMAL(6,2),
    wind_direction     DECIMAL(6,1),
    location           GEOGRAPHY(POINT, 4326),
    recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_readings_ward_time ON sensor_readings(ward_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_time ON sensor_readings(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_readings_aqi ON sensor_readings(aqi_calculated);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('sensor_readings', 'recorded_at', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS aqi_predictions (
    id                 SERIAL PRIMARY KEY,
    ward_id            INTEGER REFERENCES wards(id),
    generated_at       TIMESTAMPTZ NOT NULL,
    forecast_6h        INTEGER,
    forecast_12h       INTEGER,
    forecast_24h       INTEGER,
    confidence_low_6h  INTEGER,
    confidence_high_6h INTEGER,
    confidence_low_12h INTEGER,
    confidence_high_12h INTEGER,
    model_used         VARCHAR(50),
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT aqi_pred_ward_hour UNIQUE (ward_id, generated_at)
);

CREATE TABLE IF NOT EXISTS pollution_hotspots (
    id                SERIAL PRIMARY KEY,
    detected_at       TIMESTAMPTZ DEFAULT NOW(),
    resolved_at       TIMESTAMPTZ,
    avg_aqi           INTEGER,
    max_aqi           INTEGER,
    affected_wards    INTEGER[],
    source_type       VARCHAR(50),
    source_confidence DECIMAL(4,3),
    status            VARCHAR(20) DEFAULT 'active',
    sensor_count      INTEGER DEFAULT 0,
    polygon           GEOGRAPHY(POLYGON, 4326),
    centroid          GEOGRAPHY(POINT, 4326)
);
CREATE INDEX IF NOT EXISTS idx_hotspots_status ON pollution_hotspots(status);

CREATE TABLE IF NOT EXISTS traffic_data (
    id               SERIAL PRIMARY KEY,
    ward_id          INTEGER REFERENCES wards(id),
    vehicle_density  INTEGER,
    congestion_index DECIMAL(4,2),
    speed_avg_kmh    DECIMAL(5,1),
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_traffic_ward_time ON traffic_data(ward_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS weather_data (
    id             SERIAL PRIMARY KEY,
    ward_id        INTEGER REFERENCES wards(id),
    temperature    DECIMAL(5,1),
    humidity       DECIMAL(5,1),
    pressure       DECIMAL(7,2),
    wind_speed     DECIMAL(6,2),
    wind_direction DECIMAL(6,1),
    recorded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weather_ward_time ON weather_data(ward_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS satellite_readings (
    id               SERIAL PRIMARY KEY,
    source           VARCHAR(50) DEFAULT 'MODIS',
    acquisition_time TIMESTAMPTZ,
    fire_detected    BOOLEAN DEFAULT false,
    smoke_detected   BOOLEAN DEFAULT false,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Delhi Wards — 15 real Delhi monitoring locations ──────────────────────
INSERT INTO wards (name, zone, population, area_sqkm) VALUES
  ('Connaught Place',        'Central Delhi',     95000,  4.2),
  ('Chandni Chowk',          'North Delhi',      125000,  5.8),
  ('Anand Vihar',            'East Delhi',        88000,  6.4),
  ('Okhla Industrial Area',  'South Delhi',       45000,  8.9),
  ('Dwarka',                 'West Delhi',       210000, 18.5),
  ('Rohini',                 'North West Delhi', 185000, 22.1),
  ('Lajpat Nagar',           'South Delhi',       72000,  4.8),
  ('Wazirpur Industrial',    'North West Delhi',  38000,  7.2),
  ('Lodhi Road',             'Central Delhi',     55000,  6.1),
  ('Shahdara',               'East Delhi',        98000,  9.3),
  ('Najafgarh Road',         'West Delhi',        62000, 11.4),
  ('GTK Depot',              'North Delhi',       48000,  5.6),
  ('Mayur Vihar',            'East Delhi',        92000,  8.7),
  ('IGI Airport Area',       'South West Delhi',  35000, 12.2),
  ('Vasant Kunj',            'South West Delhi',  78000, 10.8)
ON CONFLICT DO NOTHING;
