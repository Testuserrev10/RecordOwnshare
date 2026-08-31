import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/auth";
import { credentialsSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (db.select().from(users).where(eq(users.email, email)).get()) return NextResponse.json({ error: "Unable to create account with those details." }, { status: 400 });
  const user = { id: crypto.randomUUID(), email, passwordHash: await bcrypt.hash(parsed.data.password, 12), createdAt: new Date() };
  db.insert(users).values(user).run();
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
}
