import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { cardStyle } from '../components/Charts';

// ── Bug Fix: All hardcoded dark hex colors → CSS variables for proper light/dark support
const STATUS_COLOR: Record<string, string> = {
  verified: '#22c55e', pending: '#f59e0b', rejected: '#ef4444',
  under_investigation: '#8b5cf6', assigned: '#3b82f6', resolved: '#64748b',
};
const STATUS_ICON: Record<string, string> = {
  verified: '✅', pending: '⏳', rejected: '❌',
  under_investigation: '🔍', assigned: '👮', resolved: '🎯',
};
const TYPE_ICON: Record<string, string> = {
  garbage_burning: '🔥', construction_dust: '🏗️', vehicle_smoke: '🚗',
  industrial_emission: '🏭', dust_storm: '🌪️', other: '⚠️',
};
const DELHI_WARDS = [
  'Connaught Place','Chandni Chowk','Anand Vihar','Okhla Industrial Area','Dwarka',
  'Rohini','Lajpat Nagar','Wazirpur Industrial','Lodhi Road','Shahdara',
  'Najafgarh Road','GTK Depot','Mayur Vihar','IGI Airport Area','Vasant Kunj',
];

const inpStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color .15s, box-shadow .15s',
};

export default function Reports() {
  const { user } = useAuth();
  const qc       = useQueryClient();
  const { lastReportUpdate } = useSocket();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [activeTab,   setActiveTab]   = useState<'list' | 'submit'>('list');
  const [statusFilter,setStatusFilter]= useState('all');
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [form, setForm] = useState({
    wardId: String(user?.wardId || '1'), pollutionType: 'garbage_burning',
    severity: 'medium', description: '', lat: '28.6139', lng: '77.2090',
  });
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [photoNames,  setPhotoNames]  = useState<string[]>([]);
  const [verifying,   setVerifying]   = useState<string | null>(null);

  const { data: reports, isLoading, refetch } = useQuery({
    queryKey: ['allReports', statusFilter, typeFilter],
    queryFn: () => reportAPI.getAll({
      limit: 50,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }).then(r => r.data).catch(() => null),
    enabled: user?.role !== 'citizen',
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (lastReportUpdate) {
      qc.invalidateQueries({ queryKey: ['allReports'] });
      qc.invalidateQueries({ queryKey: ['reportsStats'] });
    }
  }, [lastReportUpdate, qc]);

  const { data: stats } = useQuery({
    queryKey: ['reportStats'],
    queryFn:  () => reportAPI.getStats().then(r => r.data).catch(() => null),
    enabled:  user?.role !== 'citizen',
    refetchInterval: 60000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) { setSubmitError('Description is required.'); return; }
    setSubmitting(true); setSubmitError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (fileRef.current?.files?.length) {
        Array.from(fileRef.current.files).forEach(f => fd.append('photos', f));
      }
      await reportAPI.submit(fd);
      setSubmitted(true);
      setPhotoNames([]);
      if (fileRef.current) fileRef.current.value = '';
      setForm(p => ({ ...p, description: '' }));
      setTimeout(() => setSubmitted(false), 6000);
      qc.invalidateQueries({ queryKey: ['allReports'] });
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally { setSubmitting(false); }
  }

  async function handleVerify(id: string, status: string) {
    setVerifying(id);
    try {
      await reportAPI.verify(id, status, '');
      qc.invalidateQueries({ queryKey: ['allReports'] });
      qc.invalidateQueries({ queryKey: ['reportStats'] });
    } catch { alert('Failed to update report.'); }
    finally { setVerifying(null); }
  }

  const allReports  = reports?.reports || [];
  const filtered    = typeFilter === 'all' ? allReports : allReports.filter((r: any) => r.pollutionType === typeFilter);
  const totalCount  = reports?.total ?? allReports.length;
  const pendingCount= stats?.pending ?? allReports.filter((r: any) => r.verificationStatus === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease both' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Pollution Reports</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Citizen-reported incidents · Field verification workflow
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {user?.role !== 'citizen' && (
            <button onClick={() => refetch()} style={{
              fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--accent-soft)', border: '1px solid var(--border-accent)',
              color: 'var(--accent)', fontFamily: 'inherit',
            }}>↻ Refresh</button>
          )}
        </div>
      </div>

      {/* ── KPI Row (staff only) ── */}
      {user?.role !== 'citizen' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Total Reports',  value: totalCount,   color: 'var(--accent)'  },
            { label: 'Pending Review', value: pendingCount, color: '#f59e0b'        },
            { label: 'Verified',       value: stats?.verified   ?? 0, color: '#22c55e' },
            { label: 'Rejected',       value: stats?.rejected   ?? 0, color: '#ef4444' },
          ].map(k => (
            <div key={k.label} style={{
              ...cardStyle, textAlign: 'center', padding: 16,
              borderTop: `3px solid ${k.color}`,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs (staff only — list view only, no submit) ── */}
      {user?.role !== 'citizen' && (
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)' }}>
          <button onClick={() => setActiveTab('list')} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: 'none', border: 'none', fontFamily: 'inherit',
            color: 'var(--accent)',
            borderBottom: '2px solid var(--accent)',
            marginBottom: -2, transition: 'all .15s',
          }}>📋 All Reports</button>
        </div>
      )}

      {/* ── Submit Form (CITIZEN ONLY) ── */}
      {user?.role === 'citizen' && (
        <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'citizen' ? '1fr' : '420px 1fr', gap: 16, alignItems: 'start' }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📸</span> Submit Pollution Incident
            </div>

            {submitted && (
              <div style={{
                background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)',
                color: '#22c55e', padding: '12px 14px', borderRadius: 10, marginBottom: 16,
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 20 }}>✅</span>
                Report submitted! Our team will verify it shortly.
              </div>
            )}
            {submitError && (
              <div style={{
                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                color: '#ef4444', padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13,
              }}>⚠️ {submitError}</div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Pollution type selector */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Type of Pollution *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { value: 'garbage_burning',     label: 'Open Burning',   icon: '🔥' },
                    { value: 'construction_dust',   label: 'Construction',   icon: '🏗️' },
                    { value: 'vehicle_smoke',        label: 'Vehicle Smoke',  icon: '🚗' },
                    { value: 'industrial_emission', label: 'Industrial',     icon: '🏭' },
                    { value: 'dust_storm',          label: 'Dust Storm',     icon: '🌪️' },
                    { value: 'other',               label: 'Other',          icon: '⚠️' },
                  ].map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setForm(p => ({ ...p, pollutionType: t.value }))} style={{
                        padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, fontWeight: 600, textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: form.pollutionType === t.value ? 'var(--accent-soft)' : 'var(--bg-primary)',
                        border: `1px solid ${form.pollutionType === t.value ? 'var(--accent)' : 'var(--border)'}`,
                        color: form.pollutionType === t.value ? 'var(--accent)' : 'var(--text-secondary)',
                        transition: 'all .12s',
                      }}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Severity *
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { v: 'low', label: 'Low', col: '#22c55e' }, { v: 'medium', label: 'Medium', col: '#f59e0b' },
                    { v: 'high', label: 'High', col: '#f97316' }, { v: 'emergency', label: '🚨 Emergency', col: '#ef4444' },
                  ].map(s => (
                    <button key={s.v} type="button" onClick={() => setForm(p => ({ ...p, severity: s.v }))} style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, border: 'none', fontFamily: 'inherit',
                      background: form.severity === s.v ? `${s.col}18` : 'var(--bg-primary)',
                      color: form.severity === s.v ? s.col : 'var(--text-muted)',
                      outline: form.severity === s.v ? `1.5px solid ${s.col}` : '1px solid var(--border)',
                      transition: 'all .12s',
                    }}>{s.label}</button>
                  ))}
                </div>
              </div>

              {/* Ward */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Ward *
                </label>
                <select value={form.wardId} onChange={e => setForm(p => ({ ...p, wardId: e.target.value }))} style={{ ...inpStyle, cursor: 'pointer' }}>
                  {DELHI_WARDS.map((name, i) => (
                    <option key={i + 1} value={String(i + 1)}>{i + 1}. {name}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Description *
                </label>
                <textarea
                  required
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  rows={4}
                  placeholder="Describe what you see: location details, smoke colour, smell, time started, vehicles/buildings involved…"
                  style={{ ...inpStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              {/* GPS */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['lat', 'Latitude'], ['lng', 'Longitude']].map(([k, label]) => (
                  <div key={k}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {label}
                    </label>
                    <input type="number" step="any" value={(form as any)[k]}
                      onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={inpStyle} />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => {
                navigator.geolocation?.getCurrentPosition(p => {
                  setForm(prev => ({ ...prev, lat: String(p.coords.latitude.toFixed(6)), lng: String(p.coords.longitude.toFixed(6)) }));
                }, () => alert('GPS unavailable'));
              }} style={{
                padding: '7px', background: 'var(--accent-soft)', border: '1px solid var(--border-accent)',
                color: 'var(--accent)', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}>📍 Use My GPS Location</button>

              {/* Photos */}
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Photos (optional, up to 5)
                </label>
                <input ref={fileRef} type="file" accept="image/*" multiple
                  onChange={e => setPhotoNames(Array.from(e.target.files || []).map(f => f.name))}
                  style={{ ...inpStyle, padding: '6px 12px', cursor: 'pointer' }} />
                {photoNames.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    📷 {photoNames.join(', ')}
                  </div>
                )}
              </div>

              <button type="submit" disabled={submitting} style={{
                padding: '11px', background: submitting ? 'var(--text-muted)' : 'var(--accent)',
                border: '1px solid var(--border-accent)', color: '#fff', borderRadius: 9,
                fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all .15s', letterSpacing: '.01em',
              }}>{submitting ? '⏳ Submitting…' : 'Submit Report →'}</button>
            </form>
          </div>

          {/* Info panel for citizens */}
          {user?.role === 'citizen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                  📋 How It Works
                </div>
                {[
                  { n: '1', title: 'Submit Report', desc: 'Fill in the form with location, type, and a description of the pollution you\'re witnessing.', color: 'var(--accent)' },
                  { n: '2', title: 'Field Officer Assigned', desc: 'A verified field officer is dispatched to your reported location within 24 hours.', color: '#f59e0b' },
                  { n: '3', title: 'Investigation', desc: 'The officer investigates on-site and correlates with sensor data.', color: '#8b5cf6' },
                  { n: '4', title: 'Resolution', desc: 'Verified reports trigger official action notices. You\'ll see status updates in My Reports.', color: '#22c55e' },
                ].map(step => (
                  <div key={step.n} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', background: `${step.color}15`,
                      border: `1.5px solid ${step.color}30`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 12, fontWeight: 800, color: step.color, flexShrink: 0,
                    }}>{step.n}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{step.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ ...cardStyle, background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.15)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>🚨 Emergency?</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  For immediate hazards: call <strong>1800-180-3232</strong> (CPCB Toll Free) or mark the severity as Emergency above.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Reports List (staff) ── */}
      {activeTab === 'list' && user?.role !== 'citizen' && (
        <div style={cardStyle}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Status:</div>
            {['all', 'pending', 'assigned', 'verified', 'rejected', 'resolved'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                border: 'none', fontWeight: 600, fontFamily: 'inherit',
                background: statusFilter === s ? (STATUS_COLOR[s] ? `${STATUS_COLOR[s]}20` : 'var(--accent-soft)') : 'var(--border)',
                color: statusFilter === s ? (STATUS_COLOR[s] || 'var(--accent)') : 'var(--text-muted)',
              }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              Showing {filtered.length} of {totalCount}
            </div>
          </div>

          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />)}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No reports found</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Try a different filter</div>
            </div>
          )}

          {filtered.map((r: any) => {
            const sConf = STATUS_CONFIG[r.verificationStatus] || { label: r.verificationStatus, color: '#64748b', icon: '📄' };
            return (
              <div key={r._id} style={{
                padding: '14px 0', borderBottom: '1px solid var(--border)',
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                }}>{TYPE_ICON[r.pollutionType] || '⚠️'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {r.pollutionType?.replace(/_/g, ' ')}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700,
                      background: `${STATUS_COLOR[r.verificationStatus] || '#64748b'}18`,
                      color: STATUS_COLOR[r.verificationStatus] || '#64748b',
                    }}>{STATUS_ICON[r.verificationStatus]} {r.verificationStatus?.replace(/_/g, ' ')}</span>
                    {r.severity === 'emergency' && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>
                        🚨 EMERGENCY
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>📍 {r.wardName || `Ward ${r.wardId}`}</span>
                    <span>👤 {r.userName || 'Citizen'}</span>
                    <span>🕐 {new Date(r.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {r.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {r.description.length > 120 ? r.description.slice(0, 120) + '…' : r.description}
                    </div>
                  )}
                </div>
                {r.verificationStatus === 'pending' && (user?.role === 'admin' || user?.role === 'officer') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => handleVerify(r._id, 'verified')} disabled={verifying === r._id} style={{
                      fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                      background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)',
                      color: '#22c55e', fontWeight: 600, fontFamily: 'inherit',
                    }}>✓ Verify</button>
                    <button onClick={() => handleVerify(r._id, 'rejected')} disabled={verifying === r._id} style={{
                      fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                      background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
                      color: '#ef4444', fontWeight: 600, fontFamily: 'inherit',
                    }}>✗ Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Internal lookup for JSX (not exported)
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending:              { label: 'Pending',        color: '#f59e0b', icon: '⏳' },
  assigned:             { label: 'Assigned',       color: '#3b82f6', icon: '👮' },
  under_investigation:  { label: 'Investigating',  color: '#8b5cf6', icon: '🔍' },
  verified:             { label: 'Verified',       color: '#22c55e', icon: '✅' },
  rejected:             { label: 'Not Verified',   color: '#ef4444', icon: '❌' },
  resolved:             { label: 'Resolved',       color: '#64748b', icon: '🎯' },
};
