import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme:       Theme;
  toggleTheme: () => void;
  isDark:      boolean;
}

const ThemeContext = createContext<ThemeCtx>({ theme:'light', toggleTheme:()=>{}, isDark:false });
export const useTheme = () => useContext(ThemeContext);

// ── CSS variables injected into :root for both themes ────────────────────
const THEMES: Record<Theme, Record<string, string>> = {
  light: {
    '--bg-primary':     'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    '--bg-secondary':   '#ffffff',
    '--bg-card':        'rgba(255, 255, 255, 0.85)',
    '--bg-sidebar':     'rgba(241, 245, 249, 0.75)',
    '--bg-topbar':      'rgba(255, 255, 255, 0.8)',
    '--text-primary':   '#0f172a',
    '--text-secondary': '#475569',
    '--text-muted':     '#94a3b8',
    '--border':         'rgba(15, 23, 42, 0.08)',
    '--border-accent':  'rgba(14, 165, 233, 0.3)',
    '--accent':         '#0ea5e9',
    '--accent-soft':    'rgba(14, 165, 233, 0.1)',
    '--success':        '#10b981',
    '--danger':         '#ef4444',
    '--warning':        '#f59e0b',
    '--shadow':         '0 8px 32px rgba(15, 23, 42, 0.06)',
    '--card-hover':     'rgba(255, 255, 255, 0.95)',
  },
  dark: {
    '--bg-primary':     'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
    '--bg-secondary':   '#071020',
    '--bg-card':        'rgba(15, 23, 42, 0.65)',
    '--bg-sidebar':     'rgba(2, 6, 23, 0.75)',
    '--bg-topbar':      'rgba(2, 6, 23, 0.8)',
    '--text-primary':   '#f8fafc',
    '--text-secondary': '#cbd5e1',
    '--text-muted':     '#64748b',
    '--border':         'rgba(255, 255, 255, 0.1)',
    '--border-accent':  'rgba(56, 189, 248, 0.3)',
    '--accent':         '#38bdf8',
    '--accent-soft':    'rgba(56, 189, 248, 0.1)',
    '--success':        '#10b981',
    '--danger':         '#ef4444',
    '--warning':        '#f59e0b',
    '--shadow':         '0 8px 32px rgba(0, 0, 0, 0.4)',
    '--card-hover':     'rgba(30, 41, 59, 0.8)',
  },
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  Object.entries(THEMES[theme]).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute('data-theme', theme);
  document.body.style.background = THEMES[theme]['--bg-primary'];
  document.body.style.backgroundAttachment = 'fixed';
  document.body.style.color      = THEMES[theme]['--text-primary'];
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Default: LIGHT theme
    return (localStorage.getItem('aqi_theme') as Theme) || 'light';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('aqi_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}
