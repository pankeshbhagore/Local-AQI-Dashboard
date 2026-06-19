import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { aqiAPI, predictionAPI, alertAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import {
  MetricCard, AQIGauge, PollutantBar,
  HotspotList, WardTable, aqiColor, aqiLabel, cardStyle,
} from '../components/Charts';

// NOTE: This page is not directly routed in App.tsx. 
// Admins see AdminDashboard, Officers see OfficerDashboard, Citizens see CitizenHome.
// This component can be used as a standalone generic dashboard if needed.
export default function Dashboard() {
  const { cityAQI } = useSocket();

  const { data: cityData } = useQuery({
    queryKey: ['cityStats'],
    queryFn:  () => aqiAPI.getCity().then(r => r.data).catch(() => null),
    refetchInterval: 60000, retry: 2,
  });
  const { data: mapData } = useQuery({
    queryKey: ['wardMap'],
    queryFn:  () => aqiAPI.getMap().then(r => r.data).catch(() => null),
    refetchInterval: 60000, retry: 2,
  });
  const { data: trendData } = useQuery({
    queryKey: ['trend'],
    queryFn:  () => aqiAPI.getTrend().then(r => r.data).catch(() => []),
    refetchInterval: 120000, retry: 2,
  });
  const { data: hotspots } = useQuery({
    queryKey: ['hotspots'],
    queryFn:  () => predictionAPI.getHotspots().then(r => r.data?.hotspots || []).catch(() => []),
    refetchInterval: 300000, retry: 1,
  });
  const { data: alertsData } = useQuery({
    queryKey: ['alertsRecent'],
    queryFn:  () => alertAPI.getAll({ limit: 5 }).then(r => r.data).catch(() => null),
    refetchInterval: 30000, retry: 2,
  });

  const wards = ((mapData?.features) || []).map((f: any) => ({
    id:      f.properties?.id,
    name:    f.properties?.name,
    aqi:     cityAQI[f.properties?.id] ?? f.properties?.aqi ?? 0,
    pm25:    f.properties?.pm25,
    pm10:    f.properties?.pm10,
    sensors: f.properties?.activeSensors,
  }));

  const cityAvg = cityData?.city_avg_aqi
    ? Math.round(Number(cityData.city_avg_aqi))
    : wards.length > 0
      ? Math.round(wards.reduce((s: number, w: any) => s + (w.aqi || 0), 0) / wards.length)
      : 0;

  const critical     = Number(cityData?.critical_wards ?? wards.filter((w: any) => w.aqi > 200).length);
  const totalSensors = Number(cityData?.active_sensors ??
    (mapData?.features || []).reduce((s: number, f: any) => s + (f.properties?.activeSensors || 0), 0));

  const chartData = (Array.isArray(trendData) ? trendData : []).map((r: any) => ({
    time: r.label, aqi: Number(r.aqi) || 0, pm25: Number(r.pm25) || 0,
  }));

  const sevColor: Record<string, string> = {
    critical: '#ef4444', high: '#f97316', moderate: '#f59e0b',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px', fontSize: 12,
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: {p.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease both' }}>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <MetricCard label="City Average AQI"  value={cityAvg || '—'} sub={cityAvg ? aqiLabel(cityAvg) : 'No data yet'}
          color={cityAvg ? aqiColor(cityAvg) : undefined} large icon="🌡️"
          trend={cityAvg > 200 ? 'up' : cityAvg < 100 ? 'down' : 'stable'} />
        <MetricCard label="Active Sensors"    value={totalSensors || '—'} sub="reporting live"    icon="📡" />
        <MetricCard label="Critical Wards"    value={critical}           sub="AQI above 200"     color="#ef4444" icon="⚠️" />
        <MetricCard label="Unresolved Alerts" value={alertsData?.total ?? '—'} sub="pending action" color="#f97316" icon="🔔" />
      </div>

      {/* ── Gauge + Trend ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
            City AQI Index
          </div>
          <AQIGauge value={cityAvg} />
          <div style={{
            fontSize: 11, padding: '3px 12px', borderRadius: 20, fontWeight: 600,
            background: cityAvg ? `${aqiColor(cityAvg)}15` : 'var(--border)',
            color: cityAvg ? aqiColor(cityAvg) : 'var(--text-muted)',
            border: `1px solid ${cityAvg ? aqiColor(cityAvg) + '25' : 'var(--border)'}`,
          }}>
            India AQI Standard
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📈</span> 24-Hour AQI Trend
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="aqi" stroke="#00d4ff" strokeWidth={2}
                  fill="url(#aqiGrad)" dot={false} name="AQI" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 190, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
              <span style={{ fontSize: 32 }}>📡</span>
              <span style={{ fontSize: 13 }}>Run sensor-simulator.js to see trend data</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Pollutants + Hotspots ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🧪</span> Pollutant Levels (City Avg)
          </div>
          <PollutantBar name="PM2.5" val={cityAvg > 0 ? Math.round(cityAvg * 0.52) : 0} max={300}  color="#ef4444" unit="µg/m³" />
          <PollutantBar name="PM10"  val={cityAvg > 0 ? Math.round(cityAvg * 0.76) : 0} max={500}  color="#f97316" unit="µg/m³" />
          <PollutantBar name="NO₂"   val={cityAvg > 0 ? Math.round(cityAvg * 0.27) : 0} max={200}  color="#f59e0b" unit="ppb"   />
          <PollutantBar name="CO"    val={cityAvg > 0 ? Math.round(cityAvg * 0.01) : 0} max={50}   color="#22c55e" unit="ppm"   />
          <PollutantBar name="SO₂"   val={cityAvg > 0 ? Math.round(cityAvg * 0.11) : 0} max={100}  color="#06b6d4" unit="ppb"   />
          <PollutantBar name="O₃"    val={cityAvg > 0 ? Math.round(cityAvg * 0.21) : 0} max={200}  color="#8b5cf6" unit="ppb"   />
        </div>
        <HotspotList hotspots={hotspots || []} />
      </div>

      {/* ── Ward Table ── */}
      {wards.length > 0 && <WardTable wards={wards} />}

      {/* ── Recent Alerts ── */}
      {(alertsData?.alerts?.length > 0) && (
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🔔</span> Recent Alerts
          </div>
          {alertsData.alerts.slice(0, 5).map((a: any) => (
            <div key={a._id} style={{
              display: 'flex', gap: 10, padding: '10px 0',
              borderBottom: '1px solid var(--border)', alignItems: 'flex-start',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: sevColor[a.severity] || '#64748b',
                marginTop: 5, flexShrink: 0,
                boxShadow: `0 0 6px ${sevColor[a.severity] || '#64748b'}80`,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{a.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {a.wardName && <span>{a.wardName} · </span>}
                  {new Date(a.createdAt).toLocaleString()}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                background: `${sevColor[a.severity] || '#64748b'}18`,
                color: sevColor[a.severity] || '#64748b',
                border: `1px solid ${sevColor[a.severity] || '#64748b'}25`,
                textTransform: 'uppercase', letterSpacing: '.03em',
              }}>{a.severity}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {wards.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>
            Waiting for sensor data
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Start the sensor simulator to stream live AQI readings into the system.
          </div>
          <code style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border)',
            padding: '10px 16px', borderRadius: 8, fontSize: 13, display: 'inline-block',
            color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace",
          }}>node tools/sensor-simulator.js</code>
        </div>
      )}
    </div>
  );
}
