import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import App from './App.jsx'
import Dashboard from './pages/Dashboard.jsx'
import DocumentsPage from './pages/DocumentsPage.jsx'
import ComplianceQueryPage from './pages/ComplianceQueryPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import './index.css'

function OAuthCallback() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');
    if (token) {
      signIn(token);
      navigate('/dashboard', { replace: true });
    } else {
      navigate(`/auth?error=${error || 'OAuthFailed'}`, { replace: true });
    }
  }, [signIn, navigate, params]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px' }}>
      <div className="spinner spinner-lg" />
      <span style={{ color: 'var(--text-secondary)' }}>Completing sign-in…</span>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedRoute><App /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "documents", element: <DocumentsPage /> },
      { path: "query", element: <ComplianceQueryPage /> },
    ]
  },
  {
    path: "/auth",
    element: <AuthPage />
  },
  {
    path: "/auth/callback",
    element: <OAuthCallback />
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
)
