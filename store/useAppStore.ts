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
  addMessage: (role: ChatMessage["role"], content: string) => void;

  history: HistoryItem[];
  upsertHistory: (item: HistoryItem) => void;

  workflow: ParsedWorkflow | null;
  setWorkflow: (wf: ParsedWorkflow | null) => void;

  activeMissionId: string | null;
  setActiveMissionId: (id: string | null) => void;

  missionState: MissionState | null;
  setMissionState: (state: MissionState | null) => void;

  appendLogs: (logs: LogEvent[]) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  model: "gpt-4",
  setModel: (model) => set({ model }),

  messages: [],
  addMessage: (role, content) =>
    set((s) => ({
      messages: [...s.messages, { id: uuidv4(), role, content, ts: Date.now() }]
    })),

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
  }
}));
