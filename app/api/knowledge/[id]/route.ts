import { connectDB } from "@/lib/server/db";
import { KnowledgeDoc } from "@/lib/server/models/KnowledgeDoc";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// PUT /api/knowledge/[id] — 更新文档
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id } = params;
    const body = await req.json();
    const { title, content, category, tags, metadata } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) {
      const validCategories = ["regulation", "operation", "template", "param_guide"];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: `category must be one of: ${validCategories.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.category = category;
    }
    if (tags !== undefined) updateData.tags = tags;
    if (metadata !== undefined) updateData.metadata = metadata;

    const doc = await KnowledgeDoc.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    }).select("-embedding");

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ doc, message: "Document updated" });
  } catch (error: any) {
    console.error("PUT /api/knowledge/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/knowledge/[id] — 删除文档
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id } = params;
    const doc = await KnowledgeDoc.findByIdAndDelete(id);

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Document deleted" });
  } catch (error: any) {
    console.error("DELETE /api/knowledge/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/knowledge/[id] — 获取单个文档
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id } = params;
    const doc = await KnowledgeDoc.findById(id).select("-embedding").lean();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ doc });
  } catch (error: any) {
    console.error("GET /api/knowledge/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
