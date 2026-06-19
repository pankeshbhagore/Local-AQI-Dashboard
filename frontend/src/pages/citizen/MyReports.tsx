import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportAPI } from '../../services/api';
import { cardStyle } from '../../components/Charts';
import { useSocket } from '../../context/SocketContext';

// Bug Fix: Removed isDark helpers – now uses CSS variables throughout
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  pending:             { label: 'Pending',       color: '#f59e0b', icon: '⏳', desc: 'Report received, awaiting assignment'      },
  assigned:            { label: 'Assigned',      color: '#3b82f6', icon: '👮', desc: 'Field officer dispatched to location'       },
  under_investigation: { label: 'Investigating', color: '#8b5cf6', icon: '🔍', desc: 'Officer is on-site investigating'           },
  verified:            { label: 'Verified',      color: '#22c55e', icon: '✅', desc: 'Pollution confirmed by field officer'       },
  rejected:            { label: 'Not Verified',  color: '#ef4444', icon: '❌', desc: 'Officer could not confirm the report'      },
  resolved:            { label: 'Resolved',      color: '#64748b', icon: '🎯', desc: 'Issue has been addressed and resolved'      },
};
const TYPE_ICON: Record<string, string> = {
  garbage_burning: '🔥', construction_dust: '🏗️', vehicle_smoke: '🚗',
  industrial_emission: '🏭', dust_storm: '🌪️', other: '⚠️',
};
const SEV_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#f59e0b', high: '#f97316', emergency: '#ef4444',
};

