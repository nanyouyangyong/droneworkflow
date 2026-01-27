"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, authApi } from "@/store/useAuthStore";

// ============================================================================
// Types
// ============================================================================

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// ============================================================================
// Icons
// ============================================================================

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

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

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();

  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name) {
      newErrors.name = "请输入姓名";
    } else if (form.name.length < 2) {
      newErrors.name = "姓名至少需要2个字符";
    }

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

    if (!form.confirmPassword) {
      newErrors.confirmPassword = "请确认密码";
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = "两次输入的密码不一致";
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
      const res = await authApi.register({
        name: form.name,
        email: form.email,
        password: form.password,
      });

      if (res.success && res.data) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        router.push("/");
      } else {
        setErrorMessage(res.error || "注册失败，请稍后重试");
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
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (errorMessage) setErrorMessage("");
  };

  return (
    <div className="register-container">
      <div className="register-bg">
        <div className="register-bg-gradient" />
      </div>

      <div className="register-card">
        <div className="register-logo">
          <div className="logo-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#2563EB" />
              <path d="M12 20L18 14L24 20L18 26L12 20Z" fill="white" opacity="0.9" />
              <path d="M18 14L24 20L30 14L24 8L18 14Z" fill="white" opacity="0.7" />
              <path d="M18 26L24 20L30 26L24 32L18 26Z" fill="white" opacity="0.5" />
            </svg>
          </div>
          <span className="logo-text">Drone Workflow</span>
        </div>

        <div className="register-header">
          <h1 className="register-title">创建账号</h1>
          <p className="register-subtitle">注册以开始使用工作流系统</p>
        </div>

        {errorMessage && <div className="register-error">{errorMessage}</div>}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label className="form-label" htmlFor="name">姓名</label>
            <div className={`input-wrapper ${errors.name ? "input-error" : ""}`}>
              <UserIcon className="input-icon" />
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="您的姓名"
                value={form.name}
                onChange={handleChange("name")}
                autoComplete="name"
              />
            </div>
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">邮箱地址</label>
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

          <div className="form-group">
            <label className="form-label" htmlFor="password">密码</label>
            <div className={`input-wrapper ${errors.password ? "input-error" : ""}`}>
              <LockIcon className="input-icon" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="至少6个字符"
                value={form.password}
                onChange={handleChange("password")}
                autoComplete="new-password"
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

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">确认密码</label>
            <div className={`input-wrapper ${errors.confirmPassword ? "input-error" : ""}`}>
              <LockIcon className="input-icon" />
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="再次输入密码"
                value={form.confirmPassword}
                onChange={handleChange("confirmPassword")}
                autoComplete="new-password"
              />
            </div>
            {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
          </div>

          <button type="submit" className="register-button" disabled={loading}>
            {loading ? <LoaderIcon /> : "注 册"}
          </button>
        </form>

        <p className="login-link">
          已有账号？<a href="/login">立即登录</a>
        </p>
      </div>

      <style jsx>{`
        .register-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          background: #fafafa;
        }
        .register-bg { position: absolute; inset: 0; overflow: hidden; z-index: 0; }
        .register-bg-gradient {
          position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle at 30% 20%, rgba(37, 99, 235, 0.08) 0%, transparent 50%),
                      radial-gradient(circle at 70% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%);
        }
        .register-card {
          width: 100%; max-width: 400px; background: #ffffff; border-radius: 16px;
          padding: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); position: relative; z-index: 1;
        }
        .register-logo { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 24px; }
        .logo-text { font-size: 20px; font-weight: 600; color: #111827; }
        .register-header { text-align: center; margin-bottom: 32px; }
        .register-title { font-size: 24px; font-weight: 600; color: #111827; margin: 0 0 8px; }
        .register-subtitle { font-size: 14px; color: #6b7280; margin: 0; }
        .register-error {
          background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
          padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 24px;
        }
        .register-form { display: flex; flex-direction: column; gap: 20px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-label { font-size: 14px; font-weight: 500; color: #111827; }
        .input-wrapper {
          display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 48px;
          background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; transition: all 0.2s ease;
        }
        .input-wrapper:focus-within { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
        .input-wrapper.input-error { border-color: #dc2626; }
        .input-icon { color: #9ca3af; flex-shrink: 0; }
        .form-input { flex: 1; border: none; background: transparent; font-size: 15px; color: #111827; outline: none; }
        .form-input::placeholder { color: #9ca3af; }
        .password-toggle {
          background: none; border: none; padding: 4px; cursor: pointer; color: #9ca3af;
          display: flex; align-items: center; justify-content: center; transition: color 0.2s;
        }
        .password-toggle:hover { color: #6b7280; }
        .error-text { font-size: 12px; color: #dc2626; }
        .register-button {
          height: 48px; background: #2563eb; color: white; border: none; border-radius: 10px;
          font-size: 15px; font-weight: 500; cursor: pointer; display: flex; align-items: center;
          justify-content: center; transition: all 0.2s ease;
        }
        .register-button:hover:not(:disabled) { background: #1d4ed8; }
        .register-button:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-link { text-align: center; margin-top: 24px; font-size: 14px; color: #6b7280; }
        .login-link a { color: #2563eb; text-decoration: none; font-weight: 500; }
        .login-link a:hover { text-decoration: underline; }
        @media (max-width: 480px) { .register-card { padding: 32px 24px; } }
      `}</style>
    </div>
  );
}
