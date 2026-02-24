import mongoose, { Schema, Document } from "mongoose";

export interface IKnowledgeDoc extends Document {
  title: string;
  content: string;
  category: "regulation" | "operation" | "template" | "param_guide";
  tags: string[];
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeDocSchema = new Schema<IKnowledgeDoc>(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ["regulation", "operation", "template", "param_guide"],
      required: true
    },
    tags: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    embedding: { type: [Number], default: undefined }
  },
  { timestamps: true }
);

KnowledgeDocSchema.index({ title: "text", content: "text" });
KnowledgeDocSchema.index({ category: 1 });
KnowledgeDocSchema.index({ tags: 1 });

export const KnowledgeDoc =
  mongoose.models.KnowledgeDoc ||
  mongoose.model<IKnowledgeDoc>("KnowledgeDoc", KnowledgeDocSchema);
