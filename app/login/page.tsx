"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, authApi } from "@/store/useAuthStore";

// ============================================================================
// Types
// ============================================================================

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
}

// ============================================================================
// Icons (inline SVG)
// ============================================================================

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();

  const [form, setForm] = useState<FormData>({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  // 如果已登录，重定向到首页
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.email) {
      newErrors.email = "请输入邮箱";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "请输入有效的邮箱地址";
    }

    if (!form.password) {
      newErrors.password = "请输入密码";
    } else if (form.password.length < 6) {
      newErrors.password = "密码至少需要6个字符";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await authApi.login({
        email: form.email,
        password: form.password,
        rememberMe: form.rememberMe,
      });

      if (res.success && res.data) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push("/");
      } else {
        setErrorMessage(res.error || "登录失败，请检查您的凭证");
      }
    } catch (error) {
      setErrorMessage("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (errorMessage) setErrorMessage("");
  };

  return (
    <div className="login-container">
      {/* 装饰背景 */}
      <div className="login-bg">
        <div className="login-bg-gradient" />
      </div>

      {/* 登录卡片 */}
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#2563EB" />
              <path
                d="M12 20L18 14L24 20L18 26L12 20Z"
                fill="white"
                opacity="0.9"
              />
              <path
                d="M18 14L24 20L30 14L24 8L18 14Z"
                fill="white"
                opacity="0.7"
              />
              <path
                d="M18 26L24 20L30 26L24 32L18 26Z"
                fill="white"
                opacity="0.5"
              />
            </svg>
          </div>
          <span className="logo-text">Drone Workflow</span>
        </div>

        {/* 标题 */}
        <div className="login-header">
          <h1 className="login-title">欢迎回来</h1>
          <p className="login-subtitle">请登录以继续访问</p>
        </div>

        {/* 错误提示 */}
        {errorMessage && (
          <div className="login-error">
            {errorMessage}
          </div>
        )}

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="login-form">
          {/* 邮箱输入 */}
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              邮箱地址
            </label>
            <div className={`input-wrapper ${errors.email ? "input-error" : ""}`}>
              <MailIcon className="input-icon" />
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="your@email.com"
                value={form.email}
                onChange={handleChange("email")}
                autoComplete="email"
              />
            </div>
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          {/* 密码输入 */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              密码
            </label>
            <div className={`input-wrapper ${errors.password ? "input-error" : ""}`}>
              <LockIcon className="input-icon" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="输入密码"
                value={form.password}
                onChange={handleChange("password")}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>

          {/* 记住我 & 忘记密码 */}
          <div className="form-options">
            <label className="checkbox-wrapper">
              <input
                type="checkbox"
                className="checkbox"
                checked={form.rememberMe}
                onChange={handleChange("rememberMe")}
              />
              <span className="checkbox-label">记住我</span>
            </label>
            <a href="#" className="forgot-link">
              忘记密码？
            </a>
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? <LoaderIcon /> : "登 录"}
          </button>
        </form>

        {/* 分隔线 */}
        <div className="divider">
          <span className="divider-text">或</span>
        </div>

        {/* 社交登录 */}
        <div className="social-login">
          <button className="social-button" title="Google 登录">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </button>
          <button className="social-button" title="GitHub 登录">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </button>
        </div>

        {/* 注册入口 */}
        <p className="register-link">
          还没有账号？
          <a href="/register">立即注册</a>
        </p>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          background: #fafafa;
        }

        .login-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 0;
        }

        .login-bg-gradient {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at 30% 20%, rgba(37, 99, 235, 0.08) 0%, transparent 50%),
                      radial-gradient(circle at 70% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background: #ffffff;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 1;
        }

        .login-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .logo-text {
          font-size: 20px;
          font-weight: 600;
          color: #111827;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-title {
          font-size: 24px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 8px;
        }

        .login-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }

        .login-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 24px;
          animation: shake 0.3s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
        }

        .input-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          height: 48px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          transition: all 0.2s ease;
        }

        .input-wrapper:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .input-wrapper.input-error {
          border-color: #dc2626;
        }

        .input-wrapper.input-error:focus-within {
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
        }

        .input-icon {
          color: #9ca3af;
          flex-shrink: 0;
        }

        .form-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 15px;
          color: #111827;
          outline: none;
        }

        .form-input::placeholder {
          color: #9ca3af;
        }

        .password-toggle {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .password-toggle:hover {
          color: #6b7280;
        }

        .error-text {
          font-size: 12px;
          color: #dc2626;
        }

        .form-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .checkbox-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox {
          width: 16px;
          height: 16px;
          accent-color: #2563eb;
          cursor: pointer;
        }

        .checkbox-label {
          font-size: 14px;
          color: #6b7280;
        }

        .forgot-link {
          font-size: 14px;
          color: #2563eb;
          text-decoration: none;
          transition: color 0.2s;
        }

        .forgot-link:hover {
          color: #1d4ed8;
        }

        .login-button {
          height: 48px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .login-button:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .login-button:active:not(:disabled) {
          transform: scale(0.98);
        }

        .login-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }

        .divider-text {
          padding: 0 16px;
          font-size: 13px;
          color: #9ca3af;
        }

        .social-login {
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        .social-button {
          width: 48px;
          height: 48px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .social-button:hover {
          border-color: #d1d5db;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .register-link {
          text-align: center;
          margin-top: 24px;
          font-size: 14px;
          color: #6b7280;
        }

        .register-link a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
        }

        .register-link a:hover {
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 32px 24px;
          }
        }
      `}</style>
    </div>
  );
}
