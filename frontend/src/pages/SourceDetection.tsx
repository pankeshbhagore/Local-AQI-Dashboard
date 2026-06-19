import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { aqiAPI, predictionAPI } from '../services/api';
import { cardStyle } from '../components/Charts';
import { useTheme } from '../context/ThemeContext';

const SOURCE_COLORS: Record<string, string> = {
  construction_dust: '#f97316', vehicle_emissions: '#3b82f6',
  biomass_burning:   '#ef4444', industrial:        '#8b5cf6',
  dust_storm:        '#06b6d4', unknown:            '#64748b',
};
const SOURCE_LABELS: Record<string, string> = {
  construction_dust: 'Construction Dust',
  vehicle_emissions: 'Vehicle Emissions',
  biomass_burning:   'Biomass Burning',
  industrial:        'Industrial Emission',
  dust_storm:        'Dust Storm',
  unknown:           'Unknown Source',
};
const SOURCE_ICONS: Record<string, string> = {
  construction_dust: '🏗️', vehicle_emissions: '🚗', biomass_burning: '🔥',
  industrial: '🏭', dust_storm: '🌪️', unknown: '❓',
};
const SOURCE_DESC: Record<string, string> = {
  construction_dust: 'Elevated PM10 with low PM2.5/PM10 ratio — typical of construction activity',
  vehicle_emissions: 'High CO and NO₂ levels — characteristic of vehicle exhaust',
  biomass_burning:   'High PM2.5 with elevated CO — indicates open burning activity',
  industrial:        'High SO₂ and NO₂ — signature of industrial stack emissions',
  dust_storm:        'Very high PM10 — natural or road dust dispersion event',
  unknown:           'Insufficient data to classify the dominant source',
};

export default function SourceDetection() {
  const [wardId, setWardId] = useState(1);
  const { isDark } = useTheme();

  const { data: mapData } = useQuery({
    queryKey: ['wardMapSrc'],
    queryFn: () => aqiAPI.getMap().then(r => r.data).catch(() => null),
  });
  const wards = (mapData?.features || []).map((f: any) => ({
    id: f.properties.id, name: f.properties.name,
  }));

  const { data: src, isLoading, isError, refetch } = useQuery({
    queryKey: ['source', wardId],
    queryFn: () => predictionAPI.getSource(wardId).then(r => r.data),
    refetchInterval: 120000,
    retry: 2,
  });

  const pieData = src
    ? Object.entries(src.probabilities || {}).map(([k, v]) => ({
        name: SOURCE_LABELS[k] || k,
        key:  k,
        value: Math.round((v as number) * 100),
      })).filter(d => d.value > 0)
    : [];

  const topSource = src?.predicted_source || 'unknown';
  const confidence = src ? Math.round(src.confidence * 100) : 0;

  const selStyle: React.CSSProperties = {
    background: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 8,
    fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
    minWidth: 200,
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{payload[0].name}</div>
        <div style={{ color: 'var(--text-muted)' }}>{payload[0].value}% probability</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
            🔍 Pollution Source Detection
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            ML-powered classification of dominant pollution sources by ward
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={wardId} onChange={e => setWardId(Number(e.target.value))} style={selStyle}>
            {wards.length > 0
              ? wards.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)
              : Array.from({ length: 15 }, (_, i) => <option key={i + 1} value={i + 1}>Ward {i + 1}</option>)
            }
          </select>
          <button onClick={() => refetch()} style={{
            padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-primary)', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Top Source Card */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16 }}>
            Detected Primary Source
          </div>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--border)' }} className="skeleton" />
              <div style={{ flex: 1 }}>
                <div style={{ height: 20, borderRadius: 6, background: 'var(--border)', marginBottom: 8, width: '60%' }} className="skeleton" />
                <div style={{ height: 14, borderRadius: 6, background: 'var(--border)', width: '40%' }} className="skeleton" />
              </div>
            </div>
          )}

          {!isLoading && src && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 16, flexShrink: 0,
                  background: `${SOURCE_COLORS[topSource] || '#64748b'}18`,
                  border: `2px solid ${SOURCE_COLORS[topSource] || '#64748b'}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 34,
                }}>
                  {SOURCE_ICONS[topSource] || '❓'}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: SOURCE_COLORS[topSource] || 'var(--text-primary)', lineHeight: 1.2 }}>
                    {SOURCE_LABELS[topSource] || topSource}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {src.model || 'Rule-Based'}
                  </div>
                </div>
              </div>

              {/* Confidence bar */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Confidence</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: SOURCE_COLORS[topSource] || 'var(--accent)' }}>
                    {confidence}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${confidence}%`, height: '100%', borderRadius: 4,
                    background: `linear-gradient(90deg, ${SOURCE_COLORS[topSource] || '#64748b'}, ${SOURCE_COLORS[topSource] || '#64748b'}cc)`,
                    transition: 'width .8s cubic-bezier(.4,0,.2,1)',
                    boxShadow: `0 0 8px ${SOURCE_COLORS[topSource] || '#64748b'}50`,
                  }} />
                </div>
              </div>

              {/* Description */}
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                background: `${SOURCE_COLORS[topSource] || '#64748b'}0d`,
                border: `1px solid ${SOURCE_COLORS[topSource] || '#64748b'}20`,
                fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55,
              }}>
                {SOURCE_DESC[topSource] || 'Analysis based on current sensor readings.'}
              </div>
            </>
          )}

          {!isLoading && (isError || !src) && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
              <div style={{ fontSize: 13 }}>Insufficient sensor data for this ward</div>
            </div>
          )}
        </div>

        {/* Probability Pie */}
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16 }}>
            Source Probability Breakdown
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                  paddingAngle={3} dataKey="value">
                  {pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={SOURCE_COLORS[entry.key] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 13 }}>
              {isLoading ? 'Analysing sensor data…' : 'No probability data available'}
            </div>
          )}
        </div>
      </div>

      {/* Policy Recommendations */}
      {src?.recommendations && src.recommendations.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📋</span> Automated Policy Recommendations
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
              background: 'rgba(14,165,233,.12)', color: 'var(--accent)',
            }}>AI GENERATED</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {(src.recommendations as string[]).map((r: string, i: number) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10,
                background: 'var(--bg-primary)',
                border: `1px solid var(--border)`,
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, background: 'var(--accent-soft)',
                  color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All wards comparison */}
      {wards.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>
            Select Ward for Analysis
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {wards.map((w: any) => (
              <button key={w.id} onClick={() => setWardId(w.id)} style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: wardId === w.id ? 700 : 400,
                background: wardId === w.id ? 'var(--accent-soft)' : 'var(--bg-primary)',
                border: `1px solid ${wardId === w.id ? 'var(--border-accent)' : 'var(--border)'}`,
                color: wardId === w.id ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all .15s',
              }}>{w.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
