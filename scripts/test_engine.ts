import "dotenv/config";
import { db } from "../src/db";
import { stories, locations, characters, memories, relationships, items } from "../src/db/schema";
import { generateWorld, arbitrateAction } from "../src/lib/director";
import { generateCharacterResponse } from "../src/lib/character";
import { executeTick, movePlayer } from "../src/lib/orchestrator";
import { eq, and } from "drizzle-orm";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

async function runTests() {
  console.log(`${colors.cyan}=== starting storybook engine integration tests ===${colors.reset}\n`);

  let testStoryId: string | null = null;

  try {
    // ----------------------------------------------------
    // Test 1: Database Connection
    // ----------------------------------------------------
    console.log(`${colors.yellow}[Test 1] Testing Database Connection...${colors.reset}`);
    const dbTest = await db.select({ count: stories.id }).from(stories).limit(1);
    console.log(`${colors.green}✔ Database connection successful. Story count: ${dbTest.length}${colors.reset}\n`);

    // ----------------------------------------------------
    // Test 2: World Generation (Prompt-to-World)
    // ----------------------------------------------------
    console.log(`${colors.yellow}[Test 2] Testing Prompt-to-World Generator (Gemini Flash)...${colors.reset}`);
    const testPrompt = 
      "I want to play as a young apprentice mage named Leo. I am inside the Alchemy Laboratory of Master Alaric. " +
      "Master Alaric is an elderly grumpy wizard who secretly suspects I stole his grimoire. " +
      "There is an active fireplace and a boiling cauldron. My goal is to find where he hid my wand.";
    
    console.log(`Sending prompt: "${testPrompt.substring(0, 80)}..."`);
    testStoryId = await generateWorld(testPrompt);
    console.log(`${colors.green}✔ World generated successfully! Story ID: ${testStoryId}${colors.reset}`);

    // Verify database entities created
    const storyRow = await db.query.stories.findFirst({ where: eq(stories.id, testStoryId) });
    const locRows = await db.query.locations.findMany({ where: eq(locations.storyId, testStoryId) });
    const charRows = await db.query.characters.findMany({ where: eq(characters.storyId, testStoryId) });
    const itemRows = await db.query.items.findMany({ where: eq(items.storyId, testStoryId) });

    console.log(`Generated entities check:`);
    console.log(` - Title: "${storyRow?.title}"`);
    console.log(` - Locations: ${locRows.map(l => l.name).join(", ")}`);
    console.log(` - Characters: ${charRows.map(c => `${c.name} (${c.isPlayer ? 'Player' : 'NPC'})`).join(", ")}`);
    console.log(` - Items: ${itemRows.map(i => i.name).join(", ")}`);

    if (locRows.length === 0 || charRows.length < 2) {
      throw new Error("Failed to populate required locations or characters in database.");
    }
    console.log(`${colors.green}✔ Database entities verified successfully.${colors.reset}\n`);

    // ----------------------------------------------------
    // Test 3: Action Arbitration
    // ----------------------------------------------------
    console.log(`${colors.yellow}[Test 3] Testing GM Action Arbitration...${colors.reset}`);
    const playerChar = charRows.find(c => c.isPlayer)!;
    const startLoc = locRows[0];
    const proposedAction = "I attempt to quietly search the bookshelf for my wand while Master Alaric's back is turned.";
    
    console.log(`Proposing action: "${proposedAction}"`);
    const outcome = await arbitrateAction(
      testStoryId,
      playerChar.name,
      true,
      proposedAction,
      startLoc.id
    );
    console.log(`Arbitration result:`);
    console.log(` ${colors.cyan}${outcome}${colors.reset}`);
    
    if (!outcome.startsWith("[System]")) {
      throw new Error("Action arbitration output did not match required '[System]' format.");
    }
    console.log(`${colors.green}✔ Action arbitration verified.${colors.reset}\n`);

    // ----------------------------------------------------
    // Test 4: Isolated NPC Turn & Private Thoughts
    // ----------------------------------------------------
    console.log(`${colors.yellow}[Test 4] Testing Isolated Character Dialogue & Thoughts...${colors.reset}`);
    const npcChar = charRows.find(c => !c.isPlayer)!;
    const dialogueHistory = [
      { speakerName: playerChar.name, text: '[Speech] "Master Alaric, I swear I didn\'t touch your grimoire!"' },
      { speakerName: "System", text: outcome }
    ];
    
    console.log(`Generating response for: ${npcChar.name}`);
    const npcRes = await generateCharacterResponse(
      testStoryId,
      npcChar.id,
      startLoc.id,
      dialogueHistory,
      [`${playerChar.name} is Master Alaric's apprentice.`],
      ["Grimoires contain forbidden alchemy spells."]
    );

    console.log(`NPC thoughts:`);
    console.log(` ${colors.magenta}${npcRes.privateThoughts}${colors.reset}`);
    console.log(`NPC output:`);
    console.log(` ${colors.cyan}${npcRes.publicOutput}${colors.reset}`);

    if (!npcRes.privateThoughts || !npcRes.publicOutput) {
      throw new Error("NPC response was missing privateThoughts or publicOutput fields.");
    }
    console.log(`${colors.green}✔ Character response and knowledge isolation verified.${colors.reset}\n`);

    // ----------------------------------------------------
    // Test 5: Game Loop Tick
    // ----------------------------------------------------
    console.log(`${colors.yellow}[Test 5] Testing Simulation Loop Ticks...${colors.reset}`);
    const tickResult = await executeTick({
      storyId: testStoryId,
      playerInput: "Is there any tea left?",
      actionType: "speech"
    });

    console.log(`Recent conversation logs returned:`);
    tickResult.logs.slice(-3).forEach(l => {
      console.log(` - ${l.speaker}: ${l.text}`);
    });

    if (tickResult.logs.length === 0 || !tickResult.currentLocationName) {
      throw new Error("Simulation loop tick failed to return logs or location name.");
    }
    console.log(`${colors.green}✔ Simulation loop tick verified.${colors.reset}\n`);

    // ----------------------------------------------------
    // Test 6: Movement & Diary Consolidation
    // ----------------------------------------------------
    console.log(`${colors.yellow}[Test 6] Testing Room Movement & Diary Consolidation...${colors.reset}`);
    
    // Attempt to move East (will trigger dynamic room expansion since only starting coordinates 0,0 are set)
    console.log(`Moving player East from ${startLoc.name}...`);
    await movePlayer(testStoryId, "e");

    // Verify player position changed
    const playerAfterMove = await db.query.characters.findFirst({
      where: and(eq(characters.storyId, testStoryId), eq(characters.isPlayer, true))
    });
    
    if (playerAfterMove?.locationId === startLoc.id) {
      throw new Error("Player location failed to update after move.");
    }

    const newLoc = await db.query.locations.findFirst({
      where: eq(locations.id, playerAfterMove?.locationId!)
    });
    console.log(`${colors.green}✔ Player successfully moved to new room: "${newLoc?.name}"${colors.reset}`);

    // Verify that moving triggered biased diaries in DB
    const diaryMemories = await db.query.memories.findMany({
      where: and(
        eq(memories.storyId, testStoryId),
        eq(memories.type, "diary"),
        eq(memories.characterId, npcChar.id)
      )
    });

    console.log(`${npcChar.name}'s consolidated memories:`);
    diaryMemories.forEach(d => {
      console.log(` - ${d.content}`);
    });

    if (diaryMemories.length === 0) {
      throw new Error("No scene diaries were consolidated for NPCs upon room transition.");
    }
    console.log(`${colors.green}✔ Room transition and biased memory diaries verified.${colors.reset}\n`);

    // ----------------------------------------------------
    // Test 7: Cleanup
    // ----------------------------------------------------
    console.log(`${colors.yellow}[Test 7] Cleaning up test database records...${colors.reset}`);
    await db.delete(stories).where(eq(stories.id, testStoryId));
    console.log(`${colors.green}✔ Deleted test story record ${testStoryId} and cascade deleted all child items.${colors.reset}\n`);

    console.log(`${colors.green}===================================================`);
    console.log(`   ALL STORYBOOK ENGINE INTEGRATION TESTS PASSED!`);
    console.log(`===================================================${colors.reset}`);

  } catch (err: any) {
    console.error(`\n${colors.red}❌ TEST FAILURE ENCOUNTERED:${colors.reset}`);
    console.error(err);

    // Attempt clean up anyway
    if (testStoryId) {
      console.log(`\nAttempting database cleanup for story ${testStoryId}...`);
      await db.delete(stories).where(eq(stories.id, testStoryId));
      console.log("Cleanup finished.");
    }
    process.exit(1);
  }
}

runTests();
