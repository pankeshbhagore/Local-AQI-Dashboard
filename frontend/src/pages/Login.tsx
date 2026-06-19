import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_ACCOUNTS = [
  { role: 'Admin',   email: 'admin@delhi-aqi.com',   pass: 'admin123',   color: '#ef4444', icon: '🛡️' },
  { role: 'Officer', email: 'officer@delhi-aqi.com',  pass: 'officer123', color: '#f59e0b', icon: '👮' },
  { role: 'Citizen', email: 'citizen@delhi-aqi.com',  pass: 'citizen123', color: '#22c55e', icon: '🌿' },
];

export default function Login() {
  const { login }   = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const nav         = useNavigate();
  const [email,    setEmail]   = useState('');
  const [password, setPass]    = useState('');
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState('');
  const [showPass, setShowPass] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      nav('/');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Invalid email or password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function quickLogin(e: string, p: string) {
    setEmail(e); setPass(p); setError('');
    setLoading(true);
    try { await login(e, p); nav('/'); }
    catch { setError('Demo login failed — seed the database first.'); }
    finally { setLoading(false); }
  }

  // ── Tokens ──────────────────────────────────────────────────────────────
  const bg    = isDark ? '#060f1e' : '#f1f5f9';
  const card  = isDark ? '#0d1f35' : '#ffffff';
  const bord  = isDark ? 'rgba(0,212,255,.14)' : 'rgba(0,0,0,.09)';
  const txt   = isDark ? '#e2e8f0' : '#0f172a';
  const muted = isDark ? '#4a6080' : '#94a3b8';
  const inp: React.CSSProperties = {
    width: '100%', background: isDark ? '#071020' : '#f8fafc',
    border: `1px solid ${bord}`, color: txt,
    padding: '10px 12px', borderRadius: 9, fontSize: 14,
    outline: 'none', transition: 'border-color .15s, box-shadow .15s',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{
      minHeight: '100vh', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, transition: 'background .25s',
      backgroundImage: isDark
        ? 'radial-gradient(ellipse at 20% 50%, rgba(0,212,255,.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(139,92,246,.05) 0%, transparent 50%)'
        : 'none',
    }}>

      {/* Theme toggle */}
      <button onClick={toggleTheme} style={{
        position: 'fixed', top: 16, right: 16,
        background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)',
        border: `1px solid ${bord}`, color: muted,
        cursor: 'pointer', fontSize: 13, padding: '6px 14px',
        borderRadius: 9, transition: 'all .15s', fontFamily: 'inherit',
      }}>{isDark ? '☀️ Light' : '🌙 Dark'}</button>

      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeIn .35s ease both' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, margin: '0 auto 14px',
            background: isDark ? 'rgba(0,212,255,.12)' : 'rgba(14,165,233,.1)',
            border: `2px solid ${isDark ? 'rgba(0,212,255,.35)' : 'rgba(14,165,233,.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: isDark ? '0 0 24px rgba(0,212,255,.2)' : '0 4px 16px rgba(14,165,233,.15)',
          }}>🌿</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: txt, letterSpacing: '-.02em' }}>
            AQI Dashboard
          </div>
          <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>
            Hyper-Local Pollution Intelligence System
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: card, border: `1px solid ${bord}`, borderRadius: 16, padding: 28,
          boxShadow: isDark ? '0 8px 40px rgba(0,0,0,.4)' : '0 4px 24px rgba(0,0,0,.08)',
        }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: txt, marginBottom: 2, textAlign: 'center' }}>
            Sign In
          </div>
          <div style={{ fontSize: 12, color: muted, textAlign: 'center', marginBottom: 22 }}>
            Enter your credentials to continue
          </div>

          {error && (
            <div style={{
              color: '#ef4444', fontSize: 12, background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)', padding: '10px 12px',
              borderRadius: 9, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: muted, display: 'block', marginBottom: 5, fontWeight: 500 }}>
                Email address
              </label>
              <input type="email" required autoFocus autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" style={inp}
                onFocus={e => { e.target.style.borderColor = isDark ? '#00d4ff' : '#0ea5e9'; e.target.style.boxShadow = isDark ? '0 0 0 3px rgba(0,212,255,.1)' : '0 0 0 3px rgba(14,165,233,.12)'; }}
                onBlur={e  => { e.target.style.borderColor = bord; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: muted, display: 'block', marginBottom: 5, fontWeight: 500 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} required autoComplete="current-password"
                  value={password} onChange={e => setPass(e.target.value)}
                  placeholder="••••••••" style={{ ...inp, paddingRight: 40 }}
                  onFocus={e => { e.target.style.borderColor = isDark ? '#00d4ff' : '#0ea5e9'; e.target.style.boxShadow = isDark ? '0 0 0 3px rgba(0,212,255,.1)' : '0 0 0 3px rgba(14,165,233,.12)'; }}
                  onBlur={e  => { e.target.style.borderColor = bord; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: 15,
                }}>{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              padding: '11px', marginTop: 4,
              background: loading ? 'var(--text-muted)' : (isDark ? '#0a4b6e' : '#0ea5e9'),
              border: `1px solid ${isDark ? '#00d4ff66' : '#0284c7'}`,
              color: '#fff', borderRadius: 9, fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? .75 : 1, transition: 'all .15s',
              letterSpacing: '.01em', fontFamily: 'inherit',
            }}>
              {loading ? '⏳ Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={{ textAlign: 'center', fontSize: 12, color: muted, marginTop: 16 }}>
            New citizen?{' '}
            <Link to="/register" style={{ color: isDark ? '#00d4ff' : '#0ea5e9', fontWeight: 600 }}>
              Create an account
            </Link>
          </div>
        </div>

        {/* Quick demo login */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: muted, textAlign: 'center', marginBottom: 8, letterSpacing: '.03em' }}>
            QUICK DEMO LOGIN
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DEMO_ACCOUNTS.map(a => (
              <button key={a.role} onClick={() => quickLogin(a.email, a.pass)} disabled={loading}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 9, cursor: 'pointer',
                  background: `${a.color}12`, border: `1px solid ${a.color}30`,
                  color: a.color, fontSize: 11, fontWeight: 700,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  transition: 'all .15s', fontFamily: 'inherit',
                }}>
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                {a.role}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: muted, textAlign: 'center', marginTop: 8 }}>
            Demo accounts require database to be seeded first
          </div>
        </div>
      </div>
    </div>
  );
}
