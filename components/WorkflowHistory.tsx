"use client";

import { useAppStore } from "@/store/useAppStore";

export default function WorkflowHistory() {
  const history = useAppStore((s) => s.history);
  const workflow = useAppStore((s) => s.workflow);
  const setWorkflow = useAppStore((s) => s.setWorkflow);

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

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

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
      <div className="flex-1 overflow-auto">
        {history.length === 0 ? (
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
            {history.map((item) => (
              <div
                key={item.id}
                className="p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => {
                  // TODO: Load workflow from history
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400">
                        {formatTime(item.ts)}
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
                      {item.instruction}
                    </div>
                    <div className="mt-1 flex items-center space-x-3 text-xs text-slate-400">
                      <span>📦 {item.nodeCount} 节点</span>
                      {item.missionId && (
                        <span className="truncate">ID: {item.missionId.slice(0, 8)}...</span>
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
      {history.length > 0 && (
        <div className="border-t border-slate-200 p-2">
          <button
            className="w-full rounded-lg py-2 text-xs text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={() => {
              // TODO: Clear history
            }}
          >
            清空记录
          </button>
        </div>
      )}
    </div>
  );
}
