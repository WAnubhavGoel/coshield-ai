import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axiosConfig';

const IconShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconGrid = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const IconLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export default function Sidebar() {
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (error) {
      console.error("Logout failed", error);
    }
    localStorage.removeItem('coshield_token');
    setCurrentUser(null);
    navigate('/auth');
  };

  const initials = currentUser?.email
    ? currentUser.email.slice(0, 2).toUpperCase()
    : 'U';

  const roleLabel = {
    ADMIN: 'Administrator',
    COMPLIANCE_OFFICER: 'Compliance Officer',
    USER: 'User',
  }[currentUser?.role] || 'User';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <IconShield />
        </div>
        <div className="sidebar-logo-text">
          <span>CoShield AI</span>
          <span>Enterprise</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main</div>

        <NavLink
          to="/dashboard"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <IconGrid /> Dashboard
        </NavLink>

        <NavLink
          to="/documents"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <IconFile /> Documents
        </NavLink>

        <div className="sidebar-section-label">AI Tools</div>

        <NavLink
          to="/query"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <IconSearch /> Compliance Query
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{currentUser?.email?.split('@')[0] || 'User'}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">
            <IconLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}
