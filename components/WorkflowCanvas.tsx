"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  type Connection,
  Controls,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges
} from "reactflow";
import "reactflow/dist/style.css";
import { useAppStore } from "@/store/useAppStore";
import type { ParsedWorkflow, WorkflowNode } from "@/lib/types";
import NodeEditor from "@/components/NodeEditor";

function wfToReactFlow(wf: ParsedWorkflow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = wf.nodes.map((n, idx) => ({
    id: n.id,
    data: { 
      label: n.label,
      nodeType: n.type,
      params: n.params
    },
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

function reactFlowToWf(nodes: Node[], edges: Edge[]): ParsedWorkflow {
  const workflowNodes: WorkflowNode[] = nodes.map(n => ({
    id: n.id,
    type: n.data.nodeType || n.data.label,
    label: n.data.label,
    params: n.data.params || {}
  }));

  const workflowEdges = edges.map(e => ({
    id: e.id,
    from: e.source,
    to: e.target,
    condition: e.label as string || undefined
  }));

  return {
    workflow_name: "自定义工作流",
    nodes: workflowNodes,
    edges: workflowEdges
  };
}

export default function WorkflowCanvas() {
  const workflow = useAppStore((s) => s.workflow);
  const setWorkflow = useAppStore((s) => s.setWorkflow);
  const setActiveMissionId = useAppStore((s) => s.setActiveMissionId);
  const setMissionState = useAppStore((s) => s.setMissionState);
  const upsertHistory = useAppStore((s) => s.upsertHistory);
  
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const initial = useMemo(() => {
    if (!workflow) return { nodes: [], edges: [] };
    return wfToReactFlow(workflow);
  }, [workflow]);

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(initial.edges);

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

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChangeInternal(changes);
    },
    [onNodesChangeInternal]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChangeInternal(changes);
    },
    [onEdgesChangeInternal]
  );

  // Sync workflow data when nodes or edges change, but not during initial load
  useEffect(() => {
    if (workflow) {
      const updatedWorkflow = reactFlowToWf(nodes, edges);
      // Only update if the workflow actually changed
      if (JSON.stringify(updatedWorkflow) !== JSON.stringify(workflow)) {
        setWorkflow(updatedWorkflow);
      }
    }
  }, [nodes, edges]); // Remove setWorkflow and workflow from dependencies

  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const workflowNode: WorkflowNode = {
        id: node.id,
        type: node.data.nodeType || node.data.label,
        label: node.data.label,
        params: node.data.params || {}
      };
      setSelectedNode(workflowNode);
      setIsEditorOpen(true);
    },
    []
  );

  const onDragOver = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    []
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: 'default',
        position,
        data: {
          label: type,
          nodeType: type,
          params: {}
        },
      };

      setNodes((nds) => {
        const updatedNodes = [...nds, newNode];
        return updatedNodes;
      });
    },
    [setNodes, edges]
  );

  const handleNodeUpdate = useCallback(
    (updatedNode: WorkflowNode) => {
      setNodes((nds) => {
        const updatedNodes = nds.map(n => 
          n.id === updatedNode.id 
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: updatedNode.label,
                  params: updatedNode.params
                }
              }
            : n
        );
        return updatedNodes;
      });
    },
    [setNodes, edges]
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
          onNodeDoubleClick={onNodeDoubleClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          nodeTypes={{}}
        >
          <Background variant="dots" gap={20} />
          <Controls />
        </ReactFlow>
        
        {isEditorOpen && (
          <NodeEditor
            node={selectedNode}
            onNodeUpdate={handleNodeUpdate}
            onClose={() => {
              setIsEditorOpen(false);
              setSelectedNode(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
