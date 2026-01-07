"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { getSocket } from "@/lib/socket";
import type { LogEvent } from "@/lib/types";

const levelColor: Record<string, string> = {
  info: "text-slate-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-red-600",
  debug: "text-violet-600"
};

export default function LogPanel() {
  const missionId = useAppStore((s) => s.activeMissionId);
  const missionState = useAppStore((s) => s.missionState);
  const setMissionState = useAppStore((s) => s.setMissionState);
  const appendLogs = useAppStore((s) => s.appendLogs);

  const [connected, setConnected] = useState(false);

  const logs = missionState?.logs ?? [];

  const header = useMemo(() => {
    if (!missionState) return "执行日志";
    return `执行日志（${missionState.status} ${missionState.progress}%）`;
  }, [missionState]);

  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.on("mission:log", (payload: { missionId: string; log: LogEvent }) => {
      if (payload.missionId !== missionId) return;
      appendLogs([payload.log]);
    });

    socket.on(
      "mission:state",
      (payload: { missionId: string; state: { status: string; progress: number; currentNode?: string } }) => {
        if (!missionState) return;
        if (payload.missionId !== missionId) return;
        setMissionState({
          ...missionState,
          status: payload.state.status as any,
          progress: payload.state.progress,
          currentNode: payload.state.currentNode
        });
      }
    );

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("mission:log");
      socket.off("mission:state");
    };
  }, [appendLogs, missionId, missionState, setMissionState]);

  useEffect(() => {
    async function syncAndJoin() {
      if (!missionId) return;

      const socket = getSocket();
      socket.emit("mission:join", { missionId });

      const res = await fetch(`/api/workflow/state?missionId=${encodeURIComponent(missionId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { state: any };
      setMissionState(data.state);
    }

    void syncAndJoin();
  }, [missionId, setMissionState]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold">{header}</div>
        <div className="text-xs text-slate-500">{connected ? "WS已连接" : "WS未连接"}</div>
      </div>

      <div className="app-scrollbar flex-1 overflow-y-auto overflow-x-hidden p-3">
        {missionState == null ? (
          <div className="text-sm text-slate-500">暂无执行任务</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-slate-500">等待日志...</div>
        ) : (
          <div className="space-y-2 text-sm">
            {logs.map((l, idx) => (
              <div key={`${l.ts}-${idx}`} className="rounded border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-center justify-between">
                  <div className={`font-medium ${levelColor[l.level] ?? "text-slate-600"}`}>{l.level}</div>
                  <div className="text-xs text-slate-400">{new Date(l.ts).toLocaleTimeString()}</div>
                </div>
                <div className="mt-1 whitespace-pre-wrap text-slate-700">{l.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
