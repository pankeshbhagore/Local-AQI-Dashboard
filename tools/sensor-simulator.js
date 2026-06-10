#!/usr/bin/env node
/**
 * Delhi IoT Sensor Simulator
 * Simulates 15 AQI sensors across Delhi sending real MQTT data.
 * Run: node sensor-simulator.js
 */
require('dotenv').config({ path: '../.env' });
const mqtt = require('mqtt');

const BROKER   = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const INTERVAL = parseInt(process.argv[2] || '5000');

const client = mqtt.connect(BROKER, {
  clientId: `delhi-iot-simulator-${Date.now()}`,
  reconnectPeriod: 3000,
});

// ── Real Delhi ward pollution profiles ────────────────────────────────────
const WARDS = [
  { id:1,  name:'Connaught Place',       lat:28.6292, lng:77.2182, pm25:95,  no2:85, so2:18, co:3.2, type:'commercial'  },
  { id:2,  name:'Chandni Chowk',         lat:28.6506, lng:77.2302, pm25:130, no2:95, so2:25, co:4.5, type:'mixed'       },
  { id:3,  name:'Anand Vihar',           lat:28.6469, lng:77.3153, pm25:175, no2:110,so2:35, co:5.8, type:'transport'   },
  { id:4,  name:'Okhla Industrial Area', lat:28.5355, lng:77.2731, pm25:155, no2:130,so2:75, co:5.2, type:'industrial'  },
  { id:5,  name:'Dwarka',               lat:28.5921, lng:77.0460, pm25:65,  no2:55, so2:15, co:2.1, type:'residential' },
  { id:6,  name:'Rohini',               lat:28.7340, lng:77.1183, pm25:85,  no2:65, so2:20, co:2.8, type:'residential' },
  { id:7,  name:'Lajpat Nagar',         lat:28.5696, lng:77.2433, pm25:110, no2:90, so2:28, co:3.8, type:'commercial'  },
  { id:8,  name:'Wazirpur Industrial',  lat:28.6921, lng:77.1579, pm25:185, no2:145,so2:90, co:6.5, type:'industrial'  },
  { id:9,  name:'Lodhi Road',           lat:28.5969, lng:77.2183, pm25:55,  no2:45, so2:12, co:1.8, type:'residential' },
  { id:10, name:'Shahdara',             lat:28.6694, lng:77.2889, pm25:145, no2:105,so2:32, co:4.8, type:'mixed'       },
  { id:11, name:'Najafgarh Road',       lat:28.6080, lng:77.0200, pm25:120, no2:85, so2:28, co:3.5, type:'transport'   },
  { id:12, name:'GTK Depot',            lat:28.7121, lng:77.1534, pm25:160, no2:120,so2:40, co:5.0, type:'transport'   },
  { id:13, name:'Mayur Vihar',          lat:28.6094, lng:77.2962, pm25:75,  no2:60, so2:18, co:2.4, type:'residential' },
  { id:14, name:'IGI Airport Area',     lat:28.5562, lng:77.1000, pm25:100, no2:80, so2:22, co:3.2, type:'transport'   },
  { id:15, name:'Vasant Kunj',          lat:28.5197, lng:77.1545, pm25:60,  no2:50, so2:14, co:2.0, type:'residential' },
];

function jitter(base, pct = 0.15) {
  return +(base * (1 + (Math.random() - 0.5) * 2 * pct)).toFixed(2);
}
function diurnalFactor() {
  const h = new Date().getHours();
  if (h >= 7  && h <= 10) return 1.45;
  if (h >= 17 && h <= 21) return 1.55;
  if (h >= 0  && h <=  5) return 0.60;
  return 1.0;
}
function generateReading(ward) {
  const df  = diurnalFactor();
  const pm25 = jitter(ward.pm25 * df);
  const pm10 = jitter(pm25 * 1.7);
  const co   = jitter(ward.co * df, 0.2);
  const no2  = jitter(ward.no2 * df);
  const so2  = ward.type === 'industrial' ? jitter(ward.so2 * df * 1.5) : jitter(ward.so2 * df);
  const o3   = jitter(Math.max(5, 35 - pm25 * 0.07));
  const temperature = jitter(25, 0.08);
  const humidity    = jitter(62, 0.1);
  const windSpeed   = jitter(3.2, 0.4);
  const windDir     = Math.round(Math.random() * 360);
  return {
    wardId: ward.id,
    pm25, pm10, co, no2, so2, o3,
    temperature, humidity, windSpeed, windDirection: windDir,
    lat: ward.lat + (Math.random() - 0.5) * 0.001,
    lng: ward.lng + (Math.random() - 0.5) * 0.001,
  };
}

client.on('connect', () => {
  console.log(`✅ Delhi Sensor Simulator connected to ${BROKER}`);
  console.log(`📡 Simulating ${WARDS.length} sensors across Delhi every ${INTERVAL}ms\n`);
  console.log('Wards monitored:');
  WARDS.forEach(w => console.log(`  Ward ${w.id}: ${w.name} (${w.type})`));
  console.log('');

  function publishAll() {
    WARDS.forEach(ward => {
      const sensorId = `DL-${String(ward.id).padStart(3, '0')}`;
      const reading  = generateReading(ward);
      client.publish(`sensors/${sensorId}/readings`, JSON.stringify(reading), { qos: 1 });
    });
    console.log(`[${new Date().toLocaleTimeString()}] Published ${WARDS.length} Delhi sensor readings`);
  }
  publishAll();
  setInterval(publishAll, INTERVAL);
});

client.on('error', err => console.error('MQTT error:', err.message));
client.on('offline', ()  => console.warn('⚠️ MQTT offline — reconnecting…'));
