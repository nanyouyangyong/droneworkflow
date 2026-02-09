"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const droneTagColors = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function getDroneColor(droneId: string, allDroneIds: string[]): string {
  const idx = allDroneIds.indexOf(droneId);
  return droneTagColors[idx >= 0 ? idx % droneTagColors.length : 0];
}

export default function LogPanel() {
  const missionId = useAppStore((s) => s.activeMissionId);
  const missionState = useAppStore((s) => s.missionState);
  const setMissionState = useAppStore((s) => s.setMissionState);
  const appendLogs = useAppStore((s) => s.appendLogs);
  const subMissionLogs = useAppStore((s) => s.subMissionLogs);
  const appendSubMissionLog = useAppStore((s) => s.appendSubMissionLog);
  const clearSubMissionLogs = useAppStore((s) => s.clearSubMissionLogs);

  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const logs = missionState?.logs ?? [];

  // 收集所有出现过的 droneId
  const droneIds = useMemo(() => {
    const ids = new Set<string>();
    for (const l of logs) {
      if (l.droneId) ids.add(l.droneId);
    }
    for (const id of Object.keys(subMissionLogs)) {
      ids.add(id);
    }
    return Array.from(ids).sort();
  }, [logs, subMissionLogs]);

  const isMultiDrone = droneIds.length > 1;

  // 当前 Tab 对应的日志
  const displayLogs = useMemo(() => {
    if (activeTab === "all") return logs;
    return subMissionLogs[activeTab] || logs.filter((l) => l.droneId === activeTab);
  }, [activeTab, logs, subMissionLogs]);

  const header = useMemo(() => {
    if (!missionState) return "执行日志";
    return `执行日志（${missionState.status} ${missionState.progress}%）`;
  }, [missionState]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayLogs.length]);

  // 切换任务时清空子任务日志
  useEffect(() => {
    clearSubMissionLogs();
    setActiveTab("all");
  }, [missionId, clearSubMissionLogs]);

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
      // 同时追加到子任务日志分组
      if (payload.log.droneId) {
        appendSubMissionLog(payload.log.droneId, payload.log);
      }
    });

    socket.on(
      "mission:state",
      (payload: { missionId: string; state: { status?: string; progress?: number; currentNode?: string } }) => {
        if (!missionState) return;
        if (payload.missionId !== missionId) return;
        setMissionState({
          ...missionState,
          ...(payload.state.status !== undefined && { status: payload.state.status as any }),
          ...(payload.state.progress !== undefined && { progress: payload.state.progress }),
          ...(payload.state.currentNode !== undefined && { currentNode: payload.state.currentNode }),
        });
      }
    );

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("mission:log");
      socket.off("mission:state");
    };
  }, [appendLogs, appendSubMissionLog, missionId, missionState, setMissionState]);

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

      {/* 多无人机时显示 Tab 切换 */}
      {isMultiDrone && (
        <div className="flex gap-1 border-b border-slate-200 px-3 py-2 overflow-x-auto">
          <button
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === "all"
                ? "bg-slate-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            onClick={() => setActiveTab("all")}
          >
            全部 ({logs.length})
          </button>
          {droneIds.map((id) => {
            const count = (subMissionLogs[id] || []).length;
            return (
              <button
                key={id}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === id
                    ? "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setActiveTab(id)}
              >
                {id} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div ref={scrollRef} className="app-scrollbar flex-1 overflow-y-auto overflow-x-hidden p-3">
        {missionState == null ? (
          <div className="text-sm text-slate-500">暂无执行任务</div>
        ) : displayLogs.length === 0 ? (
          <div className="text-sm text-slate-500">等待日志...</div>
        ) : (
          <div className="space-y-2 text-sm">
            {displayLogs.map((l, idx) => (
              <div key={`${l.ts}-${idx}`} className="rounded border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${levelColor[l.level] ?? "text-slate-600"}`}>
                      {l.level}
                    </span>
                    {l.droneId && activeTab === "all" && (
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getDroneColor(l.droneId, droneIds)}`}
                      >
                        {l.droneId}
                      </span>
                    )}
                  </div>
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
