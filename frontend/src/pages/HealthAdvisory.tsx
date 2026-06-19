import React, { useState } from 'react';
import { aqiColor, aqiLabel, cardStyle } from '../components/Charts';

const ADVISORIES: Record<string, Record<string, { icon: string; title: string; text: string; bg: string; col: string }[]>> = {
  general: {
    good:        [{ icon:'😊', title:'Enjoy outdoors freely',       text:'Air quality is excellent. No restrictions on any outdoor activities.', bg:'rgba(34,197,94,.1)', col:'#22c55e' },
                  { icon:'🏃', title:'Exercise freely',             text:'All forms of outdoor exercise are safe and encouraged.', bg:'rgba(34,197,94,.07)', col:'#22c55e' }],
    satisfactory:[{ icon:'🙂', title:'Outdoor activities OK',       text:'Generally safe for most people. Sensitive groups should reduce prolonged exertion.', bg:'rgba(59,130,246,.1)', col:'#3b82f6' },
                  { icon:'💨', title:'Light ventilation',           text:'Keep windows open for fresh air circulation.', bg:'rgba(59,130,246,.07)', col:'#3b82f6' }],
    moderate:    [{ icon:'😐', title:'Reduce outdoor exercise',     text:'Reduce prolonged or heavy exertion outdoors. Short activities are generally OK.', bg:'rgba(245,158,11,.1)', col:'#f59e0b' },
                  { icon:'🪟', title:'Limit ventilation',           text:'Avoid heavy ventilation during peak pollution hours (7–10am, 5–8pm).', bg:'rgba(245,158,11,.07)', col:'#f59e0b' }],
    poor:        [{ icon:'😷', title:'Wear N95 mask',              text:'If outdoors is unavoidable, wear a properly fitted N95 respirator mask.', bg:'rgba(249,115,22,.1)', col:'#f97316' },
                  { icon:'🪟', title:'Keep windows closed',         text:'Close all windows and doors. Use an indoor air purifier if available.', bg:'rgba(249,115,22,.07)', col:'#f97316' },
                  { icon:'⏰', title:'Check safe timing',           text:'AQI typically improves late at night (11pm–5am). Plan outdoor activities then.', bg:'rgba(249,115,22,.05)', col:'#f97316' }],
    veryPoor:    [{ icon:'🚫', title:'Avoid all outdoor activity',  text:'Stay indoors as much as possible. Exposure is harmful for all age groups.', bg:'rgba(239,68,68,.1)', col:'#ef4444' },
                  { icon:'🏥', title:'Seek medical attention',      text:'Seek immediate help if you experience chest tightness, coughing, or breathlessness.', bg:'rgba(239,68,68,.07)', col:'#ef4444' },
                  { icon:'💊', title:'Keep medication ready',       text:'Those with asthma or heart conditions should keep rescue medication readily available.', bg:'rgba(239,68,68,.05)', col:'#ef4444' }],
    severe:      [{ icon:'🚨', title:'EMERGENCY — Stay indoors',   text:'Hazardous air quality. Do not go outdoors under any circumstances.', bg:'rgba(124,58,237,.12)', col:'#7c3aed' },
                  { icon:'📞', title:'Emergency services on call',  text:'If experiencing severe symptoms, call emergency services immediately.', bg:'rgba(124,58,237,.09)', col:'#7c3aed' },
                  { icon:'🏫', title:'Close schools / offices',     text:'Authorities should consider emergency closure of schools and outdoor workplaces.', bg:'rgba(124,58,237,.06)', col:'#7c3aed' }],
  },
  children: {
    good:        [{ icon:'🧒', title:'Play freely',                 text:'Children can play outdoors without any restrictions.',bg:'rgba(34,197,94,.1)',col:'#22c55e'}],
    satisfactory:[{ icon:'🧒', title:'Outdoor play OK',             text:'Outdoor activities safe. Limit vigorous sports for asthmatic children.',bg:'rgba(59,130,246,.1)',col:'#3b82f6'}],
    moderate:    [{ icon:'⏱️', title:'Reduce play time',           text:'Limit outdoor play to 1 hour. No vigorous sports.',bg:'rgba(245,158,11,.1)',col:'#f59e0b'},
                  { icon:'🎒', title:'Prefer indoor activities',    text:'Prefer indoor activities during peak pollution hours.',bg:'rgba(245,158,11,.07)',col:'#f59e0b'}],
    poor:        [{ icon:'🏠', title:'Keep children indoors',       text:'No outdoor activities. Cancel school sports events.',bg:'rgba(249,115,22,.1)',col:'#f97316'}],
    veryPoor:    [{ icon:'🚫', title:'Strict indoor',               text:'Schools should consider advisory closure. No outdoor activities whatsoever.',bg:'rgba(239,68,68,.1)',col:'#ef4444'}],
    severe:      [{ icon:'🚨', title:'Emergency — school closure',  text:'Immediate school closure recommended. Seek medical help if symptoms appear.',bg:'rgba(124,58,237,.12)',col:'#7c3aed'}],
  },
  respiratory: {
    good:        [{ icon:'✅', title:'Low risk',                    text:'Low pollution day. Standard precautions apply.',bg:'rgba(34,197,94,.1)',col:'#22c55e'}],
    satisfactory:[{ icon:'💨', title:'Carry inhaler',               text:'Keep rescue inhaler accessible when going outdoors.',bg:'rgba(59,130,246,.1)',col:'#3b82f6'}],
    moderate:    [{ icon:'💊', title:'Pre-medicate before going out',text:'Use preventive inhaler before outdoor exposure. Limit time outdoors.',bg:'rgba(245,158,11,.1)',col:'#f59e0b'}],
    poor:        [{ icon:'🏠', title:'Stay indoors — high risk',    text:'High risk of asthma/COPD attack. Avoid outdoors entirely.',bg:'rgba(249,115,22,.1)',col:'#f97316'},
                  { icon:'📞', title:'Doctor on call',              text:'Ensure your doctor is reachable. Prepare emergency action plan.',bg:'rgba(249,115,22,.07)',col:'#f97316'}],
    veryPoor:    [{ icon:'🚨', title:'Emergency protocols',         text:'Activate asthma action plan. Keep nebuliser ready. Seek medical advice proactively.',bg:'rgba(239,68,68,.1)',col:'#ef4444'}],
    severe:      [{ icon:'🏥', title:'Seek immediate medical care', text:'Hazardous for all respiratory patients. Go to nearest health facility.',bg:'rgba(124,58,237,.12)',col:'#7c3aed'}],
  },
};

