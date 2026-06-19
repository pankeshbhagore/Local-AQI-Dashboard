import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
// We need to fetch the copilot api. Since we haven't checked where copilotAPI is, I will define a quick fetch here or assume it's in api.ts
import { copilotAPI } from '../services/api';

export default function CopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; context?: any }[]>([
    { role: 'ai', text: 'Hello! I am Eco-Copilot. Ask me about current hotspots, report statistics, or request operational advice.' }
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userQuery = query;
    setMessages(prev => [...prev, { role: 'user', text: userQuery }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await copilotAPI.ask(userQuery);
      setMessages(prev => [...prev, { role: 'ai', text: res.data.response, context: res.data.contextUsed }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I am currently unavailable. Please check the backend connection.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        title="Ask AI Copilot"
        style={{
          position: 'fixed', bottom: 24, right: 24,
          width: 50, height: 50, borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
          color: '#fff', fontSize: 24, border: 'none',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, opacity 0.2s', zIndex: 1000,
          opacity: isOpen ? 0 : 1, pointerEvents: isOpen ? 'none' : 'auto'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        onClick={() => setIsOpen(true)}
      >
        ✨
      </button>

      {/* Chat Widget Container */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        width: 350, height: 500, borderRadius: 16,
        background: 'var(--bg-card)', border: `1px solid var(--border)`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', zIndex: 1001,
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Eco-Copilot</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>AI Operational Assistant</div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
              fontSize: 24, lineHeight: 1, padding: 0, opacity: 0.8,
            }}
          >×</button>
        </div>

        {/* Messages Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex', flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: 14,
                borderBottomRightRadius: msg.role === 'user' ? 2 : 14,
                borderBottomLeftRadius: msg.role === 'ai' ? 2 : 14,
                background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary)',
                color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px', alignSelf: 'flex-start' }}>
              <div style={{ background: '#8b5cf6', width: 6, height: 6, borderRadius: '50%', animation: 'breathe 1s infinite alternate' }} />
              <div style={{ background: '#8b5cf6', width: 6, height: 6, borderRadius: '50%', animation: 'breathe 1s infinite alternate 0.2s' }} />
              <div style={{ background: '#8b5cf6', width: 6, height: 6, borderRadius: '50%', animation: 'breathe 1s infinite alternate 0.4s' }} />
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} style={{ padding: '14px', borderTop: `1px solid var(--border)` }}>
          <div style={{ display: 'flex', gap: 8, background: 'var(--bg-secondary)', borderRadius: 20, padding: '4px 4px 4px 14px' }}>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask about hotspots..."
              style={{
                flex: 1, border: 'none', background: 'transparent', outline: 'none',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit'
              }}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: query.trim() ? 'var(--accent)' : 'var(--border)',
                color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: query.trim() ? 'pointer' : 'default', transition: 'background 0.2s'
              }}
            >
              ↑
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
