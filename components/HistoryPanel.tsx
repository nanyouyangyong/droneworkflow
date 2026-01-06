"use client";

import { useAppStore } from "@/store/useAppStore";

export default function HistoryPanel() {
  const history = useAppStore((s) => s.history);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold">指令历史</div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {history.length === 0 ? (
          <div className="text-sm text-slate-500">暂无历史记录</div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="rounded border border-slate-200 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-800">{new Date(h.ts).toLocaleString()}</div>
                  <div className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {h.status}
                  </div>
                </div>
                <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-slate-700">
                  {h.instruction}
                </div>
                <div className="mt-2 text-xs text-slate-500">节点数: {h.nodeCount}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
