import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Stories Table
export const stories = pgTable("stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  lore: jsonb("lore").$type<{ keyword: string; content: string }[]>().default([]).notNull(), // lore book cards
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// relations for Stories
export const storiesRelations = relations(stories, ({ many }) => ({
  locations: many(locations),
  characters: many(characters),
  relationships: many(relationships),
  memories: many(memories),
  items: many(items),
}));

// 2. Locations Table
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  sensoryTags: jsonb("sensory_tags").$type<string[]>().default([]).notNull(), // ambient sounds, smells, etc.
  connections: jsonb("connections").$type<Record<string, string>>().default({}).notNull(), // direction -> locationId
  coordinates: jsonb("coordinates").$type<{ x: number; y: number }>().default({ x: 0, y: 0 }).notNull(),
});

// relations for Locations
export const locationsRelations = relations(locations, ({ one, many }) => ({
  story: one(stories, {
    fields: [locations.storyId],
    references: [stories.id],
  }),
  characters: many(characters),
  items: many(items),
}));

// 3. Characters Table
export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  publicBio: text("public_bio").notNull(),
  privateAgenda: text("private_agenda").notNull(),
  dialogueStyle: text("dialogue_style").notNull(),
  isPlayer: boolean("is_player").default(false).notNull(),
  status: jsonb("status").$type<string[]>().default([]).notNull(), // sick, healthy, fatigued, silenced
});

// relations for Characters
export const charactersRelations = relations(characters, ({ one, many }) => ({
  story: one(stories, {
    fields: [characters.storyId],
    references: [stories.id],
  }),
  location: one(locations, {
    fields: [characters.locationId],
    references: [locations.id],
  }),
  memories: many(memories),
  items: many(items),
  sentRelationships: many(relationships, { relationName: "sourceCharacter" }),
  receivedRelationships: many(relationships, { relationName: "targetCharacter" }),
}));

// 4. Relationships Table
export const relationships = pgTable("relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  sourceCharacterId: uuid("source_character_id").references(() => characters.id, { onDelete: "cascade" }).notNull(),
  targetCharacterId: uuid("target_character_id").references(() => characters.id, { onDelete: "cascade" }).notNull(),
  trust: integer("trust").default(50).notNull(), // 0 to 100
  hostility: integer("hostility").default(0).notNull(), // 0 to 100
  suspicion: integer("suspicion").default(0).notNull(), // 0 to 100
});

// relations for Relationships
export const relationshipsRelations = relations(relationships, ({ one }) => ({
  story: one(stories, {
    fields: [relationships.storyId],
    references: [stories.id],
  }),
  sourceCharacter: one(characters, {
    fields: [relationships.sourceCharacterId],
    references: [characters.id],
    relationName: "sourceCharacter",
  }),
  targetCharacter: one(characters, {
    fields: [relationships.targetCharacterId],
    references: [characters.id],
    relationName: "targetCharacter",
  }),
}));

// 5. Memories Table
export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  characterId: uuid("character_id").references(() => characters.id, { onDelete: "cascade" }), // null for GM / Narrator memory
  content: text("content").notNull(),
  type: text("type").$type<"diary" | "event">().notNull(), // 'diary' (private logs) or 'event' (scene summaries)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// relations for Memories
export const memoriesRelations = relations(memories, ({ one }) => ({
  story: one(stories, {
    fields: [memories.storyId],
    references: [stories.id],
  }),
  character: one(characters, {
    fields: [memories.characterId],
    references: [characters.id],
  }),
}));

// 6. Items Table
export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  locationId: uuid("location_id").references(() => locations.id, { onDelete: "cascade" }), // can be null if held by character
  characterId: uuid("character_id").references(() => characters.id, { onDelete: "cascade" }), // can be null if placed in room
  name: text("name").notNull(),
  description: text("description").notNull(),
});

// relations for Items
export const itemsRelations = relations(items, ({ one }) => ({
  story: one(stories, {
    fields: [items.storyId],
    references: [stories.id],
  }),
  location: one(locations, {
    fields: [items.locationId],
    references: [locations.id],
  }),
  character: one(characters, {
    fields: [items.characterId],
    references: [characters.id],
  }),
}));
