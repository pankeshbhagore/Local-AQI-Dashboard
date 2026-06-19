import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth }   from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { aqiAPI, reportAPI, copilotAPI } from '../../services/api';
import { aqiColor, aqiLabel, cardStyle } from '../../components/Charts';
import { useNavigate } from 'react-router-dom';

// ── Animated AQI Halo Ring ──────────────────────────────────────────────────
function AQIHalo({ value }: { value: number }) {
  const pct   = Math.min(1, (value || 0) / 500);
  const r     = 82, cx = 100, cy = 100;
  const circ  = 2 * Math.PI * r;
  const color = aqiColor(value);
  const label = aqiLabel(value);
  const emoji = value <= 50 ? '😊' : value <= 100 ? '🙂' : value <= 150 ? '😐' : value <= 200 ? '😷' : value <= 300 ? '⚠️' : '🚨';

  return (
    <div style={{ position: 'relative', width: 200, height: 200 }}>
      {/* Outer breathing glow */}
      <div style={{
        position: 'absolute', inset: -12, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
        animation: 'halo-breathe 3s ease-in-out infinite',
      }} />
      <svg width={200} height={200} viewBox="0 0 200 200">
        <defs>
          <linearGradient id="aqiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity={0.4} />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--border, rgba(0,0,0,.08))" strokeWidth={10} />
        {/* Animated value arc */}
        {value > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke="url(#aqiGrad)" strokeWidth={10}
            strokeDasharray={`${circ * pct} ${circ * (1 - pct)}`}
            strokeLinecap="round" filter="url(#glow)"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray .8s cubic-bezier(.4,0,.2,1)' }}
          />
        )}
        {/* Emoji */}
        <text x={cx} y={cy - 18} textAnchor="middle" fontSize={32}>{emoji}</text>
        {/* Value */}
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={36} fontWeight={800}
          fill={color} style={{ letterSpacing: '-2px' }}>{value || 0}</text>
        {/* Label */}
        <text x={cx} y={cy + 34} textAnchor="middle" fontSize={11}
          fill="var(--text-muted, #94a3b8)" fontWeight={600}>AQI · {label}</text>
      </svg>
    </div>
  );
}

