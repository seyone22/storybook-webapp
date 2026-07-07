import { NextResponse } from "next/server";
import { generateWorld } from "@/lib/director";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const storyId = await generateWorld(prompt);
    return NextResponse.json({ storyId });
  } catch (err: any) {
    console.error("Error creating world:", err);
    return NextResponse.json({ error: err.message || "Failed to initialize world." }, { status: 500 });
  }
}
