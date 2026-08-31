import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Copy,
  FolderOpen,
  HardDrive,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Tag,
  UserRound,
  Video,
  X,
} from 'lucide-react'
import './App.css'

type View = 'overview' | 'recordings' | 'storage' | 'settings'
type Destination = 'local' | 'drive'
type Recording = {
  id: string
  title: string
  duration: string
  date: string
  destination: Destination
  path: string
  tag: string
  color: string
}

const initialRecordings: Recording[] = [
  {
    id: '1',
    title: 'Checkout flow — payment retry',
    duration: '02:14',
    date: 'Today, 10:42 AM',
    destination: 'local',
    path: 'Capture recordings / Product QA',
    tag: 'QA review',
    color: 'coral',
  },
  {
    id: '2',
    title: 'Onboarding walkthrough',
    duration: '05:38',
    date: 'Yesterday, 4:18 PM',
    destination: 'drive',
    path: 'My Drive / Capture / Demos',
    tag: 'Demo',
    color: 'blue',
  },
  {
    id: '3',
    title: 'Header interaction notes',
    duration: '01:07',
    date: 'Mon, 9:06 AM',
    destination: 'local',
    path: 'Capture recordings / Design',
    tag: 'Design',
    color: 'violet',
  },
]

function App() {
  const [view, setView] = useState<View>('overview')
  const [destination, setDestination] = useState<Destination>('local')
  const [recordings, setRecordings] = useState(initialRecordings)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [showDestinationMenu, setShowDestinationMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showToast, setShowToast] = useState('')
  const [search, setSearch] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    }
    return () => window.clearInterval(timerRef.current)
  }, [isPaused, isRecording])

  const filteredRecordings = useMemo(
    () => recordings.filter((recording) => recording.title.toLowerCase().includes(search.toLowerCase())),
    [recordings, search],
  )

  function notify(message: string) {
    setShowToast(message)
    window.setTimeout(() => setShowToast(''), 2600)
  }

  function startRecording() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      notify('Screen recording is not supported in this browser.')
      return
    }
    setSeconds(0)
    setIsRecording(true)
    setIsPaused(false)
    notify('Choose a screen, window, or browser tab to begin.')
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then((stream) => {
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopRecording())
    }).catch(() => {
      setIsRecording(false)
      notify('Screen permission was cancelled. Nothing was saved.')
    })
  }

  function stopRecording() {
    setIsRecording(false)
    setIsPaused(false)
    if (seconds > 0) {
      const newRecording: Recording = {
        id: String(Date.now()),
        title: 'Untitled recording',
        duration: formatTime(seconds),
        date: 'Just now',
        destination,
        path: destination === 'local' ? 'Capture recordings / New recording' : 'My Drive / Capture',
        tag: 'Unsorted',
        color: 'amber',
      }
      setRecordings((current) => [newRecording, ...current])
      notify(`Recording saved to ${destination === 'local' ? 'your folder' : 'Google Drive'}.`)
      setView('recordings')
    }
    setSeconds(0)
  }

  function formatTime(value: number) {
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  }

  function copyPath(path: string) {
    navigator.clipboard?.writeText(path)
    notify('Location copied to clipboard.')
  }

  function deleteRecording(id: string) {
    setRecordings((current) => current.filter((recording) => recording.id !== id))
    notify('Recording metadata removed.')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Video size={17} strokeWidth={2.5} /></div>
          <span>capture</span>
          <button className="icon-button sidebar-close" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="privacy-chip"><ShieldCheck size={14} /><span>Private by default</span></div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          <NavItem icon={<Video size={17} />} label="Record" active={view === 'overview'} onClick={() => { setView('overview'); setMobileNav(false) }} />
          <NavItem icon={<Archive size={17} />} label="Recordings" active={view === 'recordings'} count={recordings.length} onClick={() => { setView('recordings'); setMobileNav(false) }} />
          <NavItem icon={<HardDrive size={17} />} label="Storage" active={view === 'storage'} onClick={() => { setView('storage'); setMobileNav(false) }} />
          <p className="nav-label nav-label-spaced">Manage</p>
          <NavItem icon={<Settings size={17} />} label="Settings" active={view === 'settings'} onClick={() => { setView('settings'); setMobileNav(false) }} />
        </nav>
        <div className="sidebar-bottom">
          <div className="help-row"><CircleHelp size={16} /><span>How Capture works</span><ArrowRight size={14} /></div>
          <div className="user-card" onClick={() => setShowProfileMenu((value) => !value)} role="button" tabIndex={0}>
            <div className="avatar">AM</div><div className="user-meta"><strong>Alex Morgan</strong><span>Personal space</span></div><MoreHorizontal size={17} />
          </div>
          {showProfileMenu && <div className="profile-popover"><button><UserRound size={15} /> Profile</button><button><LogOut size={15} /> Sign out</button></div>}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Personal space</span><ChevronDown size={14} /></div>
          <div className="topbar-actions"><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><div className="top-avatar">AM</div></div>
        </header>
        <div className="page-wrap">
          {view === 'overview' && <Overview destination={destination} setDestination={setDestination} showDestinationMenu={showDestinationMenu} setShowDestinationMenu={setShowDestinationMenu} isRecording={isRecording} isPaused={isPaused} seconds={seconds} startRecording={startRecording} stopRecording={stopRecording} setIsPaused={setIsPaused} recordings={recordings} setView={setView} />}
          {view === 'recordings' && <Recordings recordings={filteredRecordings} search={search} setSearch={setSearch} copyPath={copyPath} deleteRecording={deleteRecording} />}
          {view === 'storage' && <Storage destination={destination} setDestination={setDestination} notify={notify} />}
          {view === 'settings' && <SettingsView notify={notify} />}
        </div>
      </main>
      {showToast && <div className="toast"><Check size={16} /> {showToast}</div>}
    </div>
  )
}

