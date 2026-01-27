"use client";

import ChatPanel from "@/components/ChatPanel";
import NodeLibrary from "@/components/NodeLibrary";
import WorkflowCanvas from "@/components/WorkflowCanvas";
import LogPanel from "@/components/LogPanel";
import WorkflowHistory from "@/components/WorkflowHistory";
import AuthGuard from "@/components/AuthGuard";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";

function UserMenu() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <span className="text-sm font-medium text-slate-700">{user?.name}</span>
      </div>
      <button
        onClick={handleLogout}
        className="rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100"
      >
        退出
      </button>
    </div>
  );
}

export default function Home() {
  const handleNodeSelect = (nodeType: string) => {
    // This will be handled by the WorkflowCanvas component
    console.log("Selected node type:", nodeType);
  };

  return (
    <AuthGuard>
      <main className="flex h-screen w-screen flex-col overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#2563EB" />
              <path d="M12 20L18 14L24 20L18 26L12 20Z" fill="white" opacity="0.9" />
              <path d="M18 14L24 20L30 14L24 8L18 14Z" fill="white" opacity="0.7" />
              <path d="M18 26L24 20L30 26L24 32L18 26Z" fill="white" opacity="0.5" />
            </svg>
            <h1 className="text-lg font-semibold text-slate-800">Drone Workflow</h1>
          </div>
          <UserMenu />
        </header>

        {/* 主内容区域 */}
        <div className="grid flex-1 grid-cols-[400px_200px_200px_1fr_400px] gap-0 overflow-hidden">
          {/* 大模型对话 */}
          <div className="h-full min-h-0 overflow-hidden border-r border-slate-200 bg-white">
            <ChatPanel />
          </div>
          {/* 节点库 */}
          <div className="h-full border-r border-slate-200 bg-white">
            <NodeLibrary onNodeSelect={handleNodeSelect} />
          </div>
          {/* 工作流历史记录 */}
          <div className="h-full border-r border-slate-200 bg-white">
            <WorkflowHistory />
          </div>
          {/* 工作流画布 */}
          <div className="h-full border-r border-slate-200 bg-slate-50">
            <WorkflowCanvas />
          </div>
          {/* 日志面板 */}
          <div className="h-full min-h-0 overflow-hidden bg-white">
            <LogPanel />
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
