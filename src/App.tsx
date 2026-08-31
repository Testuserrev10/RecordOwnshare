import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  FolderOpen,
  HardDrive,
  LogOut,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Tag,
  Video,
} from 'lucide-react'
import './App.css'

type Recording = { id: string; title: string; durationMs: number; provider: string; storagePath: string; captureSource: string; createdAt: string }
type DirectoryHandle = FileSystemDirectoryHandle & { queryPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState>; requestPermission: (options: { mode: 'readwrite' }) => Promise<PermissionState> }

type View = 'record' | 'recordings' | 'storage' | 'settings'

const api = async (path: string, options: RequestInit = {}) => fetch(path, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })

function App() {
  const [user, setUser] = useState<{ username: string; email: string } | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [view, setView] = useState<View>('record')
  const [directory, setDirectory] = useState<DirectoryHandle | null>(null)
  const [folderLabel, setFolderLabel] = useState('No folder selected')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [pendingSource, setPendingSource] = useState('screen')
  const [filename, setFilename] = useState('Capture recording')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    api('/api/v1/auth/session').then(async (response) => { if (response.ok) setUser((await response.json()).user) }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!user) return
    api('/api/v1/recordings').then(async (response) => { if (response.ok) setRecordings((await response.json()).recordings) }).catch(() => undefined)
  }, [user])

  useEffect(() => {
    if (!isRecording || isPaused) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isPaused, isRecording])

  const filteredRecordings = useMemo(() => recordings.filter((recording) => recording.title.toLowerCase().includes(query.toLowerCase())), [query, recordings])
  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 3000) }

  async function chooseFolder() {
    if (!('showDirectoryPicker' in window)) { notify('Local folders require Chrome desktop. Downloads are the fallback in other browsers.'); return }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' }) as DirectoryHandle
      const permission = await handle.requestPermission({ mode: 'readwrite' })
      if (permission !== 'granted') { notify('Folder permission was not granted.'); return }
      setDirectory(handle)
      setFolderLabel(handle.name)
      notify(`Recordings will be saved in ${handle.name}.`)
    } catch { notify('Folder selection was cancelled.') }
  }

  async function startRecording() {
    if (!directory) { notify('Choose a local folder before recording.'); return }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onstop = () => { setPendingBlob(new Blob(chunksRef.current, { type: mimeType })); setPendingSource('screen'); stream.getTracks().forEach((track) => track.stop()) }
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (recorder.state !== 'inactive') recorder.stop(); setIsRecording(false) })
      recorder.start(1000)
      recorderRef.current = recorder
      streamRef.current = stream
      setIsRecording(true)
      setIsPaused(false)
      setSeconds(0)
      notify('Recording started.')
    } catch { notify('Screen permission was cancelled. Nothing was saved.') }
  }

  function togglePause() {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') { recorder.pause(); setIsPaused(true) } else if (recorder.state === 'paused') { recorder.resume(); setIsPaused(false) }
  }

  function stopRecording() {
    if (!recorderRef.current) return
    recorderRef.current.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
    setIsRecording(false)
    setIsPaused(false)
  }

  async function saveRecording() {
    if (!pendingBlob || !directory) return
    const cleanName = filename.trim().replace(/[\\/:*?"<>|]/g, '-') || 'Capture recording'
    const fileName = `${cleanName}.webm`
    try {
      const permission = await directory.requestPermission({ mode: 'readwrite' })
      if (permission !== 'granted') throw new Error('permission')
      const fileHandle = await directory.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(pendingBlob)
      await writable.close()
      const response = await api('/api/v1/recordings', { method: 'POST', body: JSON.stringify({ title: cleanName, durationMs: seconds * 1000, provider: 'local', storagePath: `${folderLabel} / ${fileName}`, captureSource: pendingSource }) })
      if (!response.ok) throw new Error('metadata')
      const refreshed = await api('/api/v1/recordings')
      if (refreshed.ok) setRecordings((await refreshed.json()).recordings)
      setPendingBlob(null)
      setFilename('Capture recording')
      setSeconds(0)
      setView('recordings')
      notify(`${fileName} saved to ${folderLabel}.`)
    } catch { notify('The video could not be saved. Your recording is still available to retry.') }
  }

  async function signOut() { await api('/api/v1/auth/logout', { method: 'POST' }); setUser(null); setRecordings([]) }

  if (!user) return <AuthScreen mode={authMode} setMode={setAuthMode} onAuthenticated={setUser} />
  return <div className="app-shell"><aside className="sidebar"><div className="brand-row"><div className="brand-mark"><Video size={17} /></div><span>capture</span></div><div className="privacy-chip"><ShieldCheck size={14} /> Private by default</div><nav className="main-nav"><p className="nav-label">Workspace</p><NavItem icon={<Video size={17} />} label="Record" active={view === 'record'} onClick={() => setView('record')} /><NavItem icon={<Archive size={17} />} label="Recordings" count={recordings.length} active={view === 'recordings'} onClick={() => setView('recordings')} /><NavItem icon={<HardDrive size={17} />} label="Storage" active={view === 'storage'} onClick={() => setView('storage')} /><p className="nav-label nav-label-spaced">Manage</p><NavItem icon={<Settings size={17} />} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} /></nav><div className="sidebar-bottom"><div className="help-row"><CircleHelp size={16} /><span>How Capture works</span><ArrowRight size={14} /></div><button className="user-card" onClick={signOut}><span className="avatar">{user.username.slice(0, 2).toUpperCase()}</span><span className="user-meta"><strong>{user.username}</strong><small>{user.email}</small></span><LogOut size={15} /></button></div></aside><main className="main-content"><header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation"><Menu size={20} /></button><span className="breadcrumb">Personal space <ChevronDown size={14} /></span><div className="topbar-actions"><CircleHelp size={18} /><span className="top-avatar">{user.username.slice(0, 2).toUpperCase()}</span></div></header><div className="page-wrap">{view === 'record' && <RecordView folderLabel={folderLabel} hasFolder={Boolean(directory)} chooseFolder={chooseFolder} isRecording={isRecording} isPaused={isPaused} seconds={seconds} startRecording={startRecording} stopRecording={stopRecording} togglePause={togglePause} pendingBlob={pendingBlob} filename={filename} setFilename={setFilename} saveRecording={saveRecording} />}{view === 'recordings' && <RecordingsView recordings={filteredRecordings} query={query} setQuery={setQuery} copyPath={(path) => { navigator.clipboard?.writeText(path); notify('Location copied.') }} />}{view === 'storage' && <StorageView folderLabel={folderLabel} chooseFolder={chooseFolder} hasFolder={Boolean(directory)} />}{view === 'settings' && <SettingsView user={user} />}</div></main>{message && <div className="toast"><Check size={16} /> {message}</div>}</div>
}

