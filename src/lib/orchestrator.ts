import { db } from "@/db";
import { characters, locations, memories, stories, relationships, items } from "@/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { arbitrateAction, generateNewLocation, injectEvent } from "./director";
import { generateCharacterResponse } from "./character";
import { retrieveRelevantLore, retrieveRelevantMemories, consolidateScene } from "./memory";
import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

interface TickInput {
  storyId: string;
  playerInput: string; // Speech or action from player, or empty if player clicked "Wait"
  actionType: "speech" | "action" | "wait";
}

interface TickOutput {
  logs: { speaker: string; text: string; isSystem: boolean; id: string }[];
  currentLocationName: string;
  currentLocationDesc: string;
  asciiMap: string;
}

/**
 * Executes a single logical simulation tick.
 * Process:
 * 1. Process player speech/action
 * 2. Select next NPC to act/respond
 * 3. Run background updates for off-screen NPCs
 */
export async function executeTick(input: TickInput): Promise<TickOutput> {
  const { storyId, playerInput, actionType } = input;

  // 1. Fetch player & location state
  const player = await db.query.characters.findFirst({
    where: and(eq(characters.storyId, storyId), eq(characters.isPlayer, true)),
  });
  if (!player) throw new Error("Player character not found.");

  const playerLocId = player.locationId;
  if (!playerLocId) throw new Error("Player has no active location.");

  const loc = await db.query.locations.findFirst({
    where: eq(locations.id, playerLocId),
  });
  if (!loc) throw new Error("Location not found.");

  // 2. Fetch recent dialogue logs in this room (sensory envelope)
  const recentLogs = await db.query.memories.findMany({
    where: and(eq(memories.storyId, storyId), eq(memories.type, "event")),
    orderBy: [desc(memories.createdAt)],
    limit: 15,
  });
  // Sort chronologically
  recentLogs.reverse();

  // A. Process Player input
  let playerLogText = "";
  if (actionType === "speech" && playerInput.trim()) {
    playerLogText = `${player.name}: [Speech] "${playerInput}"`;
    await db.insert(memories).values({
      storyId,
      characterId: player.id,
      content: playerLogText,
      type: "event",
    });
  } else if (actionType === "action" && playerInput.trim()) {
    // Arbitrate player's action
    const outcome = await arbitrateAction(storyId, player.name, true, playerInput, playerLocId);
    playerLogText = outcome;
  } else if (actionType === "wait") {
    playerLogText = `[System] You wait quietly, observing your surroundings.`;
    await db.insert(memories).values({
      storyId,
      characterId: player.id,
      content: playerLogText,
      type: "event",
    });
  }

  // Reload logs including player input
  const updatedLogs = await db.query.memories.findMany({
    where: and(eq(memories.storyId, storyId), eq(memories.type, "event")),
    orderBy: [desc(memories.createdAt)],
    limit: 15,
  });
  updatedLogs.reverse();

  const formattedDialogue = updatedLogs.map((l) => {
    const parts = l.content.split(": ");
    const speaker = parts[0] || "System";
    const text = parts.slice(1).join(": ") || l.content;
    return { speakerName: speaker, text };
  });

  // B. Trigger NPCs in the same room
  const NPCsInRoom = await db.query.characters.findMany({
    where: and(
      eq(characters.locationId, playerLocId),
      eq(characters.isPlayer, false)
    ),
  });

  let npcResponseText = "";
  if (NPCsInRoom.length > 0) {
    // Select an NPC to respond (simplistic scheduler: random or priority)
    // In a real game we can cycle them, let's pick one randomly for this tick
    const activeNpc = NPCsInRoom[Math.floor(Math.random() * NPCsInRoom.length)];

    // Fetch memory & lore triggers
    const dialogueStr = updatedLogs.map((l) => l.content).join(" ");
    const retrievedMemories = await retrieveRelevantMemories(storyId, activeNpc.id, dialogueStr);
    const retrievedLore = await retrieveRelevantLore(storyId, dialogueStr, loc.name);

    // Call Character Agent
    const npcRes = await generateCharacterResponse(
      storyId,
      activeNpc.id,
      playerLocId,
      formattedDialogue,
      retrievedMemories,
      retrievedLore
    );

    npcResponseText = `${activeNpc.name}: ${npcRes.publicOutput}`;

    // If NPC proposed an action, arbitrate it!
    if (npcRes.publicOutput.startsWith("[Action]")) {
      const npcActionStr = npcRes.publicOutput.replace("[Action]", "").trim();
      const outcome = await arbitrateAction(storyId, activeNpc.name, false, npcActionStr, playerLocId);
      npcResponseText = outcome;
    }
  } else {
    // If no NPCs, GM might inject an environment event
    // 20% chance or if silent
    if (Math.random() < 0.3) {
      npcResponseText = await injectEvent(storyId, playerLocId);
    }
  }

  // C. Abstracted Background Sim Ticks (10% chance per tick)
  if (Math.random() < 0.1) {
    await simulateBackgroundCharacters(storyId, playerLocId);
  }

  // Fetch final logs to return to client
  const finalLogs = await db.query.memories.findMany({
    where: and(eq(memories.storyId, storyId), eq(memories.type, "event")),
    orderBy: [desc(memories.createdAt)],
    limit: 25,
  });
  finalLogs.reverse();

  return {
    logs: finalLogs.map((l) => {
      const isSystem = l.content.startsWith("[System]") || l.content.startsWith("[Event]") || l.content.startsWith("[Discovery]") || l.content.startsWith("[Starting Scene]");
      const parts = l.content.split(": ");
      const speaker = isSystem ? "System" : parts[0] || "System";
      const text = isSystem ? l.content : parts.slice(1).join(": ") || l.content;
      return { speaker, text, isSystem, id: l.id };
    }),
    currentLocationName: loc.name,
    currentLocationDesc: loc.description,
    asciiMap: "", // will compile in UI/routes
  };
}

