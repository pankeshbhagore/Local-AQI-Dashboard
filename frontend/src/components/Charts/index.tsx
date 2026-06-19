import React from 'react';

// ── AQI helpers ────────────────────────────────────────────────────────────
export function aqiColor(aqi: number): string {
  if (aqi <= 50)  return '#16a34a';
  if (aqi <= 100) return '#2563eb';
  if (aqi <= 150) return '#d97706';
  if (aqi <= 200) return '#ea580c';
  if (aqi <= 300) return '#dc2626';
  return '#7c3aed';
}
export function aqiLabel(aqi: number): string {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 150) return 'Moderate';
  if (aqi <= 200) return 'Poor';
  if (aqi <= 300) return 'Very Poor';
  return 'Severe';
}
export function aqiBg(aqi: number): string {
  if (aqi <= 50)  return 'rgba(22,163,74,.12)';
  if (aqi <= 100) return 'rgba(37,99,235,.12)';
  if (aqi <= 150) return 'rgba(217,119,6,.12)';
  if (aqi <= 200) return 'rgba(234,88,12,.12)';
  if (aqi <= 300) return 'rgba(220,38,38,.12)';
  return 'rgba(124,58,237,.12)';
}

// ── Card style (uses CSS vars from ThemeContext) ────────────────────────────
export const cardStyle: React.CSSProperties = {
  background:   'var(--bg-card, #ffffff)',
  border:       '1px solid var(--border, rgba(0,0,0,.08))',
  borderRadius: 14,
  padding:      20,
  boxShadow:    'var(--shadow, 0 1px 4px rgba(0,0,0,.06))',
  transition:   'box-shadow .2s',
};

