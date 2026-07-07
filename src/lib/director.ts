import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { stories, locations, characters, relationships, memories, items } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("Missing valid GEMINI_API_KEY in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
}

// Interfaces for structured output
interface GeneratedWorld {
  title: string;
  description: string;
  player: {
    name: string;
    age: number;
    looks: string;
    skills: string[];
    status: string[];
  };
  locations: {
    name: string;
    description: string;
    sensoryTags: string[];
    coordinates: { x: number; y: number };
    connections: Record<string, string>; // e.g., { e: "Courtyard", w: "Library" }
  }[];
  characters: {
    name: string;
    publicBio: string;
    privateAgenda: string;
    dialogueStyle: string;
    startingLocationName: string;
  }[];
  items: {
    name: string;
    description: string;
    startingLocationName: string;
  }[];
  relationships: {
    sourceName: string;
    targetName: string;
    trust: number;
    hostility: number;
    suspicion: number;
  }[];
  initialDirectorGoals: string[];
}

/**
 * Phase 1: Initialize Story World from a single prompt
 */
export async function generateWorld(userPrompt: string): Promise<string> {
  const ai = getGenAI();

  const systemInstruction = `
    You are the Lead Narrative Architect. Convert the user's roleplay prompt into a structured, highly coherent Storybook World Package in JSON.
    Expand the lore details, design interesting adjacent locations with grid coordinates (x, y), create rich characters with distinct public profiles, private motives/secrets, and speech styles, and invent active Director Quests.
    Ensure that:
    1. At least one character is Alice the maid if mentioned, or another key character.
    2. Starting coordinates (0,0) must represent the player's starting room.
    3. Grid coordinates of adjacent locations must connect correctly (e.g. if room B is 'e' of A(0,0), B's coordinates must be (1,0)).
    4. One character is marked as the player's profile based on the prompt.
    5. Private agendas must contain hidden goals and secrets that the character will NOT reveal easily.
    6. Return a valid JSON adhering strictly to the schema.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Initialize a story world based on this prompt:\n"${userPrompt}"`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          player: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              age: { type: "INTEGER" },
              looks: { type: "STRING" },
              skills: { type: "ARRAY", items: { type: "STRING" } },
              status: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["name", "age", "looks", "skills", "status"],
          },
          locations: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                description: { type: "STRING" },
                sensoryTags: { type: "ARRAY", items: { type: "STRING" } },
                coordinates: {
                  type: "OBJECT",
                  properties: {
                    x: { type: "INTEGER" },
                    y: { type: "INTEGER" },
                  },
                  required: ["x", "y"],
                },
                connections: {
                  type: "OBJECT",
                  properties: {
                    n: { type: "STRING" },
                    s: { type: "STRING" },
                    e: { type: "STRING" },
                    w: { type: "STRING" },
                    u: { type: "STRING" },
                    d: { type: "STRING" },
                  },
                },
              },
              required: ["name", "description", "sensoryTags", "coordinates", "connections"],
            },
          },
          characters: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                publicBio: { type: "STRING" },
                privateAgenda: { type: "STRING" },
                dialogueStyle: { type: "STRING" },
                startingLocationName: { type: "STRING" },
              },
              required: ["name", "publicBio", "privateAgenda", "dialogueStyle", "startingLocationName"],
            },
          },
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                description: { type: "STRING" },
                startingLocationName: { type: "STRING" },
              },
              required: ["name", "description", "startingLocationName"],
            },
          },
          relationships: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                sourceName: { type: "STRING" },
                targetName: { type: "STRING" },
                trust: { type: "INTEGER" },
                hostility: { type: "INTEGER" },
                suspicion: { type: "INTEGER" },
              },
              required: ["sourceName", "targetName", "trust", "hostility", "suspicion"],
            },
          },
          initialDirectorGoals: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["title", "description", "player", "locations", "characters", "items", "relationships", "initialDirectorGoals"],
      },
    },
  });

  const parsed = JSON.parse(response.text!) as GeneratedWorld;

  // Insert into Database
  return await db.transaction(async (tx) => {
    // 1. Create Story
    const [storyRow] = await tx
      .insert(stories)
      .values({
        title: parsed.title,
        description: parsed.description,
      })
      .returning();

    const storyId = storyRow.id;

    // 2. Insert Locations
    const locationMap = new Map<string, string>(); // Name -> DB UUID
    for (const loc of parsed.locations) {
      const [locRow] = await tx
        .insert(locations)
        .values({
          storyId,
          name: loc.name,
          description: loc.description,
          sensoryTags: loc.sensoryTags,
          coordinates: loc.coordinates,
          connections: {}, // will map IDs in a second pass
        })
        .returning();
      locationMap.set(loc.name, locRow.id);
    }

    // Update connection references using database UUIDs instead of text names
    for (const loc of parsed.locations) {
      const dbId = locationMap.get(loc.name)!;
      const mappedConns: Record<string, string> = {};
      Object.entries(loc.connections).forEach(([dir, targetName]) => {
        const targetId = locationMap.get(targetName);
        if (targetId) {
          mappedConns[dir] = targetId;
        }
      });
      await tx.update(locations).set({ connections: mappedConns }).where(eq(locations.id, dbId));
    }

    // 3. Create Player Character
    const startLocName = parsed.locations[0]?.name || "";
    const startLocId = locationMap.get(startLocName) || null;

    const [playerRow] = await tx
      .insert(characters)
      .values({
        storyId,
        locationId: startLocId,
        name: parsed.player.name,
        publicBio: `Age ${parsed.player.age}. Looks: ${parsed.player.looks}. Skills: ${parsed.player.skills.join(", ")}`,
        privateAgenda: "Survive and pursue personal interests.",
        dialogueStyle: "Speaks naturally based on user input.",
        isPlayer: true,
        status: parsed.player.status,
      })
      .returning();

    const characterMap = new Map<string, string>(); // Name -> Character UUID
    characterMap.set(parsed.player.name, playerRow.id);

    // 4. Create NPC Characters
    for (const npc of parsed.characters) {
      const npcLocId = locationMap.get(npc.startingLocationName) || startLocId;
      const [npcRow] = await tx
        .insert(characters)
        .values({
          storyId,
          locationId: npcLocId,
          name: npc.name,
          publicBio: npc.publicBio,
          privateAgenda: npc.privateAgenda,
          dialogueStyle: npc.dialogueStyle,
          isPlayer: false,
          status: ["healthy"],
        })
        .returning();
      characterMap.set(npc.name, npcRow.id);
    }

    // 5. Create Items
    for (const item of parsed.items) {
      const itemLocId = locationMap.get(item.startingLocationName) || null;
      await tx.insert(items).values({
        storyId,
        locationId: itemLocId,
        characterId: null, // starting on ground
        name: item.name,
        description: item.description,
      });
    }

    // 6. Create Relationships
    for (const rel of parsed.relationships) {
      const srcId = characterMap.get(rel.sourceName);
      const tgtId = characterMap.get(rel.targetName);
      if (srcId && tgtId) {
        await tx.insert(relationships).values({
          storyId,
          sourceCharacterId: srcId,
          targetCharacterId: tgtId,
          trust: rel.trust,
          hostility: rel.hostility,
          suspicion: rel.suspicion,
        });
      }
    }

    // 7. Write Initial Director Goals as a System Event Memory
    const goalSummary = `Initial Director Quests:\n` + parsed.initialDirectorGoals.map((g) => `- ${g}`).join("\n");
    await tx.insert(memories).values({
      storyId,
      characterId: null, // GM
      content: goalSummary,
      type: "event",
    });

    // Write starting scene description as first event log
    const startLoc = parsed.locations[0];
    const initialText = `[Starting Scene: ${startLoc.name}]\n${startLoc.description}\nSensory: ${startLoc.sensoryTags.join(", ")}`;
    await tx.insert(memories).values({
      storyId,
      characterId: null, // GM
      content: initialText,
      type: "event",
    });

    return storyId;
  });
}

