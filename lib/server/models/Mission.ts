import mongoose, { Schema, Document } from "mongoose";

export interface ILogEvent {
  ts: number;
  level: "info" | "success" | "warning" | "error" | "debug";
  message: string;
  nodeId?: string;
}

export interface IMission extends Document {
  missionId: string;
  workflowId?: mongoose.Types.ObjectId;
  workflowSnapshot: {
    name: string;
    nodes: Array<{
      id: string;
      type: string;
      label: string;
      params?: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      from: string;
      to: string;
      condition?: string | null;
    }>;
  };
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  currentNode?: string;
  logs: ILogEvent[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LogEventSchema = new Schema<ILogEvent>(
  {
    ts: { type: Number, required: true },
    level: {
      type: String,
      enum: ["info", "success", "warning", "error", "debug"],
      required: true
    },
    message: { type: String, required: true },
    nodeId: { type: String }
  },
  { _id: false }
);

const MissionSchema = new Schema<IMission>(
  {
    missionId: { type: String, required: true, unique: true, index: true },
    workflowId: { type: Schema.Types.ObjectId, ref: "Workflow" },
    workflowSnapshot: {
      name: { type: String, required: true },
      nodes: { type: [Schema.Types.Mixed], default: [] },
      edges: { type: [Schema.Types.Mixed], default: [] }
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "cancelled"],
      default: "pending"
    },
    progress: { type: Number, default: 0 },
    currentNode: { type: String },
    logs: { type: [LogEventSchema], default: [] },
    startedAt: { type: Date },
    completedAt: { type: Date }
  },
  { timestamps: true }
);

export const Mission =
  mongoose.models.Mission || mongoose.model<IMission>("Mission", MissionSchema);
