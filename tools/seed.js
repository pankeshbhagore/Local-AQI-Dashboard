#!/usr/bin/env node
/**
 * Delhi AQI Dashboard — Full Seed (100+ Wards)
 */
require('dotenv').config({ path: '../.env' });
const { Pool }  = require('pg');
const mongoose  = require('mongoose');
const bcrypt    = require('bcrypt');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost', port: parseInt(process.env.PG_PORT||'5432'),
  database: process.env.PG_DB||'aqi_db', user: process.env.PG_USER||'postgres',
  password: process.env.PG_PASS||'secret123',
});
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aqi_reports';

// 100+ Delhi wards — real GPS, pollution profiles
const DELHI_WARDS = [
  {id:1, name:'Connaught Place',       district:'Central Delhi',      lat:28.6292,lng:77.2182,pm25:95, no2:85, so2:18,co:3.2, type:'commercial'},
  {id:2, name:'Chandni Chowk',         district:'North Delhi',        lat:28.6506,lng:77.2302,pm25:130,no2:95, so2:25,co:4.5, type:'mixed'},
  {id:3, name:'Civil Lines',           district:'North Delhi',        lat:28.6820,lng:77.2220,pm25:75, no2:55, so2:14,co:2.4, type:'residential'},
  {id:4, name:'Kashmere Gate',         district:'North Delhi',        lat:28.6650,lng:77.2280,pm25:115,no2:80, so2:22,co:3.8, type:'commercial'},
  {id:5, name:'Sadar Bazar',           district:'North Delhi',        lat:28.6590,lng:77.2100,pm25:125,no2:90, so2:28,co:4.2, type:'commercial'},
  {id:6, name:'Karol Bagh',            district:'West Delhi',         lat:28.6450,lng:77.1890,pm25:110,no2:78, so2:20,co:3.5, type:'commercial'},
  {id:7, name:'Patel Nagar',           district:'West Delhi',         lat:28.6360,lng:77.1740,pm25:80, no2:62, so2:16,co:2.8, type:'residential'},
  {id:8, name:'Rajinder Nagar',        district:'Central Delhi',      lat:28.6440,lng:77.2030,pm25:70, no2:55, so2:14,co:2.4, type:'residential'},
  {id:9, name:'Lodhi Road',            district:'South Delhi',        lat:28.5969,lng:77.2183,pm25:55, no2:45, so2:12,co:1.8, type:'residential'},
  {id:10,name:'Lodi Colony',           district:'South Delhi',        lat:28.5920,lng:77.2260,pm25:52, no2:42, so2:11,co:1.7, type:'residential'},
  {id:11,name:'Rohini Sector 1-7',     district:'North West Delhi',   lat:28.7340,lng:77.1183,pm25:85, no2:65, so2:20,co:2.8, type:'residential'},
  {id:12,name:'Rohini Sector 8-19',    district:'North West Delhi',   lat:28.7500,lng:77.1050,pm25:88, no2:68, so2:21,co:2.9, type:'residential'},
  {id:13,name:'Pitampura',             district:'North West Delhi',   lat:28.7020,lng:77.1310,pm25:90, no2:70, so2:22,co:3.0, type:'residential'},
  {id:14,name:'Wazirpur Industrial',   district:'North West Delhi',   lat:28.6921,lng:77.1579,pm25:185,no2:145,so2:90,co:6.5, type:'industrial'},
  {id:15,name:'GTK Depot / Azadpur',   district:'North Delhi',        lat:28.7121,lng:77.1534,pm25:160,no2:120,so2:40,co:5.0, type:'transport'},
  {id:16,name:'Burari',                district:'North Delhi',        lat:28.7500,lng:77.2080,pm25:95, no2:72, so2:22,co:3.2, type:'residential'},
  {id:17,name:'Mukherji Nagar',        district:'North Delhi',        lat:28.7060,lng:77.2040,pm25:85, no2:65, so2:18,co:2.9, type:'residential'},
  {id:18,name:'Model Town',            district:'North Delhi',        lat:28.7200,lng:77.1920,pm25:82, no2:63, so2:17,co:2.7, type:'residential'},
  {id:19,name:'Shalimar Bagh',         district:'North West Delhi',   lat:28.7180,lng:77.1640,pm25:88, no2:67, so2:20,co:2.9, type:'residential'},
  {id:20,name:'Keshav Puram',          district:'North West Delhi',   lat:28.7000,lng:77.1450,pm25:92, no2:70, so2:22,co:3.1, type:'residential'},
  {id:21,name:'Anand Vihar',           district:'East Delhi',         lat:28.6469,lng:77.3153,pm25:175,no2:110,so2:35,co:5.8, type:'transport'},
  {id:22,name:'Patparganj',            district:'East Delhi',         lat:28.6240,lng:77.2980,pm25:125,no2:90, so2:28,co:4.2, type:'mixed'},
  {id:23,name:'Mayur Vihar Phase 1',   district:'East Delhi',         lat:28.6094,lng:77.2962,pm25:75, no2:60, so2:18,co:2.4, type:'residential'},
  {id:24,name:'Mayur Vihar Phase 2-3', district:'East Delhi',         lat:28.6050,lng:77.3100,pm25:78, no2:62, so2:18,co:2.5, type:'residential'},
  {id:25,name:'Shahdara',              district:'East Delhi',         lat:28.6694,lng:77.2889,pm25:145,no2:105,so2:32,co:4.8, type:'mixed'},
  {id:26,name:'Vivek Vihar',           district:'East Delhi',         lat:28.6720,lng:77.3200,pm25:100,no2:75, so2:24,co:3.4, type:'residential'},
  {id:27,name:'Preet Vihar',           district:'East Delhi',         lat:28.6430,lng:77.3020,pm25:95, no2:72, so2:22,co:3.2, type:'residential'},
  {id:28,name:'Laxmi Nagar',           district:'East Delhi',         lat:28.6310,lng:77.2770,pm25:110,no2:82, so2:26,co:3.7, type:'commercial'},
  {id:29,name:'Geeta Colony',          district:'East Delhi',         lat:28.6580,lng:77.2740,pm25:92, no2:70, so2:22,co:3.1, type:'residential'},
  {id:30,name:'Mandawali',             district:'East Delhi',         lat:28.6280,lng:77.3080,pm25:98, no2:74, so2:23,co:3.3, type:'residential'},
  {id:31,name:'Okhla Industrial Area', district:'South East Delhi',   lat:28.5355,lng:77.2731,pm25:155,no2:130,so2:75,co:5.2, type:'industrial'},
  {id:32,name:'Sarita Vihar',          district:'South East Delhi',   lat:28.5410,lng:77.2940,pm25:68, no2:52, so2:15,co:2.2, type:'residential'},
  {id:33,name:'Jasola',                district:'South East Delhi',   lat:28.5490,lng:77.2890,pm25:72, no2:56, so2:16,co:2.4, type:'mixed'},
  {id:34,name:'Badarpur',              district:'South East Delhi',   lat:28.5030,lng:77.2880,pm25:135,no2:100,so2:30,co:4.5, type:'mixed'},
  {id:35,name:'Lajpat Nagar',          district:'South Delhi',        lat:28.5696,lng:77.2433,pm25:110,no2:90, so2:28,co:3.8, type:'commercial'},
  {id:36,name:'Greater Kailash',       district:'South Delhi',        lat:28.5501,lng:77.2335,pm25:72, no2:58, so2:16,co:2.4, type:'residential'},
  {id:37,name:'Malviya Nagar',         district:'South Delhi',        lat:28.5362,lng:77.2074,pm25:65, no2:52, so2:14,co:2.1, type:'residential'},
  {id:38,name:'Hauz Khas',             district:'South Delhi',        lat:28.5494,lng:77.2001,pm25:62, no2:50, so2:14,co:2.0, type:'mixed'},
  {id:39,name:'Vasant Vihar',          district:'South West Delhi',   lat:28.5586,lng:77.1735,pm25:55, no2:44, so2:12,co:1.8, type:'residential'},
  {id:40,name:'Vasant Kunj',           district:'South West Delhi',   lat:28.5197,lng:77.1545,pm25:58, no2:48, so2:13,co:1.9, type:'residential'},
  {id:41,name:'Dwarka Sector 1-10',    district:'South West Delhi',   lat:28.5921,lng:77.0460,pm25:65, no2:55, so2:15,co:2.1, type:'residential'},
  {id:42,name:'Dwarka Sector 11-23',   district:'South West Delhi',   lat:28.5700,lng:77.0310,pm25:62, no2:52, so2:14,co:2.0, type:'residential'},
  {id:43,name:'IGI Airport Area',      district:'South West Delhi',   lat:28.5562,lng:77.1000,pm25:100,no2:80, so2:22,co:3.2, type:'transport'},
  {id:44,name:'Palam',                 district:'South West Delhi',   lat:28.5850,lng:77.0820,pm25:78, no2:62, so2:18,co:2.6, type:'residential'},
  {id:45,name:'Mahipalpur',            district:'South West Delhi',   lat:28.5300,lng:77.1200,pm25:82, no2:65, so2:18,co:2.7, type:'mixed'},
  {id:46,name:'Kapashera',             district:'South West Delhi',   lat:28.5050,lng:77.0760,pm25:118,no2:88, so2:35,co:4.0, type:'industrial'},
  {id:47,name:'Bijwasan',              district:'South West Delhi',   lat:28.5020,lng:77.0500,pm25:75, no2:60, so2:18,co:2.5, type:'mixed'},
  {id:48,name:'Najafgarh Road',        district:'South West Delhi',   lat:28.6080,lng:77.0200,pm25:120,no2:85, so2:28,co:3.5, type:'transport'},
  {id:49,name:'Uttam Nagar',           district:'West Delhi',         lat:28.6130,lng:77.0590,pm25:95, no2:72, so2:22,co:3.2, type:'residential'},
  {id:50,name:'Janakpuri',             district:'West Delhi',         lat:28.6280,lng:77.0820,pm25:78, no2:62, so2:18,co:2.6, type:'residential'},
  {id:51,name:'Rajouri Garden',        district:'West Delhi',         lat:28.6490,lng:77.1210,pm25:98, no2:75, so2:22,co:3.3, type:'commercial'},
  {id:52,name:'Tilak Nagar',           district:'West Delhi',         lat:28.6370,lng:77.1070,pm25:92, no2:70, so2:20,co:3.0, type:'mixed'},
  {id:53,name:'Vikaspuri',             district:'West Delhi',         lat:28.6580,lng:77.0690,pm25:85, no2:66, so2:19,co:2.8, type:'residential'},
  {id:54,name:'Punjabi Bagh',          district:'West Delhi',         lat:28.6720,lng:77.1350,pm25:88, no2:68, so2:20,co:2.9, type:'residential'},
  {id:55,name:'Paschim Vihar',         district:'West Delhi',         lat:28.6810,lng:77.1050,pm25:90, no2:70, so2:21,co:3.0, type:'residential'},
  {id:56,name:'Nangloi',               district:'West Delhi',         lat:28.6830,lng:77.0720,pm25:105,no2:78, so2:25,co:3.5, type:'residential'},
  {id:57,name:'Nilothi / Mundka',      district:'West Delhi',         lat:28.6920,lng:77.0430,pm25:130,no2:95, so2:45,co:4.5, type:'industrial'},
  {id:58,name:'Mangolpuri',            district:'North West Delhi',   lat:28.7190,lng:77.0950,pm25:108,no2:80, so2:28,co:3.6, type:'residential'},
  {id:59,name:'Sultan Puri',           district:'North West Delhi',   lat:28.7120,lng:77.0720,pm25:112,no2:82, so2:30,co:3.8, type:'residential'},
  {id:60,name:'Bawana Industrial',     district:'North West Delhi',   lat:28.7912,lng:77.0345,pm25:165,no2:130,so2:80,co:5.8, type:'industrial'},
  {id:61,name:'Narela Industrial',     district:'North Delhi',        lat:28.8520,lng:77.0950,pm25:155,no2:120,so2:65,co:5.2, type:'industrial'},
  {id:62,name:'Alipur',                district:'North Delhi',        lat:28.8110,lng:77.1340,pm25:75, no2:58, so2:18,co:2.5, type:'rural'},
  {id:63,name:'Badli',                 district:'North West Delhi',   lat:28.7350,lng:77.1720,pm25:140,no2:105,so2:50,co:4.8, type:'industrial'},
  {id:64,name:'Tri Nagar',             district:'North West Delhi',   lat:28.6980,lng:77.1680,pm25:95, no2:72, so2:22,co:3.2, type:'residential'},
  {id:65,name:'India Gate / Rajpath',  district:'New Delhi',          lat:28.6129,lng:77.2295,pm25:70, no2:55, so2:15,co:2.3, type:'government'},
  {id:66,name:'Chanakyapuri',          district:'New Delhi',          lat:28.5986,lng:77.1966,pm25:48, no2:40, so2:10,co:1.6, type:'government'},
  {id:67,name:'Pragati Maidan',        district:'Central Delhi',      lat:28.6192,lng:77.2506,pm25:88, no2:68, so2:20,co:2.9, type:'government'},
  {id:68,name:'Mustafabad',            district:'North East Delhi',   lat:28.7190,lng:77.2900,pm25:145,no2:108,so2:35,co:4.8, type:'residential'},
  {id:69,name:'Bhajanpura',            district:'North East Delhi',   lat:28.7020,lng:77.2790,pm25:135,no2:100,so2:32,co:4.5, type:'residential'},
  {id:70,name:'Ghazipur',              district:'East Delhi',         lat:28.6254,lng:77.3220,pm25:128,no2:95, so2:30,co:4.3, type:'mixed'},
  {id:71,name:'Kondli',                district:'East Delhi',         lat:28.5990,lng:77.3310,pm25:88, no2:68, so2:20,co:2.9, type:'residential'},
  {id:72,name:'Trilokpuri',            district:'East Delhi',         lat:28.6130,lng:77.3100,pm25:110,no2:82, so2:26,co:3.7, type:'residential'},
  {id:73,name:'Nand Nagri',            district:'North East Delhi',   lat:28.6900,lng:77.3050,pm25:125,no2:92, so2:30,co:4.2, type:'residential'},
  {id:74,name:'Kalindi Kunj',          district:'South East Delhi',   lat:28.5530,lng:77.3080,pm25:65, no2:52, so2:15,co:2.1, type:'residential'},
  {id:75,name:'New Friends Colony',    district:'South East Delhi',   lat:28.5640,lng:77.2800,pm25:60, no2:48, so2:13,co:2.0, type:'residential'},
  {id:76,name:'Madanpur Khadar',       district:'South East Delhi',   lat:28.5180,lng:77.3200,pm25:118,no2:88, so2:28,co:3.9, type:'mixed'},
  {id:77,name:'Sangam Vihar',          district:'South Delhi',        lat:28.5050,lng:77.2490,pm25:145,no2:108,so2:35,co:4.8, type:'residential'},
  {id:78,name:'Deoli',                 district:'South West Delhi',   lat:28.4960,lng:77.2120,pm25:128,no2:95, so2:30,co:4.3, type:'residential'},
  {id:79,name:'Wazirabad Industrial',  district:'North East Delhi',   lat:28.7350,lng:77.2580,pm25:155,no2:118,so2:75,co:5.2, type:'industrial'},
  {id:80,name:'Lawrence Road Ind.',    district:'North West Delhi',   lat:28.6980,lng:77.1900,pm25:148,no2:112,so2:65,co:5.0, type:'industrial'},
  {id:81,name:'Jhilmil Industrial',    district:'East Delhi',         lat:28.6580,lng:77.3180,pm25:135,no2:100,so2:55,co:4.6, type:'industrial'},
  {id:82,name:'New Delhi Railway Stn', district:'Central Delhi',      lat:28.6426,lng:77.2201,pm25:120,no2:90, so2:28,co:4.0, type:'transport'},
  {id:83,name:'Nizamuddin Station',    district:'South East Delhi',   lat:28.5877,lng:77.2440,pm25:105,no2:80, so2:24,co:3.5, type:'transport'},
  {id:84,name:'Kashmere Gate ISBT',    district:'North Delhi',        lat:28.6650,lng:77.2280,pm25:140,no2:105,so2:35,co:4.7, type:'transport'},
  {id:85,name:'Najafgarh',             district:'South West Delhi',   lat:28.6080,lng:77.0050,pm25:72, no2:58, so2:18,co:2.4, type:'rural'},
  {id:86,name:'Chattarpur',            district:'South West Delhi',   lat:28.4990,lng:77.1680,pm25:80, no2:62, so2:18,co:2.6, type:'mixed'},
  {id:87,name:'Mehrauli',              district:'South West Delhi',   lat:28.5238,lng:77.1862,pm25:75, no2:60, so2:17,co:2.5, type:'mixed'},
  {id:88,name:'Kalkaji',               district:'South East Delhi',   lat:28.5480,lng:77.2590,pm25:100,no2:76, so2:23,co:3.3, type:'mixed'},
  {id:89,name:'Nehru Place',           district:'South East Delhi',   lat:28.5490,lng:77.2523,pm25:108,no2:82, so2:25,co:3.6, type:'commercial'},
  {id:90,name:'Sarojini Nagar',        district:'South West Delhi',   lat:28.5763,lng:77.1953,pm25:68, no2:54, so2:15,co:2.2, type:'residential'},
  {id:91,name:'Kidwai Nagar',          district:'South Delhi',        lat:28.5800,lng:77.2160,pm25:65, no2:52, so2:14,co:2.1, type:'residential'},
  {id:92,name:'Moti Bagh',             district:'South Delhi',        lat:28.5893,lng:77.1990,pm25:62, no2:50, so2:14,co:2.0, type:'residential'},
  {id:93,name:'R K Puram',             district:'South West Delhi',   lat:28.5672,lng:77.1792,pm25:68, no2:54, so2:15,co:2.2, type:'residential'},
  {id:94,name:'Dakshinpuri',           district:'South Delhi',        lat:28.5140,lng:77.2450,pm25:138,no2:102,so2:32,co:4.6, type:'residential'},
  {id:95,name:'Ambedkar Nagar',        district:'South Delhi',        lat:28.5090,lng:77.2580,pm25:132,no2:98, so2:30,co:4.4, type:'residential'},
  {id:96,name:'Tughlakabad',           district:'South East Delhi',   lat:28.4760,lng:77.2850,pm25:115,no2:86, so2:28,co:3.8, type:'mixed'},
  {id:97,name:'Badarpur Border',       district:'South East Delhi',   lat:28.4870,lng:77.2990,pm25:145,no2:108,so2:36,co:4.8, type:'transport'},
  {id:98,name:'Shahdara Industrial',   district:'East Delhi',         lat:28.6750,lng:77.2980,pm25:148,no2:112,so2:65,co:5.0, type:'industrial'},
  {id:99,name:'Badarpura Industrial',  district:'East Delhi',         lat:28.6340,lng:77.3240,pm25:138,no2:105,so2:58,co:4.7, type:'industrial'},
  {id:100,name:'Tughlakabad Extension',district:'South East Delhi',   lat:28.4700,lng:77.2780,pm25:122,no2:90, so2:30,co:4.1, type:'mixed'},
  {id:101,name:'Dhansa / Najafgarh Outskirts',district:'South West Delhi',lat:28.5680,lng:76.9650,pm25:55,no2:42,so2:12,co:1.8,type:'rural'},
];

