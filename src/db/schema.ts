import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export const settings = sqliteTable("settings", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["local", "google_drive"] }).notNull().default("local"),
  storageLabel: text("storage_label"),
  storagePath: text("storage_path"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const recordings = sqliteTable("recordings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  recordedAt: integer("recorded_at", { mode: "timestamp" }).notNull(),
  fileName: text("file_name").notNull(),
  storageLabel: text("storage_label").notNull(),
  storagePath: text("storage_path"),
  provider: text("provider", { enum: ["local", "google_drive"] }).notNull().default("local"),
  externalFileId: text("external_file_id"),
  externalUrl: text("external_url"),
  thumbnail: text("thumbnail"),
});