function NavItem({ icon, label, active, count, onClick }: { icon: React.ReactNode; label: string; active: boolean; count?: number; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <em>{count}</em>}</button>
}

function Overview(props: { destination: Destination; setDestination: (value: Destination) => void; showDestinationMenu: boolean; setShowDestinationMenu: (value: boolean) => void; isRecording: boolean; isPaused: boolean; seconds: number; startRecording: () => void; stopRecording: () => void; setIsPaused: (value: boolean) => void; recordings: Recording[]; setView: (view: View) => void }) {
  const { destination, setDestination, showDestinationMenu, setShowDestinationMenu, isRecording, isPaused, seconds, startRecording, stopRecording, setIsPaused, recordings, setView } = props
  return <>
    <div className="page-heading"><div><p className="eyebrow">Thursday, October 24, 2024</p><h1>Good morning, Alex</h1><p className="heading-subtitle">Record something worth remembering.</p></div><button className="secondary-button"><LockKeyhole size={15} /> Your data stays yours</button></div>
    <section className="record-card">
      <div className="record-card-copy"><span className="status-dot" /> <span>{isRecording ? (isPaused ? 'Recording paused' : 'Recording in progress') : 'Ready when you are'}</span><h2>{isRecording ? 'Capturing your screen' : 'What will you capture today?'}</h2><p>Everything you record goes directly to your chosen destination. Capture never stores your video.</p></div>
      <div className="record-actions">
        <div className="destination-select-wrap"><button className="destination-select" onClick={() => setShowDestinationMenu(!showDestinationMenu)}><span className={`destination-icon ${destination}`} >{destination === 'local' ? <FolderOpen size={15} /> : <Cloud size={15} />}</span><span>{destination === 'local' ? 'Local folder' : 'Google Drive'}</span><ChevronDown size={15} /></button>{showDestinationMenu && <div className="destination-menu"><button onClick={() => { setDestination('local'); setShowDestinationMenu(false) }}><FolderOpen size={16} /><span><strong>Local folder</strong><small>Capture recordings /</small></span>{destination === 'local' && <Check size={15} />}</button><button onClick={() => { setDestination('drive'); setShowDestinationMenu(false) }}><Cloud size={16} /><span><strong>Google Drive</strong><small>My Drive / Capture</small></span>{destination === 'drive' && <Check size={15} />}</button></div>}</div>
        {!isRecording ? <button className="record-button" onClick={startRecording}><span className="record-button-icon"><Video size={20} fill="currentColor" /></span> Start recording <span className="shortcut">⌘ R</span></button> : <div className="recording-controls"><button className="control-button pause" onClick={() => setIsPaused(!isPaused)}>{isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}<span>{isPaused ? 'Resume' : 'Pause'}</span></button><button className="control-button stop" onClick={stopRecording}><Square size={16} fill="currentColor" /><span>Stop</span></button><strong className="live-timer">{formatTime(seconds)}</strong></div>}
      </div>
    </section>
    <div className="section-header"><div><h3>Recent recordings</h3><p>Your latest captures, saved to your own storage.</p></div><button className="text-button" onClick={() => setView('recordings')}>View all <ArrowRight size={15} /></button></div>
    <div className="recording-grid">{recordings.slice(0, 3).map((recording) => <RecordingCard key={recording.id} recording={recording} />)}</div>
    <section className="privacy-banner"><div className="banner-icon"><ShieldCheck size={18} /></div><div><strong>Your recordings never pass through Capture.</strong><p>We only keep the details needed to show you what you saved and where it lives.</p></div><button className="text-button">Learn more <ArrowRight size={15} /></button></section>
  </>
}

function RecordingCard({ recording }: { recording: Recording }) {
  return <article className="recording-card"><div className={`thumbnail ${recording.color}`}><div className="thumbnail-window"><span /><span /><span /><div className="thumbnail-lines" /></div><span className="duration">{recording.duration}</span></div><div className="recording-card-info"><div><h4>{recording.title}</h4><p>{recording.date}</p></div><button className="icon-button" aria-label="More recording actions"><MoreHorizontal size={18} /></button></div><div className="recording-card-meta"><span className={`provider-pill ${recording.destination}`}>{recording.destination === 'local' ? <FolderOpen size={13} /> : <Cloud size={13} />}{recording.destination === 'local' ? 'Local folder' : 'Google Drive'}</span><span className="tag-pill"><Tag size={12} />{recording.tag}</span></div></article>
}

