import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { recordings, settings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { RecorderWorkspace } from "@/components/recorder-workspace";

export default async function CapturePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const [preference, history] = await Promise.all([
    Promise.resolve(db.select().from(settings).where(eq(settings.userId, user.id)).get()),
    Promise.resolve(db.select().from(recordings).where(eq(recordings.userId, user.id)).orderBy(desc(recordings.recordedAt)).limit(50).all()),
  ]);
  return <RecorderWorkspace email={user.email} initialStorage={preference?.storageLabel ?? null} initialProvider={preference?.provider ?? "local"} initialRecordings={history.map((item) => ({ ...item, recordedAt: item.recordedAt.toISOString() }))} />;
}
