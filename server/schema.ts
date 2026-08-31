import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
})

export const recordings = sqliteTable('recordings', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  durationMs: integer('duration_ms').notNull(),
  provider: text('provider').notNull(),
  storagePath: text('storage_path').notNull(),
  shareUrl: text('share_url'),
  captureSource: text('capture_source').notNull(),
  createdAt: text('created_at').notNull(),
})
