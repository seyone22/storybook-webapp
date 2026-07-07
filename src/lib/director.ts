import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { stories, locations, characters, relationships, memories, items } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

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
 * Step 1: Draft World from user scenario prompt (Gemini API)
 */
export async function draftWorld(userPrompt: string): Promise<GeneratedWorld & { lore: { keyword: string; content: string }[] }> {
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
    6. Generate a 'lore' list containing 4-5 core keyword-triggered world cards (e.g. magic system rules, family secrets, magical diseases like the 'White Death') matching topics from the prompt.
    7. Return a valid JSON adhering strictly to the schema.
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
          title: { type: "STRING", description: "Catchy title of the roleplay world" },
          description: { type: "STRING", description: "Brief setting summary, max 2 sentences" },
          player: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", description: "First name of the player character" },
              age: { type: "INTEGER", description: "Age of player character" },
              looks: { type: "STRING", description: "Short appearance description, max 2 sentences" },
              skills: { type: "ARRAY", items: { type: "STRING" }, description: "3-4 key starting skills" },
              status: { type: "ARRAY", items: { type: "STRING" }, description: "Always ['healthy'] initially" },
            },
            required: ["name", "age", "looks", "skills", "status"],
          },
          locations: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Short room name, e.g. Private Chambers" },
                description: { type: "STRING", description: "Atmospheric room description, max 2 sentences" },
                sensoryTags: { type: "ARRAY", items: { type: "STRING" }, description: "3-4 words representing sights, sounds, or smells" },
                coordinates: {
                  type: "OBJECT",
                  properties: {
                    x: { type: "INTEGER", description: "Grid coordinate X relative to start room (0,0)" },
                    y: { type: "INTEGER", description: "Grid coordinate Y relative to start room (0,0)" },
                  },
                  required: ["x", "y"],
                },
                connections: {
                  type: "OBJECT",
                  properties: {
                    n: { type: "STRING", description: "Name of room to the North, if any" },
                    s: { type: "STRING", description: "Name of room to the South, if any" },
                    e: { type: "STRING", description: "Name of room to the East, if any" },
                    w: { type: "STRING", description: "Name of room to the West, if any" },
                    u: { type: "STRING", description: "Name of room Above, if any" },
                    d: { type: "STRING", description: "Name of room Below, if any" },
                  },
                },
              },
              required: ["name", "description", "sensoryTags", "coordinates", "connections"],
            },
            description: "List of 4-5 interconnected rooms, starting room MUST be at (0,0)"
          },
          characters: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "NPC name" },
                publicBio: { type: "STRING", description: "Public personality and appearance, max 2 sentences" },
                privateAgenda: { type: "STRING", description: "NPC secrets and private goals, max 2 sentences" },
                dialogueStyle: { type: "STRING", description: "Speech voice and quirks, e.g. soft-spoken, stuttering" },
                startingLocationName: { type: "STRING", description: "Name of room where this NPC starts" },
              },
              required: ["name", "publicBio", "privateAgenda", "dialogueStyle", "startingLocationName"],
            },
            description: "List of 2-3 key NPC characters in the manor/setting"
          },
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "Item name" },
                description: { type: "STRING", description: "Item look and purpose, max 1 sentence" },
                startingLocationName: { type: "STRING", description: "Room name where item lies on the ground" },
              },
              required: ["name", "description", "startingLocationName"],
            },
            description: "List of 3-4 interesting items scattered in the rooms"
          },
          relationships: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                sourceName: { type: "STRING", description: "Character name" },
                targetName: { type: "STRING", description: "Character name" },
                trust: { type: "INTEGER", description: "Initial trust score (0 to 100)" },
                hostility: { type: "INTEGER", description: "Initial hostility score (0 to 100)" },
                suspicion: { type: "INTEGER", description: "Initial suspicion score (0 to 100)" },
              },
              required: ["sourceName", "targetName", "trust", "hostility", "suspicion"],
            },
            description: "Initial relationship vectors between characters"
          },
          initialDirectorGoals: { 
            type: "ARRAY", 
            items: { type: "STRING" },
            description: "List of 3-4 initial story quests/mysteries to solve, max 1 sentence each" 
          },
          lore: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                keyword: { type: "STRING", description: "Lore topic, e.g. White Death, Magic System" },
                content: { type: "STRING", description: "Detailed lore paragraph for lookup, max 3 sentences" }
              },
              required: ["keyword", "content"]
            },
            description: "List of 4-5 key world elements or secrets matching the prompt"
          }
        },
        required: ["title", "description", "player", "locations", "characters", "items", "relationships", "initialDirectorGoals", "lore"],
      },
    },
  });

  return JSON.parse(response.text!) as GeneratedWorld & { lore: { keyword: string; content: string }[] };
}

