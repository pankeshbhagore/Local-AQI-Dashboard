import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { aqiAPI, predictionAPI } from '../services/api';
import { aqiColor, aqiLabel, cardStyle } from '../components/Charts';
import { useTheme } from '../context/ThemeContext';

// FIX: All hardcoded dark hex values replaced with CSS variables for light/dark support
export default function Forecast() {
  const [wardId, setWardId] = useState(1);
  const { isDark } = useTheme();

  const { data: mapData } = useQuery({
    queryKey: ['wardMapForecast'],
    queryFn: () => aqiAPI.getMap().then(r => r.data).catch(() => null),
  });

  const { data: forecast, isLoading, isError } = useQuery({
    queryKey: ['forecast', wardId],
    queryFn: () => predictionAPI.getWardForecast(wardId).then(r => r.data),
    refetchInterval: 300000, retry: 2,
  });

  const wards = (mapData?.features || []).map((f: any) => ({
    id: f.properties.id, name: f.properties.name,
  }));

  const timeline = forecast?.timeline || [];

  const kpis = [
    { label: 'Current AQI',   value: timeline.find((t: any) => t.isActual)?.forecast ?? '—', hint: '' },
    { label: '+6h Forecast',  value: forecast?.forecast_6h  ?? '—', hint: forecast ? `CI: ${forecast.ci_low_6h}–${forecast.ci_high_6h}` : '' },
    { label: '+12h Forecast', value: forecast?.forecast_12h ?? '—', hint: forecast ? `CI: ${forecast.ci_low_12h}–${forecast.ci_high_12h}` : '' },
    { label: '+24h Forecast', value: forecast?.forecast_24h ?? '—', hint: forecast?.trend ? `Trend: ${forecast.trend}` : '' },
  ];

  const trendIcon = forecast?.trend === 'improving' ? '📉' : forecast?.trend === 'deteriorating' ? '📈' : '➡️';
  const trendCol  = forecast?.trend === 'improving' ? '#22c55e' : forecast?.trend === 'deteriorating' ? '#ef4444' : 'var(--text-muted)';

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
        {payload.map((p: any) => p.value != null && (
          <div key={p.name} style={{ color: p.stroke || p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>AQI Forecast</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            ML-powered predictions · LSTM model with confidence intervals
          </div>
        </div>
        <select value={wardId} onChange={e => setWardId(+e.target.value)} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 9,
          fontSize: 13, outline: 'none', cursor: 'pointer',
        }}>
          {wards.length === 0 && <option value={1}>Ward 1 (seed DB first)</option>}
          {wards.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {kpis.map((k, i) => {
          const num = typeof k.value === 'number' ? k.value : 0;
          return (
            <div key={k.label} style={{
              ...cardStyle, position: 'relative', overflow: 'hidden',
              borderTop: `3px solid ${typeof k.value === 'number' ? aqiColor(num) : 'var(--border)'}`,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, fontWeight: 600 }}>
                {k.label}
              </div>
              <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, letterSpacing: '-.02em',
                color: typeof k.value === 'number' ? aqiColor(num) : 'var(--text-primary)' }}>
                {k.value}
              </div>
              {typeof k.value === 'number' && k.value > 0 && (
                <div style={{ fontSize: 11, color: aqiColor(num), marginTop: 4, fontWeight: 600 }}>
                  {aqiLabel(num)}
                </div>
              )}
              {k.hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{k.hint}</div>}
            </div>
          );
        })}
      </div>

      {/* Trend badge */}
      {forecast && (
        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 36 }}>{trendIcon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: trendCol, fontWeight: 700, textTransform: 'capitalize' }}>
              AQI is {forecast.trend || 'stable'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Model: <strong style={{ color: 'var(--text-secondary)' }}>{forecast.model}</strong> ·
              Confidence: <strong style={{ color: 'var(--text-secondary)' }}>{forecast.confidence_pct}%</strong>
            </div>
          </div>
          {forecast.model === 'MockFallback' && (
            <div style={{
              fontSize: 11, padding: '5px 10px', borderRadius: 8,
              background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)',
              color: '#f59e0b', maxWidth: 240, lineHeight: 1.5,
            }}>
              ⚠️ Statistical fallback active. Run sensor-simulator.js then train ML models for real forecasts.
            </div>
          )}
        </div>
      )}

      {/* Main chart */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            📈 Forecast Timeline with Confidence Band
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 2, background: 'var(--accent)', display: 'inline-block', borderRadius: 1 }} />Observed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 2, background: '#ef4444', display: 'inline-block', borderRadius: 1, borderTop: '2px dashed #ef4444' }} />Forecast
            </span>
          </div>
        </div>

        {isLoading && (
          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
            <div className="skeleton" style={{ width: '100%', height: 220, borderRadius: 8 }} />
          </div>
        )}
        {isError && (
          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 36 }}>⚠️</span>
            <span style={{ fontSize: 13, color: '#ef4444' }}>ML service unavailable. Showing statistical fallback.</span>
          </div>
        )}
        {!isLoading && !isError && timeline.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="obsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fcsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              {/* Danger threshold lines */}
              <ReferenceLine y={200} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: 'Poor', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
              <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.4}
                label={{ value: 'Moderate', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
              {/* Confidence band */}
              <Area type="monotone"
                dataKey={(d: any) => !d.isActual ? d.upper : null}
                stroke="none" fill="rgba(239,68,68,.07)" dot={false} connectNulls legendType="none" />
              {/* Observed */}
              <Area type="monotone"
                dataKey={(d: any) => d.isActual ? d.forecast : null}
                stroke="var(--accent)" strokeWidth={2.5} fill="url(#obsGrad)"
                dot={false} connectNulls={false} name="Observed" />
              {/* Forecast */}
              <Area type="monotone"
                dataKey={(d: any) => !d.isActual ? d.forecast : null}
                stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3"
                fill="url(#fcsGrad)" dot={false} connectNulls={false} name="Forecast" />
            </AreaChart>
          </ResponsiveContainer>
        )}
        {!isLoading && !isError && timeline.length === 0 && (
          <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
            <span style={{ fontSize: 36 }}>📡</span>
            <span style={{ fontSize: 13 }}>No data yet — run sensor-simulator.js to generate readings</span>
          </div>
        )}
      </div>

      {/* AQI Category reference */}
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          India AQI Scale Reference
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {[
            { range: '0–50',  label: 'Good',        color: '#16a34a' },
            { range: '51–100',label: 'Satisfactory', color: '#2563eb' },
            { range: '101–150',label:'Moderate',     color: '#d97706' },
            { range: '151–200',label:'Poor',         color: '#ea580c' },
            { range: '201–300',label:'Very Poor',    color: '#dc2626' },
            { range: '300+',  label: 'Severe',       color: '#7c3aed' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '10px 8px', borderRadius: 9, textAlign: 'center',
              background: `${s.color}12`, border: `1px solid ${s.color}25`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: s.color }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.range}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
