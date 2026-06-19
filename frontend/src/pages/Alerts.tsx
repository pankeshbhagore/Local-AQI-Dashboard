import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { alertAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { cardStyle } from '../components/Charts';
import { useTheme } from '../context/ThemeContext';

const SEV_COLOR: Record<string,string> = { critical:'#ef4444', high:'#f97316', moderate:'#f59e0b' };
const SEV_BG:    Record<string,string> = { critical:'rgba(239,68,68,.1)', high:'rgba(249,115,22,.08)', moderate:'rgba(245,158,11,.08)' };

// FIX: All hardcoded dark hex colours → CSS variables; also fixed manual alert form submission error handling
export default function Alerts() {
  const { user }       = useAuth();
  const { liveAlerts } = useSocket();
  const { isDark }     = useTheme();
  const qc             = useQueryClient();
  const [filter,      setFilter]      = useState<'all'|'critical'|'high'|'moderate'>('all');
  const [showManual,  setShowManual]  = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [manualForm,  setManualForm]  = useState({
    wardId: '', wardName: '', message: '', severity: 'high', recommendations: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['alerts', filter],
    queryFn: () => alertAPI.getAll(filter !== 'all' ? { severity: filter } : {}).then(r => r.data).catch(() => null),
    refetchInterval: 20000,
  });

  async function handleResolve(id: string) {
    try { await alertAPI.resolve(id); qc.invalidateQueries({ queryKey: ['alerts'] }); }
    catch { alert('Failed to resolve alert.'); }
  }

  async function handleManual(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await alertAPI.manual({
        ...manualForm,
        wardId: manualForm.wardId ? parseInt(manualForm.wardId) : undefined,
        recommendations: manualForm.recommendations
          ? manualForm.recommendations.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      });
      setShowManual(false);
      setManualForm({ wardId: '', wardName: '', message: '', severity: 'high', recommendations: '' });
      qc.invalidateQueries({ queryKey: ['alerts'] });
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to create alert.');
    } finally { setSubmitting(false); }
  }

  const allAlerts = data?.alerts || [];
  const liveUnresolved = liveAlerts.filter((a: any) => !a.resolved);
  const counts = {
    critical: allAlerts.filter((a:any) => a.severity === 'critical' && !a.resolved).length,
    high:     allAlerts.filter((a:any) => a.severity === 'high'     && !a.resolved).length,
    moderate: allAlerts.filter((a:any) => a.severity === 'moderate' && !a.resolved).length,
  };

  const inpStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '8px 11px', borderRadius: 8,
    fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeIn .3s ease both' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>Alerts & Notifications</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Real-time AQI threshold alerts and manual notifications
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refetch()} style={{
            fontSize: 12, background: 'var(--accent-soft)', border: '1px solid var(--border-accent)',
            color: 'var(--accent)', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
          }}>↻ Refresh</button>
          {(user?.role === 'admin') && (
            <button onClick={() => setShowManual(v => !v)} style={{
              fontSize: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)',
              color: '#ef4444', padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            }}>+ Manual Alert</button>
          )}
        </div>
      </div>

      {/* Live banner */}
      {liveUnresolved.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)',
          borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'breathe 1.5s infinite', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
            {liveUnresolved.length} live alert{liveUnresolved.length > 1 ? 's' : ''} just arrived
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {liveUnresolved[0]?.message}
          </span>
        </div>
      )}

      {/* Summary KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {(['critical', 'high', 'moderate'] as const).map(sev => (
          <div key={sev} style={{
            ...cardStyle, textAlign: 'center', cursor: 'pointer',
            borderTop: `3px solid ${SEV_COLOR[sev]}`,
            outline: filter === sev ? `2px solid ${SEV_COLOR[sev]}` : 'none',
          }} onClick={() => setFilter(f => f === sev ? 'all' : sev)}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, fontWeight: 600 }}>
              {sev}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: SEV_COLOR[sev] }}>
              {counts[sev]}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>unresolved</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['all', 'critical', 'high', 'moderate'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            fontWeight: 600, border: 'none', fontFamily: 'inherit',
            background: filter === f ? (f === 'all' ? 'var(--accent)' : SEV_BG[f]) : 'var(--border)',
            color: filter === f ? (f === 'all' ? '#fff' : SEV_COLOR[f]) : 'var(--text-muted)',
            outline: filter === f && f !== 'all' ? `2px solid ${SEV_COLOR[f]}50` : 'none',
          }}>
            {f === 'all' ? 'All Alerts' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {allAlerts.length} total · {allAlerts.filter((a: any) => !a.resolved).length} unresolved
        </div>
      </div>

      {/* Manual alert form */}
      {showManual && (
        <div style={{ ...cardStyle, border: '1px solid rgba(239,68,68,.25)' }}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 14 }}>
            🚨 Create Manual Alert
          </div>
          <form onSubmit={handleManual} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ward ID</label>
              <input value={manualForm.wardId} onChange={e => setManualForm(p => ({...p, wardId: e.target.value}))}
                placeholder="1–15" style={inpStyle} type="number" min="1" max="15" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ward Name</label>
              <input value={manualForm.wardName} onChange={e => setManualForm(p => ({...p, wardName: e.target.value}))}
                placeholder="e.g. Anand Vihar" style={inpStyle} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Message *</label>
              <input required value={manualForm.message} onChange={e => setManualForm(p => ({...p, message: e.target.value}))}
                placeholder="Alert message for administrators and officers" style={inpStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Severity *</label>
              <select value={manualForm.severity} onChange={e => setManualForm(p => ({...p, severity: e.target.value}))} style={{...inpStyle, cursor: 'pointer'}}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Recommendations (comma-separated)</label>
              <input value={manualForm.recommendations} onChange={e => setManualForm(p => ({...p, recommendations: e.target.value}))}
                placeholder="Deploy team, Issue notice, Close site" style={inpStyle} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowManual(false)} style={{
                padding: '8px 16px', background: 'none', border: '1px solid var(--border)',
                color: 'var(--text-muted)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{
                padding: '8px 18px', background: '#ef4444', border: 'none',
                color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
                {submitting ? 'Sending…' : '🚨 Send Alert'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alerts list */}
      <div style={cardStyle}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8 }} />)}
          </div>
        )}
        {!isLoading && allAlerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Alerts</div>
            <div style={{ fontSize: 12 }}>All clear — no {filter !== 'all' ? filter : ''} alerts at this time</div>
          </div>
        )}
        {allAlerts.map((a: any) => (
          <div key={a._id} style={{
            display: 'flex', gap: 12, padding: '13px 0',
            borderBottom: '1px solid var(--border)', alignItems: 'flex-start',
          }}>
            {/* Severity indicator */}
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: SEV_BG[a.severity] || 'var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>
              {a.severity === 'critical' ? '🚨' : a.severity === 'high' ? '⚠️' : '⚡'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>
                {a.message}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a.wardName && <span>📍 {a.wardName}</span>}
                <span>🕐 {new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {a.resolved && <span style={{ color: '#22c55e' }}>✓ Resolved by {a.resolvedBy}</span>}
              </div>
              {a.recommendations?.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 5, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.recommendations.slice(0, 3).map((r: string, i: number) => (
                    <span key={i} style={{
                      background: 'var(--bg-primary)', border: '1px solid var(--border)',
                      padding: '2px 7px', borderRadius: 12,
                    }}>→ {r}</span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              <span style={{
                fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700, letterSpacing: '.03em',
                background: SEV_BG[a.severity] || 'var(--border)',
                color: SEV_COLOR[a.severity] || 'var(--text-muted)',
                border: `1px solid ${SEV_COLOR[a.severity] || 'var(--border)'}30`,
              }}>{(a.severity || '').toUpperCase()}</span>
              {!a.resolved && (user?.role === 'admin' || user?.role === 'officer') && (
                <button onClick={() => handleResolve(a._id)} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 7,
                  background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)',
                  color: '#22c55e', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
                }}>✓ Resolve</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
