import { db } from "@/db";
import { characters, locations, memories, stories, relationships, items } from "@/db/schema";
import { eq, and, desc, ne, inArray } from "drizzle-orm";
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
    // Select an NPC to respond (cycle or random)
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

    // If NPC proposed a raw action, arbitrate it
    if (npcRes.publicOutput.startsWith("[Action]")) {
      const npcActionStr = npcRes.publicOutput.replace("[Action]", "").trim();
      const outcome = await arbitrateAction(storyId, activeNpc.name, false, npcActionStr, playerLocId);
      npcResponseText = outcome;
    }
  } else {
    // If no NPCs, GM might inject an environment event (50% chance when alone)
    if (Math.random() < 0.5) {
      npcResponseText = await injectEvent(storyId, playerLocId);
    }
  }

  // C. Abstracted Background Sim Ticks
  // 100% chance if waiting, 50% chance otherwise to make off-screen characters wander and explore
  const backgroundSimChance = actionType === "wait" ? 1.0 : 0.5;
  if (Math.random() < backgroundSimChance) {
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
    asciiMap: "", // compiled in UI/routes
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
 * Off-screen characters get simulated at a high level and can move rooms
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
    if (!char.locationId) continue;

    const currentLoc = await db.query.locations.findFirst({
      where: eq(locations.id, char.locationId),
    });
    if (!currentLoc) continue;

    // Fetch adjacent locations
    const conns = (currentLoc.connections || {}) as Record<string, string>;
    const adjacentIds = Object.values(conns);
    
    let adjacentLocs: { id: string; name: string }[] = [];
    if (adjacentIds.length > 0) {
      adjacentLocs = await db.query.locations.findMany({
        where: inArray(locations.id, adjacentIds),
        columns: {
          id: true,
          name: true,
        },
      });
    }
    const adjacentRoomNames = adjacentLocs.map((l) => l.name);

    const systemInstruction = `
      You are the Background Story Simulator.
      Simulate what NPC ${char.name} does off-screen in location: ${currentLoc.name} (${currentLoc.description}).
      Adjacent connected rooms they can walk to: ${adjacentRoomNames.join(", ") || "None"}.
      
      Based on their secret agenda: "${char.privateAgenda}", decide if they continue their current action, or walk to an adjacent room.
      You must output a JSON object containing:
      1. thought: 1-sentence inner thoughts.
      2. action: 1-sentence description of what they do. Format starting with their name, e.g. "${char.name} searches the desk..."
      3. moveToRoomName: The name of an adjacent room if they choose to walk there. Otherwise set to null.
    `;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: "Determine off-screen action.",
        config: { 
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              thought: { type: "STRING" },
              action: { type: "STRING" },
              moveToRoomName: { type: "STRING", nullable: true },
            },
            required: ["thought", "action", "moveToRoomName"],
          },
        },
      });

      const parsed = JSON.parse(response.text!) as { thought: string; action: string; moveToRoomName: string | null };

      // Write directly to character's diary
      await db.insert(memories).values({
        storyId,
        characterId: char.id,
        content: `[Off-screen Thought] ${parsed.thought}\n[Off-screen Action] ${parsed.action}`,
        type: "diary",
      });

      // Handle room transition
      if (parsed.moveToRoomName && adjacentRoomNames.includes(parsed.moveToRoomName)) {
        const targetRoom = adjacentLocs.find((l) => l.name === parsed.moveToRoomName);
        if (targetRoom) {
          // Update DB location
          await db
            .update(characters)
            .set({ locationId: targetRoom.id })
            .where(eq(characters.id, char.id));

          // If the target room is the player's room, announce their arrival!
          if (targetRoom.id === playerLocId) {
            await db.insert(memories).values({
              storyId,
              characterId: null,
              content: `[Event] ${char.name} enters the room from the ${currentLoc.name}.`,
              type: "event",
            });
          }
        }
      }
    } catch (err) {
      console.error(`Failed background sim for ${char.name}:`, err);
    }
  }
}
