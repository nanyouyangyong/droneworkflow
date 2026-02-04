import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore, authApi } from '@/store/useAuthStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  describe('Store Actions', () => {
    it('should set auth state correctly', () => {
      const { result } = renderHook(() => useAuthStore());

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      act(() => {
        result.current.setAuth(mockUser, 'access-token', 'refresh-token');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.accessToken).toBe('access-token');
      expect(result.current.refreshToken).toBe('refresh-token');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should update tokens correctly', () => {
      const { result } = renderHook(() => useAuthStore());

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      act(() => {
        result.current.setAuth(mockUser, 'old-access', 'old-refresh');
      });

      act(() => {
        result.current.updateTokens('new-access', 'new-refresh');
      });

      expect(result.current.accessToken).toBe('new-access');
      expect(result.current.refreshToken).toBe('new-refresh');
      expect(result.current.user).toEqual(mockUser); // User should remain unchanged
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should logout correctly', () => {
      const { result } = renderHook(() => useAuthStore());

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      act(() => {
        result.current.setAuth(mockUser, 'access-token', 'refresh-token');
      });

      act(() => {
        result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist auth state to localStorage', () => {
      const { result } = renderHook(() => useAuthStore());

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      act(() => {
        result.current.setAuth(mockUser, 'access-token', 'refresh-token');
      });

      const stored = localStorage.getItem('auth-storage');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.user).toEqual(mockUser);
      expect(parsed.state.accessToken).toBe('access-token');
      expect(parsed.state.refreshToken).toBe('refresh-token');
      expect(parsed.state.isAuthenticated).toBe(true);
    });

    it('should clear localStorage on logout', () => {
      const { result } = renderHook(() => useAuthStore());

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      act(() => {
        result.current.setAuth(mockUser, 'access-token', 'refresh-token');
      });

      act(() => {
        result.current.logout();
      });

      const stored = localStorage.getItem('auth-storage');
      const parsed = JSON.parse(stored!);
      expect(parsed.state.user).toBeNull();
      expect(parsed.state.isAuthenticated).toBe(false);
    });
  });

  describe('authApi', () => {
    it('should login successfully with valid credentials', async () => {
      const result = await authApi.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.user.email).toBe('test@example.com');
      expect(result.data?.accessToken).toBe('mock-access-token');
      expect(result.data?.refreshToken).toBe('mock-refresh-token');
    });

    it('should fail login with invalid credentials', async () => {
      const result = await authApi.login({
        email: 'wrong@example.com',
        password: 'wrongpassword',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should register successfully', async () => {
      const result = await authApi.register({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.user.email).toBe('newuser@example.com');
      expect(result.data?.user.name).toBe('New User');
      expect(result.data?.accessToken).toBeDefined();
    });

    it('should refresh token successfully', async () => {
      const result = await authApi.refreshToken('mock-refresh-token');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.accessToken).toBe('new-mock-access-token');
      expect(result.data?.refreshToken).toBe('new-mock-refresh-token');
    });

    it('should fail to refresh with invalid token', async () => {
      const result = await authApi.refreshToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });

    it('should get user info with valid token', async () => {
      const result = await authApi.getMe('mock-access-token');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.email).toBe('test@example.com');
      expect(result.data?.name).toBe('Test User');
    });

    it('should fail to get user info with invalid token', async () => {
      const result = await authApi.getMe('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });
  });
});