/**
 * Triggers a location transition for the player
 */
export async function movePlayer(storyId: string, direction: string): Promise<void> {
  const player = await db.query.characters.findFirst({
    where: and(eq(characters.storyId, storyId), eq(characters.isPlayer, true)),
  });
  if (!player || !player.locationId) throw new Error("Player position not found.");

  const currentLoc = await db.query.locations.findFirst({
    where: eq(locations.id, player.locationId),
  });
  if (!currentLoc) throw new Error("Current location not found.");

  const conns = currentLoc.connections as Record<string, string>;
  let targetLocId = conns[direction];

  if (!targetLocId) {
    // Location doesn't exist, dynamically spawn it via the GM Cartographer!
    const newLocRow = await generateNewLocation(storyId, player.locationId, direction, "Exploring new coordinates");
    targetLocId = newLocRow.id;
  }

  // Trigger Scene Consolidation of the old room before leaving
  const rawLogs = await db.query.memories.findMany({
    where: and(eq(memories.storyId, storyId), eq(memories.type, "event")),
    orderBy: [desc(memories.createdAt)],
    limit: 20,
  });
  rawLogs.reverse();
  const rawLogString = rawLogs.map((l) => l.content).join("\n");

  await consolidateScene(storyId, rawLogString);

  // Update player location in database
  await db
    .update(characters)
    .set({ locationId: targetLocId })
    .where(eq(characters.id, player.id));
}

/**
 * Off-screen characters get simulated at a high level
 */
async function simulateBackgroundCharacters(storyId: string, playerLocId: string) {
  // Fetch all characters NOT in the player's room
  const offScreenChars = await db.query.characters.findMany({
    where: and(
      eq(characters.storyId, storyId),
      eq(characters.isPlayer, false),
      ne(characters.locationId, playerLocId)
    ),
  });

  if (offScreenChars.length === 0) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") return;
  const ai = new GoogleGenAI({ apiKey });

  for (const char of offScreenChars) {
    const loc = await db.query.locations.findFirst({
      where: eq(locations.id, char.locationId!),
    });

    const systemInstruction = `
      You are the Background Story Simulator.
      Simulate what ${char.name} does off-screen in location: ${loc?.name || "unknown"}.
      Based on their agenda: "${char.privateAgenda}", what is their immediate off-screen action or status update?
      Keep it to 1 sentence max. Format: "${char.name} ..."
    `;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: "Determine off-screen action.",
        config: { systemInstruction },
      });

      const updateText = response.text!.trim();

      // Write directly to character's memory diary (so they remember doing it!)
      await db.insert(memories).values({
        storyId,
        characterId: char.id,
        content: `[Off-screen Action] ${updateText}`,
        type: "diary",
      });
    } catch (err) {
      console.error(`Failed background sim for ${char.name}:`, err);
    }
  }
}
