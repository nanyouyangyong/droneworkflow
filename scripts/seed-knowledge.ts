import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态导入 Model（避免循环依赖）
async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/droneworkflow";
  console.log(`Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);
  console.log("MongoDB connected.");

  // 手动定义 Schema（避免路径别名问题）
  const KnowledgeDocSchema = new mongoose.Schema(
    {
      title: { type: String, required: true },
      content: { type: String, required: true },
      category: {
        type: String,
        enum: ["regulation", "operation", "template", "param_guide"],
        required: true
      },
      tags: { type: [String], default: [] },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
      embedding: { type: [Number], default: undefined }
    },
    { timestamps: true }
  );

  KnowledgeDocSchema.index({ title: "text", content: "text" });

  const KnowledgeDoc =
    mongoose.models.KnowledgeDoc ||
    mongoose.model("KnowledgeDoc", KnowledgeDocSchema);

  const knowledgeDir = path.resolve(__dirname, "..", "data", "knowledge");

  if (!fs.existsSync(knowledgeDir)) {
    console.error(`Knowledge directory not found: ${knowledgeDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith(".md"));
  console.log(`Found ${files.length} knowledge files.`);

  const categoryMap: Record<string, string> = {
    "drone-operations": "operation",
    "flight-regulations": "regulation",
    "node-params-guide": "param_guide",
    "workflow-templates": "template"
  };

  let created = 0;
  let updated = 0;

  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const baseName = file.replace(/\.md$/, "");

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : baseName;
    const category = categoryMap[baseName] || "operation";

    const existing = await KnowledgeDoc.findOne({ title });

    if (existing) {
      existing.content = content;
      existing.category = category;
      await existing.save();
      console.log(`  Updated: ${title}`);
      updated++;
    } else {
      await KnowledgeDoc.create({
        title,
        content,
        category,
        tags: [baseName],
        metadata: { source: "seed", filePath: file }
      });
      console.log(`  Created: ${title}`);
      created++;
    }
  }

  console.log(`\nDone! Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
