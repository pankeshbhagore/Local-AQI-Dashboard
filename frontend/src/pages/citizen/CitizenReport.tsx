import React, { useState, useRef } from 'react';
import { useAuth }   from '../../context/AuthContext';
import { reportAPI } from '../../services/api';
import { useQuery }  from '@tanstack/react-query';
import { aqiAPI }    from '../../services/api';
import { cardStyle } from '../../components/Charts';

// FIX: Replaced all hardcoded dark hex colours with CSS variables for theme support
const POLLUTION_TYPES = [
  { value: 'garbage_burning',     label: 'Garbage / Open Burning',    icon: '🔥' },
  { value: 'construction_dust',   label: 'Construction Site Dust',     icon: '🏗️' },
  { value: 'vehicle_smoke',       label: 'Vehicle Exhaust Smoke',      icon: '🚗' },
  { value: 'industrial_emission', label: 'Industrial / Factory Smoke', icon: '🏭' },
  { value: 'dust_storm',          label: 'Dust Storm / Road Dust',     icon: '🌪️' },
  { value: 'other',               label: 'Other Pollution',            icon: '⚠️' },
];

const SEVERITY_OPTIONS = [
  { value: 'low',       label: 'Low',       color: '#22c55e', desc: 'Minor, localised issue' },
  { value: 'medium',    label: 'Medium',    color: '#f59e0b', desc: 'Noticeable & ongoing'   },
  { value: 'high',      label: 'High',      color: '#f97316', desc: 'Strong odour / smoke'   },
  { value: 'emergency', label: 'Emergency', color: '#ef4444', desc: 'Immediate hazard'        },
];

const DELHI_WARDS = [
  'Connaught Place','Chandni Chowk','Anand Vihar','Okhla Industrial Area','Dwarka',
  'Rohini','Lajpat Nagar','Wazirpur Industrial','Lodhi Road','Shahdara',
  'Najafgarh Road','GTK Depot','Mayur Vihar','IGI Airport Area','Vasant Kunj',
];

