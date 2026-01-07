import mongoose, { Schema, Document } from "mongoose";

export interface IChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
}

export interface IChatHistory extends Document {
  sessionId: string;
  messages: IChatMessage[];
  workflowId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true
    },
    content: { type: String, required: true },
    ts: { type: Number, required: true }
  },
  { _id: false }
);

const ChatHistorySchema = new Schema<IChatHistory>(
  {
    sessionId: { type: String, required: true, index: true },
    messages: { type: [ChatMessageSchema], default: [] },
    workflowId: { type: Schema.Types.ObjectId, ref: "Workflow" }
  },
  { timestamps: true }
);

export const ChatHistory =
  mongoose.models.ChatHistory ||
  mongoose.model<IChatHistory>("ChatHistory", ChatHistorySchema);
