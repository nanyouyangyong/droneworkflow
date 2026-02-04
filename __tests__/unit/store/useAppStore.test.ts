import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      model: 'deepseek-chat',
      messages: [],
      history: [],
      workflow: null,
      activeMissionId: null,
      missionState: null,
    });
  });

  describe('Model Management', () => {
    it('should set model correctly', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setModel('gpt-4');
      });

      expect(result.current.model).toBe('gpt-4');
    });

    it('should have default model', () => {
      const { result } = renderHook(() => useAppStore());
      expect(result.current.model).toBe('deepseek-chat');
    });
  });

  describe('Message Management', () => {
    it('should add user message', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addMessage('user', 'Hello');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[0].content).toBe('Hello');
      expect(result.current.messages[0].id).toBeDefined();
      expect(result.current.messages[0].ts).toBeDefined();
    });

    it('should add assistant message', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addMessage('assistant', 'Hi there');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe('assistant');
      expect(result.current.messages[0].content).toBe('Hi there');
    });

    it('should add multiple messages in order', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addMessage('user', 'First');
        result.current.addMessage('assistant', 'Second');
        result.current.addMessage('user', 'Third');
      });

      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[0].content).toBe('First');
      expect(result.current.messages[1].content).toBe('Second');
      expect(result.current.messages[2].content).toBe('Third');
    });

    it('should update last message', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addMessage('assistant', 'Initial');
      });

      act(() => {
        result.current.updateLastMessage('Updated');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Updated');
    });

    it('should update last message progressively (streaming)', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addMessage('assistant', '');
      });

      act(() => {
        result.current.updateLastMessage('Hello');
      });

      act(() => {
        result.current.updateLastMessage('Hello World');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello World');
    });

    it('should not update when no messages exist', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.updateLastMessage('Should not add');
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('should set messages directly', () => {
      const { result } = renderHook(() => useAppStore());

      const newMessages = [
        { id: '1', role: 'user' as const, content: 'Test 1', ts: Date.now() },
        { id: '2', role: 'assistant' as const, content: 'Test 2', ts: Date.now() },
      ];

      act(() => {
        result.current.setMessages(newMessages);
      });

      expect(result.current.messages).toEqual(newMessages);
    });

    it('should clear all messages', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.addMessage('user', 'Message 1');
        result.current.addMessage('assistant', 'Message 2');
      });

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('Workflow Management', () => {
    it('should set workflow', () => {
      const { result } = renderHook(() => useAppStore());

      const mockWorkflow = {
        nodes: [{ id: 'node1', type: 'start', label: 'Start', data: {} }],
        edges: [],
      };

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      expect(result.current.workflow).toEqual(mockWorkflow);
    });

    it('should clear workflow by setting null', () => {
      const { result } = renderHook(() => useAppStore());

      const mockWorkflow = {
        nodes: [{ id: 'node1', type: 'start', label: 'Start', data: {} }],
        edges: [],
      };

      act(() => {
        result.current.setWorkflow(mockWorkflow);
      });

      expect(result.current.workflow).toEqual(mockWorkflow);

      act(() => {
        result.current.setWorkflow(null);
      });

      expect(result.current.workflow).toBeNull();
    });
  });

  describe('History Management', () => {
    it('should add new history item', () => {
      const { result } = renderHook(() => useAppStore());

      const historyItem = {
        id: 'hist1',
        ts: Date.now(),
        instruction: 'Test instruction',
        nodeCount: 5,
        status: 'completed' as const,
      };

      act(() => {
        result.current.upsertHistory(historyItem);
      });

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0]).toEqual(historyItem);
    });

    it('should add new items to the beginning', () => {
      const { result } = renderHook(() => useAppStore());

      const item1 = {
        id: 'hist1',
        ts: Date.now(),
        instruction: 'First',
        nodeCount: 3,
        status: 'completed' as const,
      };

      const item2 = {
        id: 'hist2',
        ts: Date.now() + 1000,
        instruction: 'Second',
        nodeCount: 4,
        status: 'running' as const,
      };

      act(() => {
        result.current.upsertHistory(item1);
        result.current.upsertHistory(item2);
      });

      expect(result.current.history).toHaveLength(2);
      expect(result.current.history[0].id).toBe('hist2'); // Most recent first
      expect(result.current.history[1].id).toBe('hist1');
    });

    it('should update existing history item', () => {
      const { result } = renderHook(() => useAppStore());

      const item = {
        id: 'hist1',
        ts: Date.now(),
        instruction: 'Test',
        nodeCount: 3,
        status: 'running' as const,
      };

      act(() => {
        result.current.upsertHistory(item);
      });

      const updatedItem = {
        ...item,
        status: 'completed' as const,
        missionId: 'mission123',
      };

      act(() => {
        result.current.upsertHistory(updatedItem);
      });

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].status).toBe('completed');
      expect(result.current.history[0].missionId).toBe('mission123');
    });
  });

  describe('Mission State Management', () => {
    it('should set active mission ID', () => {
      const { result } = renderHook(() => useAppStore());

      act(() => {
        result.current.setActiveMissionId('mission123');
      });

      expect(result.current.activeMissionId).toBe('mission123');
    });

    it('should set mission state', () => {
      const { result } = renderHook(() => useAppStore());

      const missionState = {
        id: 'mission123',
        status: 'running' as const,
        logs: [],
        startTime: Date.now(),
      };

      act(() => {
        result.current.setMissionState(missionState);
      });

      expect(result.current.missionState).toEqual(missionState);
    });

    it('should append logs to mission state', () => {
      const { result } = renderHook(() => useAppStore());

      const missionState = {
        id: 'mission123',
        status: 'running' as const,
        logs: [{ level: 'info' as const, message: 'Initial log', ts: Date.now() }],
        startTime: Date.now(),
      };

      act(() => {
        result.current.setMissionState(missionState);
      });

      const newLogs = [
        { level: 'info' as const, message: 'New log 1', ts: Date.now() },
        { level: 'info' as const, message: 'New log 2', ts: Date.now() },
      ];

      act(() => {
        result.current.appendLogs(newLogs);
      });

      expect(result.current.missionState?.logs).toHaveLength(3);
      expect(result.current.missionState?.logs[1].message).toBe('New log 1');
      expect(result.current.missionState?.logs[2].message).toBe('New log 2');
    });

    it('should not append logs when no mission state exists', () => {
      const { result } = renderHook(() => useAppStore());

      const newLogs = [
        { level: 'info' as const, message: 'Log', ts: Date.now() },
      ];

      act(() => {
        result.current.appendLogs(newLogs);
      });

      expect(result.current.missionState).toBeNull();
    });
  });
});