/**
 * Step 2: Save the World Template JSON into the Database
 */
export async function saveWorldTemplate(
  parsed: GeneratedWorld & { lore: { keyword: string; content: string }[] }
): Promise<string> {
  return await db.transaction(async (tx) => {
    // 1. Create Story Template
    const [storyRow] = await tx
      .insert(stories)
      .values({
        title: parsed.title,
        description: parsed.description,
        lore: parsed.lore,
        isTemplate: true,
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
          connections: {}, // will map in a second pass
        })
        .returning();
      locationMap.set(loc.name, locRow.id);
    }

    // Update connection references using database UUIDs
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

    // 3. Create Template Player Character
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
        characterId: null,
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
      characterId: null,
      content: goalSummary,
      type: "event",
    });

    // Write starting scene description
    const startLoc = parsed.locations[0];
    const initialText = `[Starting Scene: ${startLoc.name}]\n${startLoc.description}\nSensory: ${startLoc.sensoryTags.join(", ")}`;
    await tx.insert(memories).values({
      storyId,
      characterId: null,
      content: initialText,
      type: "event",
    });

    return storyId;
  });
}

/**
 * Step 3: Instantiate Playthrough from a saved World Template and custom Player details
 */
export async function instantiatePlaythrough(
  templateStoryId: string,
  customPlayer: { name: string; age: number; looks: string; skills: string[] }
): Promise<string> {
  return await db.transaction(async (tx) => {
    // 1. Get Template Story
    const templateStory = await tx.query.stories.findFirst({
      where: eq(stories.id, templateStoryId),
    });
    if (!templateStory) throw new Error("Template story not found.");

    // 2. Insert new active story referencing parent
    const [activeStory] = await tx
      .insert(stories)
      .values({
        title: templateStory.title,
        description: templateStory.description,
        lore: templateStory.lore,
        isTemplate: false,
        parentTemplateId: templateStoryId,
      })
      .returning();

    const storyId = activeStory.id;

    // 3. Clone Locations
    const templateLocs = await tx.query.locations.findMany({
      where: eq(locations.storyId, templateStoryId),
    });

    const locationIdMap = new Map<string, string>(); // templateLocId -> activeLocId
    for (const loc of templateLocs) {
      const [newLoc] = await tx
        .insert(locations)
        .values({
          storyId,
          name: loc.name,
          description: loc.description,
          sensoryTags: loc.sensoryTags,
          coordinates: loc.coordinates,
          connections: {}, // mapped below
        })
        .returning();
      locationIdMap.set(loc.id, newLoc.id);
    }

    // Update connections
    for (const loc of templateLocs) {
      const activeLocId = locationIdMap.get(loc.id)!;
      const mappedConns: Record<string, string> = {};
      Object.entries(loc.connections as Record<string, string>).forEach(([dir, targetLocId]) => {
        const activeTargetId = locationIdMap.get(targetLocId);
        if (activeTargetId) {
          mappedConns[dir] = activeTargetId;
        }
      });
      await tx.update(locations).set({ connections: mappedConns }).where(eq(locations.id, activeLocId));
    }

    // 4. Clone Characters
    const templateChars = await tx.query.characters.findMany({
      where: eq(characters.storyId, templateStoryId),
    });

    const characterIdMap = new Map<string, string>(); // templateCharId -> activeCharId
    const nameMap = new Map<string, string>(); // templateName -> activeName
    
    for (const char of templateChars) {
      const activeLocId = char.locationId ? locationIdMap.get(char.locationId) || null : null;
      
      if (char.isPlayer) {
        // Instantiate custom player
        const [newPlayer] = await tx
          .insert(characters)
          .values({
            storyId,
            locationId: activeLocId,
            name: customPlayer.name,
            publicBio: `Age ${customPlayer.age}. Looks: ${customPlayer.looks}. Skills: ${customPlayer.skills.join(", ")}`,
            privateAgenda: "Survive and pursue personal interests.",
            dialogueStyle: "Speaks naturally based on user input.",
            isPlayer: true,
            status: ["healthy"],
          })
          .returning();
        characterIdMap.set(char.id, newPlayer.id);
        nameMap.set(char.name, customPlayer.name);
      } else {
        // Copy NPC
        const [newNpc] = await tx
          .insert(characters)
          .values({
            storyId,
            locationId: activeLocId,
            name: char.name,
            publicBio: char.publicBio,
            privateAgenda: char.privateAgenda,
            dialogueStyle: char.dialogueStyle,
            isPlayer: false,
            status: char.status,
          })
          .returning();
        characterIdMap.set(char.id, newNpc.id);
        nameMap.set(char.name, char.name);
      }
    }

    // 5. Clone Items
    const templateItems = await tx.query.items.findMany({
      where: eq(items.storyId, templateStoryId),
    });

    for (const item of templateItems) {
      const activeLocId = item.locationId ? locationIdMap.get(item.locationId) || null : null;
      const activeCharId = item.characterId ? characterIdMap.get(item.characterId) || null : null;

      await tx.insert(items).values({
        storyId,
        locationId: activeLocId,
        characterId: activeCharId,
        name: item.name,
        description: item.description,
      });
    }

    // 6. Clone Relationships
    const templateRels = await tx.query.relationships.findMany({
      where: eq(relationships.storyId, templateStoryId),
    });

    for (const rel of templateRels) {
      const activeSrcId = characterIdMap.get(rel.sourceCharacterId);
      const activeTgtId = characterIdMap.get(rel.targetCharacterId);

      if (activeSrcId && activeTgtId) {
        await tx.insert(relationships).values({
          storyId,
          sourceCharacterId: activeSrcId,
          targetCharacterId: activeTgtId,
          trust: rel.trust,
          hostility: rel.hostility,
          suspicion: rel.suspicion,
        });
      }
    }

    // 7. Clone Memories (initial event logs)
    const templateQuests = await tx.query.memories.findMany({
      where: and(eq(memories.storyId, templateStoryId), eq(memories.type, "event")),
      orderBy: [desc(memories.createdAt)],
    });
    
    // Copy the memories, mapping names if referenced (e.g. from Alaric to customPlayer.name)
    for (const mem of templateQuests.reverse()) {
      let content = mem.content;
      templateChars.forEach((tc) => {
        if (tc.isPlayer) {
          content = content.replace(new RegExp(tc.name, "g"), customPlayer.name);
        }
      });

      await tx.insert(memories).values({
        storyId,
        characterId: null,
        content,
        type: "event",
      });
    }

    return storyId;
  });
}

