import { connectDB } from "@/lib/server/db";
import { KnowledgeDoc } from "@/lib/server/models/KnowledgeDoc";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// POST /api/knowledge/seed — 从 data/knowledge/ 批量导入种子数据
export async function POST() {
  try {
    await connectDB();

    const knowledgeDir = path.resolve(process.cwd(), "data", "knowledge");

    if (!fs.existsSync(knowledgeDir)) {
      return NextResponse.json(
        { error: `Knowledge directory not found: ${knowledgeDir}` },
        { status: 404 }
      );
    }

    const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith(".md"));

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No .md files found in knowledge directory" },
        { status: 404 }
      );
    }

    const categoryMap: Record<string, string> = {
      "drone-operations": "operation",
      "flight-regulations": "regulation",
      "node-params-guide": "param_guide",
      "workflow-templates": "template"
    };

    const results: Array<{ file: string; action: string }> = [];

    for (const file of files) {
      const filePath = path.join(knowledgeDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const baseName = file.replace(/\.md$/, "");

      // 从文件内容提取标题（第一个 # 标题）
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : baseName;

      const category = categoryMap[baseName] || "operation";

      // 检查是否已存在同名文档
      const existing = await KnowledgeDoc.findOne({ title });

      if (existing) {
        // 更新已有文档
        existing.content = content;
        existing.category = category as any;
        await existing.save();
        results.push({ file, action: "updated" });
      } else {
        // 创建新文档
        await KnowledgeDoc.create({
          title,
          content,
          category,
          tags: [baseName],
          metadata: { source: "seed", filePath: file }
        });
        results.push({ file, action: "created" });
      }
    }

    return NextResponse.json({
      message: `Seeded ${results.length} knowledge documents`,
      results
    });
  } catch (error: any) {
    console.error("POST /api/knowledge/seed error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
