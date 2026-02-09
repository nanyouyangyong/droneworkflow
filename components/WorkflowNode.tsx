"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { useAppStore } from "@/store/useAppStore";

const nodeIcons: Record<string, string> = {
  start: "▶",
  end: "⏹",
  "起飞": "🚁",
  "降落": "🛬",
  "悬停": "⏸️",
  "飞行": "✈️",
  "飞行到点": "📍",
  "拍照": "📷",
  "定时拍照": "📷",
  "录像": "🎥",
  "电量检查": "🔋",
  "避障": "🛡️",
  "返航": "🏠",
  "条件判断": "🔀",
  "区域巡检": "🔍",
  "地址解析": "🗺️",
  "路径规划": "🧭",
  "POI搜索": "📌",
  "天气查询": "🌤️",
  parallel_fork: "⑃",
  parallel_join: "⑂",
};

function WorkflowNodeComponent({ id, data, selected }: NodeProps) {
  const executedNodes = useAppStore((s) => s.executedNodes);
  const failedNodes = useAppStore((s) => s.failedNodes);
  const currentNode = useAppStore((s) => s.currentNode);

  const nodeType: string = data.nodeType || data.label || "";
  const label: string = data.label || nodeType;
  const icon = nodeIcons[nodeType] || "⚙️";

  const isCurrentNode = currentNode === id;
  const isExecuted = executedNodes.has(id);
  const isFailed = failedNodes.has(id);
  const isStartOrEnd = nodeType === "start" || nodeType === "end";
  const isForkJoin = nodeType === "parallel_fork" || nodeType === "parallel_join";

  // 决定样式 — 执行状态优先级最高
  let containerStyle = "";
  let textStyle = "text-slate-700";
  let statusLabel = "";
  let statusColor = "";

  if (isFailed) {
    containerStyle = "border-red-500 bg-red-50 shadow-lg shadow-red-200/50 ring-2 ring-red-400/30 scale-105";
    textStyle = "text-red-800";
    statusLabel = "失败";
    statusColor = "bg-red-500";
  } else if (isCurrentNode) {
    containerStyle = "border-blue-500 bg-blue-50 shadow-xl shadow-blue-300/50 ring-3 ring-blue-400/50 scale-110 wf-node-executing";
    textStyle = "text-blue-800";
    statusLabel = "执行中";
    statusColor = "bg-blue-500";
  } else if (isExecuted) {
    containerStyle = "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-200/50 ring-2 ring-emerald-400/20";
    textStyle = "text-emerald-800";
    statusLabel = "完成";
    statusColor = "bg-emerald-500";
  } else if (isStartOrEnd) {
    containerStyle = "border-slate-400 bg-slate-800 shadow-md";
    textStyle = "text-white";
  } else if (isForkJoin) {
    containerStyle = "border-violet-300 bg-violet-50 shadow-sm";
    textStyle = "text-violet-700";
  } else {
    containerStyle = "border-slate-200 bg-white shadow-sm hover:shadow-md";
  }

  if (selected && !isCurrentNode) {
    containerStyle += " ring-2 ring-blue-500/30";
  }

  return (
    <div
      className={`relative rounded-xl border-2 ${containerStyle} px-4 py-3 min-w-[140px] max-w-[200px] transition-all duration-500 ease-in-out`}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-slate-400 !border-white !border-2" />

      {/* 执行中 — 顶部脉冲指示器 */}
      {isCurrentNode && (
        <span className="absolute -top-2 -right-2 flex h-5 w-5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
          <span className="relative inline-flex h-5 w-5 rounded-full bg-blue-500 items-center justify-center">
            <svg className="h-2.5 w-2.5 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </span>
        </span>
      )}

      {/* 已完成 — 绿色对勾徽章 */}
      {isExecuted && !isCurrentNode && (
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm shadow-emerald-300">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      {/* 失败 — 红色叉号徽章 */}
      {isFailed && (
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm shadow-red-300">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      )}

      {/* 节点内容 */}
      <div className="flex items-center gap-2.5">
        <span className={`text-xl leading-none shrink-0 ${isCurrentNode ? "animate-bounce" : ""}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className={`text-xs font-bold ${textStyle} truncate leading-tight`}>
            {label}
          </div>
          {statusLabel && (
            <div className="mt-1 flex items-center gap-1">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor} ${isCurrentNode ? "animate-pulse" : ""}`} />
              <span className={`text-[10px] font-semibold ${
                isCurrentNode ? "text-blue-600 animate-pulse" :
                isExecuted ? "text-emerald-600" :
                isFailed ? "text-red-600" : "text-slate-500"
              }`}>
                {statusLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 执行中底部进度条 */}
      {isCurrentNode && (
        <div className="mt-2 h-1 w-full rounded-full bg-blue-200 overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full wf-progress-bar" />
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-slate-400 !border-white !border-2" />
    </div>
  );
}

export default memo(WorkflowNodeComponent);
