import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ACTIVITY = [
  { type: 'success', title: 'Document "ISO 27001 Policy" fully ingested',   time: '2 min ago' },
  { type: 'info',    title: 'Compliance query answered for john@acme.com',   time: '18 min ago' },
  { type: 'warning', title: '"GDPR Addendum v3.pdf" parsing in progress',    time: '35 min ago' },
  { type: 'success', title: 'New user sarah@acme.com registered',            time: '1 hr ago' },
  { type: 'info',    title: 'Cache hit — 12 queries served from Redis',      time: '3 hrs ago' },
];

const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const IconBolt = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconUpload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
  </svg>
);

const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const firstName = currentUser?.email?.split('@')[0] || 'there';

  const stats = [
    { label: 'Documents Ingested', value: '24',   change: '+3 this week',  up: true,  color: 'cyan',   icon: <IconFile />,   iconColor: 'cyan' },
    { label: 'Queries Answered',   value: '187',  change: '+12 today',     up: true,  color: 'indigo', icon: <IconSearch />, iconColor: 'indigo' },
    { label: 'Team Members',       value: '8',    change: '+1 this month', up: true,  color: 'green',  icon: <IconUsers />,  iconColor: 'green' },
    { label: 'Avg. Response Time', value: '1.2s', change: '-0.3s vs last', up: true,  color: 'amber',  icon: <IconClock />,  iconColor: 'amber' },
  ];

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <h1>Dashboard</h1>
          <p>Welcome back, {firstName} 👋</p>
        </div>
        <div className="topbar-right">
          <span className="badge badge-success">● System Operational</span>
        </div>
      </header>

      <div className="page-content page-enter">
        {/* Stats */}
        <div className="stats-grid">
          {stats.map((s) => (
            <div key={s.label} className={`stat-card stat-${s.color}`}>
              <div className="stat-header">
                <div className={`stat-icon ${s.iconColor}`}>{s.icon}</div>
                <span className={`stat-change ${s.up ? 'up' : 'down'}`}>{s.change}</span>
              </div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Content Grid */}
        <div className="dashboard-grid">
          {/* Recent Activity */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Recent Activity</div>
                <div className="section-sub">Live audit trail</div>
              </div>
              <span className="badge badge-info">Live</span>
            </div>
            <div className="activity-list">
              {ACTIVITY.map((a, i) => (
                <div className="activity-item" key={i}>
                  <div className={`activity-dot ${a.type}`} />
                  <div className="activity-text">
                    <div className="activity-title">{a.title}</div>
                    <div className="activity-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="section-title">Quick Actions</div>
                <div className="section-sub">Jump to common tasks</div>
              </div>
            </div>
            <div className="quick-actions">
              {[
                { icon: <IconUpload />, title: 'Upload Document', desc: 'Add a new compliance PDF', to: '/documents' },
                { icon: <IconSearch />, title: 'Query AI',        desc: 'Ask a compliance question', to: '/query' },
                { icon: <IconFile />,   title: 'View Documents',  desc: 'Browse all ingested files', to: '/documents' },
                { icon: <IconShield />, title: 'Compliance Hub',  desc: 'Check policy coverage',    to: '/query' },
              ].map((action) => (
                <div
                  key={action.title}
                  className="quick-action-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(action.to)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(action.to)}
                >
                  <div className="quick-action-icon">{action.icon}</div>
                  <div className="quick-action-title">{action.title}</div>
                  <div className="quick-action-desc">{action.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <IconBolt />
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)' }}>RAG Engine Status</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { label: 'Vector Store',    status: 'Operational' },
                  { label: 'Redis Cache',     status: 'Operational' },
                  { label: 'OpenAI GPT-4o',   status: 'Operational' },
                  { label: 'Worker Queue',    status: 'Operational' },
                ].map(({ label, status }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
                    <span className="badge badge-success" style={{ fontSize: '10px' }}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
