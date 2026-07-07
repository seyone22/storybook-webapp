import { NextResponse } from "next/server";
import { draftWorld, saveWorldTemplate, instantiatePlaythrough } from "@/lib/director";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "draft") {
      const { prompt } = body;
      if (!prompt || typeof prompt !== "string") {
        return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
      }
      const draft = await draftWorld(prompt);
      return NextResponse.json({ draft });
    }

    if (action === "save_template") {
      const { draft } = body;
      if (!draft) {
        return NextResponse.json({ error: "Missing draft data" }, { status: 400 });
      }
      const templateStoryId = await saveWorldTemplate(draft);
      return NextResponse.json({ templateStoryId });
    }

    if (action === "instantiate") {
      const { templateStoryId, customPlayer } = body;
      if (!templateStoryId || !customPlayer) {
        return NextResponse.json({ error: "Missing templateStoryId or customPlayer details" }, { status: 400 });
      }
      const storyId = await instantiatePlaythrough(templateStoryId, customPlayer);
      return NextResponse.json({ storyId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("Error in world API route:", err);
    return NextResponse.json({ error: err.message || "Operation failed." }, { status: 500 });
  }
}
