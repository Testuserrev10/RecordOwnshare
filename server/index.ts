import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { desc, eq } from 'drizzle-orm'
import { randomBytes, createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { recordings } from './schema.js'

const port = Number(process.env.PORT || 4173)
const dataDir = join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })
const sqlite = new Database(join(dataDir, 'capture.db'))
const db = drizzle(sqlite)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS recordings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, duration_ms INTEGER NOT NULL, provider TEXT NOT NULL, storage_path TEXT NOT NULL, share_url TEXT, capture_source TEXT NOT NULL, created_at TEXT NOT NULL);
`)

const app = Fastify({ logger: true })
await app.register(cookie)
await app.register(fastifyStatic, { root: join(process.cwd(), 'dist'), wildcard: false })

const authBody = z.object({ username: z.string().trim().min(3).max(40), password: z.string().min(8).max(128), email: z.string().email().optional() })
const recordingBody = z.object({ title: z.string().trim().min(1).max(160), durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000), provider: z.enum(['local', 'drive']), storagePath: z.string().trim().max(500), captureSource: z.enum(['screen', 'window', 'tab']) })

function hash(value: string) { return createHash('sha256').update(value).digest('hex') }
function sessionUser(request: { cookies: Record<string, string | undefined> }) {
  const token = request.cookies.capture_session
  if (!token) return null
  const row = sqlite.prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').get(hash(token), new Date().toISOString()) as { user_id: string } | undefined
  return row?.user_id || null
}
function sessionCookie(reply: { setCookie: Function }, userId: string) {
  const token = randomBytes(32).toString('hex')
  sqlite.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').run(randomBytes(16).toString('hex'), userId, hash(token), new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString())
  reply.setCookie('capture_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 })
}

app.get('/api/v1/health', async () => ({ ok: true }))
app.post('/api/v1/auth/signup', async (request, reply) => {
  const parsed = authBody.safeParse(request.body)
  if (!parsed.success || !parsed.data.email) return reply.code(400).send({ error: { code: 'INVALID_ACCOUNT', message: 'Enter a username, email, and password.' } })
  const existing = sqlite.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(parsed.data.username, parsed.data.email)
  if (existing) return reply.code(409).send({ error: { code: 'ACCOUNT_EXISTS', message: 'Unable to create this account.' } })
  const id = randomBytes(16).toString('hex')
  sqlite.prepare('INSERT INTO users (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(id, parsed.data.username, parsed.data.email, await bcrypt.hash(parsed.data.password, 12), new Date().toISOString())
  sessionCookie(reply, id)
  return reply.code(201).send({ user: { id, username: parsed.data.username, email: parsed.data.email } })
})
app.post('/api/v1/auth/login', async (request, reply) => {
  const parsed = authBody.safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } })
  const user = sqlite.prepare('SELECT id, username, email, password_hash FROM users WHERE username = ?').get(parsed.data.username) as { id: string; username: string; email: string; password_hash: string } | undefined
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' } })
  sessionCookie(reply, user.id)
  return { user: { id: user.id, username: user.username, email: user.email } }
})
app.post('/api/v1/auth/logout', async (request, reply) => { const token = request.cookies.capture_session; if (token) sqlite.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token)); reply.clearCookie('capture_session', { path: '/' }); return { ok: true } })
app.get('/api/v1/recordings', async (request, reply) => {
  const userId = sessionUser(request)
  if (!userId) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to view recordings.' } })
  const rows = await db.select().from(recordings).where(eq(recordings.userId, userId)).orderBy(desc(recordings.createdAt))
  return { recordings: rows }
})
app.post('/api/v1/recordings', async (request, reply) => {
  const userId = sessionUser(request)
  if (!userId) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to save recordings.' } })
  const parsed = recordingBody.safeParse(request.body)
  if (!parsed.success) return reply.code(400).send({ error: { code: 'INVALID_RECORDING', message: 'Recording metadata is invalid.' } })
  const id = randomBytes(16).toString('hex')
  await db.insert(recordings).values({ id, userId, title: parsed.data.title, durationMs: parsed.data.durationMs, provider: parsed.data.provider, storagePath: parsed.data.storagePath, captureSource: parsed.data.captureSource, createdAt: new Date().toISOString() })
  return reply.code(201).send({ id })
})
app.get('/*', async (_request, reply) => reply.sendFile('index.html'))

await app.listen({ port, host: '0.0.0.0' })