export default function CitizenReport() {
  const { user }  = useAuth();
  const fileRef   = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    wardId:        String(user?.wardId || '1'),
    pollutionType: 'garbage_burning',
    severity:      'medium',
    description:   '',
    lat:           '28.6139',
    lng:           '77.2090',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState<string | null>(null);
  const [error,      setError]      = useState('');
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [useGPS,     setUseGPS]     = useState(false);

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setPhotoNames(files.map(f => f.name));
  }

  function getGPS() {
    setUseGPS(true);
    navigator.geolocation?.getCurrentPosition(
      pos => {
        set('lat', String(pos.coords.latitude.toFixed(6)));
        set('lng', String(pos.coords.longitude.toFixed(6)));
      },
      () => setUseGPS(false)
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) { setError('Please describe the incident.'); return; }
    setError(''); setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (fileRef.current?.files?.length) {
        Array.from(fileRef.current.files).forEach(f => fd.append('photos', f));
      }
      const res = await reportAPI.submit(fd);
      setSubmitted(res.data?.reportId || 'submitted');
      setForm(p => ({ ...p, description: '', pollutionType: 'garbage_burning', severity: 'medium' }));
      setPhotoNames([]);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setError(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally { setSubmitting(false); }
  }

  const inpStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', padding: '9px 12px', borderRadius: 9,
    fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color .15s, box-shadow .15s',
  };
  const lblStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)', display: 'block',
    marginBottom: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeIn .3s ease both' }}>

      {/* Page header */}
      <div>
        <h2 style={{ fontSize: 20, color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
          Report Pollution Incident
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0' }}>
          Help improve your city's air quality by reporting pollution incidents
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 14, alignItems: 'start' }}>

        {/* Main Form */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 18 }}>
            📋 Incident Details
          </div>

          {/* Success banner */}
          {submitted && (
            <div style={{
              background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)',
              color: '#22c55e', padding: '14px 16px', borderRadius: 10, marginBottom: 18,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>✅ Report Submitted Successfully!</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: .9 }}>ID: {submitted}</div>
              <div style={{ fontSize: 12, marginTop: 2, color: '#16a34a' }}>
                Our field team will verify and respond within 2 hours.
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
              color: '#ef4444', padding: '10px 12px', borderRadius: 9, marginBottom: 14,
              fontSize: 13,
            }}>⚠️ {error}</div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Ward */}
            <div>
              <label style={lblStyle}>Ward / Location</label>
              <select value={form.wardId} onChange={e => set('wardId', e.target.value)}
                style={{ ...inpStyle, cursor: 'pointer' }}>
                {DELHI_WARDS.map((name, i) => (
                  <option key={i + 1} value={String(i + 1)}>Ward {i + 1} — {name}</option>
                ))}
              </select>
            </div>

            {/* Pollution type */}
            <div>
              <label style={lblStyle}>Type of Pollution</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {POLLUTION_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => set('pollutionType', t.value)}
                    style={{
                      padding: '10px 8px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${form.pollutionType === t.value ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.pollutionType === t.value ? 'var(--accent-soft)' : 'var(--bg-primary)',
                      color: form.pollutionType === t.value ? 'var(--accent)' : 'var(--text-muted)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 600, transition: 'all .15s',
                    }}>
                    <span style={{ fontSize: 20 }}>{t.icon}</span>
                    <span style={{ textAlign: 'center', lineHeight: 1.3 }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Severity */}
            <div>
              <label style={lblStyle}>Severity Level</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {SEVERITY_OPTIONS.map(s => (
                  <button key={s.value} type="button" onClick={() => set('severity', s.value)}
                    style={{
                      padding: '9px 6px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${form.severity === s.value ? s.color : 'var(--border)'}`,
                      background: form.severity === s.value ? `${s.color}12` : 'var(--bg-primary)',
                      color: form.severity === s.value ? s.color : 'var(--text-muted)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      transition: 'all .15s',
                    }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{s.label}</span>
                    <span style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.3 }}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={lblStyle}>Description *</label>
              <textarea
                required value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe what you see — e.g. thick black smoke from construction site near the main road…"
                rows={3}
                style={{ ...inpStyle, resize: 'vertical', minHeight: 80 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {form.description.length}/500 characters
              </div>
            </div>

            {/* Location */}
            <div>
              <label style={lblStyle}>GPS Coordinates</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.lat} onChange={e => set('lat', e.target.value)}
                  placeholder="Latitude" style={{ ...inpStyle, flex: 1 }} />
                <input value={form.lng} onChange={e => set('lng', e.target.value)}
                  placeholder="Longitude" style={{ ...inpStyle, flex: 1 }} />
                <button type="button" onClick={getGPS} style={{
                  padding: '9px 12px', borderRadius: 9, whiteSpace: 'nowrap',
                  background: useGPS ? 'rgba(34,197,94,.1)' : 'var(--bg-primary)',
                  border: '1px solid var(--border)', color: useGPS ? '#22c55e' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                }}>📍 {useGPS ? 'Got GPS' : 'Use GPS'}</button>
              </div>
            </div>

            {/* Photos */}
            <div>
              <label style={lblStyle}>Photos (optional, max 5)</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)', borderRadius: 10, padding: '20px',
                  textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s',
                  background: 'var(--bg-primary)',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseOut={e  => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {photoNames.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>📷</div>
                    <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                      {photoNames.length} photo{photoNames.length > 1 ? 's' : ''} selected
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {photoNames.join(', ')}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📸</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Click to attach photos
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      JPG, PNG up to 10MB each
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple
                style={{ display: 'none' }} onChange={handleFiles} />
            </div>

            <button type="submit" disabled={submitting} style={{
              padding: '12px', background: submitting ? 'var(--text-muted)' : 'var(--accent)',
              border: 'none', color: '#fff', borderRadius: 9, fontSize: 14, fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              transition: 'all .15s', boxShadow: submitting ? 'none' : '0 2px 12px rgba(14,165,233,.3)',
            }}>
              {submitting ? '⏳ Submitting…' : '🚨 Submit Report'}
            </button>
          </form>
        </div>

        {/* Sidebar info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
              📌 What Happens Next
            </div>
            {[
              { step: '1', text: 'Your report is immediately visible to admins and officers', color: 'var(--accent)' },
              { step: '2', text: 'A field officer is assigned within 30 minutes', color: '#f59e0b' },
              { step: '3', text: 'Investigation and enforcement action is taken on-site', color: '#f97316' },
              { step: '4', text: 'You receive status updates via the My Reports page', color: '#22c55e' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: s.color + '20',
                  border: `1.5px solid ${s.color}`, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
                }}>{s.step}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s.text}</div>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, background: 'rgba(239,68,68,.06)', borderColor: 'rgba(239,68,68,.2)' }}>
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, marginBottom: 8 }}>
              ⚠️ Report Responsibly
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Please only report genuine pollution incidents. False reports waste emergency resources and may delay real responses.
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
              📊 Your Contribution
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Every report you file helps build a more accurate picture of Delhi's pollution hotspots and improves AI model predictions.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