export default function MyReports() {
  const qc = useQueryClient();
  const { lastReportUpdate } = useSocket();
  const [selected,   setSelected]   = useState<any>(null);
  const [feedback,   setFeedback]   = useState({ id: '', text: '', rating: 5 });
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (lastReportUpdate) qc.invalidateQueries({ queryKey: ['myReports'] });
  }, [lastReportUpdate, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ['myReports'],
    queryFn:  () => reportAPI.getMine().then(r => r.data).catch(() => null),
    refetchInterval: 15000,
  });

  const reports  = data?.reports || [];
  const pending  = reports.filter((r: any) => ['pending', 'assigned'].includes(r.verificationStatus)).length;
  const active   = reports.filter((r: any) => r.verificationStatus === 'under_investigation').length;
  const resolved = reports.filter((r: any) => ['verified', 'resolved'].includes(r.verificationStatus)).length;

  async function submitFeedback(reportId: string) {
    if (!feedback.text.trim()) return;
    setSubmitting(true);
    try {
      await reportAPI.feedback(reportId, feedback.rating, feedback.text);
      setFeedback({ id: '', text: '', rating: 5 });
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['myReports'] });
    } catch { alert('Failed to submit feedback.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease both' }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>My Reports</h2>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
          Track your submitted pollution reports and their status
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total',      value: reports.length, color: 'var(--accent)', icon: '📋' },
          { label: 'In Progress',value: pending + active, color: '#f59e0b',    icon: '⏳' },
          { label: 'Active',     value: active,          color: '#8b5cf6',     icon: '🔍' },
          { label: 'Resolved',   value: resolved,        color: '#22c55e',     icon: '✅' },
        ].map(k => (
          <div key={k.label} style={{
            ...cardStyle, padding: 14, textAlign: 'center',
            borderTop: `3px solid ${k.color}`,
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Reports list */}
      <div style={cardStyle}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 8 }} />)}
          </div>
        )}

        {!isLoading && reports.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No reports yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Help make Delhi cleaner — report a pollution incident!
            </div>
            <a href="/report" style={{
              padding: '10px 24px', background: 'var(--accent)', color: '#fff',
              borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}>📸 Submit First Report →</a>
          </div>
        )}

        {reports.map((r: any) => {
          const sConf  = STATUS_CONFIG[r.verificationStatus] || { label: r.verificationStatus, color: '#64748b', icon: '📄', desc: '' };
          const canFeedback = ['verified', 'resolved'].includes(r.verificationStatus) && !r.citizenFeedback?.rating;
          const isOpen = selected?._id === r._id;
          return (
            <div key={r._id}>
              <div
                onClick={() => setSelected(isOpen ? null : r)}
                style={{
                  padding: '14px 0', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'opacity .1s',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}
              >
                {/* Type icon */}
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>{TYPE_ICON[r.pollutionType] || '⚠️'}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Top line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.pollutionType?.replace(/_/g, ' ')}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                      background: `${sConf.color}18`, color: sConf.color,
                    }}>{sConf.icon} {sConf.label}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700,
                      background: `${SEV_COLOR[r.severity] || '#64748b'}15`,
                      color: SEV_COLOR[r.severity] || '#64748b',
                    }}>{r.severity}</span>
                  </div>
                  {/* Meta */}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>📍 {r.wardName || `Ward ${r.wardId}`}</span>
                    <span>🕐 {new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    {r.assignedToName && <span>👮 {r.assignedToName}</span>}
                  </div>
                </div>

                {/* Feedback badge */}
                {r.citizenFeedback?.rating && (
                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                    {'★'.repeat(r.citizenFeedback.rating)}
                  </div>
                )}
                <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{
                  background: 'var(--bg-primary)', borderRadius: 10, padding: 16,
                  marginBottom: 4, border: '1px solid var(--border)',
                }}>
                  {/* Status timeline */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Status Progress</div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {['pending', 'assigned', 'under_investigation', 'verified', 'resolved'].map((s, i, arr) => {
                        const conf   = STATUS_CONFIG[s];
                        const done   = arr.indexOf(r.verificationStatus) >= i;
                        const current = r.verificationStatus === s;
                        return (
                          <React.Fragment key={s}>
                            <div style={{
                              padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                              background: done ? `${conf.color}18` : 'var(--border)',
                              color: done ? conf.color : 'var(--text-muted)',
                              border: current ? `1.5px solid ${conf.color}` : '1.5px solid transparent',
                            }}>{conf.icon} {conf.label}</div>
                            {i < arr.length - 1 && (
                              <div style={{ width: 16, height: 1, background: done && arr.indexOf(r.verificationStatus) > i ? conf.color : 'var(--border)', flexShrink: 0 }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                      {STATUS_CONFIG[r.verificationStatus]?.desc}
                    </div>
                  </div>

                  {/* Description */}
                  {r.description && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Your Report</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.description}</div>
                    </div>
                  )}

                  {/* Officer notes */}
                  {r.officerNotes && (
                    <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>👮 Officer Notes</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.officerNotes}</div>
                    </div>
                  )}

                  {/* Feedback form */}
                  {canFeedback && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                        ⭐ Rate this resolution
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setFeedback(p => ({ ...p, id: r._id, rating: n }))} style={{
                            width: 32, height: 32, borderRadius: 6, cursor: 'pointer',
                            background: (feedback.id === r._id ? feedback.rating : 0) >= n ? 'rgba(245,158,11,.15)' : 'var(--bg-primary)',
                            border: '1px solid var(--border)', fontSize: 16,
                          }}>{'★'}</button>
                        ))}
                      </div>
                      <textarea
                        value={feedback.id === r._id ? feedback.text : ''}
                        onChange={e => setFeedback(p => ({ ...p, id: r._id, text: e.target.value }))}
                        placeholder="Share your experience with the resolution…"
                        rows={2}
                        style={{
                          width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
                          color: 'var(--text-primary)', padding: '8px 11px', borderRadius: 8,
                          fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                        }}
                      />
                      <button onClick={() => submitFeedback(r._id)} disabled={submitting || !feedback.text.trim()} style={{
                        marginTop: 8, padding: '7px 16px', background: 'var(--accent)', border: 'none',
                        color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      }}>{submitting ? 'Submitting…' : 'Submit Feedback'}</button>
                    </div>
                  )}

                  {/* Existing feedback */}
                  {r.citizenFeedback?.rating && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Your Feedback</div>
                      <div style={{ color: '#f59e0b', fontSize: 14 }}>{'★'.repeat(r.citizenFeedback.rating)}{'☆'.repeat(5 - r.citizenFeedback.rating)}</div>
                      {r.citizenFeedback.feedback && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{r.citizenFeedback.feedback}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
