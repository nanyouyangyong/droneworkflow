"use client";

import { useState, useEffect } from "react";
import type { WorkflowEdge } from "@/lib/types";

interface EdgeEditorProps {
  edge: WorkflowEdge | null;
  onEdgeUpdate: (edge: WorkflowEdge) => void;
  onClose: () => void;
}

export default function EdgeEditor({ edge, onEdgeUpdate, onClose }: EdgeEditorProps) {
  const [editedEdge, setEditedEdge] = useState<WorkflowEdge | null>(null);

  useEffect(() => {
    setEditedEdge(edge);
  }, [edge]);

  if (!editedEdge) return null;

  const handleConditionChange = (condition: string) => {
    setEditedEdge(prev => {
      if (!prev) return null;
      return {
        ...prev,
        condition: condition || undefined
      };
    });
  };

  const handleSave = () => {
    if (editedEdge) {
      onEdgeUpdate(editedEdge);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            编辑连接线: {editedEdge.from} → {editedEdge.to}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            条件表达式 (可选)
          </label>
          <textarea
            value={editedEdge.condition || ""}
            onChange={(e) => handleConditionChange(e.target.value)}
            placeholder="例如: battery > 30 或 obstacle_detected == false"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <p className="mt-2 text-xs text-slate-500">
            留空表示无条件执行。支持简单的条件表达式。
          </p>
        </div>

        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-slate-900">常用条件</h4>
          <div className="space-y-2">
            <button
              onClick={() => handleConditionChange("battery &gt; 30")}
              className="w-full text-left rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              电量 &gt; 30%
            </button>
            <button
              onClick={() => handleConditionChange("battery &gt; 15")}
              className="w-full text-left rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              电量 &gt; 15%
            </button>
            <button
              onClick={() => handleConditionChange("obstacle_detected == false")}
              className="w-full text-left rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              无障碍物
            </button>
            <button
              onClick={() => handleConditionChange("mission_complete == true")}
              className="w-full text-left rounded border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              任务完成
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
