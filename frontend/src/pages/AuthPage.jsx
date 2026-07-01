import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import axios from "../api/axiosConfig";

const IconShield = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2.2"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function AuthPage() {
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", tenantName: "" });
  const [errors, setErrors] = useState({});

  if (currentUser) return <Navigate to="/dashboard" replace />;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name])
      setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!form.email) errs.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      errs.email = "Enter a valid email";
    if (!form.password) errs.password = "Password is required";
    if (tab === "register") {
      if (form.password.length < 8)
        errs.password = "Password must be at least 8 characters";
      if (!form.tenantName) errs.tenantName = "Organization name is required";
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      let response;
      if (tab === "login") {
        response = await axios.post("/auth/login", {
          email: form.email,
          password: form.password,
        });
      } else {
        response = await axios.post("/auth/register", {
          email: form.email,
          password: form.password,
          tenantName: form.tenantName,
        });
      }
      const data = response.data;
      localStorage.setItem("coshield_token", data.token);
      setCurrentUser(data.user);
      toast(`Welcome back, ${data.user.email.split("@")[0]}!`, "success");
      navigate("/dashboard");
    } catch (err) {
      const msg =
        err.response?.data?.error || err.message || "Authentication failed";
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/auth/google`;
  };

  return (
    <div className="auth-page">
      {/* Left — Hero */}
      <div className="auth-hero">
        <div className="auth-hero-bg">
          <div className="auth-hero-orb auth-hero-orb-1" />
          <div className="auth-hero-orb auth-hero-orb-2" />
          <div className="auth-hero-grid" />
        </div>

        <div className="auth-hero-content">
          <div className="auth-hero-badge">
            <IconCheck /> Enterprise Security Platform
          </div>

          <h2>
            AI-Powered
            <br />
            <span>Compliance</span>
            <br />
            Intelligence
          </h2>

          <p>
            Query your entire policy library instantly. CoShield AI synthesizes
            answers from your documents with source citations, powered by hybrid
            semantic search and GPT‑4.
          </p>

          <div className="auth-hero-features">
            {[
              "Hybrid RAG — vector + keyword search fused with RRF",
              "RBAC-enforced document access by role & department",
              "Tenant-isolated multi-organization architecture",
              "Redis-cached responses for instant repeat queries",
            ].map((f, i) => (
              <div className="auth-feature" key={i}>
                <div className="auth-feature-icon">
                  <IconCheck />
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="auth-form-panel">
        <div className="auth-form-box">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <IconShield />
            </div>
            <span className="auth-logo-text">CoShield AI</span>
          </div>

          <div className="auth-tabs">
            <button
              id="tab-login"
              className={`auth-tab ${tab === "login" ? "active" : ""}`}
              onClick={() => {
                setTab("login");
                setErrors({});
              }}
            >
              Sign In
            </button>
            <button
              id="tab-register"
              className={`auth-tab ${tab === "register" ? "active" : ""}`}
              onClick={() => {
                setTab("register");
                setErrors({});
              }}
            >
              Register
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div>
              <p className="auth-form-title">
                {tab === "login" ? "Welcome back" : "Create account"}
              </p>
              <p className="auth-form-sub">
                {tab === "login"
                  ? "Sign in to your CoShield workspace"
                  : "Get started with your organization"}
              </p>
            </div>

            {tab === "register" && (
              <div className="field">
                <label htmlFor="tenantName">Organization Name</label>
                <input
                  id="tenantName"
                  name="tenantName"
                  type="text"
                  placeholder="Acme Corp"
                  value={form.tenantName}
                  onChange={handleChange}
                  autoComplete="organization"
                />
                {errors.tenantName && (
                  <span className="field-error">⚠ {errors.tenantName}</span>
                )}
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && (
                <span className="field-error">⚠ {errors.email}</span>
              )}
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder={
                  tab === "register"
                    ? "Min 8 chars, 1 uppercase, 1 number"
                    : "••••••••"
                }
                value={form.password}
                onChange={handleChange}
                autoComplete={
                  tab === "login" ? "current-password" : "new-password"
                }
              />
              {errors.password && (
                <span className="field-error">⚠ {errors.password}</span>
              )}
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" />{" "}
                  {tab === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : tab === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>

            <div className="auth-divider">or continue with</div>

            <button
              type="button"
              className="google-btn"
              onClick={handleGoogleLogin}
              id="google-auth-btn"
            >
              <GoogleLogo />
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
