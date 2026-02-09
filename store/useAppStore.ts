"use client";

import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { LogEvent, MissionState, ParsedWorkflow } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

type HistoryItem = {
  id: string;
  ts: number;
  instruction: string;
  nodeCount: number;
  status: MissionState["status"];
  missionId?: string;
};

type AppState = {
  model: string;
  setModel: (model: string) => void;

  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (role: ChatMessage["role"], content: string) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;

  history: HistoryItem[];
  upsertHistory: (item: HistoryItem) => void;

  workflow: ParsedWorkflow | null;
  setWorkflow: (wf: ParsedWorkflow | null) => void;

  activeMissionId: string | null;
  setActiveMissionId: (id: string | null) => void;

  missionState: MissionState | null;
  setMissionState: (state: MissionState | null) => void;

  appendLogs: (logs: LogEvent[]) => void;

  // 按 droneId 分组的子任务日志
  subMissionLogs: Record<string, LogEvent[]>;
  appendSubMissionLog: (droneId: string, log: LogEvent) => void;
  clearSubMissionLogs: () => void;

  // 画布节点执行状态
  executedNodes: Set<string>;
  failedNodes: Set<string>;
  currentNode: string | null;
  markNodeExecuted: (nodeId: string) => void;
  markNodeFailed: (nodeId: string) => void;
  setCurrentNode: (nodeId: string | null) => void;
  resetExecutionState: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  model: "deepseek-chat",
  setModel: (model) => set({ model }),

  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (role, content) =>
    set((s) => ({
      messages: [...s.messages, { id: uuidv4(), role, content, ts: Date.now() }]
    })),
  updateLastMessage: (content) =>
    set((s) => {
      if (s.messages.length === 0) return s;
      const updated = [...s.messages];
      updated[updated.length - 1] = { ...updated[updated.length - 1], content };
      return { messages: updated };
    }),
  clearMessages: () => set({ messages: [] }),

  history: [],
  upsertHistory: (item) =>
    set((s) => {
      const idx = s.history.findIndex((h) => h.id === item.id);
      if (idx >= 0) {
        const next = [...s.history];
        next[idx] = item;
        return { history: next };
      }
      return { history: [item, ...s.history] };
    }),

  workflow: null,
  setWorkflow: (wf) => set({ workflow: wf }),

  activeMissionId: null,
  setActiveMissionId: (id) => set({ activeMissionId: id }),

  missionState: null,
  setMissionState: (state) => set({ missionState: state }),

  appendLogs: (logs) => {
    const cur = get().missionState;
    if (!cur) return;
    set({ missionState: { ...cur, logs: [...cur.logs, ...logs] } });
  },

  subMissionLogs: {},
  appendSubMissionLog: (droneId, log) =>
    set((s) => ({
      subMissionLogs: {
        ...s.subMissionLogs,
        [droneId]: [...(s.subMissionLogs[droneId] || []), log],
      },
    })),
  clearSubMissionLogs: () => set({ subMissionLogs: {} }),

  executedNodes: new Set<string>(),
  failedNodes: new Set<string>(),
  currentNode: null,
  markNodeExecuted: (nodeId) =>
    set((s) => {
      const next = new Set(s.executedNodes);
      next.add(nodeId);
      return { executedNodes: next };
    }),
  markNodeFailed: (nodeId) =>
    set((s) => {
      const next = new Set(s.failedNodes);
      next.add(nodeId);
      return { failedNodes: next };
    }),
  setCurrentNode: (nodeId) => set({ currentNode: nodeId }),
  resetExecutionState: () =>
    set({ executedNodes: new Set<string>(), failedNodes: new Set<string>(), currentNode: null }),
}));
