import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth }   from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTheme }  from '../../context/ThemeContext';
import { useQuery }  from '@tanstack/react-query';
import { alertAPI }  from '../../services/api';
import CopilotWidget from '../CopilotWidget';

const NAV: Record<string, { to: string; icon: string; label: string }[]> = {
  admin: [
    { to: '/',         icon: '📊', label: 'Analytics'       },
    { to: '/map',      icon: '🗺️', label: 'Ward Map'        },
    { to: '/twin',     icon: '🏙️', label: 'Digital Twin'    },
    { to: '/forecast', icon: '📈', label: 'Forecast'         },
    { to: '/sources',  icon: '🔍', label: 'Source Detection' },
    { to: '/alerts',   icon: '🔔', label: 'Alerts'           },
    { to: '/reports',  icon: '📋', label: 'Reports'          }, // FIX: was missing
    { to: '/advisory', icon: '❤️', label: 'Health Advisory'  },
    { to: '/users',    icon: '👥', label: 'Users'             },
  ],
  officer: [
    { to: '/',         icon: '📋', label: 'My Reports'        },
    { to: '/map',      icon: '🗺️', label: 'Ward Map'          },
    { to: '/twin',     icon: '🏙️', label: 'Digital Twin'      },
    { to: '/forecast', icon: '📈', label: 'Forecast'           },
    { to: '/sources',  icon: '🔍', label: 'Source Detection'   },
    { to: '/alerts',   icon: '🔔', label: 'Alerts'             },
    { to: '/reports',  icon: '📄', label: 'All Reports'        }, // FIX: added for officer
    { to: '/advisory', icon: '❤️', label: 'Health Advisory'    },
  ],
  citizen: [
    { to: '/',          icon: '🌿', label: 'My AQI'           },
    { to: '/report',    icon: '📸', label: 'Report Pollution' },
    { to: '/myreports', icon: '📋', label: 'My Reports'       },
    { to: '/advisory',  icon: '❤️', label: 'Health Advisory'  },
  ],
};

const ROLE_COL: Record<string, string> = {
  admin: '#ef4444', officer: '#f59e0b', citizen: '#22c55e',
};
const ROLE_LBL: Record<string, string> = {
  admin: 'Administrator', officer: 'Field Officer', citizen: 'Citizen',
};

// ── Page Title resolver ─────────────────────────────────────────────────────
const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard', '/map': 'Ward Map', '/twin': 'Digital Twin 3D', '/forecast': 'AQI Forecast',
  '/sources': 'Source Detection', '/alerts': 'Alerts System', '/reports': 'Reports',
  '/advisory': 'Health Advisory', '/users': 'User Management',
  '/report': 'Report Pollution', '/myreports': 'My Reports',
};

