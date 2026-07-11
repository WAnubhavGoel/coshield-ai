import { useState, useRef, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axiosConfig';

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconBot = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
    <line x1="12" y1="3" x2="12" y2="1"/>
    <circle cx="9" cy="15" r="1" fill="currentColor"/>
    <circle cx="15" cy="15" r="1" fill="currentColor"/>
  </svg>
);

const IconDoc = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const EXAMPLE_QUERIES = [
  'What is our data retention policy for production logs?',
  'What are the password complexity requirements?',
  'How should security incidents be escalated?',
  'What is the policy for third-party vendor access?',
];

function CitationsPanel({ citations, sourceDocuments }) {
  const all = citations?.length ? citations : [];
  const hasSources = sourceDocuments?.length > 0;

  if (!all.length && !hasSources) {
    return (
      <div className="citations-panel">
        <div className="citations-header">
          <h3>Source Citations</h3>
          <p>Evidence from your documents</p>
        </div>
        <div className="citations-empty">
          <IconDoc />
          <p>Citations will appear here after an AI query</p>
        </div>
      </div>
    );
  }

  return (
    <div className="citations-panel">
      <div className="citations-header">
        <h3>Source Citations</h3>
        <p>{all.length} citation{all.length !== 1 ? 's' : ''} found</p>
      </div>
      <div className="citations-list">
        {all.map((c, i) => (
          <div className="citation-card" key={i}>
            <div className="citation-doc">
              <IconDoc /> {c.document_title}
            </div>
            <div className="citation-page">Page {c.page_number}</div>
            {c.snippet && (
              <div className="citation-snippet">"{c.snippet}"</div>
            )}
          </div>
        ))}
        {hasSources && (
          <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              All Matched Chunks
            </div>
            {sourceDocuments.map((s, i) => (
              <div className="citation-card" key={i} style={{ marginBottom: '8px' }}>
                <div className="citation-doc"><IconDoc /> {s.document_title}</div>
                <div className="citation-page">Page {s.page_number}</div>
                <div className="citation-snippet">{s.content_snippet}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComplianceQueryPage() {
  const toast = useToast();
  const { currentUser } = useAuth();

  const storageKey = currentUser ? `coshield_chat_history_${currentUser.id}` : 'coshield_chat_history_guest';
  const citationsKey = currentUser ? `coshield_chat_citations_${currentUser.id}` : 'coshield_chat_citations_guest';
  const sourcesKey = currentUser ? `coshield_chat_sources_${currentUser.id}` : 'coshield_chat_sources_guest';

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastCitations, setLastCitations] = useState(() => {
    try {
      const saved = localStorage.getItem(citationsKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [lastSources, setLastSources] = useState(() => {
    try {
      const saved = localStorage.getItem(sourcesKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const chatRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    localStorage.setItem(citationsKey, JSON.stringify(lastCitations));
  }, [lastCitations, citationsKey]);

  useEffect(() => {
    localStorage.setItem(sourcesKey, JSON.stringify(lastSources));
  }, [lastSources, sourcesKey]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const response = await axios.post('/compliance/query', { question });
      const data = response.data;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer,
        cached: data.cached,
      }]);
      setLastCitations(data.citations || []);
      setLastSources(data.source_documents || []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Query failed';
      toast(msg, 'error');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠ An error occurred while processing your query. Please ensure you have documents uploaded and try again.',
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <h1>Compliance Query</h1>
          <p>Ask questions about your security policies and compliance documents</p>
        </div>
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="badge badge-info">Gemini 2.5 Flash · Hybrid RAG</span>
          {messages.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '4px 10px', fontSize: '12px' }}
              onClick={() => {
                if (window.confirm("Clear all chat messages and citations?")) {
                  setMessages([]);
                  setLastCitations([]);
                  setLastSources([]);
                }
              }}
            >
              Clear Chat
            </button>
          )}
        </div>
      </header>

      <div className="page-content page-enter" style={{ height: 'calc(100vh - var(--topbar-h) - 64px)', display: 'flex', flexDirection: 'column' }}>
        <div className="query-layout" style={{ flex: 1 }}>
          {}
          <div className="query-panel">
            <div className="query-panel-header">
              <div style={{
                width: 36, height: 36,
                background: 'var(--primary-grad)',
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', flexShrink: 0,
                boxShadow: 'var(--shadow-primary)'
              }}>
                <IconBot />
              </div>
              <div>
                <h2>CoShield AI</h2>
                <p>Enterprise Compliance Assistant</p>
              </div>
            </div>

            <div className="chat-area" ref={chatRef}>
              {messages.length === 0 && !loading ? (
                <div className="chat-empty">
                  <div className="chat-empty-icon"><IconBot /></div>
                  <h3>Ask your compliance assistant</h3>
                  <p>Query your entire policy library in natural language. Answers are sourced from your ingested documents.</p>
                  <div className="example-queries">
                    {EXAMPLE_QUERIES.map((q) => (
                      <button
                        key={q}
                        className="example-query-btn"
                        onClick={() => sendMessage(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className={`chat-message ${msg.role}`}>
                      <div className="chat-sender">
                        {msg.role === 'user' ? 'You' : 'CoShield AI'}
                        {msg.cached && (
                          <span className="cached-pill">⚡ Cached</span>
                        )}
                      </div>
                      <div className={`chat-bubble ${msg.error ? 'error-bubble' : ''}`}
                        style={msg.error ? { borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' } : {}}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="chat-message assistant">
                      <div className="chat-sender">CoShield AI</div>
                      <div className="chat-bubble" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="spinner" />
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                          Searching documents and synthesizing answer…
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="chat-input-area">
              <div className="chat-input-row">
                <textarea
                  ref={textareaRef}
                  id="compliance-query-input"
                  className="chat-textarea"
                  placeholder="Ask a compliance question… (Shift+Enter for new line)"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(e); }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={loading}
                />
                <button
                  id="send-query-btn"
                  className="send-btn"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  title="Send query"
                  type="button"
                >
                  {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <IconSend />}
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Answers are synthesized from your ingested policy documents and may include cached results (⚡).
              </p>
            </div>
          </div>

          {}
          <CitationsPanel citations={lastCitations} sourceDocuments={lastSources} />
        </div>
      </div>
    </>
  );
}