function Recordings({ recordings, search, setSearch, copyPath, deleteRecording }: { recordings: Recording[]; search: string; setSearch: (value: string) => void; copyPath: (path: string) => void; deleteRecording: (id: string) => void }) {
  return <><div className="page-heading compact"><div><p className="eyebrow">Library</p><h1>Your recordings</h1><p className="heading-subtitle">A private index of everything you have captured.</p></div><button className="record-button small"><Video size={16} fill="currentColor" /> Start recording</button></div><div className="library-toolbar"><label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recordings" /></label><button className="filter-button">All destinations <ChevronDown size={15} /></button><button className="filter-button">Newest first <ChevronDown size={15} /></button></div><div className="library-list">{recordings.length ? recordings.map((recording) => <article className="library-row" key={recording.id}><div className={`thumbnail small-thumb ${recording.color}`}><div className="thumbnail-window"><span /><span /><span /></div><span className="duration">{recording.duration}</span></div><div className="library-main"><h3>{recording.title}</h3><p>{recording.date} · {recording.path}</p><div className="recording-card-meta"><span className={`provider-pill ${recording.destination}`}>{recording.destination === 'local' ? <FolderOpen size={13} /> : <Cloud size={13} />}{recording.destination === 'local' ? 'Local folder' : 'Google Drive'}</span><span className="tag-pill"><Tag size={12} />{recording.tag}</span></div></div><div className="row-actions"><button className="icon-button" onClick={() => copyPath(recording.path)} aria-label="Copy location"><Copy size={16} /></button><button className="icon-button danger-hover" onClick={() => deleteRecording(recording.id)} aria-label="Delete recording metadata"><X size={16} /></button></div></article>) : <div className="empty-state"><Archive size={28} /><h3>No recordings found</h3><p>Try a different search or start a new recording.</p></div>}</div></>
}

function Storage({ destination, setDestination, notify }: { destination: Destination; setDestination: (value: Destination) => void; notify: (message: string) => void }) {
  return <><div className="page-heading compact"><div><p className="eyebrow">Preferences</p><h1>Where things go</h1><p className="heading-subtitle">Choose the destination Capture uses after you stop recording.</p></div></div><section className="storage-panel"><div className="panel-heading"><div><h2>Connected destinations</h2><p>Capture writes your video directly to these locations.</p></div><span className="secure-label"><ShieldCheck size={14} /> Encrypted connection</span></div><StorageOption icon={<FolderOpen size={20} />} title="Local folder" description="Capture recordings /" status="Ready on this device" active={destination === 'local'} onClick={() => { setDestination('local'); notify('Local folder is now your default.') }} /><StorageOption icon={<Cloud size={20} />} title="Google Drive" description="My Drive / Capture" status="Connected as alex@northstar.dev" active={destination === 'drive'} onClick={() => { setDestination('drive'); notify('Google Drive is now your default.') }} connected /><button className="add-destination"><Plus size={17} /> Connect another destination <span>Later</span></button></section><section className="privacy-card"><div className="banner-icon"><LockKeyhole size={18} /></div><div><h3>Built for privacy</h3><p>Capture stores only recording details like title, duration, destination and path. Your video stays in the location you choose.</p></div></section></>
}

function StorageOption({ icon, title, description, status, active, onClick, connected }: { icon: React.ReactNode; title: string; description: string; status: string; active: boolean; onClick: () => void; connected?: boolean }) {
  return <button className={`storage-option ${active ? 'selected' : ''}`} onClick={onClick}><span className="storage-option-icon">{icon}</span><span className="storage-option-copy"><strong>{title}</strong><small>{description}</small></span><span className="storage-status"><span className="status-dot" />{status}</span>{connected && <span className="connected-badge">Connected</span>}{active && <Check className="selected-check" size={18} />}</button>
}

function SettingsView({ notify }: { notify: (message: string) => void }) {
  return <><div className="page-heading compact"><div><p className="eyebrow">Account</p><h1>Settings</h1><p className="heading-subtitle">Small details that make Capture feel like yours.</p></div></div><section className="settings-panel"><div className="settings-section"><div><h2>Profile</h2><p>Your account details.</p></div><div className="settings-fields"><label>Username<input defaultValue="alexmorgan" /></label><label>Email<input defaultValue="alex@northstar.dev" /></label><button className="secondary-button save-settings" onClick={() => notify('Profile changes saved.')}>Save changes</button></div></div><div className="settings-section"><div><h2>Recording defaults</h2><p>Set up your ideal starting point.</p></div><div className="settings-fields"><label className="toggle-row"><span><strong>Microphone</strong><small>Ask before each recording</small></span><span className="toggle on"><span /></span></label><label className="toggle-row"><span><strong>System audio</strong><small>Use when available</small></span><span className="toggle"><span /></span></label></div></div></section></>
}

function formatTime(value: number) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` }

export default App
