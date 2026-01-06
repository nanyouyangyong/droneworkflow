"use client";

import { useState, useEffect } from "react";
import type { WorkflowNode } from "@/lib/types";

interface NodeEditorProps {
  node: WorkflowNode | null;
  onNodeUpdate: (node: WorkflowNode) => void;
  onClose: () => void;
}

export default function NodeEditor({ node, onNodeUpdate, onClose }: NodeEditorProps) {
  const [editedNode, setEditedNode] = useState<WorkflowNode | null>(null);

  useEffect(() => {
    setEditedNode(node);
  }, [node]);

  if (!editedNode) return null;

  const handleParamChange = (key: string, value: string | number | boolean) => {
    setEditedNode(prev => {
      if (!prev) return null;
      return {
        ...prev,
        params: {
          ...prev.params,
          [key]: value
        }
      };
    });
  };

  const handleSave = () => {
    if (editedNode) {
      onNodeUpdate(editedNode);
      onClose();
    }
  };

  const renderParamEditor = () => {
    switch (editedNode.type) {
      case "起飞":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">高度 (米)</label>
              <input
                type="number"
                value={editedNode.params?.altitude as number || 10}
                onChange={(e) => handleParamChange("altitude", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">速度 (m/s)</label>
              <input
                type="number"
                value={editedNode.params?.speed as number || 5}
                onChange={(e) => handleParamChange("speed", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "飞行":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">目标坐标</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="X"
                  value={editedNode.params?.x as number || ""}
                  onChange={(e) => handleParamChange("x", Number(e.target.value))}
                  className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Y"
                  value={editedNode.params?.y as number || ""}
                  onChange={(e) => handleParamChange("y", Number(e.target.value))}
                  className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">高度 (米)</label>
              <input
                type="number"
                value={editedNode.params?.altitude || 50}
                onChange={(e) => handleParamChange("altitude", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">速度 (m/s)</label>
              <input
                type="number"
                value={editedNode.params?.speed as number || 10}
                onChange={(e) => handleParamChange("speed", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "悬停":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">悬停时间 (秒)</label>
              <input
                type="number"
                value={editedNode.params?.duration as number || 30}
                onChange={(e) => handleParamChange("duration", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">高度 (米)</label>
              <input
                type="number"
                value={editedNode.params?.altitude as number || 50}
                onChange={(e) => handleParamChange("altitude", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "拍照":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">照片质量</label>
              <select
                value={editedNode.params?.quality as string || "high"}
                onChange={(e) => handleParamChange("quality", e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">低质量</option>
                <option value="medium">中等质量</option>
                <option value="high">高质量</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">拍照数量</label>
              <input
                type="number"
                value={editedNode.params?.count as number || 1}
                onChange={(e) => handleParamChange("count", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "录像":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">录像时长 (秒)</label>
              <input
                type="number"
                value={editedNode.params?.duration as number || 60}
                onChange={(e) => handleParamChange("duration", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">分辨率</label>
              <select
                value={editedNode.params?.resolution as string || "1080p"}
                onChange={(e) => handleParamChange("resolution", e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="4k">4K</option>
              </select>
            </div>
          </div>
        );

      case "电量检查":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">低电量阈值 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editedNode.params?.low as number || 30}
                onChange={(e) => handleParamChange("low", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">临界电量阈值 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editedNode.params?.critical as number || 15}
                onChange={(e) => handleParamChange("critical", Number(e.target.value))}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case "条件判断":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">条件类型</label>
              <select
                value={editedNode.params?.conditionType as string || "battery"}
                onChange={(e) => handleParamChange("conditionType", e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="battery">电量检查</option>
                <option value="obstacle">障碍物检测</option>
                <option value="time">时间条件</option>
                <option value="custom">自定义条件</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">条件值</label>
              <input
                type="text"
                value={editedNode.params?.conditionValue as string || ""}
                onChange={(e) => handleParamChange("conditionValue", e.target.value)}
                className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm text-slate-500">
            该节点类型暂无可编辑参数
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            编辑节点: {editedNode.label}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700">节点标签</label>
          <input
            type="text"
            value={editedNode.label}
            onChange={(e) => setEditedNode(prev => prev ? {...prev, label: e.target.value} : null)}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-6">
          <h4 className="mb-3 text-sm font-medium text-slate-900">节点参数</h4>
          {renderParamEditor()}
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
