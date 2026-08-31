import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Cloud, FolderOpen, Library, LockKeyhole, LogOut, MonitorPlay, Sparkles } from "lucide-react";
import { db } from "@/db";
import { recordings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export default async function RecordingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const items = db.select().from(recordings).where(eq(recordings.userId, user.id)).orderBy(desc(recordings.recordedAt)).limit(100).all();

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-brand" href="/capture"><span className="brand-orb"><Sparkles size={15} /></span><span>capture</span></Link>
        <nav className="sidebar-nav" aria-label="Main navigation"><span className="sidebar-label">Workspace</span><Link className="sidebar-link" href="/capture"><MonitorPlay size={17} /> Recorder</Link><Link className="sidebar-link active" href="/recordings"><Library size={17} /> Library</Link><span className="sidebar-label sidebar-label-spaced">Account</span><Link className="sidebar-link" href="/recordings"><LockKeyhole size={17} /> Settings</Link></nav>
        <div className="sidebar-bottom"><div className="sidebar-privacy"><LockKeyhole size={16} /><div><strong>Private by design</strong><span>Videos stay with you.</span></div></div><div className="sidebar-user"><span className="avatar">{user.email.slice(0, 1).toUpperCase()}</span><span className="user-email">{user.email}</span><LogOut size={15} /></div></div>
      </aside>
      <section className="app-content">
        <header className="content-header"><div><p className="breadcrumb">WORKSPACE <span>/</span> LIBRARY</p><p className="header-caption">Your recordings, indexed—not uploaded.</p></div><Link className="button button-primary" href="/capture"><MonitorPlay size={16} /> Start recording</Link></header>
        <section className="recordings-page"><div className="page-intro"><p className="eyebrow">YOUR LIBRARY / METADATA ONLY</p><h1>Everything you captured.<br /><em>Nothing you gave away.</em></h1><p className="hero-description">Capture keeps the details that help you find a recording again. The video stays in your local folder or private Google Drive.</p></div>{items.length ? <div className="library-grid">{items.map((item) => <article className="library-card" key={item.id}>{item.thumbnail ? <div className="thumbnail" style={{ backgroundImage: `url(${item.thumbnail})` }} aria-label="Recording thumbnail" /> : <div className="thumbnail placeholder" aria-hidden="true" />}<div className="library-card-body"><p className="card-provider">{item.provider === "google_drive" ? <><Cloud size={13} /> Private Google Drive</> : <><FolderOpen size={13} /> Local folder</>}</p><h2>{item.title}</h2><p className="library-path">{item.storagePath ?? item.fileName}</p><div className="recording-meta"><span>{new Date(item.recordedAt).toISOString().slice(0, 10)}</span><span>{Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}</span></div>{item.externalUrl && <a className="drive-link" href={item.externalUrl} target="_blank" rel="noreferrer">Open in Drive ↗</a>}</div></article>)}</div> : <div className="library-empty"><span className="empty-icon"><Library size={22} /></span><h2>No recordings yet</h2><p>Start your first capture in under five seconds. It will appear here with its file location and metadata.</p><Link className="button button-primary" href="/capture">Go to recorder</Link></div>}</section>
      </section>
    </main>
  );
}
