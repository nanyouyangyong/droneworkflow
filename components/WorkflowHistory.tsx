"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

interface MissionItem {
  id: string;
  missionId: string;
  workflowName: string;
  status: string;
  progress: number;
  nodeCount: number;
  logCount: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export default function WorkflowHistory() {
  const history = useAppStore((s) => s.history);
  const workflow = useAppStore((s) => s.workflow);
  const setWorkflow = useAppStore((s) => s.setWorkflow);
  const setActiveMissionId = useAppStore((s) => s.setActiveMissionId);

  const [dbMissions, setDbMissions] = useState<MissionItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 从后端加载任务历史
  useEffect(() => {
    async function fetchMissions() {
      setLoading(true);
      try {
        const res = await fetch("/api/mission/list?limit=50");
        if (res.ok) {
          const data = await res.json();
          setDbMissions(data.missions || []);
        }
      } catch (error) {
        console.error("Failed to fetch missions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMissions();
    // 每 10 秒刷新一次
    const interval = setInterval(fetchMissions, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-blue-100 text-blue-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "idle":
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "running":
        return "执行中";
      case "completed":
        return "已完成";
      case "failed":
        return "失败";
      case "idle":
      default:
        return "待执行";
    }
  };

  const formatTime = (ts: number | string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatDate = (ts: string) => {
    const date = new Date(ts);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) {
      return formatTime(ts);
    }
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // 加载任务详情
  const handleLoadMission = async (missionId: string) => {
    try {
      const res = await fetch(`/api/mission/${missionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.mission?.workflowSnapshot) {
          setWorkflow({
            workflow_name: data.mission.workflowSnapshot.name,
            nodes: data.mission.workflowSnapshot.nodes,
            edges: data.mission.workflowSnapshot.edges
          });
          setActiveMissionId(missionId);
        }
      }
    } catch (error) {
      console.error("Failed to load mission:", error);
    }
  };

  // 合并本地历史和数据库任务
  const allItems = [
    ...history.map((h) => ({
      type: "local" as const,
      id: h.id,
      missionId: h.missionId,
      name: h.instruction,
      status: h.status,
      nodeCount: h.nodeCount,
      ts: h.ts
    })),
    ...dbMissions.map((m) => ({
      type: "db" as const,
      id: m.id,
      missionId: m.missionId,
      name: m.workflowName,
      status: m.status,
      nodeCount: m.nodeCount,
      ts: new Date(m.createdAt).getTime()
    }))
  ]
    .filter((item, index, self) => 
      // 去重：按 missionId 去重
      index === self.findIndex((t) => t.missionId === item.missionId)
    )
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 30);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">📋</span>
          <span className="text-sm font-semibold text-slate-800">工作流记录</span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {history.length} 条
        </span>
      </div>

      {/* Current Workflow */}
      {workflow && (
        <div className="border-b border-slate-200 bg-blue-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm">🎯</span>
              <span className="text-sm font-medium text-blue-800">当前工作流</span>
            </div>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              {workflow.nodes.length} 节点
            </span>
          </div>
          <div className="mt-1 text-xs text-blue-600 truncate">
            {workflow.workflow_name}
          </div>
        </div>
      )}

      {/* History List */}
      <div className="app-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
        {loading && allItems.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <div className="text-center">
              <div className="mb-2 text-2xl animate-spin">⏳</div>
              <div className="text-sm text-slate-400">加载中...</div>
            </div>
          </div>
        ) : allItems.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <div className="text-center">
              <div className="mb-2 text-3xl opacity-50">📭</div>
              <div className="text-sm text-slate-400">暂无工作流记录</div>
              <div className="mt-1 text-xs text-slate-300">
                生成工作流后会在此显示
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {allItems.map((item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => {
                  if (item.missionId) {
                    handleLoadMission(item.missionId);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400">
                        {formatDate(new Date(item.ts).toISOString())}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${getStatusColor(
                          item.status
                        )}`}
                      >
                        {getStatusText(item.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-700 truncate">
                      {item.name || "未命名工作流"}
                    </div>
                    <div className="mt-1 flex items-center space-x-3 text-xs text-slate-400">
                      <span>📦 {item.nodeCount} 节点</span>
                      {item.type === "db" && (
                        <span className="text-blue-400">☁️ 已保存</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {allItems.length > 0 && (
        <div className="border-t border-slate-200 p-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>共 {allItems.length} 条记录</span>
            {loading && <span className="animate-pulse">刷新中...</span>}
          </div>
        </div>
      )}
    </div>
  );
}