function jitter(v, p=0.15) { return Math.max(0, v*(1+(Math.random()-.5)*2*p)); }
function diurnal(h) {
  if (h>=7  && h<=10) return 1.50;
  if (h>=17 && h<=21) return 1.60;
  if (h>=0  && h<=5)  return 0.58;
  return 1.0;
}
function calcAQI(pm25) {
  const bp=[[0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],[55.5,150.4,151,200],[150.5,250.4,201,300],[250.5,500,301,500]];
  for (const [cl,ch,il,ih] of bp) if(pm25>=cl&&pm25<=ch) return Math.round(((ih-il)/(ch-cl))*(pm25-cl)+il);
  return 500;
}

async function seedWards() {
  console.log('🌱 Seeding 101 Delhi wards…');
  for (const w of DELHI_WARDS) {
    await pool.query(
      `INSERT INTO wards (id, name, zone, centroid)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4,$5),4326))
       ON CONFLICT (id) DO NOTHING`,
      [w.id, w.name, w.district, w.lng, w.lat]
    );
  }
}

async function seedSensors() {
  console.log('🌱 Seeding 101 Delhi ward sensors…');
  for (const w of DELHI_WARDS) {
    await pool.query(
      `INSERT INTO sensors (sensor_id, ward_id, name, model, location, installed_at, last_seen, is_active)
       VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5,$6),4326), NOW()-INTERVAL '30 days', NOW(), true)
       ON CONFLICT (sensor_id) DO NOTHING`,
      [`DL-${String(w.id).padStart(3,'0')}`, w.id, `Delhi CPCB Sensor - ${w.name}`, 'CPCB-AQM-S4', w.lng, w.lat]
    );
  }
  console.log(`  ✅ ${DELHI_WARDS.length} sensors seeded`);
}

