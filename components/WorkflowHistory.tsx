"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";

interface WorkflowItem {
  id: string;
  name: string;
  description?: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function WorkflowHistory() {
  const workflow = useAppStore((s) => s.workflow);
  const setWorkflow = useAppStore((s) => s.setWorkflow);

  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // 从后端加载工作流列表
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflow/list?limit=50");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows || []);
        return data.workflows || [];
      }
    } catch (error) {
      console.error("Failed to fetch workflows:", error);
    }
    return [];
  }, []);

  // 加载工作流详情到画布
  const loadWorkflow = useCallback(async (workflowId: string) => {
    try {
      const res = await fetch(`/api/workflow/${workflowId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.workflow) {
          setWorkflow({
            workflow_name: data.workflow.name,
            nodes: data.workflow.nodes || [],
            edges: data.workflow.edges || []
          });
          setSelectedId(workflowId);
        }
      }
    } catch (error) {
      console.error("Failed to load workflow:", error);
    }
  }, [setWorkflow]);

  // 初始化：加载工作流列表，并默认加载第一个
  useEffect(() => {
    async function init() {
      setLoading(true);
      const list = await fetchWorkflows();
      
      // 如果当前没有工作流且列表不为空，加载第一个
      if (!workflow && list.length > 0 && !initialLoaded) {
        await loadWorkflow(list[0].id);
        setInitialLoaded(true);
      } else {
        setInitialLoaded(true);
      }
      setLoading(false);
    }

    init();
  }, [fetchWorkflows, loadWorkflow, workflow, initialLoaded]);

  // 当大模型生成新工作流时，刷新列表
  useEffect(() => {
    if (workflow && initialLoaded) {
      fetchWorkflows();
    }
  }, [workflow, initialLoaded, fetchWorkflows]);

  const formatDate = (ts: string) => {
    const date = new Date(ts);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // 刷新列表
  const handleRefresh = async () => {
    setLoading(true);
    await fetchWorkflows();
    setLoading(false);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">📋</span>
          <span className="text-sm font-semibold text-slate-800">工作流记录</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="刷新"
          >
            <span className={loading ? "animate-spin inline-block" : ""}>🔄</span>
          </button>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {workflows.length} 条
          </span>
        </div>
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
            {workflow.workflow_name || "未命名工作流"}
          </div>
        </div>
      )}

      {/* Workflow List */}
      <div className="app-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
        {loading && workflows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <div className="text-center">
              <div className="mb-2 text-2xl animate-spin">⏳</div>
              <div className="text-sm text-slate-400">加载中...</div>
            </div>
          </div>
        ) : workflows.length === 0 ? (
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
            {workflows.map((item) => (
              <div
                key={item.id}
                className={`p-3 cursor-pointer transition-colors ${
                  selectedId === item.id
                    ? "bg-blue-50 border-l-2 border-l-blue-500"
                    : "hover:bg-slate-50"
                }`}
                onClick={() => loadWorkflow(item.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-slate-400">
                        {formatDate(item.updatedAt)}
                      </span>
                      {selectedId === item.id && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-600">
                          当前
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-700 truncate font-medium">
                      {item.name || "未命名工作流"}
                    </div>
                    {item.description && (
                      <div className="mt-0.5 text-xs text-slate-400 truncate">
                        {item.description}
                      </div>
                    )}
                    <div className="mt-1 flex items-center space-x-3 text-xs text-slate-400">
                      <span>📦 {item.nodeCount} 节点</span>
                      <span>🔗 {item.edgeCount} 连接</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {workflows.length > 0 && (
        <div className="border-t border-slate-200 p-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>共 {workflows.length} 条记录</span>
            {loading && <span className="animate-pulse">刷新中...</span>}
          </div>
        </div>
      )}
    </div>
  );
}
