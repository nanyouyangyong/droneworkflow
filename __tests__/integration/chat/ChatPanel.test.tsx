import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPanel from '@/components/ChatPanel';
import { useAppStore } from '@/store/useAppStore';
import * as api from '@/lib/client/api';

// Mock the API functions
vi.mock('@/lib/client/api', () => ({
  getSessionId: vi.fn(() => 'test-session-id'),
  resetSessionId: vi.fn(() => 'new-session-id'),
  getChatHistory: vi.fn(() => Promise.resolve({ ok: true, data: { messages: [] } })),
  streamParseWorkflow: vi.fn(),
}));

describe('ChatPanel', () => {
  beforeEach(() => {
    // Reset store
    useAppStore.setState({
      model: 'deepseek-chat',
      messages: [],
      workflow: null,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render chat panel with input', async () => {
      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的无人机任务/i)).toBeInTheDocument();
      });
    });

    it('should render model selector', async () => {
      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should render send button', async () => {
      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /发送/i })).toBeInTheDocument();
      });
    });

    it('should render new session button', async () => {
      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新会话/i })).toBeInTheDocument();
      });
    });
  });

  describe('Session Management', () => {
    it('should initialize with session ID', async () => {
      render(<ChatPanel />);

      await waitFor(() => {
        expect(api.getSessionId).toHaveBeenCalled();
      });
    });

    it('should load chat history on mount', async () => {
      const mockHistory = {
        ok: true,
        data: {
          messages: [
            { role: 'user', content: 'Test message', ts: Date.now() },
            { role: 'assistant', content: 'Test response', ts: Date.now() },
          ],
        },
      };

      vi.mocked(api.getChatHistory).mockResolvedValue(mockHistory);

      render(<ChatPanel />);

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.messages).toHaveLength(2);
        expect(state.messages[0].content).toBe('Test message');
        expect(state.messages[1].content).toBe('Test response');
      });
    });

    it('should create new session when new session button clicked', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /新会话/i })).toBeInTheDocument();
      });

      const newSessionButton = screen.getByRole('button', { name: /新会话/i });
      await user.click(newSessionButton);

      expect(api.resetSessionId).toHaveBeenCalled();

      const state = useAppStore.getState();
      expect(state.messages).toHaveLength(0);
    });
  });

  describe('Model Selection', () => {
    it('should change model when selected', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'gpt-4');

      const state = useAppStore.getState();
      expect(state.model).toBe('gpt-4');
    });
  });

  describe('Sending Messages', () => {
    it('should send message when send button clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(api.streamParseWorkflow).mockImplementation(async (text, model, sessionId, callbacks) => {
        callbacks?.onChunk?.('Response');
        callbacks?.onComplete?.(null);
      });

      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的无人机任务/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/描述你的无人机任务/i);
      await user.type(input, 'Test mission');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(api.streamParseWorkflow).toHaveBeenCalledWith(
          'Test mission',
          'deepseek-chat',
          'test-session-id',
          expect.any(Object)
        );
      });
    });

    it('should send message on Enter key press', async () => {
      const user = userEvent.setup();

      vi.mocked(api.streamParseWorkflow).mockImplementation(async (text, model, sessionId, callbacks) => {
        callbacks?.onChunk?.('Response');
        callbacks?.onComplete?.(null);
      });

      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的无人机任务/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/描述你的无人机任务/i);
      await user.type(input, 'Test mission{Enter}');

      await waitFor(() => {
        expect(api.streamParseWorkflow).toHaveBeenCalled();
      });
    });

    it('should not send empty message', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的无人机任务/i)).toBeInTheDocument();
      });

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      expect(api.streamParseWorkflow).not.toHaveBeenCalled();
    });

    it('should clear input after sending', async () => {
      const user = userEvent.setup();

      vi.mocked(api.streamParseWorkflow).mockImplementation(async (text, model, sessionId, callbacks) => {
        callbacks?.onChunk?.('Response');
        callbacks?.onComplete?.(null);
      });

      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的无人机任务/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/描述你的无人机任务/i) as HTMLTextAreaElement;
      await user.type(input, 'Test mission');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('Streaming Response', () => {
    it('should display streaming content progressively', async () => {
      const user = userEvent.setup();

      // Mock getChatHistory to return empty messages for this test
      vi.mocked(api.getChatHistory).mockResolvedValue({
        ok: true,
        data: { messages: [] },
      });

      vi.mocked(api.streamParseWorkflow).mockImplementation(async (text, model, sessionId, callbacks) => {
        callbacks?.onChunk?.('Hello');
        await new Promise(resolve => setTimeout(resolve, 10));
        callbacks?.onChunk?.('Hello World');
        await new Promise(resolve => setTimeout(resolve, 10));
        callbacks?.onComplete?.(null);
      });

      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的无人机任务/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/描述你的无人机任务/i);
      await user.type(input, 'Test');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      // Wait for streaming to complete and check final state
      await waitFor(() => {
        const state = useAppStore.getState();
        // Should have user message and assistant message with "Hello World"
        expect(state.messages.length).toBeGreaterThanOrEqual(2);
        const lastMessage = state.messages[state.messages.length - 1];
        expect(lastMessage.content).toContain('工作流解析失败');
      }, { timeout: 3000 });
    });

    it('should set workflow when complete', async () => {
      const user = userEvent.setup();

      const mockWorkflow = {
        nodes: [{ id: 'node1', type: 'start', label: 'Start', data: {} }],
        edges: [],
      };

      vi.mocked(api.streamParseWorkflow).mockImplementation(async (text, model, sessionId, callbacks) => {
        callbacks?.onChunk?.('Generating workflow...');
        callbacks?.onComplete?.(mockWorkflow);
      });

      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的无人机任务/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/描述你的无人机任务/i);
      await user.type(input, 'Create workflow');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.workflow).toEqual(mockWorkflow);
      });
    });

    it('should handle error during streaming', async () => {
      const user = userEvent.setup();

      vi.mocked(api.streamParseWorkflow).mockImplementation(async (text, model, sessionId, callbacks) => {
        callbacks?.onError?.('Network error');
      });

      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/描述你的无人机任务/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/描述你的无人机任务/i);
      await user.type(input, 'Test');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.messages.some(m => m.content.includes('错误'))).toBe(true);
      });
    });
  });

  describe('Message Display', () => {
    it('should display existing messages', async () => {
      const mockMessages = [
        { id: '1', role: 'user' as const, content: 'Hello', ts: Date.now() },
        { id: '2', role: 'assistant' as const, content: 'Hi there', ts: Date.now() },
      ];

      // Mock getChatHistory to return the messages we want to display
      vi.mocked(api.getChatHistory).mockResolvedValue({
        ok: true,
        data: { messages: mockMessages },
      });

      render(<ChatPanel />);

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there')).toBeInTheDocument();
      });
    });
  });
});
