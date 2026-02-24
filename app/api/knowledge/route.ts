import { connectDB } from "@/lib/server/db";
import { KnowledgeDoc } from "@/lib/server/models/KnowledgeDoc";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/knowledge — 获取知识库文档列表
export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const keyword = searchParams.get("keyword");

    const query: Record<string, unknown> = {};
    if (category) query.category = category;
    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { content: { $regex: keyword, $options: "i" } },
        { tags: { $in: [keyword] } }
      ];
    }

    const docs = await KnowledgeDoc.find(query)
      .select("-embedding")
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ docs, total: docs.length });
  } catch (error: any) {
    console.error("GET /api/knowledge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/knowledge — 添加知识库文档
export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const { title, content, category, tags, metadata } = body;

    if (!title || !content || !category) {
      return NextResponse.json(
        { error: "title, content, category are required" },
        { status: 400 }
      );
    }

    const validCategories = ["regulation", "operation", "template", "param_guide"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    const doc = await KnowledgeDoc.create({
      title,
      content,
      category,
      tags: tags || [],
      metadata: metadata || {}
    });

    return NextResponse.json({ doc, message: "Document created" }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/knowledge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
