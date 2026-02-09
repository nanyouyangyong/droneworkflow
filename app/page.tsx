"use client";

import ChatPanel from "@/components/ChatPanel";
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
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-medium text-white shadow-sm">
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
        <span className="text-sm font-medium text-slate-700">{user?.name}</span>
      </div>
      <button
        onClick={handleLogout}
        className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700"
      >
        退出
      </button>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <main className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
        {/* 顶部导航栏 */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white px-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-base font-semibold text-slate-800 tracking-tight">Drone Workflow</h1>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">Beta</span>
          </div>
          <UserMenu />
        </header>

        {/* 主内容区域：三栏布局 */}
        <div className="flex flex-1 overflow-hidden">
          {/* ===== 左侧栏：对话 ===== */}
          <div className="flex w-[360px] shrink-0 flex-col border-r border-slate-200/80 bg-white">
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel />
            </div>
          </div>

          {/* ===== 中间区域：工作流记录(横向) + 画布 ===== */}
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            {/* 工作流历史记录 — 横向条 */}
            <div className="shrink-0 border-b border-slate-200/80 bg-white">
              <WorkflowHistory />
            </div>
            {/* 工作流画布 */}
            <div className="flex-1 min-h-0 bg-slate-50/80">
              <WorkflowCanvas />
            </div>
          </div>

          {/* ===== 右侧栏：日志面板 ===== */}
          <div className="w-[340px] shrink-0 border-l border-slate-200/80 bg-white overflow-hidden">
            <LogPanel />
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