/**
 * Legacy support for direct generation (drafts + instantiates player immediately)
 */
export async function generateWorld(userPrompt: string): Promise<string> {
  const drafted = await draftWorld(userPrompt);
  const templateId = await saveWorldTemplate(drafted);
  return await instantiatePlaythrough(templateId, {
    name: drafted.player.name,
    age: drafted.player.age,
    looks: drafted.player.looks,
    skills: drafted.player.skills,
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
    5. The player character (Is Player: true) is the protagonist and must ALWAYS be described/addressed in the second person ("You", "Your", "You feel..."). All other characters are described in the third person. Never describe the player character in the third person or use their name.
    
    Example (when Lyra is NOT the Player):
    Intention: Lyra tries to pick the lock of the chest.
    Output: [System] Lyra crouches by the iron chest and slips in her lockpick. With a metallic snap, the pick breaks inside the keyhole. The chest remains locked, but the sharp noise echoes through the quiet room.
    
    Example (when Lyra IS the Player):
    Intention: Lyra tries to pick the lock of the chest.
    Output: [System] You crouch by the iron chest and slip in your lockpick. With a metallic snap, the pick breaks inside the keyhole. The chest remains locked, but the sharp noise echoes through the quiet room.
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
    4. If the event directly affects or describes the player character (the protagonist), ALWAYS refer to them in the second person ("You", "Your"). For example, say: "You hear a heavy sigh..." instead of "Alaric hears a heavy sigh..." or "The player character hears a heavy sigh...".
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
