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
import type { ParsedWorkflow, WorkflowNode, WorkflowEdge } from "@/lib/types";
import NodeEditor from "@/components/NodeEditor";
import EdgeEditor from "@/components/EdgeEditor";
import ContextMenu from "@/components/ContextMenu";

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
  const [selectedEdge, setSelectedEdge] = useState<WorkflowEdge | null>(null);
  const [isEdgeEditorOpen, setIsEdgeEditorOpen] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node?: Node;
    edge?: Edge;
  } | null>(null);

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
      setEdges((eds:any) => [
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

  // Handle keyboard events for delete
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        // Delete selected nodes and edges
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedEdges = edges.filter(e => e.selected);
        
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          const nodeIds = selectedNodes.map(n => n.id);
          const edgeIds = selectedEdges.map(e => e.id);
          
          setNodes(currentNodes => currentNodes.filter(n => !nodeIds.includes(n.id)));
          setEdges(currentEdges => currentEdges.filter(e => !edgeIds.includes(e.id)));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, setNodes, setEdges]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        node
      });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        edge
      });
    },
    []
  );

  const handleContextMenuEditNode = useCallback(
    (node: Node) => {
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

  const handleContextMenuEditEdge = useCallback(
    (edge: Edge) => {
      const workflowEdge: WorkflowEdge = {
        id: edge.id,
        from: edge.source,
        to: edge.target,
        condition: edge.label as string || undefined
      };
      setSelectedEdge(workflowEdge);
      setIsEdgeEditorOpen(true);
    },
    []
  );

  const handleContextMenuDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes(currentNodes => currentNodes.filter(n => n.id !== nodeId));
    },
    []
  );

  const handleContextMenuDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges(currentEdges => currentEdges.filter(e => e.id !== edgeId));
    },
    []
  );

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

  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const workflowEdge: WorkflowEdge = {
        id: edge.id,
        from: edge.source,
        to: edge.target,
        condition: edge.label as string || undefined
      };
      setSelectedEdge(workflowEdge);
      setIsEdgeEditorOpen(true);
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

  const handleEdgeUpdate = useCallback(
    (updatedEdge: WorkflowEdge) => {
      setEdges((eds) => {
        const updatedEdges = eds.map(e => 
          e.id === updatedEdge.id 
            ? {
                ...e,
                label: updatedEdge.condition
              }
            : e
        );
        return updatedEdges;
      });
    },
    [setEdges, nodes]
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
          onEdgeDoubleClick={onEdgeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          nodeTypes={{}}
        >
          <Background variant="dots" gap={20} />
          <Controls />
        </ReactFlow>
        
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onEditNode={handleContextMenuEditNode}
            onEditEdge={handleContextMenuEditEdge}
            onDeleteNode={handleContextMenuDeleteNode}
            onDeleteEdge={handleContextMenuDeleteEdge}
            selectedNode={contextMenu.node}
            selectedEdge={contextMenu.edge}
          />
        )}
        
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
        
        {isEdgeEditorOpen && (
          <EdgeEditor
            edge={selectedEdge}
            onEdgeUpdate={handleEdgeUpdate}
            onClose={() => {
              setIsEdgeEditorOpen(false);
              setSelectedEdge(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
