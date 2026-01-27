"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        }),

      updateTokens: (accessToken, refreshToken) =>
        set({
          accessToken,
          refreshToken,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ============================================================================
// Auth API Client
// ============================================================================

interface LoginParams {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterParams {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  success: boolean;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  error?: string;
}

export const authApi = {
  async login(params: LoginParams): Promise<AuthResponse> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async register(params: RegisterParams): Promise<AuthResponse> {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    return res.json();
  },

  async getMe(accessToken: string): Promise<{ success: boolean; data?: User; error?: string }> {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  },
};

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * 创建带认证的 fetch 函数
 */
export function createAuthFetch() {
  return async (url: string, options: RequestInit = {}) => {
    const { accessToken, refreshToken, updateTokens, logout } = useAuthStore.getState();

    if (!accessToken) {
      throw new Error("未登录");
    }

    // 添加认证头
    const authOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    };

    let res = await fetch(url, authOptions);

    // 如果 401，尝试刷新 token
    if (res.status === 401 && refreshToken) {
      const refreshRes = await authApi.refreshToken(refreshToken);

      if (refreshRes.success && refreshRes.data) {
        updateTokens(refreshRes.data.accessToken, refreshRes.data.refreshToken);

        // 使用新 token 重试请求
        authOptions.headers = {
          ...options.headers,
          Authorization: `Bearer ${refreshRes.data.accessToken}`,
        };
        res = await fetch(url, authOptions);
      } else {
        // 刷新失败，登出
        logout();
        throw new Error("登录已过期，请重新登录");
      }
    }

    return res;
  };
}
