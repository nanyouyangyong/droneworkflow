"use client";

import { useState } from "react";
import type { WorkflowNode } from "@/lib/types";

interface NodeLibraryProps {
  onNodeSelect: (nodeType: string) => void;
}

const nodeTypes = [
  {
    type: "起飞",
    label: "起飞",
    description: "无人机起飞操作",
    icon: "🚁",
    category: "基础操作"
  },
  {
    type: "降落",
    label: "降落", 
    description: "无人机降落操作",
    icon: "🛬",
    category: "基础操作"
  },
  {
    type: "悬停",
    label: "悬停",
    description: "在指定位置悬停",
    icon: "⏸️",
    category: "基础操作"
  },
  {
    type: "飞行",
    label: "飞行",
    description: "按路径飞行到目标点",
    icon: "✈️",
    category: "导航"
  },
  {
    type: "拍照",
    label: "拍照",
    description: "拍摄照片",
    icon: "📷",
    category: "任务载荷"
  },
  {
    type: "录像",
    label: "录像",
    description: "开始录制视频",
    icon: "🎥",
    category: "任务载荷"
  },
  {
    type: "电量检查",
    label: "电量检查",
    description: "检查电池电量状态",
    icon: "🔋",
    category: "安全检查"
  },
  {
    type: "避障",
    label: "避障",
    description: "启用避障系统",
    icon: "🛡️",
    category: "安全检查"
  },
  {
    type: "返航",
    label: "返航",
    description: "自动返回起始点",
    icon: "🏠",
    category: "安全检查"
  },
  {
    type: "条件判断",
    label: "条件判断",
    description: "根据条件分支执行",
    icon: "🔀",
    category: "控制流程"
  },
  {
    type: "parallel_fork",
    label: "并行分发",
    description: "将任务分配给多架无人机并行执行",
    icon: "⑃",
    category: "控制流程"
  },
  {
    type: "parallel_join",
    label: "并行汇聚",
    description: "等待所有并行分支完成后继续",
    icon: "⑂",
    category: "控制流程"
  }
];

export default function NodeLibrary({ onNodeSelect }: NodeLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");

  const categories = ["全部", ...Array.from(new Set(nodeTypes.map(n => n.category)))];

  const filteredNodes = nodeTypes.filter(node => {
    const matchesSearch = node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "全部" || node.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">节点库</h3>
      </div>
      
      <div className="border-b border-slate-200 p-3">
        <input
          type="text"
          placeholder="搜索节点..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="border-b border-slate-200 p-3">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-1 gap-2">
          {filteredNodes.map((node) => (
            <div
              key={node.type}
              draggable
              onDragStart={(event) => handleDragStart(event, node.type)}
              onClick={() => onNodeSelect(node.type)}
              className="cursor-grab rounded border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{node.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-900">{node.label}</div>
                  <div className="text-xs text-slate-500">{node.description}</div>
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {node.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