// ── MetricCard ─────────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string; value: string | number; sub?: string;
  color?: string; large?: boolean; icon?: string; trend?: 'up' | 'down' | 'stable';
}
export function MetricCard({ label, value, sub, color, large, icon, trend }: MetricCardProps) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : null;
  const trendCol  = trend === 'up' ? '#ef4444' : '#22c55e';
  return (
    <div style={{
      ...cardStyle,
      display: 'flex', flexDirection: 'column', gap: 0,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Top accent bar */}
      {color && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          borderRadius: '14px 14px 0 0',
        }} />
      )}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 8, marginTop: color ? 6 : 0,
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {label}
        </div>
        {icon && <span style={{ fontSize: 18, opacity: .8 }}>{icon}</span>}
      </div>
      <div style={{
        fontSize: large ? 38 : 30, fontWeight: 700,
        color: color || 'var(--text-primary, #0f172a)', lineHeight: 1,
        letterSpacing: '-.02em',
      }}>
        {value}
        {trendIcon && (
          <span style={{ fontSize: 14, color: trendCol, marginLeft: 6, fontWeight: 600 }}>
            {trendIcon}
          </span>
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

// ── AQI Gauge (SVG semicircle) ─────────────────────────────────────────────
export function AQIGauge({ value }: { value: number }) {
  const pct   = Math.min(1, (value || 0) / 500);
  const r     = 68, cx = 80, cy = 80;
  const sx    = cx - r;
  const sy    = cy;
  const ex    = cx + r * Math.cos(Math.PI + pct * Math.PI);
  const ey    = cy + r * Math.sin(Math.PI + pct * Math.PI);
  const large = pct > 0.5 ? 1 : 0;
  const color = aqiColor(value || 0);

  // Background arc segments (colour zones)
  const zones = [
    { pct: .1,  col: '#16a34a' },
    { pct: .1,  col: '#2563eb' },
    { pct: .1,  col: '#d97706' },
    { pct: .1,  col: '#ea580c' },
    { pct: .2,  col: '#dc2626' },
    { pct: .4,  col: '#7c3aed' },
  ];
  let cursor = 0;
  const segPaths = zones.map(z => {
    const a1  = Math.PI + cursor * Math.PI;
    const a2  = Math.PI + (cursor + z.pct) * Math.PI;
    const x1  = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2  = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const lg  = z.pct > 0.5 ? 1 : 0;
    cursor += z.pct;
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2}`, col: z.col };
  });

  return (
    <svg width={160} height={104} viewBox="0 0 160 104">
      {/* Zone arcs (faint) */}
      {segPaths.map((s, i) => (
        <path key={i} d={s.d} fill="none" stroke={s.col} strokeWidth={10}
          strokeLinecap="butt" opacity={.18} />
      ))}
      {/* Track */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="var(--border, rgba(0,0,0,.06))" strokeWidth={12} strokeLinecap="round" />
      {/* Value arc */}
      {(value || 0) > 0 && (
        <path d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`}
          fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
      )}
      {/* Needle dot */}
      <circle cx={ex} cy={ey} r={5} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      {/* Value text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={32} fontWeight={800}
        fill={color} style={{ letterSpacing: '-1px' }}>{value || 0}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10}
        fill="var(--text-muted, #94a3b8)">AQI / 500</text>
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize={11} fontWeight={600}
        fill={color}>{aqiLabel(value || 0)}</text>
    </svg>
  );
}

// ── PollutantBar ───────────────────────────────────────────────────────────
export function PollutantBar({ name, val, max, color, unit }: {
  name: string; val: number; max: number; color: string; unit: string;
}) {
  const pct    = Math.min(100, Math.round(((val || 0) / max) * 100));
  const danger = pct > 75;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 500 }}>{name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {danger && <span style={{ fontSize: 9, color: color, fontWeight: 700, letterSpacing: '.03em' }}>HIGH</span>}
          <span style={{ fontSize: 12, color: 'var(--text-primary, #0f172a)', fontWeight: 600 }}>
            {val || 0}
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 400, fontSize: 11 }}> {unit}</span>
          </span>
        </div>
      </div>
      <div style={{
        height: 6, borderRadius: 4,
        background: 'var(--border, rgba(0,0,0,.07))', overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          transition: 'width .6s cubic-bezier(.4,0,.2,1)',
          boxShadow: pct > 50 ? `0 0 8px ${color}50` : 'none',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: .7 }}>{pct}% of limit</span>
      </div>
    </div>
  );
}

// ── HotspotList ────────────────────────────────────────────────────────────
export function HotspotList({ hotspots }: { hotspots: any[] }) {
  const list = hotspots || [];
  return (
    <div style={cardStyle}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em' }}>
          🔥 Active Hotspots
        </div>
        {list.length > 0 && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(239,68,68,.1)', color: '#ef4444', fontWeight: 700,
          }}>{list.length}</span>
        )}
      </div>

      {list.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 6, padding: '20px 0', color: 'var(--text-muted, #94a3b8)',
        }}>
          <span style={{ fontSize: 28 }}>✅</span>
          <span style={{ fontSize: 13 }}>No active hotspots</span>
        </div>
      )}

      {list.map((h: any, i: number) => {
        const sev   = h.severity || (h.avgAQI > 250 ? 'critical' : h.avgAQI > 200 ? 'high' : 'moderate');
        const sevC  = sev === 'critical' ? '#dc2626' : sev === 'high' ? '#ea580c' : '#d97706';
        return (
          <div key={h.id || i} style={{
            display: 'flex', gap: 12, padding: '10px 0',
            borderBottom: i < list.length - 1 ? '1px solid var(--border, rgba(0,0,0,.06))' : 'none',
            alignItems: 'center',
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 10,
              background: aqiBg(h.avgAQI || 0),
              border: `1.5px solid ${aqiColor(h.avgAQI || 0)}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: aqiColor(h.avgAQI || 0), flexShrink: 0,
            }}>{h.avgAQI || '?'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {h.sourceType ? h.sourceType.replace(/_/g, ' ') : `Hotspot ${i + 1}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {(h.affectedWards || []).length} wards · {h.sensorCount || 0} sensors
              </div>
            </div>
            <span style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700,
              letterSpacing: '.03em',
              background: `${sevC}15`, color: sevC,
              border: `1px solid ${sevC}25`,
            }}>{sev.toUpperCase()}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── WardTable ──────────────────────────────────────────────────────────────
export function WardTable({ wards }: { wards: any[] }) {
  const [sortBy,  setSortBy]  = React.useState<'aqi' | 'name' | 'pm25'>('aqi');
  const [filter,  setFilter]  = React.useState('');

  const filtered = (wards || []).filter(w =>
    !filter || w.name?.toLowerCase().includes(filter.toLowerCase())
  );
  const sorted = [...filtered].sort((a, b) =>
    sortBy === 'aqi'  ? (b.aqi  || 0) - (a.aqi  || 0) :
    sortBy === 'pm25' ? (b.pm25 || 0) - (a.pm25 || 0) :
    (a.name || '').localeCompare(b.name || '')
  );

  return (
    <div style={cardStyle}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>
          All Wards — Live AQI
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>
            ({sorted.length} of {wards.length})
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search ward…"
            style={{
              fontSize: 12, padding: '5px 10px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', outline: 'none', width: 120,
            }}
          />
          {(['aqi', 'pm25', 'name'] as const).map(k => (
            <button key={k} onClick={() => setSortBy(k)} style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
              border: 'none', fontWeight: 600,
              background: sortBy === k ? 'var(--accent-soft)' : 'var(--border)',
              color: sortBy === k ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all .15s',
            }}>↕ {k.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Ward', 'AQI', 'PM2.5', 'PM10', 'Status', 'Sensors'].map(h => (
                <th key={h} style={{
                  fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.05em',
                  padding: '8px 10px', textAlign: 'left',
                  borderBottom: '2px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((w: any) => (
              <tr key={w.id || w.name} style={{ transition: 'background .1s' }}>
                <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
                  {w.name}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: aqiColor(w.aqi || 0) }}>
                    {w.aqi || '—'}
                  </span>
                </td>
                <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  {w.pm25 ? Number(w.pm25).toFixed(1) : '—'}
                </td>
                <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  {w.pm10 ? Number(w.pm10).toFixed(1) : '—'}
                </td>
                <td style={{ padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700,
                    letterSpacing: '.02em',
                    background: aqiBg(w.aqi || 0), color: aqiColor(w.aqi || 0),
                    border: `1px solid ${aqiColor(w.aqi || 0)}25`,
                  }}>{aqiLabel(w.aqi || 0)}</span>
                </td>
                <td style={{ padding: '9px 10px', fontSize: 12, borderBottom: '1px solid var(--border)', fontWeight: 500,
                  color: (w.sensors || 0) > 0 ? '#16a34a' : '#94a3b8' }}>
                  {w.sensors != null ? `${w.sensors} active` : '—'}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {filter ? `No wards matching "${filter}"` : 'No ward data yet — run sensor-simulator.js'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MetricCard;