// ── Gamification: Reward Tier ───────────────────────────────────────────────
function RewardTier({ points, totalReports }: { points: number; totalReports: number }) {
  const tiers = [
    { name: 'Bronze',   min: 0,   max: 100,  color: '#cd7f32', icon: '🥉', next: 'Silver'   },
    { name: 'Silver',   min: 100, max: 300,  color: '#a8a9ad', icon: '🥈', next: 'Gold'     },
    { name: 'Gold',     min: 300, max: 600,  color: '#ffd700', icon: '🥇', next: 'Platinum' },
    { name: 'Platinum', min: 600, max: 1000, color: '#e5e4e2', icon: '💎', next: 'Diamond'  },
    { name: 'Diamond',  min: 1000,max: 9999, color: '#b9f2ff', icon: '👑', next: 'Legend'   },
  ];
  const tier = tiers.find(t => points >= t.min && points < t.max) || tiers[tiers.length - 1];
  const progress = Math.min(1, (points - tier.min) / (tier.max - tier.min));

  return (
    <div style={{
      ...cardStyle, padding: '18px 20px',
      background: `linear-gradient(135deg, var(--bg-card), ${tier.color}08)`,
      borderTop: `3px solid ${tier.color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{tier.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: tier.color }}>{tier.name} Guardian</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{points} Karma Points</div>
          </div>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: `${tier.color}15`, color: tier.color, border: `1px solid ${tier.color}30`,
        }}>
          {totalReports} reports filed
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            Progress to {tier.next}
          </span>
          <span style={{ fontSize: 10, color: tier.color, fontWeight: 700 }}>
            {Math.round(progress * 100)}%
          </span>
        </div>
        <div style={{
          height: 6, borderRadius: 20, background: 'var(--border)',
          overflow: 'hidden', position: 'relative',
        }}>
          <div style={{
            height: '100%', borderRadius: 20,
            background: `linear-gradient(90deg, ${tier.color}90, ${tier.color})`,
            width: `${progress * 100}%`,
            transition: 'width .8s cubic-bezier(.4,0,.2,1)',
            boxShadow: `0 0 8px ${tier.color}40`,
          }} />
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
        {tier.max - points} more points needed for {tier.next} tier
      </div>
    </div>
  );
}

// ── Health Advice by AQI level ──────────────────────────────────────────────
const ADVICE: Record<string, { icon: string; text: string; bg: string; col: string }[]> = {
  'Good':         [{ icon: '😊', text: 'Air quality is excellent. Enjoy outdoor activities freely!', bg: 'rgba(34,197,94,.1)', col: '#22c55e' }],
  'Satisfactory': [{ icon: '🙂', text: 'Generally safe. Sensitive groups should reduce prolonged exertion.', bg: 'rgba(59,130,246,.1)', col: '#3b82f6' }],
  'Moderate':     [
    { icon: '😐', text: 'Reduce prolonged outdoor exercise.', bg: 'rgba(245,158,11,.1)', col: '#f59e0b' },
    { icon: '🪟', text: 'Limit ventilation during peak hours (7–10am, 5–8pm).', bg: 'rgba(245,158,11,.07)', col: '#f59e0b' },
  ],
  'Poor':         [
    { icon: '😷', text: 'Wear N95 mask if going outdoors.', bg: 'rgba(249,115,22,.1)', col: '#f97316' },
    { icon: '🪟', text: 'Keep windows closed. Use air purifier if available.', bg: 'rgba(249,115,22,.07)', col: '#f97316' },
  ],
  'Very Poor':    [
    { icon: '🚫', text: 'Avoid all outdoor activity. Stay indoors.', bg: 'rgba(239,68,68,.1)', col: '#ef4444' },
    { icon: '🏥', text: 'Seek medical help if chest tightness or breathing difficulty occurs.', bg: 'rgba(239,68,68,.07)', col: '#ef4444' },
  ],
  'Severe':       [{ icon: '🚨', text: 'EMERGENCY — Do NOT go outdoors under any circumstances.', bg: 'rgba(124,58,237,.12)', col: '#7c3aed' }],
};

const DELHI_WARD_NAMES: Record<number, string> = {
  1: 'Connaught Place', 2: 'Chandni Chowk', 3: 'Anand Vihar',
  4: 'Okhla Industrial', 5: 'Dwarka', 6: 'Rohini',
  7: 'Lajpat Nagar', 8: 'Wazirpur', 9: 'Lodhi Road',
  10: 'Shahdara', 11: 'Najafgarh Road', 12: 'GTK Depot',
  13: 'Mayur Vihar', 14: 'IGI Airport', 15: 'Vasant Kunj',
};

export default function CitizenHome() {
  const { user }    = useAuth();
  const { cityAQI, liveAlerts = [] } = useSocket();
  const nav         = useNavigate();
  const wardId      = user?.wardId || 1;
  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiAdvisory, setAiAdvisory]   = useState<string | null>(null);
  const [loadingAi,  setLoadingAi]    = useState(false);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: wardData } = useQuery({
    queryKey: ['wardCitizen', wardId],
    queryFn:  () => aqiAPI.getWard(wardId, 12).then(r => r.data).catch(() => null),
    refetchInterval: 30000, retry: 2,
  });
  const { data: cityData } = useQuery({
    queryKey: ['cityStats'],
    queryFn:  () => aqiAPI.getCity().then(r => r.data).catch(() => null),
    refetchInterval: 60000, retry: 2,
  });
  const { data: myReportsData } = useQuery({
    queryKey: ['myReportsCount'],
    queryFn:  () => reportAPI.getMine().then(r => r.data).catch(() => null),
    refetchInterval: 30000,
  });

  const aqi      = cityAQI[wardId] ?? wardData?.current?.aqi_calculated ?? 0;
  const label    = aqiLabel(aqi);
  const advices  = ADVICE[label] || ADVICE['Moderate'];
  const color    = aqiColor(aqi);
  const pm25     = wardData?.current?.pm25 ? Number(wardData.current.pm25).toFixed(1) : '—';
  const pm10     = wardData?.current?.pm10 ? Number(wardData.current.pm10).toFixed(1) : '—';
  const no2      = wardData?.current?.no2  ? Number(wardData.current.no2).toFixed(1)  : '—';
  const co       = wardData?.current?.co   ? Number(wardData.current.co).toFixed(2)   : '—';
  const so2      = wardData?.current?.so2  ? Number(wardData.current.so2).toFixed(1)  : '—';
  const cityAvg  = cityData?.city_avg_aqi  ? Math.round(Number(cityData.city_avg_aqi)) : 0;
  const wardName = DELHI_WARD_NAMES[wardId] || `Ward ${wardId}`;
  const hour     = currentTime.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Gamification data from user profile
  const rewardPoints  = user?.rewardPoints  || 0;
  const totalReports  = myReportsData?.reports?.length || user?.totalReports || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease both' }}>

      {/* ── Hero Greeting Card ─────────────────────────────────────────────── */}
      <div style={{
        ...cardStyle, display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px',
        background: `linear-gradient(135deg, var(--bg-card), ${color}0a)`,
        borderLeft: `4px solid ${color}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative gradient orb */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 120, height: 120,
          borderRadius: '50%', background: `radial-gradient(circle, ${color}12, transparent)`,
          pointerEvents: 'none',
        }} />
        <div style={{ flex: 1, zIndex: 1 }}>
          <div style={{ fontSize: 18, color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '-.01em' }}>
            {greeting}, {user?.name?.split(' ')[0] || 'there'}! 👋
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Live AQI for{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{wardName}</span>
            {' · '}{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button
          onClick={() => nav('/report')}
          style={{
            background: `linear-gradient(135deg, var(--accent), #3b82f6)`, border: 'none',
            color: '#fff', padding: '10px 20px', borderRadius: 10,
            fontSize: 13, cursor: 'pointer', fontWeight: 700,
            whiteSpace: 'nowrap', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(14,165,233,.35)',
            transition: 'all .2s', display: 'flex', alignItems: 'center', gap: 6,
          }}
          onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseOut={e  => (e.currentTarget.style.transform = 'none')}
        >📸 Report Pollution</button>
      </div>

      {/* ── Main Grid: AQI Halo + Stats + Gamification ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 1fr', gap: 14 }}>

        {/* AQI Halo */}
        <div style={{
          ...cardStyle, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 16px',
          background: `linear-gradient(180deg, var(--bg-card) 0%, ${color}05 100%)`,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: '.08em', fontWeight: 700, marginBottom: 2 }}>Your Ward AQI</div>
          <AQIHalo value={aqi} />
          <div style={{
            fontSize: 11, padding: '4px 14px', borderRadius: 20, fontWeight: 600,
            background: `${color}12`, color, border: `1px solid ${color}22`, marginTop: 4,
          }}>{wardName}</div>
        </div>

        {/* Pollutant Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'PM2.5',   val: pm25, unit: 'µg/m³', color: '#ef4444', icon: '🔴', sub: 'Fine particles' },
            { label: 'PM10',    val: pm10, unit: 'µg/m³', color: '#f97316', icon: '🟠', sub: 'Coarse dust' },
            { label: 'NO₂',     val: no2,  unit: 'ppb',   color: '#f59e0b', icon: '🟡', sub: 'Nitrogen dioxide' },
            { label: 'CO',      val: co,   unit: 'mg/m³', color: '#6366f1', icon: '🟣', sub: 'Carbon monoxide' },
            { label: 'SO₂',     val: so2,  unit: 'ppb',   color: '#ec4899', icon: '🩷', sub: 'Sulfur dioxide' },
            { label: 'City Avg',val: cityAvg ? String(cityAvg) : '—', unit: 'AQI', color: 'var(--accent)', icon: '🌆', sub: aqiLabel(cityAvg) },
          ].map(s => (
            <div key={s.label} style={{
              ...cardStyle, padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 2,
              borderLeft: `3px solid ${s.color}`,
              transition: 'transform .15s, box-shadow .15s',
            }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={e  => { e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</span>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: '-.02em' }}>
                {s.val} <span style={{ fontSize: 10, fontWeight: 500, opacity: .7 }}>{s.unit}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Gamification Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <RewardTier points={rewardPoints} totalReports={totalReports} />

          {/* Quick Actions */}
          <div style={{ ...cardStyle, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: '📸', label: 'Report Pollution', desc: '+10 karma points', to: '/report', col: 'var(--accent)' },
                { icon: '📋', label: 'My Reports', desc: 'Track your reports', to: '/myreports', col: '#8b5cf6' },
                { icon: '❤️', label: 'Health Advisory', desc: 'Stay safe', to: '/advisory', col: '#ef4444' },
              ].map(a => (
                <button key={a.to} onClick={() => nav(a.to)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '9px 12px', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 9,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  transition: 'all .15s', color: 'var(--text-primary)',
                }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = a.col; e.currentTarget.style.background = `${typeof a.col === 'string' && a.col.startsWith('#') ? a.col : '#0ea5e9'}08`; }}
                  onMouseOut={e  => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.desc}</div>
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Health Advisory + AQI Scale ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Health Advisory */}
        <div style={{
          ...cardStyle, borderLeft: `4px solid ${color}`,
          background: `linear-gradient(135deg, var(--bg-card), ${color}06)`,
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>❤️</span> Health Advisory — AQI {aqi} ({label})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {advices.map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10,
                background: a.bg, border: `1px solid ${a.col}18`,
                transition: 'transform .15s',
              }}
                onMouseOver={e => (e.currentTarget.style.transform = 'translateX(3px)')}
                onMouseOut={e  => (e.currentTarget.style.transform = 'none')}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{a.icon}</span>
                <span style={{ fontSize: 13, color: a.col, lineHeight: 1.6, fontWeight: 500 }}>{a.text}</span>
              </div>
            ))}
          </div>

          {/* AI Advisory Button */}
          <div style={{ marginTop: 14 }}>
            <button
              onClick={async () => {
                setLoadingAi(true);
                try {
                  const res = await copilotAPI.advisory({
                    aqi, wardName, pm25, pm10
                  });
                  setAiAdvisory(res.data.advisory);
                } catch {
                  setAiAdvisory('AI Advisory currently unavailable.');
                } finally {
                  setLoadingAi(false);
                }
              }}
              disabled={loadingAi}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'opacity 0.2s', opacity: loadingAi ? 0.7 : 1
              }}
            >
              ✨ {loadingAi ? 'Generating AI Advice...' : 'Get Personalized AI Advice'}
            </button>
            
            {aiAdvisory && (
              <div style={{
                marginTop: 12, padding: '12px', borderRadius: 8,
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
                color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.5,
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <span style={{ fontSize: 16, display: 'block', marginBottom: 4 }}>🤖 Eco-Copilot says:</span>
                {aiAdvisory}
              </div>
            )}
          </div>
        </div>

        {/* AQI Scale */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 14,
            textTransform: 'uppercase', letterSpacing: '.05em' }}>AQI Scale Reference</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { r: '0–50',    l: 'Good',             c: '#22c55e', d: 'No restrictions. Enjoy outdoors.' },
              { r: '51–100',  l: 'Satisfactory',      c: '#3b82f6', d: 'Sensitive groups limit strenuous exertion.' },
              { r: '101–150', l: 'Moderate',           c: '#f59e0b', d: 'Reduce outdoor exercise.' },
              { r: '151–200', l: 'Poor',               c: '#f97316', d: 'Avoid outdoors. N95 mask required.' },
              { r: '201–300', l: 'Very Poor',          c: '#ef4444', d: 'Stay indoors. Health risk for all.' },
              { r: '300+',    l: 'Severe / Hazardous', c: '#7c3aed', d: 'Emergency. Do not go outdoors.' },
            ].map((s, i) => (
              <div key={s.r} style={{
                display: 'grid', gridTemplateColumns: '65px 140px 1fr',
                alignItems: 'center', gap: 8, padding: '8px 6px',
                borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
                background: aqi > 0 && aqiLabel(aqi) === s.l ? `${s.c}0a` : 'transparent',
                borderRadius: 6, transition: 'background .2s',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{s.r}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 3, background: s.c, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: s.c, fontWeight: aqiLabel(aqi) === s.l ? 700 : 400 }}>
                    {aqiLabel(aqi) === s.l ? '▶ ' : ''}{s.l}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Citizen Features: Alerts & Report Tracker ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Nearby Alerts */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>
            🚨 Nearby Alerts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {liveAlerts.filter((a:any) => a.wardId === wardId).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No active alerts in your ward.</div>
            ) : (
              liveAlerts.filter((a:any) => a.wardId === wardId).map((alert:any, idx:number) => (
                <div key={idx} style={{ padding: '10px 12px', background: 'rgba(239,68,68,.1)', borderLeft: '3px solid #ef4444', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>{alert.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(alert.createdAt).toLocaleString('en-IN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Report Tracker */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>
            📝 Latest Report Status
          </div>
          {myReportsData?.reports && myReportsData.reports.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myReportsData.reports.slice(0, 1).map((r:any) => (
                <div key={r._id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 24 }}>{r.pollutionType === 'garbage_burning' ? '🔥' : '⚠️'}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.pollutionType?.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </div>
                    <div style={{ marginTop: 6, display: 'inline-block', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: r.verificationStatus === 'resolved' ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)', color: r.verificationStatus === 'resolved' ? '#22c55e' : '#f59e0b' }}>
                      {r.verificationStatus?.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => nav('/myreports')} style={{ marginTop: 8, padding: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>View All Reports</button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>You haven't submitted any reports yet.</div>
          )}
        </div>
      </div>

    </div>
  );
}