function AuthScreen({ mode, setMode, onAuthenticated }: { mode: 'login' | 'signup'; setMode: (mode: 'login' | 'signup') => void; onAuthenticated: (user: { username: string; email: string }) => void }) { const [error, setError] = useState(''); const [busy, setBusy] = useState(false); async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); const form = new FormData(event.currentTarget); const response = await api(`/api/v1/auth/${mode === 'signup' ? 'signup' : 'login'}`, { method: 'POST', body: JSON.stringify({ username: form.get('username'), email: form.get('email') || undefined, password: form.get('password') }) }); const data = await response.json(); setBusy(false); if (!response.ok) { setError(data.error?.message || 'Unable to continue.'); return } onAuthenticated(data.user) } return <main className="auth-screen"><div className="auth-brand"><div className="brand-mark"><Video size={17} /></div><span>capture</span></div><div className="auth-card"><div className="auth-intro"><p className="eyebrow">Private by default</p><h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1><p>{mode === 'login' ? 'Your recordings stay in the places you choose.' : 'A private home for the screen recordings you own.'}</p></div><form className="auth-form" onSubmit={submit}><label>Username<input name="username" required minLength={3} autoComplete="username" placeholder="alex" /></label>{mode === 'signup' && <label>Email<input name="email" type="email" required autoComplete="email" placeholder="alex@company.com" /></label>}<label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-submit" disabled={busy}>{busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button></form><div className="auth-switch">{mode === 'login' ? <><span>New to Capture?</span><button onClick={() => setMode('signup')}>Create an account</button></> : <><span>Already have an account?</span><button onClick={() => setMode('login')}>Sign in</button></>}</div></div><p className="auth-footer"><ShieldCheck size={14} /> Your videos never pass through Capture servers.</p></main> }

