import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { cardStyle } from '../../components/Charts';

// Bug Fix: Replaced all hardcoded dark theme hex values with CSS variables
const ROLE_COLOR: Record<string, string> = {
  admin: '#ef4444', officer: '#f59e0b', citizen: '#22c55e',
};
const ROLE_ICON: Record<string, string> = {
  admin: '🛡️', officer: '👮', citizen: '🌿',
};
const DELHI_WARDS = [
  'Connaught Place','Chandni Chowk','Anand Vihar','Okhla Industrial Area','Dwarka',
  'Rohini','Lajpat Nagar','Wazirpur Industrial','Lodhi Road','Shahdara',
  'Najafgarh Road','GTK Depot','Mayur Vihar','IGI Airport Area','Vasant Kunj',
];

const inpStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border)',
  color: 'var(--text-primary)', padding: '8px 11px', borderRadius: 8,
  fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

export default function UserManagement() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [search,     setSearch]  = useState('');
  const [roleFilter, setRoleF]   = useState('all');
  const [showCreate, setCreate]  = useState(false);
  const [newUser,    setNew]     = useState({ name: '', email: '', password: '', role: 'officer', wardId: '1' });
  const [creating,   setCreating]= useState(false);
  const [createErr,  setCreateErr]= useState('');
  const [togglingId, setToggId]  = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn:  () => api.get('/auth/users').then(r => r.data),
    refetchInterval: 30000,
  });

  const allUsers: any[] = data?.users || [];
  const users = allUsers.filter((u: any) => {
    const matchSearch = !search || u.email.includes(search.toLowerCase()) || (u.name || '').toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = {
    all:      allUsers.length,
    admin:    allUsers.filter(u => u.role === 'admin').length,
    officer:  allUsers.filter(u => u.role === 'officer').length,
    citizen:  allUsers.filter(u => u.role === 'citizen').length,
    superuser:allUsers.filter(u => u.role === 'superuser').length,
  };

  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setCreateErr(''); setCreating(true);
    try {
      await api.post('/auth/register', { ...newUser, wardId: parseInt(newUser.wardId) });
      qc.invalidateQueries({ queryKey: ['allUsers'] });
      setNew({ name: '', email: '', password: '', role: 'officer', wardId: '1' });
      setCreate(false);
    } catch (err: any) {
      setCreateErr(err.response?.data?.error || 'Failed to create user.');
    } finally { setCreating(false); }
  }

  async function toggleActive(userId: string, isActive: boolean) {
    setToggId(userId);
    try {
      await api.patch(`/auth/users/${userId}`, { isActive: !isActive });
      qc.invalidateQueries({ queryKey: ['allUsers'] });
    } catch { alert('Failed to update user.'); }
    finally { setToggId(null); }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api.patch(`/auth/users/${userId}`, { role });
      qc.invalidateQueries({ queryKey: ['allUsers'] });
    } catch { alert('Failed to change role.'); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn .3s ease both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>User Management</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Manage roles, activation status, and ward assignments
          </div>
        </div>
        <button onClick={() => setCreate(v => !v)} style={{
          padding: '8px 16px', background: 'var(--accent)', border: 'none', color: '#fff',
          borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>+ Add User</button>
      </div>

      {/* KPI pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['all', 'admin', 'officer', 'citizen'] as const).map(role => (
          <button key={role} onClick={() => setRoleF(role)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            fontWeight: 600, border: 'none', fontFamily: 'inherit',
            background: roleFilter === role
              ? (role === 'all' ? 'var(--accent)' : `${ROLE_COLOR[role] || 'var(--accent)'}18`)
              : 'var(--border)',
            color: roleFilter === role
              ? (role === 'all' ? '#fff' : ROLE_COLOR[role] || 'var(--accent)')
              : 'var(--text-muted)',
          }}>
            {role === 'all' ? '👥' : ROLE_ICON[role]} {role.charAt(0).toUpperCase() + role.slice(1)}
            <span style={{ marginLeft: 6, opacity: .8 }}>({roleCounts[role]})</span>
          </button>
        ))}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Search name or email…"
          style={{
            marginLeft: 'auto', fontSize: 12, padding: '6px 12px', borderRadius: 20,
            border: '1px solid var(--border)', background: 'var(--bg-primary)',
            color: 'var(--text-primary)', outline: 'none', width: 200,
          }}
        />
      </div>

      {/* Create user form */}
      {showCreate && (
        <div style={{ ...cardStyle, border: '1px solid var(--border-accent)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
            ➕ Create New User
          </div>
          {createErr && (
            <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,.08)',
              border: '1px solid rgba(239,68,68,.2)', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
              ⚠️ {createErr}
            </div>
          )}
          <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Full Name *</label>
              <input required value={newUser.name} onChange={e => setNew(p => ({...p, name: e.target.value}))} placeholder="Full Name" style={inpStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Email *</label>
              <input required type="email" value={newUser.email} onChange={e => setNew(p => ({...p, email: e.target.value}))} placeholder="email@example.com" style={inpStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Password *</label>
              <input required type="password" value={newUser.password} onChange={e => setNew(p => ({...p, password: e.target.value}))} placeholder="Min 6 characters" style={inpStyle} minLength={6} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Role *</label>
              <select value={newUser.role} onChange={e => setNew(p => ({...p, role: e.target.value}))} style={{ ...inpStyle, cursor: 'pointer' }}>
                <option value="citizen">Citizen</option>
                <option value="officer">Field Officer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Ward Assignment</label>
              <select value={newUser.wardId} onChange={e => setNew(p => ({...p, wardId: e.target.value}))} style={{ ...inpStyle, cursor: 'pointer' }}>
                {DELHI_WARDS.map((name, i) => (
                  <option key={i+1} value={String(i+1)}>{i+1}. {name}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => { setCreate(false); setCreateErr(''); }} style={{
                padding: '8px 16px', background: 'none', border: '1px solid var(--border)',
                color: 'var(--text-muted)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button type="submit" disabled={creating} style={{
                padding: '8px 18px', background: 'var(--accent)', border: 'none',
                color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>{creating ? 'Creating…' : '➕ Create User'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div style={cardStyle}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />)}
          </div>
        )}
        {!isLoading && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['User', 'Role', 'Ward', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
                    color: 'var(--text-muted)', padding: '8px 10px', textAlign: 'left',
                    borderBottom: '2px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u._id} style={{ opacity: u.isActive ? 1 : .5 }}>
                  <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                        background: `${ROLE_COLOR[u.role] || '#64748b'}18`,
                        border: `1px solid ${ROLE_COLOR[u.role] || '#64748b'}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: ROLE_COLOR[u.role] || '#64748b',
                      }}>{(u.name || u.email)[0].toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{u.name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>
                    {me?.role === 'superuser' && u._id !== me?.id ? (
                      <select value={u.role} onChange={e => changeRole(u._id, e.target.value)} style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                        background: `${ROLE_COLOR[u.role] || '#64748b'}12`,
                        border: `1px solid ${ROLE_COLOR[u.role] || '#64748b'}30`,
                        color: ROLE_COLOR[u.role] || 'var(--text-secondary)',
                        fontWeight: 700, outline: 'none',
                      }}>
                        <option value="citizen">Citizen</option>
                        <option value="officer">Officer</option>
                        <option value="admin">Admin</option>
                        <option value="superuser">Superuser</option>
                      </select>
                    ) : (
                      <span style={{
                        fontSize: 10, padding: '3px 9px', borderRadius: 20, fontWeight: 700,
                        background: `${ROLE_COLOR[u.role] || '#64748b'}12`,
                        color: ROLE_COLOR[u.role] || '#64748b',
                      }}>{ROLE_ICON[u.role]} {u.role}</span>
                    )}
                  </td>
                  <td style={{ padding: '11px 10px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {u.wardId ? DELHI_WARDS[u.wardId - 1] || `Ward ${u.wardId}` : '—'}
                  </td>
                  <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700,
                      background: u.isActive ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.08)',
                      color: u.isActive ? '#22c55e' : '#ef4444',
                    }}>{u.isActive ? '● Active' : '○ Inactive'}</span>
                  </td>
                  <td style={{ padding: '11px 10px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}
                  </td>
                  <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>
                    {u._id !== me?.id && (
                      <button
                        onClick={() => toggleActive(u._id, u.isActive)}
                        disabled={togglingId === u._id}
                        style={{
                          fontSize: 11, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
                          border: '1px solid var(--border)', background: 'var(--bg-primary)',
                          color: u.isActive ? '#ef4444' : '#22c55e',
                          fontWeight: 600, fontFamily: 'inherit',
                        }}>
                        {togglingId === u._id ? '…' : u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                    {u._id === me?.id && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>You</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: 13 }}>
                    {search ? `No users matching "${search}"` : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
