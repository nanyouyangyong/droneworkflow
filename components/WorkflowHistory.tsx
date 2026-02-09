"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import ConfirmDialog from "@/components/ConfirmDialog";

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
  const [deleteTarget, setDeleteTarget] = useState<WorkflowItem | null>(null);

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

  const handleDeleteClick = useCallback((item: WorkflowItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(item);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/workflow/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setWorkflows((prev) => prev.filter((w) => w.id !== deleteTarget.id));
        if (selectedId === deleteTarget.id) {
          setSelectedId(null);
          setWorkflow(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete workflow:", error);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, selectedId, setWorkflow]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const list = await fetchWorkflows();
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
      return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const handleRefresh = async () => {
    setLoading(true);
    await fetchWorkflows();
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 min-h-[44px]">
      {/* 标题 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs font-semibold text-slate-600">记录</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-medium">
          {workflows.length}
        </span>
        <button
          onClick={handleRefresh}
          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="刷新"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* 分隔线 */}
      <div className="h-5 w-px bg-slate-200 shrink-0" />

      {/* 横向滚动的工作流列表 */}
      <div className="app-scrollbar flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {loading && workflows.length === 0 ? (
            <span className="text-xs text-slate-400 animate-pulse">加载中...</span>
          ) : workflows.length === 0 ? (
            <span className="text-xs text-slate-400">暂无记录</span>
          ) : (
            workflows.map((item) => (
              <div
                key={item.id}
                className={`group relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all shrink-0 ${
                  selectedId === item.id
                    ? "border-blue-300 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
                onClick={() => loadWorkflow(item.id)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {selectedId === item.id && (
                    <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  )}
                  <span className={`text-xs font-medium truncate max-w-[120px] ${
                    selectedId === item.id ? "text-blue-700" : "text-slate-700"
                  }`}>
                    {item.name || "未命名"}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {item.nodeCount}节点
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatDate(item.updatedAt)}
                  </span>
                </div>
                {/* 删除按钮 */}
                <button
                  onClick={(e) => handleDeleteClick(item, e)}
                  className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                  title="删除工作流"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除工作流"
        message={`确定要删除「${deleteTarget?.name || '未命名'}」吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