function NavItem({ icon, label, active, count, onClick }: { icon: React.ReactNode; label: string; active: boolean; count?: number; onClick: () => void }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <em>{count}</em>}</button> }
function RecordView({ folderLabel, hasFolder, chooseFolder, isRecording, isPaused, seconds, startRecording, stopRecording, togglePause, pendingBlob, filename, setFilename, saveRecording }: { folderLabel: string; hasFolder: boolean; chooseFolder: () => void; isRecording: boolean; isPaused: boolean; seconds: number; startRecording: () => void; stopRecording: () => void; togglePause: () => void; pendingBlob: Blob | null; filename: string; setFilename: (value: string) => void; saveRecording: () => void }) { return <><div className="page-heading"><div><p className="eyebrow">Local-first recording</p><h1>Make your point clear.</h1><p className="heading-subtitle">Record your screen, save it to your own folder, and keep moving.</p></div></div><section className="record-card"><div className="record-card-copy"><span className="status-dot" /> <span>{isRecording ? isPaused ? 'Recording paused' : 'Recording in progress' : 'Ready when you are'}</span><h2>{isRecording ? `Capturing · ${formatTime(seconds)}` : 'What will you capture today?'}</h2><p>{hasFolder ? `Videos will be written directly to ${folderLabel}.` : 'Choose a local folder first. Capture never uploads your video.'}</p></div><div className="record-actions">{!hasFolder && !pendingBlob && <button className="secondary-button" onClick={chooseFolder}><FolderOpen size={16} /> Choose local folder</button>}{hasFolder && !isRecording && !pendingBlob && <button className="record-button" onClick={startRecording}><Video size={18} fill="currentColor" /> Start recording <span className="shortcut">⌘ R</span></button>}{isRecording && <div className="recording-controls"><button className="control-button pause" onClick={togglePause}>{isPaused ? <Play size={17} /> : <Pause size={17} />} {isPaused ? 'Resume' : 'Pause'}</button><button className="control-button stop" onClick={stopRecording}><Square size={15} fill="currentColor" /> Stop</button></div>}</div></section>{pendingBlob && <section className="save-panel"><div><p className="eyebrow">Recording ready</p><h2>Save your WebM file</h2><p>Review the filename before writing it to {folderLabel}.</p></div><div className="save-form"><label>File name<input value={filename} onChange={(event) => setFilename(event.target.value)} autoFocus /><small>.webm will be added automatically</small></label><button className="record-button" onClick={saveRecording}><HardDrive size={16} /> Save to local folder</button></div></section>}<div className="section-header"><div><h3>How local saving works</h3><p>Your browser writes the file directly to the folder you approve.</p></div></div><div className="steps"><div><span>01</span><strong>Choose a folder</strong><p>Capture asks for write permission once.</p></div><div><span>02</span><strong>Record in WebM</strong><p>Video stays in this browser tab.</p></div><div><span>03</span><strong>Save and find it</strong><p>Metadata helps you remember the path.</p></div></div></> }
function RecordingsView({ recordings, query, setQuery, copyPath }: { recordings: Recording[]; query: string; setQuery: (value: string) => void; copyPath: (path: string) => void }) { return <><div className="page-heading compact"><div><p className="eyebrow">Library</p><h1>Your recordings</h1><p className="heading-subtitle">A private index of files saved to your own storage.</p></div></div><div className="library-toolbar"><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recordings" /></label></div><div className="library-list">{recordings.length ? recordings.map((recording) => <article className="library-row" key={recording.id}><div className="thumbnail small-thumb coral"><div className="thumbnail-window"><span /><span /><span /></div><span className="duration">{formatTime(recording.durationMs / 1000)}</span></div><div className="library-main"><h3>{recording.title}.webm</h3><p>{new Date(recording.createdAt).toLocaleString()} · {recording.storagePath}</p><div className="recording-card-meta"><span className="provider-pill local"><FolderOpen size={13} /> Local folder</span><span className="tag-pill"><Tag size={12} /> WebM</span></div></div><button className="icon-button" onClick={() => copyPath(recording.storagePath)} aria-label="Copy storage path"><Copy size={16} /></button><button className="icon-button" aria-label="More actions"><MoreHorizontal size={17} /></button></article>) : <div className="empty-state"><Archive size={28} /><h3>No recordings yet</h3><p>Choose a folder and make your first capture.</p></div>}</div></> }
function StorageView({ folderLabel, chooseFolder, hasFolder }: { folderLabel: string; chooseFolder: () => void; hasFolder: boolean }) { return <><div className="page-heading compact"><div><p className="eyebrow">Storage</p><h1>Your local folder</h1><p className="heading-subtitle">Capture writes WebM files directly to your computer.</p></div></div><section className="storage-panel"><div className="panel-heading"><div><h2>Local Folder</h2><p>{hasFolder ? folderLabel : 'No folder selected yet'}</p></div><span className="secure-label"><ShieldCheck size={14} /> Browser permission</span></div><button className="storage-option selected" onClick={chooseFolder}><span className="storage-option-icon"><FolderOpen size={20} /></span><span className="storage-option-copy"><strong>{hasFolder ? 'Change folder' : 'Choose a folder'}</strong><small>Files are saved as .webm recordings</small></span><ArrowRight size={17} /></button></section><section className="privacy-banner"><div className="banner-icon"><ShieldCheck size={18} /></div><div><strong>Capture does not store video files.</strong><p>Only the filename, duration, path label, and save time are kept in your account.</p></div></section></> }
function SettingsView({ user }: { user: { username: string; email: string } }) { return <><div className="page-heading compact"><div><p className="eyebrow">Account</p><h1>Settings</h1><p className="heading-subtitle">Your Capture account details.</p></div></div><section className="settings-panel"><div className="settings-section"><div><h2>Profile</h2><p>Stored securely in the Capture database.</p></div><div className="settings-fields"><label>Username<input value={user.username} readOnly /></label><label>Email<input value={user.email} readOnly /></label></div></div></section></> }
function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` }

export default App
