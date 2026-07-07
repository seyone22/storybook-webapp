import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { stories, memories, relationships, characters } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new Error("Missing valid GEMINI_API_KEY in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * 1. Retrieve Lore cards triggered by keywords in dialogue or location name
 */
export async function retrieveRelevantLore(
  storyId: string,
  recentDialogue: string,
  locationName: string
): Promise<string[]> {
  const storyRow = await db.query.stories.findFirst({
    where: eq(stories.id, storyId),
  });
  if (!storyRow || !storyRow.lore) return [];

  const matchedLore: string[] = [];
  const textToScan = `${recentDialogue} ${locationName}`.toLowerCase();

  storyRow.lore.forEach((card) => {
    if (textToScan.includes(card.keyword.toLowerCase())) {
      matchedLore.push(`[Lore: ${card.keyword}] ${card.content}`);
    }
  });

  return matchedLore;
}

/**
 * 2. Retrieve Relevant Memories (recent events + keyword-matched diaries/events)
 */
export async function retrieveRelevantMemories(
  storyId: string,
  characterId: string | null,
  recentDialogue: string
): Promise<string[]> {
  // Fetch recent global events (last 5)
  const recentEvents = await db.query.memories.findMany({
    where: and(eq(memories.storyId, storyId), eq(memories.type, "event")),
    orderBy: [desc(memories.createdAt)],
    limit: 5,
  });

  // Fetch character's private diaries that match keywords in the recent dialogue
  const matchedDiaries: string[] = [];
  if (characterId) {
    const allDiaries = await db.query.memories.findMany({
      where: and(
        eq(memories.storyId, storyId),
        eq(memories.characterId, characterId),
        eq(memories.type, "diary")
      ),
      orderBy: [desc(memories.createdAt)],
      limit: 20,
    });

    const textToScan = recentDialogue.toLowerCase();
    allDiaries.forEach((diary) => {
      // Simple keyword matching: if any word in recentDialogue matches words in the diary
      const diaryWords = diary.content.toLowerCase().split(/\W+/);
      const containsKeyword = diaryWords.some((word) => {
        return word.length > 4 && textToScan.includes(word);
      });

      if (containsKeyword) {
        matchedDiaries.push(diary.content);
      }
    });
  }

  // Combine and format
  const combined = [
    ...recentEvents.reverse().map((e) => `[Public Event] ${e.content}`),
    ...matchedDiaries.slice(0, 3).map((d) => `[Private Recollection] ${d}`),
  ];

  return combined;
}

interface RelationshipUpdate {
  sourceName: string;
  targetName: string;
  trustChange: number;
  hostilityChange: number;
  suspicionChange: number;
}

/**
 * 3. Consolidate Scene: Writes biased diaries and updates relationship vectors
 */
export async function consolidateScene(storyId: string, sceneDialogueHistory: string): Promise<string> {
  const ai = getGenAI();

  // Fetch all characters in this story
  const allChars = await db.query.characters.findMany({
    where: eq(characters.storyId, storyId),
  });

  // A. Generate private biased diaries for each character
  for (const char of allChars) {
    // Players write their own logs (or we skip), but let's compile diaries for NPCs
    if (char.isPlayer) continue;

    const systemInstruction = `
      You are the Private Diary Compiler for ${char.name}.
      Read the raw transcript of the scene and write a brief diary entry (2-3 sentences) summarizing it.
      IMPORTANT: This diary entry must be written in the first person from ${char.name}'s perspective, colored heavily by their private agenda: "${char.privateAgenda}".
      If they witnessed secrets, note them down. If they suspect another character, log their suspicion.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Scene Transcript:\n${sceneDialogueHistory}\n\nWrite the diary entry.`,
      config: { systemInstruction },
    });

    const entry = response.text!.trim();

    // Save to memories
    await db.insert(memories).values({
      storyId,
      characterId: char.id,
      content: `[Diary] ${entry}`,
      type: "diary",
    });
  }

  // B. Update relationship vectors using a single LLM arbitration call
  const systemInstruction = `
    You are the Relationship Arbiter. Review this scene transcript and determine if characters' opinions of each other have shifted.
    Compare their dialogue, secrets exposed, and actions.
    
    Output a JSON array of relationship changes with values between -30 and +30 for delta changes.
    Output schema:
    [
      {
        "sourceName": "Character A",
        "targetName": "Character B",
        "trustChange": -10,
        "hostilityChange": 5,
        "suspicionChange": 15
      }
    ]
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Scene Transcript:\n${sceneDialogueHistory}\n\nAssess relationship shifts.`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            sourceName: { type: "STRING" },
            targetName: { type: "STRING" },
            trustChange: { type: "INTEGER" },
            hostilityChange: { type: "INTEGER" },
            suspicionChange: { type: "INTEGER" },
          },
          required: ["sourceName", "targetName", "trustChange", "hostilityChange", "suspicionChange"],
        },
      },
    },
  });

  try {
    const updates = JSON.parse(response.text!) as RelationshipUpdate[];

    // Apply relationship shifts in DB
    for (const update of updates) {
      const srcChar = allChars.find((c) => c.name.toLowerCase() === update.sourceName.toLowerCase());
      const tgtChar = allChars.find((c) => c.name.toLowerCase() === update.targetName.toLowerCase());

      if (srcChar && tgtChar) {
        // Find existing relationship row
        const relRow = await db.query.relationships.findFirst({
          where: and(
            eq(relationships.sourceCharacterId, srcChar.id),
            eq(relationships.targetCharacterId, tgtChar.id)
          ),
        });

        if (relRow) {
          // Update stats, clamping between 0 and 100
          const newTrust = Math.max(0, Math.min(100, relRow.trust + update.trustChange));
          const newHostility = Math.max(0, Math.min(100, relRow.hostility + update.hostilityChange));
          const newSuspicion = Math.max(0, Math.min(100, relRow.suspicion + update.suspicionChange));

          await db
            .update(relationships)
            .set({ trust: newTrust, hostility: newHostility, suspicion: newSuspicion })
            .where(eq(relationships.id, relRow.id));
        }
      }
    }
  } catch (err) {
    console.error("Failed to parse relationship updates:", err);
  }

  // C. Summarize scene for the general chronicle (event log)
  const systemInstructionGM = `
    You are the Chronicle Narrator. Write a concise, 1-sentence narrative summary of what just occurred in this scene (e.g. "Lyra tried to open the chest but failed, causing Kael to suspect her motives.")
    Do not use bullet points or formatting.
  `;

  const responseGM = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Scene Transcript:\n${sceneDialogueHistory}`,
    config: { systemInstruction: systemInstructionGM },
  });

  const chronicleSummary = `[Chronicle] ${responseGM.text!.trim()}`;
  await db.insert(memories).values({
    storyId,
    characterId: null, // GM
    content: chronicleSummary,
    type: "event",
  });

  return chronicleSummary;
}
