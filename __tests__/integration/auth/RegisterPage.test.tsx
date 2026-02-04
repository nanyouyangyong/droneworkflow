import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '@/app/register/page';
import { useAuthStore } from '@/store/useAuthStore';

describe('RegisterPage', () => {
  beforeEach(() => {
    // Reset auth store
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  describe('Form Rendering', () => {
    it('should render registration form with all fields', () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/姓名/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/邮箱/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^密码$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/确认密码/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^注 册$/i })).toBeInTheDocument();
    });

    it('should render logo and title', () => {
      render(<RegisterPage />);

      expect(screen.getByText('Drone Workflow')).toBeInTheDocument();
      expect(screen.getByText('创建账号')).toBeInTheDocument();
    });

    it('should render login link', () => {
      render(<RegisterPage />);

      expect(screen.getByText(/已有账号？/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /立即登录/i })).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error for empty name', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/请输入姓名/i)).toBeInTheDocument();
      });
    });

    it('should show error for name less than 2 characters', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/姓名/i);
      await user.type(nameInput, 'A');

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/姓名至少需要2个字符/i)).toBeInTheDocument();
      });
    });

    it('should show error for empty email', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/姓名/i);
      await user.type(nameInput, 'Test User');

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/请输入邮箱/i)).toBeInTheDocument();
      });
    });

    it('should show error for empty password', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/姓名/i);
      const emailInput = screen.getByLabelText(/邮箱/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/请输入密码/i)).toBeInTheDocument();
      });
    });

    it('should show error for password less than 6 characters', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/姓名/i);
      const emailInput = screen.getByLabelText(/邮箱/i);
      const passwordInput = screen.getByLabelText(/^密码$/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '12345');

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/密码至少需要6个字符/i)).toBeInTheDocument();
      });
    });

    it('should show error for empty confirm password', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/姓名/i);
      const emailInput = screen.getByLabelText(/邮箱/i);
      const passwordInput = screen.getByLabelText(/^密码$/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/请确认密码/i)).toBeInTheDocument();
      });
    });

    it('should show error for password mismatch', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/姓名/i);
      const emailInput = screen.getByLabelText(/邮箱/i);
      const passwordInput = screen.getByLabelText(/^密码$/i);
      const confirmPasswordInput = screen.getByLabelText(/确认密码/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password456');

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/两次输入的密码不一致/i)).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user types', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/请输入姓名/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/姓名/i);
      await user.type(nameInput, 'Test User');

      await waitFor(() => {
        expect(screen.queryByText(/请输入姓名/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const passwordInputs = screen.getAllByPlaceholderText(/输入密码/i);
      const passwordInput = passwordInputs[0] as HTMLInputElement;

      expect(passwordInput.type).toBe('password');

      // Find the first toggle button (for password field)
      const toggleButtons = screen.getAllByRole('button', { name: '' });
      await user.click(toggleButtons[0]);

      expect(passwordInput.type).toBe('text');

      await user.click(toggleButtons[0]);
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('Registration Flow', () => {
    it('should register successfully and auto-login', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/姓名/i);
      const emailInput = screen.getByLabelText(/邮箱/i);
      const passwordInput = screen.getByLabelText(/^密码$/i);
      const confirmPasswordInput = screen.getByLabelText(/确认密码/i);

      await user.type(nameInput, 'New User');
      await user.type(emailInput, 'newuser@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      const submitButton = screen.getByRole('button', { name: /^注 册$/i });
      await user.click(submitButton);

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.user?.email).toBe('newuser@example.com');
        expect(state.user?.name).toBe('New User');
        expect(state.accessToken).toBe('mock-access-token');
      });
    });

    it('should submit form on Enter key press', async () => {
      const user = userEvent.setup();
      render(<RegisterPage />);

      const nameInput = screen.getByLabelText(/姓名/i);
      const emailInput = screen.getByLabelText(/邮箱/i);
      const passwordInput = screen.getByLabelText(/^密码$/i);
      const confirmPasswordInput = screen.getByLabelText(/确认密码/i);

      await user.type(nameInput, 'New User');
      await user.type(emailInput, 'newuser@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
      });
    });
  });
});
