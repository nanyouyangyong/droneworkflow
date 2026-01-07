import mongoose, { Schema, Document } from "mongoose";

export interface IWorkflowNode {
  id: string;
  type: string;
  label: string;
  params?: Record<string, unknown>;
}

export interface IWorkflowEdge {
  id: string;
  from: string;
  to: string;
  condition?: string | null;
}

export interface IWorkflow extends Document {
  name: string;
  description?: string;
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowNodeSchema = new Schema<IWorkflowNode>(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    label: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const WorkflowEdgeSchema = new Schema<IWorkflowEdge>(
  {
    id: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    condition: { type: String, default: null }
  },
  { _id: false }
);

const WorkflowSchema = new Schema<IWorkflow>(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    nodes: { type: [WorkflowNodeSchema], default: [] },
    edges: { type: [WorkflowEdgeSchema], default: [] }
  },
  { timestamps: true }
);

export const Workflow =
  mongoose.models.Workflow || mongoose.model<IWorkflow>("Workflow", WorkflowSchema);