function getLevel(aqi: number): string {
  if (aqi <= 50)  return 'good';
  if (aqi <= 100) return 'satisfactory';
  if (aqi <= 150) return 'moderate';
  if (aqi <= 200) return 'poor';
  if (aqi <= 300) return 'veryPoor';
  return 'severe';
}

const AQI_SCALE = [
  { range: '0–50',    label: 'Good',             color: '#22c55e', tip: 'No restrictions. Enjoy outdoor activities.'     },
  { range: '51–100',  label: 'Satisfactory',      color: '#3b82f6', tip: 'Sensitive groups limit strenuous exertion.'     },
  { range: '101–150', label: 'Moderate',           color: '#f59e0b', tip: 'Reduce prolonged outdoor exercise.'            },
  { range: '151–200', label: 'Poor',               color: '#f97316', tip: 'Avoid outdoor exercise. Wear N95 mask.'        },
  { range: '201–300', label: 'Very Poor',          color: '#ef4444', tip: 'Stay indoors. Health risk for all.'            },
  { range: '300+',    label: 'Severe / Hazardous', color: '#7c3aed', tip: 'Emergency. Do not go outdoors.'                },
];

const GROUPS: [string, string, string][] = [
  ['general',     'General Public',         '👥'],
  ['children',    'Children & Elderly',     '👶'],
  ['respiratory', 'Respiratory Conditions', '🫁'],
];