/**
 * Phase 2: Action Arbitration (No God-Moding)
 */
export async function arbitrateAction(
  storyId: string,
  proposingCharName: string,
  isPlayer: boolean,
  actionIntention: string,
  currentLocationId: string
): Promise<string> {
  const ai = getGenAI();

  // Fetch location state, items, and character statuses to give context to GM
  const locationRow = await db.query.locations.findFirst({
    where: eq(locations.id, currentLocationId),
  });
  const roomItems = await db.query.items.findMany({
    where: eq(items.locationId, currentLocationId),
  });
  const charsInRoom = await db.query.characters.findMany({
    where: eq(characters.locationId, currentLocationId),
  });

  const roomState = `
    Location: ${locationRow?.name}
    Description: ${locationRow?.description}
    Items present in room: ${roomItems.map((i) => i.name).join(", ") || "None"}
    Characters present: ${charsInRoom.map((c) => `${c.name} (Status: ${c.status.join(", ")})`).join(", ")}
  `;

  const systemInstruction = `
    You are the Game Master (GM) Arbiter. The user is in a multi-agent roleplay environment.
    You must evaluate a proposed physical or complex action from a character and determine the realistic outcome.
    
    RULES:
    1. Do NOT write dialogue. Only describe the physical result, environmental changes, or immediate physical reaction.
    2. Characters cannot guarantee success. Evaluate their skills and status.
    3. Keep descriptions punchy, immersive, and sensory.
    4. Format your response starting with "[System] ".
    
    Example:
    Intention: Lyra tries to pick the lock of the chest.
    Output: [System] Lyra crouches by the iron chest and slips in her lockpick. With a metallic snap, the pick breaks inside the keyhole. The chest remains locked, but the sharp noise echoes through the quiet room.
  `;

  const prompt = `
    Room Context:
    ${roomState}

    Character acting: ${proposingCharName} (Is Player: ${isPlayer})
    Intention: "${actionIntention}"

    Determine and output the resolved action outcome.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { systemInstruction },
  });

  const outcome = response.text!.trim();

  // Save the system arbitration outcome as a global event memory
  await db.insert(memories).values({
    storyId,
    characterId: null,
    content: outcome,
    type: "event",
  });

  return outcome;
}

/**
 * Phase 3: Dynamic Procedural Room Expansion
 */
export async function generateNewLocation(
  storyId: string,
  parentLocationId: string,
  direction: string, // n, s, e, w, u, d
  explorationDetails: string
): Promise<any> {
  const ai = getGenAI();

  // Fetch parent location details
  const parentLoc = await db.query.locations.findFirst({
    where: eq(locations.id, parentLocationId),
  });
  if (!parentLoc) throw new Error("Parent location not found.");

  // Fetch overall story info to maintain lore compliance
  const storyRow = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });

  const oppositeDirs: Record<string, string> = {
    n: "s",
    s: "n",
    e: "w",
    w: "e",
    u: "d",
    d: "u",
  };

  const systemInstruction = `
    You are the World Cartographer. The player is exploring an undefined area.
    Based on the world lore and parent room context, generate a new adjacent location.
    
    Lore context: ${storyRow?.title} - ${storyRow?.description}
    Parent Location: ${parentLoc.name} (${parentLoc.description})
    Direction from parent: ${direction}
    Player description/intention: "${explorationDetails}"
    
    You must output a JSON structure containing:
    1. name: A short, immersive room name.
    2. description: Atmospheric, detailed description.
    3. sensoryTags: Array of 3-4 sensory items (smells, sounds, lighting).
    
    Ensure it aligns perfectly with the lore. Keep it creative!
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: "Generate the new location.",
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          description: { type: "STRING" },
          sensoryTags: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["name", "description", "sensoryTags"],
      },
    },
  });

  const parsed = JSON.parse(response.text!) as {
    name: string;
    description: string;
    sensoryTags: string[];
  };

  // Determine coordinates based on direction
  const pCoords = parentLoc.coordinates;
  const newCoords = { ...pCoords };
  if (direction === "n") newCoords.y -= 1;
  else if (direction === "s") newCoords.y += 1;
  else if (direction === "e") newCoords.x += 1;
  else if (direction === "w") newCoords.x -= 1;

  // Insert location into Database
  return await db.transaction(async (tx) => {
    const oppositeDir = oppositeDirs[direction] || "n";

    // 1. Create location
    const [newLocRow] = await tx
      .insert(locations)
      .values({
        storyId,
        name: parsed.name,
        description: parsed.description,
        sensoryTags: parsed.sensoryTags,
        coordinates: newCoords,
        connections: {
          [oppositeDir]: parentLocationId,
        },
      })
      .returning();

    // 2. Link parent location to this new location
    const updatedParentConns = {
      ...(parentLoc.connections as Record<string, string>),
      [direction]: newLocRow.id,
    };
    await tx
      .update(locations)
      .set({ connections: updatedParentConns })
      .where(eq(locations.id, parentLocationId));

    // 3. Log the discovery as an event
    const logText = `[Discovery] You move ${direction.toUpperCase()} and enter ${parsed.name}. ${parsed.description}`;
    await tx.insert(memories).values({
      storyId,
      characterId: null,
      content: logText,
      type: "event",
    });

    return newLocRow;
  });
}

/**
 * Phase 4: Event Injector
 */
export async function injectEvent(storyId: string, currentLocationId: string): Promise<string> {
  const ai = getGenAI();

  const locationRow = await db.query.locations.findFirst({
    where: eq(locations.id, currentLocationId),
  });
  const activeChars = await db.query.characters.findMany({
    where: eq(characters.locationId, currentLocationId),
  });

  const systemInstruction = `
    You are the Game Master Event Injector. The story conversation has stalled.
    You must inject a minor dynamic event, NPC action, or environmental change to break the stall and force a reaction.
    
    RULES:
    1. Keep it brief (2-3 sentences max).
    2. Focus on action: a sudden noise, an NPC acting on their agenda, a physical shift, or a message arrival.
    3. Format starting with "[Event] ".
  `;

  const prompt = `
    Location: ${locationRow?.name}
    Active Characters: ${activeChars.map((c) => c.name).join(", ")}
    Inject a prompt event.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { systemInstruction },
  });

  const eventText = response.text!.trim();

  // Save the event log
  await db.insert(memories).values({
    storyId,
    characterId: null,
    content: eventText,
    type: "event",
  });

  return eventText;
}
