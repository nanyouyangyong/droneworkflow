"use client";

import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  type Connection,
  Controls,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState
} from "reactflow";
import "reactflow/dist/style.css";
import { useAppStore } from "@/store/useAppStore";
import type { ParsedWorkflow } from "@/lib/types";

function wfToReactFlow(wf: ParsedWorkflow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = wf.nodes.map((n, idx) => ({
    id: n.id,
    data: { label: n.label },
    position: { x: 50 + (idx % 3) * 220, y: 50 + Math.floor(idx / 3) * 140 },
    type: "default"
  }));

  const edges: Edge[] = wf.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.condition ?? undefined,
    animated: false
  }));

  return { nodes, edges };
}

export default function WorkflowCanvas() {
  const workflow = useAppStore((s) => s.workflow);
  const setActiveMissionId = useAppStore((s) => s.setActiveMissionId);
  const setMissionState = useAppStore((s) => s.setMissionState);
  const upsertHistory = useAppStore((s) => s.upsertHistory);

  const initial = useMemo(() => {
    if (!workflow) return { nodes: [], edges: [] };
    return wfToReactFlow(workflow);
  }, [workflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  useEffect(() => {
    if (!workflow) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const next = wfToReactFlow(workflow);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [setEdges, setNodes, workflow]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((eds) => [
        ...eds,
        {
          ...connection,
          id: `${connection.source}-${connection.target}`
        }
      ]);
    },
    [setEdges]
  );

  async function onExecute() {
    if (!workflow) return;

    const res = await fetch("/api/workflow/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflow })
    });

    if (!res.ok) return;
    const data = (await res.json()) as { missionId: string; state: any };

    setActiveMissionId(data.missionId);
    setMissionState(data.state);

    upsertHistory({
      id: data.missionId,
      ts: Date.now(),
      instruction: workflow.workflow_name,
      nodeCount: workflow.nodes.length,
      status: data.state.status,
      missionId: data.missionId
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="text-sm font-semibold">工作流画布</div>
        <button
          className="rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={onExecute}
          disabled={!workflow}
        >
          执行工作流
        </button>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background variant="dots" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