export default function HealthAdvisory() {
  const [aqi,   setAqi]   = useState(175);
  const [group, setGroup] = useState<'general'|'children'|'respiratory'>('general');

  const level  = getLevel(aqi);
  const tips   = ADVISORIES[group]?.[level] || [];
  const aqiCol = aqiColor(aqi);
  const emoji  = aqi<=50?'😊':aqi<=100?'🙂':aqi<=150?'😐':aqi<=200?'😷':aqi<=300?'⚠️':'🚨';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease both' }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
          Health Advisory System
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0' }}>
          Personalised health guidance based on current AQI levels
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Controls ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* AQI slider */}
          <div style={cardStyle}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
              AQI Value
            </div>
            {/* Big value display */}
            <div style={{
              textAlign: 'center', fontSize: 56, fontWeight: 800, color: aqiCol,
              lineHeight: 1, marginBottom: 4, letterSpacing: '-2px',
            }}>{aqi}</div>
            <div style={{ textAlign: 'center', fontSize: 13, color: aqiCol, fontWeight: 600, marginBottom: 14 }}>
              {aqiLabel(aqi)}
            </div>
            {/* Slider */}
            <input type="range" min={0} max={500} step={1} value={aqi}
              onChange={e => setAqi(+e.target.value)}
              style={{ width: '100%', accentColor: aqiCol, cursor: 'pointer' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>500</span>
            </div>
          </div>

          {/* Population group selector */}
          <div style={cardStyle}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
              Population Group
            </div>
            {GROUPS.map(([k, l, icon]) => (
              <button key={k} onClick={() => setGroup(k as any)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', marginBottom: 7, textAlign: 'left',
                background: group === k ? 'var(--accent-soft)' : 'transparent',
                border: `1.5px solid ${group === k ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 9, color: group === k ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: group === k ? 600 : 400,
                transition: 'all .15s',
              }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span>{l}</span>
                {group === k && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>

          {/* Quick AQI presets */}
          <div style={cardStyle}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
              Quick Presets
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { label: 'Good',   val: 35,  col: '#22c55e' },
                { label: 'Mod',    val: 125, col: '#f59e0b' },
                { label: 'Poor',   val: 175, col: '#f97316' },
                { label: 'V.Poor', val: 250, col: '#ef4444' },
                { label: 'Severe', val: 350, col: '#7c3aed' },
                { label: 'Hazard', val: 450, col: '#7c3aed' },
              ].map(p => (
                <button key={p.label} onClick={() => setAqi(p.val)} style={{
                  padding: '6px 4px', borderRadius: 7, cursor: 'pointer',
                  background: `${p.col}12`, border: `1px solid ${p.col}30`,
                  color: p.col, fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                  transition: 'all .15s',
                }}>{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Advisory cards ────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Status hero card */}
          <div style={{
            ...cardStyle,
            borderLeft: `5px solid ${aqiCol}`,
            background: `linear-gradient(135deg, var(--bg-card), ${aqiCol}06)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 58, height: 58, borderRadius: 16, background: `${aqiCol}18`,
                border: `2px solid ${aqiCol}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
                boxShadow: `0 0 20px ${aqiCol}20`,
              }}>{emoji}</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: aqiCol, letterSpacing: '-.01em' }}>
                  {aqiLabel(aqi)} — AQI {aqi}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, textTransform: 'capitalize' }}>
                  {group.replace(/_/g, ' ')} advisory
                </div>
              </div>
            </div>

            {tips.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No specific advisory for this level.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tips.map((tip, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10,
                  background: tip.bg, border: `1px solid ${tip.col}20`,
                  transition: 'transform .15s',
                }}
                  onMouseOver={e => (e.currentTarget.style.transform = 'translateX(3px)')}
                  onMouseOut={e  => (e.currentTarget.style.transform = 'none')}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{tip.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: tip.col, marginBottom: 3 }}>{tip.title}</div>
                    <div style={{ fontSize: 12, color: tip.col, opacity: .85, lineHeight: 1.6 }}>{tip.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AQI Reference Scale */}
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>
              AQI Scale Reference
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {AQI_SCALE.map((s, i) => {
                const isActive = aqiLabel(aqi) === s.label;
                return (
                  <div key={s.range} style={{
                    display: 'grid', gridTemplateColumns: '80px 160px 1fr',
                    alignItems: 'center', gap: 10, padding: '9px 10px',
                    borderBottom: i < AQI_SCALE.length - 1 ? '1px solid var(--border)' : 'none',
                    borderRadius: 8, margin: '1px 0',
                    background: isActive ? `${s.color}10` : 'transparent',
                    transition: 'background .2s',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.range}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: s.color, fontWeight: isActive ? 700 : 500 }}>
                        {s.label}
                      </span>
                      {isActive && <span style={{ fontSize: 10, color: s.color, fontWeight: 700 }}>← you</span>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.tip}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
