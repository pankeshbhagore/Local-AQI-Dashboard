import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

const DELHI_WARDS = [
  'Connaught Place','Chandni Chowk','Anand Vihar','Okhla Industrial Area','Dwarka',
  'Rohini','Lajpat Nagar','Wazirpur Industrial','Lodhi Road','Shahdara',
  'Najafgarh Road','GTK Depot','Mayur Vihar','IGI Airport Area','Vasant Kunj',
];

export default function Register() {
  const { login }   = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const nav         = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', phone: '', wardId: '1' });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [showPass, setShowPass] = useState(false);
  const [step,     setStep]     = useState<1 | 2>(1);

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function validateStep1() {
    if (!form.name.trim()) return 'Full name is required.';
    if (!form.email.includes('@')) return 'Please enter a valid email.';
    if (form.password.length < 6) return 'Password must be at least 6 characters.';
    if (form.password !== form.confirm) return 'Passwords do not match.';
    return '';
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name:     form.name.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        phone:    form.phone.trim() || undefined,
        role:     'citizen',
        wardId:   parseInt(form.wardId),
      });
      setSuccess('Account created! Signing you in…');
      await login(form.email.trim().toLowerCase(), form.password);
      nav('/');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.details?.[0]?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally { setLoading(false); }
  }

  const bg    = isDark ? '#060f1e' : '#f1f5f9';
  const card  = isDark ? '#0d1f35' : '#ffffff';
  const bord  = isDark ? 'rgba(0,212,255,.14)' : 'rgba(0,0,0,.09)';
  const txt   = isDark ? '#e2e8f0' : '#0f172a';
  const muted = isDark ? '#4a6080' : '#94a3b8';
  const inp: React.CSSProperties = {
    width: '100%', background: isDark ? '#071020' : '#f8fafc',
    border: `1px solid ${bord}`, color: txt, padding: '10px 12px',
    borderRadius: 9, fontSize: 13, outline: 'none', transition: 'border-color .15s, box-shadow .15s',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20, transition: 'background .25s',
      backgroundImage: isDark ? 'radial-gradient(ellipse at 20% 50%, rgba(0,212,255,.04) 0%, transparent 60%)' : 'none',
    }}>
      <button onClick={toggleTheme} style={{
        position: 'fixed', top: 16, right: 16, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)',
        border: `1px solid ${bord}`, color: muted, cursor: 'pointer',
        fontSize: 13, padding: '6px 14px', borderRadius: 9, fontFamily: 'inherit',
      }}>{isDark ? '☀️ Light' : '🌙 Dark'}</button>

      <div style={{ width: '100%', maxWidth: 420, animation: 'fadeIn .35s ease both' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 12px',
            background: isDark ? 'rgba(0,212,255,.12)' : 'rgba(14,165,233,.1)',
            border: `2px solid ${isDark ? 'rgba(0,212,255,.35)' : 'rgba(14,165,233,.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            boxShadow: isDark ? '0 0 20px rgba(0,212,255,.2)' : '0 4px 16px rgba(14,165,233,.12)',
          }}>🌿</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: txt, letterSpacing: '-.02em' }}>
            Join AQI Dashboard
          </div>
          <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
            Citizen air quality monitoring network
          </div>
        </div>

        {/* Progress steps */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 0 }}>
          {[{ n: 1, label: 'Account' }, { n: 2, label: 'Location' }].map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 12, fontWeight: 700,
                  background: step >= s.n ? (isDark ? '#0a4b6e' : '#0ea5e9') : (isDark ? '#071020' : '#f1f5f9'),
                  color: step >= s.n ? '#fff' : muted,
                  border: `2px solid ${step >= s.n ? (isDark ? '#00d4ff' : '#0ea5e9') : bord}`,
                  transition: 'all .25s',
                }}>{step > s.n ? '✓' : s.n}</div>
                <div style={{ fontSize: 10, color: step >= s.n ? (isDark ? '#00d4ff' : '#0ea5e9') : muted, marginTop: 4, fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
              {i < 1 && <div style={{ flex: 1, height: 2, background: step > 1 ? (isDark ? '#00d4ff' : '#0ea5e9') : bord, transition: 'background .25s', maxWidth: 60, margin: '0 4px', marginBottom: 18 }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: card, border: `1px solid ${bord}`, borderRadius: 16, padding: 28,
          boxShadow: isDark ? '0 8px 40px rgba(0,0,0,.4)' : '0 4px 24px rgba(0,0,0,.08)' }}>

          {error && (
            <div style={{ color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)', padding: '10px 12px',
              borderRadius: 9, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠️</span> {error}
            </div>
          )}
          {success && (
            <div style={{ color: '#22c55e', fontSize: 12, background: 'rgba(34,197,94,.08)',
              border: '1px solid rgba(34,197,94,.2)', padding: '10px 12px',
              borderRadius: 9, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✅</span> {success}
            </div>
          )}

          {/* Step 1 — Account details */}
          {step === 1 && (
            <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: txt, marginBottom: 4 }}>Account Details</div>
              <div>
                <label style={{ fontSize: 11, color: muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>Full Name *</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>Email Address *</label>
                <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input required type={showPass ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', e.target.value)} placeholder="Min 6 characters"
                    style={{ ...inp, paddingRight: 40 }} minLength={6} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: 15,
                  }}>{showPass ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>Confirm Password *</label>
                <input required type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)}
                  placeholder="Re-enter password" style={{ ...inp, borderColor: form.confirm && form.confirm !== form.password ? '#ef4444' : undefined }} />
                {form.confirm && form.confirm !== form.password && (
                  <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>Passwords do not match</div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, color: muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>Phone (optional)</label>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXX XXXXX" style={inp} />
              </div>
              <button type="submit" style={{
                padding: 11, marginTop: 4, background: isDark ? '#0a4b6e' : '#0ea5e9',
                border: `1px solid ${isDark ? '#00d4ff66' : '#0284c7'}`,
                color: '#fff', borderRadius: 9, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Next: Choose Ward →</button>
            </form>
          )}

          {/* Step 2 — Location */}
          {step === 2 && (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: txt, marginBottom: 4 }}>Choose Your Ward</div>
              <div style={{ fontSize: 12, color: muted, lineHeight: 1.6,
                background: isDark ? 'rgba(0,212,255,.05)' : 'rgba(14,165,233,.05)',
                border: `1px solid ${isDark ? 'rgba(0,212,255,.1)' : 'rgba(14,165,233,.15)'}`,
                padding: '10px 12px', borderRadius: 8, marginBottom: 4 }}>
                📍 Select the ward nearest to your home. You'll receive localised AQI readings and health advisories for this area.
              </div>
              <div>
                <label style={{ fontSize: 11, color: muted, display: 'block', marginBottom: 5, fontWeight: 600 }}>Delhi Ward *</label>
                <select value={form.wardId} onChange={e => set('wardId', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                  {DELHI_WARDS.map((name, i) => (
                    <option key={i + 1} value={String(i + 1)}>{i + 1}. {name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setStep(1); setError(''); }} style={{
                  flex: 1, padding: 11, background: 'none', border: `1px solid ${bord}`,
                  color: muted, borderRadius: 9, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}>← Back</button>
                <button type="submit" disabled={loading} style={{
                  flex: 2, padding: 11,
                  background: loading ? (isDark ? '#1e3a5f' : '#93c5fd') : (isDark ? '#0a4b6e' : '#0ea5e9'),
                  border: `1px solid ${isDark ? '#00d4ff66' : '#0284c7'}`,
                  color: '#fff', borderRadius: 9, fontSize: 14, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}>{loading ? '⏳ Creating account…' : 'Create Account →'}</button>
              </div>
            </form>
          )}

          <div style={{ textAlign: 'center', fontSize: 12, color: muted, marginTop: 16 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: isDark ? '#00d4ff' : '#0ea5e9', fontWeight: 600 }}>Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
