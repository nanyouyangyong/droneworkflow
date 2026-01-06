import ChatPanel from "@/components/ChatPanel";
import HistoryPanel from "@/components/HistoryPanel";
import WorkflowCanvas from "@/components/WorkflowCanvas";
import LogPanel from "@/components/LogPanel";

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <div className="grid h-full grid-cols-[400px_300px_1fr_400px] gap-0">
        <div className="h-full border-r border-slate-200 bg-white">
          <ChatPanel />
        </div>
        <div className="h-full border-r border-slate-200 bg-white">
          <HistoryPanel />
        </div>
        <div className="h-full border-r border-slate-200 bg-slate-50">
          <WorkflowCanvas />
        </div>
        <div className="h-full bg-white">
          <LogPanel />
        </div>
      </div>
    </main>
  );
}