export default function Layout() {
  const { user, logout }   = useAuth();
  const { connected, liveAlerts, newReports, lastUpdate } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const role     = user?.role || 'citizen';
  const navItems = NAV[role] || NAV.citizen;

  const { data: badgeData } = useQuery({
    queryKey: ['alertCount'],
    queryFn:  () => alertAPI.getCount().then(r => r.data.count).catch(() => 0),
    refetchInterval: 30000,
    enabled: role !== 'citizen',
  });

  const alertBadge  = (Number(badgeData) || 0) + liveAlerts.length;
  const reportBadge = newReports.length;
  const pageTitle   = ROUTE_TITLES[location.pathname] || 'Dashboard';

  // ── Design tokens ─────────────────────────────────────────────────────────
  const tokens = {
    sidebarBg:  'var(--bg-sidebar)',
    mainBg:     'transparent',
    topbarBg:   'var(--bg-topbar)',
    border:     'var(--border)',
    text:       'var(--text-primary)',
    muted:      'var(--text-muted)',
    accent:     'var(--accent)',
    activeNavBg:'var(--accent-soft)',
    navHoverBg: 'var(--card-hover)',
  };

  const navItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: collapsed ? '10px 0' : '9px 14px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    textDecoration: 'none', fontSize: 13, whiteSpace: 'nowrap',
    color: isActive ? tokens.accent : tokens.muted,
    background: isActive ? tokens.activeNavBg : 'transparent',
    borderLeft: `2px solid ${isActive ? tokens.accent : 'transparent'}`,
    borderRadius: collapsed ? 0 : '0 8px 8px 0',
    marginRight: collapsed ? 0 : 6,
    transition: 'all .15s ease',
    position: 'relative',
  });

  return (
    <div style={{
      display: 'flex', height: '100vh',
      background: tokens.mainBg, color: tokens.text, overflow: 'hidden',
    }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: collapsed ? 52 : 222, flexShrink: 0,
        background: tokens.sidebarBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: `1px solid ${tokens.border}`,
        display: 'flex', flexDirection: 'column',
        transition: 'width .22s cubic-bezier(.4,0,.2,1)', overflow: 'hidden',
        boxShadow: isDark ? '2px 0 12px rgba(0,0,0,.3)' : '2px 0 8px rgba(0,0,0,.04)',
      }}>

        {/* Brand */}
        <div style={{
          padding: '16px 14px', borderBottom: `1px solid ${tokens.border}`,
          display: 'flex', alignItems: 'center', gap: 10, minHeight: 60,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: isDark ? 'rgba(0,212,255,.12)' : 'rgba(14,165,233,.1)',
            border: `1.5px solid ${isDark ? 'rgba(0,212,255,.35)' : 'rgba(14,165,233,.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, boxShadow: isDark ? '0 0 12px rgba(0,212,255,.15)' : 'none',
          }}>🌿</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tokens.text, whiteSpace: 'nowrap', letterSpacing: '-.01em' }}>
                AQI Dashboard
              </div>
              <div style={{ fontSize: 10, color: tokens.muted, marginTop: 1 }}>
                Air Quality Intelligence
              </div>
            </div>
          )}
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div style={{
            margin: '10px 10px 4px', padding: '6px 10px', borderRadius: 8,
            background: `${ROLE_COL[role]}14`,
            border: `1px solid ${ROLE_COL[role]}28`,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: ROLE_COL[role], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: ROLE_COL[role], fontWeight: 600, letterSpacing: '.02em' }}>
              {ROLE_LBL[role]}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '6px 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map(item => {
            const badge =
              item.label === 'Alerts' && alertBadge > 0 ? alertBadge :
              (item.label === 'Analytics' || item.label === 'My Reports') && reportBadge > 0 ? reportBadge :
              0;
            return (
              <NavLink
                key={item.to} to={item.to} end={item.to === '/'}
                style={({ isActive }) => navItemStyle(isActive)}
                title={collapsed ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && <span style={{ flex: 1, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>}
                    {!collapsed && badge > 0 && (
                      <span style={{
                        background: item.label === 'Alerts' ? '#ef4444' : '#f59e0b',
                        color: '#fff', borderRadius: 20, fontSize: 10,
                        padding: '1px 6px', fontWeight: 700, minWidth: 18, textAlign: 'center',
                      }}>{badge > 99 ? '99+' : badge}</span>
                    )}
                    {/* collapsed badge dot */}
                    {collapsed && badge > 0 && (
                      <span style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 7, height: 7, borderRadius: '50%',
                        background: item.label === 'Alerts' ? '#ef4444' : '#f59e0b',
                      }} />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{
          padding: collapsed ? '10px 0' : '12px 12px',
          borderTop: `1px solid ${tokens.border}`,
        }}>
          {/* Live dot */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            justifyContent: collapsed ? 'center' : 'flex-start',
            marginBottom: collapsed ? 0 : 8,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: connected ? '#22c55e' : '#ef4444',
              boxShadow: connected ? '0 0 6px rgba(34,197,94,.6)' : 'none',
              transition: 'background .3s',
            }} />
            {!collapsed && (
              <span style={{ fontSize: 11, color: tokens.muted }}>
                {connected ? 'Live' : 'Offline'}
              </span>
            )}
          </div>

          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: `${ROLE_COL[role]}20`,
                border: `1px solid ${ROLE_COL[role]}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: ROLE_COL[role], fontWeight: 700,
              }}>
                {(user?.name || user?.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: tokens.text, fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{user?.name || 'User'}</div>
                <div style={{
                  fontSize: 10, color: tokens.muted,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{user?.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <button onClick={toggleTheme} title="Toggle theme" style={{
                  background: 'none', border: 'none', color: tokens.muted,
                  cursor: 'pointer', fontSize: 14, padding: '3px 4px', borderRadius: 5,
                  transition: 'color .15s',
                }}>{isDark ? '☀️' : '🌙'}</button>
                <button onClick={logout} title="Sign out" style={{
                  background: 'none', border: 'none', color: tokens.muted,
                  cursor: 'pointer', fontSize: 14, padding: '3px 4px', borderRadius: 5,
                  transition: 'color .15s',
                }}>⇥</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          height: 52, background: tokens.topbarBg,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${tokens.border}`,
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0,
          boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,.05)',
        }}>
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'none', border: `1px solid ${tokens.border}`,
              color: tokens.muted, cursor: 'pointer', fontSize: 14,
              padding: '5px 8px', borderRadius: 7, lineHeight: 1,
              transition: 'all .15s',
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <span style={{ fontSize: 11, color: tokens.muted }}>AQI</span>
            <span style={{ fontSize: 11, color: tokens.muted }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>{pageTitle}</span>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastUpdate && (
              <span style={{ fontSize: 11, color: tokens.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>🕐</span>
                {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {/* Live indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
              padding: '4px 10px', borderRadius: 20, fontWeight: 600, letterSpacing: '.03em',
              background: connected ? (isDark ? 'rgba(34,197,94,.1)' : 'rgba(22,163,74,.08)') : 'rgba(239,68,68,.08)',
              color: connected ? '#22c55e' : '#ef4444',
              border: `1px solid ${connected ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.2)'}`,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: 'currentColor',
                animation: connected ? 'breathe 2s ease-in-out infinite' : 'none',
              }} />
              {connected ? 'LIVE' : 'OFFLINE'}
            </div>

            {/* Role chip */}
            <div style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 700,
              letterSpacing: '.04em',
              background: `${ROLE_COL[role]}12`,
              color: ROLE_COL[role],
              border: `1px solid ${ROLE_COL[role]}25`,
            }}>
              {role.toUpperCase()}
            </div>

            {/* Date */}
            <div style={{ fontSize: 11, color: tokens.muted }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={{
          flex: 1, overflow: 'auto', padding: 16, background: tokens.mainBg,
          animation: 'fadeIn .25s ease both',
        }}>
          <Outlet />
        </main>
        {/* Floating AI Copilot */}
        {(role === 'admin' || role === 'officer') && <CopilotWidget />}
      </div>
    </div>
  );
}
