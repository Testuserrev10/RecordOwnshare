import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { settingsSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a folder name." }, { status: 400 });
  db.insert(settings).values({ userId: user.id, provider: parsed.data.provider, storageLabel: parsed.data.storageLabel, storagePath: parsed.data.storagePath, updatedAt: new Date() }).onConflictDoUpdate({ target: settings.userId, set: { provider: parsed.data.provider, storageLabel: parsed.data.storageLabel, storagePath: parsed.data.storagePath, updatedAt: new Date() } }).run();
  return NextResponse.json({ ok: true, storageLabel: parsed.data.storageLabel });
}
