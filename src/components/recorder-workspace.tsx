"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  ChevronRight,
  CircleHelp,
  Cloud,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Library,
  LockKeyhole,
  LogOut,
  MonitorPlay,
  Radio,
  Settings2,
  Sparkles,
  Square,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { uploadToDrive, requestDriveToken } from "@/lib/google-drive";
import { ensureDirectoryWritePermission, getDirectoryHandle, getMimeType, pickDirectory, saveDirectoryHandle, supportsLocalRecording, writeRecording } from "@/lib/recording";

type Recording = {
  id: string;
  title: string;
  durationSeconds: number;
  recordedAt: string;
  fileName: string;
  storageLabel: string;
  storagePath: string | null;
  provider: "local" | "google_drive";
  externalUrl?: string | null;
  thumbnail: string | null;
};

type Props = {
  email: string;
  initialStorage: string | null;
  initialProvider: "local" | "google_drive";
  initialRecordings: Recording[];
};

function formatRecordingDate(value: string) {
  const date = new Date(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

async function createThumbnail(blob: Blob) {
  return new Promise<string | null>((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.onloadeddata = () => { video.currentTime = Math.min(1, video.duration || 1); };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(video.src);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(blob);
  });
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RecorderWorkspace({ email, initialStorage, initialProvider, initialRecordings }: Props) {
  const router = useRouter();
  const [storage, setStorage] = useState(initialStorage);
  const [provider, setProvider] = useState<"local" | "google_drive">(initialProvider);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [recordings, setRecordings] = useState(initialRecordings);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const supported = useSyncExternalStore(() => () => undefined, supportsLocalRecording, () => true);
  const googleDriveConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  useEffect(() => {
    getDirectoryHandle().then((saved) => saved && setHandle(saved)).catch(() => undefined);
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function refreshHistory() {
    const response = await fetch("/api/recordings", { cache: "no-store" });
    if (!response.ok) throw new Error("history");
    const data = await response.json();
    setRecordings(data.recordings);
  }

  async function chooseFolder() {
    setError("");
    try {
      const next = await pickDirectory();
      setHandle(next);
      setProvider("local");
      setStorage(next.name);
      const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "local", storageLabel: next.name, storagePath: next.name }) });
      if (!response.ok) throw new Error("settings");
      setStatus("Local folder ready");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Capture needs permission to write to that folder. Try choosing it again.");
    }
  }

  async function chooseDrive() {
    setError("");
    if (!googleDriveConfigured) {
      setError("Google Drive is not configured yet. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable it.");
      return;
    }
    setProvider("google_drive");
    setStorage("My Drive");
    const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "google_drive", storageLabel: "My Drive", storagePath: "My Drive" }) });
    if (!response.ok) setError("Could not save Google Drive as your destination.");
    else setStatus("Google Drive selected");
  }

  async function createNewFolder() {
    setError("");
    if (!supported) { setError("Your browser cannot create local folders. Use the latest Chrome or Edge on desktop."); return; }
    const name = window.prompt("Name your new Capture folder", "Capture Recordings")?.trim();
    if (!name) return;
    if (!/^[^\\/\\:*?\"<>|]{1,80}$/.test(name)) { setError("Choose a folder name without slashes or special file characters."); return; }
    try {
      const parent = await pickDirectory();
      const next = await parent.getDirectoryHandle(name, { create: true });
      await saveDirectoryHandle(next);
      setHandle(next);
      setProvider("local");
      setStorage(name);
      const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "local", storageLabel: name, storagePath: name }) });
      if (!response.ok) throw new Error("settings");
      setStatus(`New folder “${name}” is ready`);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("The new folder could not be created. Choose a writable parent folder and try again.");
    }
  }

  async function disconnectDrive() {
    setError("");
    const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "local", storageLabel: "Not selected", storagePath: "Not selected" }) });
    if (!response.ok) { setError("Could not disconnect Google Drive."); return; }
    setProvider("local");
    setStorage(null);
    setStatus("Google Drive disconnected. Choose a local folder to record.");
  }

  async function start() {
    if (recording || starting) return;
    if (provider === "local" && !handle) { setError("Choose a local folder before recording."); return; }
    setStarting(true);
    setError("");
    setNotice("");
    setStatus(provider === "google_drive" ? "Connect Google Drive in the popup, then choose what to record." : "Choose a screen, window, or tab in the browser prompt.");
    try {
      let driveAccessToken: string | null = null;
      if (provider === "local") await ensureDirectoryWritePermission(handle!);
      if (provider === "google_drive") driveAccessToken = await requestDriveToken(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setStarting(false);
      const media = new MediaRecorder(stream, { mimeType: getMimeType() });
      chunks.current = [];
      media.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      media.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setStatus(provider === "local" ? "Writing to your folder…" : "Uploading directly to Drive…");
        const blob = new Blob(chunks.current, { type: media.mimeType });
        const thumbnail = await createThumbnail(blob);
        const stamp = new Date();
        const fileName = `capture-${stamp.toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}.webm`;
        try {
          let externalFileId: string | null = null;
          let externalUrl: string | null = null;
          let storagePath = `${storage}/${fileName}`;
          if (provider === "local") await writeRecording(blob, fileName, handle!);
          else {
            if (!driveAccessToken) throw new Error("Google authorization was not completed.");
            const driveFile = await uploadToDrive(blob, fileName, driveAccessToken);
            externalFileId = driveFile.id;
            externalUrl = driveFile.webViewLink ?? `https://drive.google.com/file/d/${driveFile.id}/view`;
            storagePath = `My Drive/${fileName}`;
          }
          const response = await fetch("/api/recordings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Untitled capture", durationSeconds: elapsed, recordedAt: stamp.toISOString(), fileName, storageLabel: storage ?? "My Drive", storagePath, provider, externalFileId, externalUrl, thumbnail }) });
          if (!response.ok) throw new Error("metadata");
          await refreshHistory();
          setNotice(provider === "local" ? "Recording saved locally. Video never left your browser." : "Recording saved to your private Google Drive.");
          setStatus("Capture complete");
          router.refresh();
        } catch (cause) {
          console.error("Capture finalization failed", cause instanceof Error ? cause.message : cause);
          const driveDetail = provider === "google_drive" && cause instanceof Error && cause.message.startsWith("Drive upload failed") ? ` ${cause.message}` : "";
          setError(provider === "local" ? "The recording could not be saved. Check folder permission and try again." : `The recording could not be uploaded to Drive. Nothing was added to your Capture history.${driveDetail}`);
          setStatus("");
        }
      };
      media.start(250);
      recorder.current = media;
      started.current = Date.now();
      setElapsed(0);
      setRecording(true);
      setStatus("Recording locally");
    } catch {
      setStarting(false);
      setError(provider === "google_drive" ? "Google Drive authorization or screen sharing was cancelled. Nothing was saved." : "Screen sharing was cancelled or blocked. Nothing was saved.");
      setStatus("");
    }
  }

  function stop() { recorder.current?.stop(); setStatus("Finishing capture…"); }
  async function openFolder() {
    if (!handle) { await chooseFolder(); return; }
    setStatus("Your selected folder is ready in the browser. Use your file app to browse its files.");
  }
  async function logout() { await fetch("/api/auth/signout", { method: "POST" }); router.push("/sign-in"); router.refresh(); }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-brand" href="/capture"><span className="brand-orb"><Sparkles size={15} /></span><span>capture</span></Link>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="sidebar-label">Workspace</span>
          <Link className="sidebar-link active" href="/capture"><MonitorPlay size={17} /> Recorder <span className="shortcut">⌘ R</span></Link>
          <Link className="sidebar-link" href="/recordings"><Library size={17} /> Library</Link>
          <span className="sidebar-label sidebar-label-spaced">Account</span>
          <Link className="sidebar-link" href="/recordings"><Settings2 size={17} /> Settings</Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-privacy"><LockKeyhole size={16} /><div><strong>Private by design</strong><span>Videos stay with you.</span></div></div>
          <button className="sidebar-user" onClick={logout}><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span className="user-email">{email}</span><LogOut size={15} /></button>
        </div>
      </aside>
      <section className="app-content">
        <header className="content-header"><div><p className="breadcrumb">WORKSPACE <ChevronRight size={13} /> RECORDER</p><p className="header-caption">Ready when you are.</p></div><button className="button button-secondary header-folder" onClick={openFolder}><FolderOpen size={16} /> {storage ? "Open folder" : "Choose storage"}</button></header>
        <div className="dashboard-grid">
          <section className="hero-block">
            <div className="hero-copy-block"><p className="eyebrow"><span className="live-dot" /> PRIVATE RECORDING</p><h1>Record instantly.<br /><em>Own every file.</em></h1><p className="hero-description">Record bugs, walkthroughs and demos directly into your own storage. Capture indexes only what helps you find them later.</p></div>
            <div className="hero-actions"><button className={`record-cta ${recording ? "is-recording" : ""}`} onClick={recording ? stop : start} disabled={!supported || starting} aria-label={recording ? "Stop recording" : "Start recording"}>{recording ? <Square size={20} fill="currentColor" /> : <Radio size={21} />}<span>{starting ? "Starting…" : recording ? "Stop recording" : "Start recording"}</span>{recording && <strong>{formatDuration(elapsed)}</strong>}</button><button className="button button-ghost" onClick={chooseFolder}><FolderOpen size={17} /> Choose storage</button></div>
            <div className="quick-features"><span><Check size={14} /> Screen, window or tab</span><span><Check size={14} /> Direct-to-destination</span><span><Check size={14} /> No video uploads</span></div>
            {!supported && <div className="inline-alert"><TriangleAlert size={17} /><span>Use the latest Chrome or Edge on desktop to record and select a local folder.</span></div>}
            {error && <div className="inline-alert error"><TriangleAlert size={17} /><span>{error}</span></div>}
            {notice && <div className="inline-alert success"><Check size={17} /><span>{notice}</span></div>}
            {status && !error && !notice && <p className="live-status" role="status"><span className={recording ? "pulse-dot" : "status-dot"} />{status}</p>}
          </section>
          <aside className="dashboard-rail">
            <section className="surface-card destination-card"><div className="card-heading"><div><p className="card-eyebrow">RECORDING DESTINATION</p><h2>Where should recordings be saved?</h2></div><HardDrive size={19} /></div><button className={`destination-option ${provider === "local" ? "selected" : ""}`} onClick={chooseFolder}><span className="destination-icon local"><FolderOpen size={18} /></span><span><strong>Local folder</strong><small>{storage ? storage : "Private and offline"}</small></span><span className="destination-check">{provider === "local" && <Check size={15} />}</span></button><button className={`destination-option ${provider === "google_drive" ? "selected" : ""}`} onClick={chooseDrive} disabled={!googleDriveConfigured} title={!googleDriveConfigured ? "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google Drive." : undefined}><span className="destination-icon drive"><Cloud size={18} /></span><span><strong>Google Drive</strong><small>{googleDriveConfigured ? "Private cloud sync" : "Not configured yet"}</small></span><span className="destination-check">{provider === "google_drive" && <Check size={15} />}</span></button><div className="destination-actions">{provider === "local" && <button className="text-button" onClick={createNewFolder}><FolderOpen size={14} /> Create new folder</button>}{provider === "google_drive" && <button className="text-button danger-text" onClick={disconnectDrive}>Disconnect Drive</button>}</div></section>
            <section className="surface-card privacy-card"><div className="privacy-icon"><LockKeyhole size={18} /></div><div><p className="card-eyebrow">PRIVACY BY DESIGN</p><h2>Your files stay yours.</h2><p>Video goes straight to your destination. Capture keeps only lightweight metadata.</p><Link href="/recordings">Learn about your library <ChevronRight size={14} /></Link></div></section>
          </aside>
        </div>
        <section className="recent-section"><div className="section-heading"><div><p className="card-eyebrow">YOUR WORKSPACE</p><h2>Recent captures</h2></div><Link className="text-link" href="/recordings">View library <ChevronRight size={15} /></Link></div>{recordings.length === 0 ? <div className="empty-surface"><Archive size={22} /><div><h3>Your library is ready.</h3><p>Start your first recording in under five seconds. It will appear here with its location and metadata.</p></div><button className="button button-secondary" onClick={start}>Start recording</button></div> : <div className="capture-list">{recordings.slice(0, 4).map((item) => <article className="capture-row" key={item.id}><div className="capture-thumb" style={item.thumbnail ? { backgroundImage: `url(${item.thumbnail})` } : undefined}>{!item.thumbnail && <MonitorPlay size={18} />}</div><div className="capture-title"><strong>{item.title}</strong><span>{item.storagePath ?? item.fileName}</span></div><span className="capture-provider">{item.provider === "google_drive" ? <Cloud size={14} /> : <FolderOpen size={14} />}{item.provider === "google_drive" ? "Drive" : "Local"}</span><span className="capture-duration"><Timer size={14} />{formatDuration(item.durationSeconds)}</span><span className="capture-date">{formatRecordingDate(item.recordedAt)}</span>{item.externalUrl && <a className="row-action" href={item.externalUrl} target="_blank" rel="noreferrer" aria-label="Open recording in Drive"><ExternalLink size={16} /></a>}</article>)}</div>}</section>
        <footer className="workspace-footer"><span><LockKeyhole size={14} /> Videos stay in your storage. Capture indexes only what helps you find them later.</span><span><CircleHelp size={14} /> Shortcuts: <kbd>⌘</kbd><kbd>R</kbd> record</span></footer>
      </section>
    </main>
  );
}
