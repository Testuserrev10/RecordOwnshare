import crypto from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { recordings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { recordingSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ recordings: db.select().from(recordings).where(eq(recordings.userId, user.id)).orderBy(desc(recordings.recordedAt)).limit(50).all() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = recordingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Recording metadata is invalid." }, { status: 400 });
  const item = { id: crypto.randomUUID(), userId: user.id, ...parsed.data, recordedAt: new Date(parsed.data.recordedAt) };
  db.insert(recordings).values(item).run();
  return NextResponse.json({ recording: item }, { status: 201 });
}
