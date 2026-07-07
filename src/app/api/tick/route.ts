import { NextResponse } from "next/server";
import { db } from "@/db";
import { characters, locations, memories, relationships, items } from "@/db/schema";
import { executeTick, movePlayer } from "@/lib/orchestrator";
import { compileAsciiMap } from "@/lib/asciiCompiler";
import { eq, and, desc, ne } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storyId, actionType, text, direction, memoryId, newText } = body;

    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    // 1. Process Actions
    if (actionType === "move") {
      if (!direction) return NextResponse.json({ error: "Missing direction" }, { status: 400 });
      await movePlayer(storyId, direction);
    } else if (actionType === "speech" || actionType === "action" || actionType === "wait") {
      await executeTick({ storyId, playerInput: text || "", actionType });
    } else if (actionType === "undo") {
      // Delete the last 2 event logs (Player input and NPC response) to step back one turn
      const lastLogs = await db.query.memories.findMany({
        where: and(eq(memories.storyId, storyId), eq(memories.type, "event")),
        orderBy: [desc(memories.createdAt)],
        limit: 2,
      });
      for (const log of lastLogs) {
        await db.delete(memories).where(eq(memories.id, log.id));
      }
    } else if (actionType === "reroll") {
      // Delete the very last event log (which should be the last NPC/GM response)
      const lastLogs = await db.query.memories.findMany({
        where: and(eq(memories.storyId, storyId), eq(memories.type, "event")),
        orderBy: [desc(memories.createdAt)],
        limit: 1,
      });
      if (lastLogs[0]) {
        await db.delete(memories).where(eq(memories.id, lastLogs[0].id));
      }
      // Re-trigger an NPC turn by executing a wait tick
      await executeTick({ storyId, playerInput: "", actionType: "wait" });
    } else if (actionType === "edit") {
      if (!memoryId || !newText) {
        return NextResponse.json({ error: "Missing memoryId or newText" }, { status: 400 });
      }
      await db.update(memories).set({ content: newText }).where(eq(memories.id, memoryId));
    }

    // 2. Fetch Updated State to return to the UI
    const player = await db.query.characters.findFirst({
      where: and(eq(characters.storyId, storyId), eq(characters.isPlayer, true)),
    });
    if (!player || !player.locationId) {
      return NextResponse.json({ error: "Player state not initialized" }, { status: 500 });
    }

    const currentLoc = await db.query.locations.findFirst({
      where: eq(locations.id, player.locationId),
    });

    const allLocs = await db.query.locations.findMany({
      where: eq(locations.storyId, storyId),
    });

    const allChars = await db.query.characters.findMany({
      where: eq(characters.storyId, storyId),
    });

    // Compile the ASCII map
    const asciiMap = compileAsciiMap(allLocs, player.locationId, allChars);

    // Fetch logs (last 25 event logs)
    const eventLogs = await db.query.memories.findMany({
      where: and(eq(memories.storyId, storyId), eq(memories.type, "event")),
      orderBy: [desc(memories.createdAt)],
      limit: 25,
    });
    eventLogs.reverse();

    const formattedLogs = eventLogs.map((l) => {
      const isSystem =
        l.content.startsWith("[System]") ||
        l.content.startsWith("[Event]") ||
        l.content.startsWith("[Discovery]") ||
        l.content.startsWith("[Starting Scene]");
      const parts = l.content.split(": ");
      const speaker = isSystem ? "System" : parts[0] || "System";
      const text = isSystem ? l.content : parts.slice(1).join(": ") || l.content;
      return { id: l.id, speaker, text, isSystem };
    });

    // Fetch character relationship values (from NPCs to Player)
    const castRels = await db.query.relationships.findMany({
      where: and(
        eq(relationships.storyId, storyId),
        eq(relationships.targetCharacterId, player.id)
      ),
    });

    const castDetails = [];
    for (const rel of castRels) {
      const npc = allChars.find((c) => c.id === rel.sourceCharacterId);
      if (npc) {
        castDetails.push({
          id: npc.id,
          name: npc.name,
          publicBio: npc.publicBio,
          status: npc.status,
          locationName: allLocs.find((l) => l.id === npc.locationId)?.name || "Unknown",
          trust: rel.trust,
          hostility: rel.hostility,
          suspicion: rel.suspicion,
          isPlayerInRoom: npc.locationId === player.locationId,
        });
      }
    }

    // Fetch items present in player's room
    const roomItems = await db.query.items.findMany({
      where: and(eq(items.storyId, storyId), eq(items.locationId, player.locationId)),
    });

    // Fetch player inventory
    const inventory = await db.query.items.findMany({
      where: and(eq(items.storyId, storyId), eq(items.characterId, player.id)),
    });

    // Fetch Director Console Logs (private diary memories of NPCs, and player's private logs)
    const directorLogs = await db.query.memories.findMany({
      where: and(eq(memories.storyId, storyId), eq(memories.type, "diary")),
      orderBy: [desc(memories.createdAt)],
      limit: 15,
    });

    const formattedDirectorLogs = directorLogs.map((l) => {
      const charName = allChars.find((c) => c.id === l.characterId)?.name || "System";
      return {
        id: l.id,
        charName,
        content: l.content.replace("[Thoughts]", "").replace("[Off-screen Action]", "").trim(),
        createdAt: l.createdAt,
      };
    });

    return NextResponse.json({
      logs: formattedLogs,
      currentLocationName: currentLoc?.name || "Unknown",
      currentLocationDesc: currentLoc?.description || "",
      sensoryTags: currentLoc?.sensoryTags || [],
      asciiMap,
      cast: castDetails,
      roomItems,
      inventory,
      playerStats: {
        name: player.name,
        bio: player.publicBio,
        status: player.status,
      },
      directorLogs: formattedDirectorLogs,
    });
  } catch (err: any) {
    console.error("Error executing tick:", err);
    return NextResponse.json({ error: err.message || "Failed to process tick." }, { status: 500 });
  }
}
