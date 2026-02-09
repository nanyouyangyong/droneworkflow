"use client";

import { useEffect, useRef, useState } from "react";

interface NodeLibraryProps {
  onClose?: () => void;
  onAddNode?: (nodeType: string) => void;
}

const nodeTypes = [
  { type: "起飞", label: "起飞", description: "无人机起飞", icon: "🚁", category: "基础" },
  { type: "降落", label: "降落", description: "无人机降落", icon: "🛬", category: "基础" },
  { type: "悬停", label: "悬停", description: "指定位置悬停", icon: "⏸️", category: "基础" },
  { type: "飞行", label: "飞行", description: "飞行到目标点", icon: "✈️", category: "导航" },
  { type: "拍照", label: "拍照", description: "拍摄照片", icon: "📷", category: "载荷" },
  { type: "录像", label: "录像", description: "录制视频", icon: "🎥", category: "载荷" },
  { type: "电量检查", label: "电量检查", description: "检查电池电量", icon: "🔋", category: "安全" },
  { type: "避障", label: "避障", description: "启用避障系统", icon: "🛡️", category: "安全" },
  { type: "返航", label: "返航", description: "自动返回起点", icon: "🏠", category: "安全" },
  { type: "条件判断", label: "条件判断", description: "条件分支执行", icon: "🔀", category: "流程" },
  { type: "parallel_fork", label: "并行分发", description: "多机并行执行", icon: "⑃", category: "流程" },
  { type: "parallel_join", label: "并行汇聚", description: "等待分支完成", icon: "⑂", category: "流程" },
];

const categoryColors: Record<string, string> = {
  "基础": "border-blue-200 bg-blue-50/50",
  "导航": "border-emerald-200 bg-emerald-50/50",
  "载荷": "border-amber-200 bg-amber-50/50",
  "安全": "border-rose-200 bg-rose-50/50",
  "流程": "border-violet-200 bg-violet-50/50",
};

const categoryTagColors: Record<string, string> = {
  "基础": "bg-blue-100 text-blue-700",
  "导航": "bg-emerald-100 text-emerald-700",
  "载荷": "bg-amber-100 text-amber-700",
  "安全": "bg-rose-100 text-rose-700",
  "流程": "bg-violet-100 text-violet-700",
};

export default function NodeLibrary({ onClose, onAddNode }: NodeLibraryProps) {
  const [filter, setFilter] = useState("全部");
  const overlayRef = useRef<HTMLDivElement>(null);

  const categories = ["全部", ...Array.from(new Set(nodeTypes.map(n => n.category)))];
  const filtered = filter === "全部" ? nodeTypes : nodeTypes.filter(n => n.category === filter);

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
    onClose?.();
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div className="w-[520px] h-[500px] rounded-2xl bg-white shadow-2xl border border-slate-200/50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">节点库</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">拖拽或双击节点添加到画布</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter tabs */}
        <div className="shrink-0 flex gap-1 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === c
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Node Grid */}
        <div className="app-scrollbar flex-1 min-h-0 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-2.5">
            {filtered.map((node) => (
              <div
                key={node.type}
                draggable
                onDragStart={(event) => handleDragStart(event, node.type)}
                onDoubleClick={() => { onAddNode?.(node.type); }}
                className={`group cursor-grab rounded-xl border-2 p-3 transition-all hover:shadow-md hover:scale-[1.02] active:cursor-grabbing active:scale-95 select-none ${
                  categoryColors[node.category] || "border-slate-200 bg-white"
                }`}
              >
                <div className="text-2xl leading-none text-center">{node.icon}</div>
                <div className="mt-2 text-xs font-semibold text-slate-800 text-center truncate">{node.label}</div>
                <div className="mt-0.5 text-[10px] text-slate-400 text-center truncate">{node.description}</div>
                <div className="mt-1.5 flex justify-center">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                    categoryTagColors[node.category] || "bg-slate-100 text-slate-600"
                  }`}>
                    {node.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