async function seedReadings() {
  console.log('🌱 Seeding 24h readings for 101 Delhi wards…');
  const now = Date.now(); let count = 0;
  const BATCH = 250; let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const ph = batch.map((_,i)=>{const b=i*16;return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},ST_SetSRID(ST_MakePoint($${b+14},$${b+15}),4326),$${b+16})`;}).join(',');
    await pool.query(`INSERT INTO sensor_readings (sensor_id,ward_id,pm25,pm10,co,no2,so2,o3,aqi_calculated,temperature,humidity,wind_speed,wind_direction,location,recorded_at) VALUES ${ph} ON CONFLICT DO NOTHING`, batch.flat());
    count += batch.length; batch = [];
    process.stdout.write(`\r  ${count.toLocaleString()} rows…`);
  };
  for (const w of DELHI_WARDS) {
    for (let m=24*60; m>=0; m-=5) {
      const ts=new Date(now-m*60*1000), h=ts.getHours(), df=diurnal(h);
      const pm25=jitter(w.pm25*df), pm10=jitter(pm25*1.7), no2=jitter(w.no2*df);
      const so2=jitter(w.so2*df), co=jitter(w.co*df), o3=Math.max(2,jitter(35-pm25*0.07));
      const aqi=calcAQI(pm25);
      batch.push([`DL-${String(w.id).padStart(3,'0')}`,w.id,+pm25.toFixed(2),+pm10.toFixed(2),+co.toFixed(3),+no2.toFixed(2),+so2.toFixed(2),+o3.toFixed(2),aqi,+jitter(25,0.06).toFixed(1),+jitter(62,0.08).toFixed(1),+jitter(3.2,0.3).toFixed(2),Math.round(Math.random()*360),w.lng,w.lat,ts]);
      if (batch.length>=BATCH) await flush();
    }
  }
  await flush();
  console.log(`\n  ✅ ${count.toLocaleString()} readings seeded`);
}

async function seedUsers() {
  console.log('🌱 Seeding users…');
  await mongoose.connect(MONGO_URI);
  const userSchema = new mongoose.Schema({
    email:{type:String,unique:true,lowercase:true,required:true},passwordHash:{type:String,required:true},
    role:{type:String,default:'citizen'},name:{type:String},wardId:{type:Number,default:null},
    wardName:{type:String,default:null},isActive:{type:Boolean,default:true},
    rewardPoints:{type:Number,default:0},rewardLevel:{type:String,default:'Bronze'},
    totalReports:{type:Number,default:0},verifiedReports:{type:Number,default:0},
    rejectedReports:{type:Number,default:0},incorrectStreak:{type:Number,default:0},
    isSuspended:{type:Boolean,default:false},lastLogin:{type:Date,default:null},
  },{timestamps:true});
  userSchema.methods.toPublicJSON=function(){return{id:this._id,email:this.email,name:this.name,role:this.role,wardId:this.wardId,wardName:this.wardName,rewardPoints:this.rewardPoints,rewardLevel:this.rewardLevel};};
  const User = mongoose.models.User || mongoose.model('User', userSchema);

  const USERS = [
    {email:'admin@delhi-aqi.com',  password:'admin123',  role:'admin',   name:'Delhi AQI Administrator',   wardId:null, wardName:null},
    {email:'officer@delhi-aqi.com',password:'officer123',role:'officer', name:'Field Officer Amit Sharma',  wardId:21,   wardName:'Anand Vihar'},
    {email:'citizen@delhi-aqi.com',password:'citizen123',role:'citizen', name:'Priya Verma',                wardId:1,    wardName:'Connaught Place'},
  ];
  for (const u of USERS) {
    if (await User.findOne({email:u.email})) { console.log(`  ⏭️  ${u.email} exists`); continue; }
    await User.create({email:u.email,passwordHash:await bcrypt.hash(u.password,12),role:u.role,name:u.name,wardId:u.wardId,wardName:u.wardName});
    console.log(`  ✅ [${u.role.padEnd(8)}] ${u.email.padEnd(28)} / ${u.password}`);
  }
  await mongoose.disconnect();
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Delhi AQI Dashboard — Full 101-Ward Seeder  ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  try { await pool.query('SELECT 1'); console.log('✅ PostgreSQL connected\n'); }
  catch(e) { console.error('❌ PG failed:', e.message); process.exit(1); }
  try {
    await seedWards();
    await seedSensors();
    await seedReadings();
    await seedUsers();
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║            Seeding Complete! 🎉               ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('\n  URL:      http://localhost:3000');
    console.log('  Admin:    admin@delhi-aqi.com    / admin123');
    console.log('  Officer:  officer@delhi-aqi.com  / officer123');
    console.log('  Citizen:  citizen@delhi-aqi.com  / citizen123');
    console.log('\n  101 Delhi wards with real GPS coordinates seeded!\n');
  } catch(e) { console.error('❌ Seeding failed:', e.message); }
  finally { await pool.end(); process.exit(0); }
}
main();
