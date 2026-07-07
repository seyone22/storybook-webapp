import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { characters, relationships, locations, memories } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("Missing valid GEMINI_API_KEY in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
}

interface CharacterResponse {
  privateThoughts: string;
  publicOutput: string; // E.g., "[Speech] 'Hello'" or "[Action] I shrug nervously."
}

/**
 * Generate a response for an NPC character
 */
export async function generateCharacterResponse(
  storyId: string,
  characterId: string,
  currentLocationId: string,
  sceneDialogueHistory: { speakerName: string; text: string }[],
  retrievedMemories: string[],
  relevantLore: string[]
): Promise<CharacterResponse> {
  const ai = getGenAI();

  // 1. Fetch character's specific profile
  const self = await db.query.characters.findFirst({
    where: eq(characters.id, characterId),
  });
  if (!self) throw new Error("Character not found.");

  // 2. Fetch location details
  const locationRow = await db.query.locations.findFirst({
    where: eq(locations.id, currentLocationId),
  });

  // 3. Fetch relationships this character has with everyone else in the room
  const rels = await db.query.relationships.findMany({
    where: eq(relationships.sourceCharacterId, characterId),
  });

  // Map relationship details into string
  const relSummary = [];
  for (const r of rels) {
    const target = await db.query.characters.findFirst({
      where: eq(characters.id, r.targetCharacterId),
    });
    if (target) {
      relSummary.push(
        `- Toward ${target.name}: Trust=${r.trust}/100, Hostility=${r.hostility}/100, Suspicion=${r.suspicion}/100`
      );
    }
  }

  // 4. Construct Prompt Context
  const formattedDialogue = sceneDialogueHistory
    .map((d) => `${d.speakerName}: ${d.text}`)
    .join("\n");

  const prompt = `
    --- CHARACTER DETAILS ---
    Your Name: ${self.name}
    Public Bio: ${self.publicBio}
    Private Agenda (Secrets/True Motives): ${self.privateAgenda}
    Current Status: ${self.status.join(", ") || "healthy"}
    Speech/Dialogue Style Guide: ${self.dialogueStyle}

    --- ENVIRONMENT ---
    Location: ${locationRow?.name}
    Description: ${locationRow?.description}
    Sensory Details: ${locationRow?.sensoryTags.join(", ")}

    --- RELATIONSHIPS ---
    ${relSummary.join("\n") || "No established relationships yet."}

    --- RELEVANT PAST MEMORIES ---
    ${retrievedMemories.map((m, idx) => `[Memory ${idx + 1}] ${m}`).join("\n") || "None."}

    --- RELEVANT LORE ---
    ${relevantLore.map((l, idx) => `[Lore ${idx + 1}] ${l}`).join("\n") || "None."}

    --- RECENT DIALOGUE HISTORY (WHAT YOU HAVE WITNESSED) ---
    ${formattedDialogue || "No dialogue has occurred in this scene yet."}

    Generate your response as a JSON object separating your private thoughts from your public action/speech.
  `;

  const systemInstruction = `
    You are roleplaying as ${self.name} in an immersive narrative simulation.
    
    You must output a JSON object containing:
    1. privateThoughts: Your inner deliberation, calculations, emotional states, and plotting based on your Private Agenda. This is secret and NOT broadcast.
    2. publicOutput: What you actually say or do in the room.
       - Use '[Speech] "Dialogue text"' for speech.
       - Use '[Action] Action description' for physical actions.
       
    CRITICAL RULES:
    1. STRICTLY adhere to your Dialogue Style Guide: "${self.dialogueStyle}".
    2. Do NOT act on secrets or details you have not witnessed in the Dialogue History or Past Memories. Respect the knowledge isolation.
    3. You can only propose ACTIONS; do not state their successful outcome (e.g. write "[Action] I attempt to push Kael" not "[Action] I push Kael to the floor").
    4. Keep dialogue natural, fluid, and fit for the roleplay.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          privateThoughts: { type: "STRING" },
          publicOutput: { type: "STRING" },
        },
        required: ["privateThoughts", "publicOutput"],
      },
    },
  });

  const parsed = JSON.parse(response.text!) as CharacterResponse;

  // Save character's private thoughts as a diary/private memory log
  await db.insert(memories).values({
    storyId,
    characterId,
    content: `[Thoughts] ${parsed.privateThoughts}`,
    type: "diary",
  });

  // Save their public statement to the database event logs
  await db.insert(memories).values({
    storyId,
    characterId,
    content: `${self.name}: ${parsed.publicOutput}`,
    type: "event",
  });

  return parsed;
}
