import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AuthGuard from '@/components/AuthGuard';
import { useAuthStore } from '@/store/useAuthStore';

// Mock useRouter
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    // Reset auth store
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    localStorage.clear();
    mockReplace.mockClear();

    // Mock persist hydration
    if (useAuthStore.persist) {
      useAuthStore.persist.hasHydrated = vi.fn(() => true);
      useAuthStore.persist.onFinishHydration = vi.fn(() => () => {});
    }
  });

  describe('When user is authenticated', () => {
    it('should render children when authenticated', async () => {
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
        },
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        isAuthenticated: true,
      });

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('should not redirect when authenticated', async () => {
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
        },
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        isAuthenticated: true,
      });

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('When user is not authenticated', () => {
    it('should show loading state initially', () => {
      // Mock that hydration is not complete
      if (useAuthStore.persist) {
        useAuthStore.persist.hasHydrated = vi.fn(() => false);
      }

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });

    it('should redirect to login when not authenticated', async () => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
    });

    it('should show redirect message when not authenticated', async () => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(screen.getByText('正在跳转到登录页...')).toBeInTheDocument();
      });
    });

    it('should not render children when not authenticated', async () => {
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Hydration handling', () => {
    it('should wait for hydration before checking auth', async () => {
      let hydrationCallback: (() => void) | null = null;

      if (useAuthStore.persist) {
        useAuthStore.persist.hasHydrated = vi.fn(() => false);
        useAuthStore.persist.onFinishHydration = vi.fn((callback) => {
          hydrationCallback = callback;
          return () => {};
        });
      }

      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
        },
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        isAuthenticated: true,
      });

      render(
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      );

      // Should show loading initially
      expect(screen.getByText('加载中...')).toBeInTheDocument();

      // Simulate hydration complete
      if (hydrationCallback) {
        hydrationCallback();
      }

      // Should now show content
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });
  });
});
