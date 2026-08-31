declare global {
  interface Window {
    showDirectoryPicker: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  }
}

const DB_NAME = "capture-local";
const STORE = "handles";

export function supportsLocalRecording() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window && "MediaRecorder" in window && "mediaDevices" in navigator;
}

function openStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
  const database = await openStore();
  await new Promise<void>((resolve, reject) => { const tx = database.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(handle, "default"); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}

export async function getDirectoryHandle() {
  const database = await openStore();
  return new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => { const tx = database.transaction(STORE, "readonly"); const request = tx.objectStore(STORE).get("default"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

export async function pickDirectory() {
  const handle = await window.showDirectoryPicker({ mode: "readwrite" });
  await saveDirectoryHandle(handle);
  return handle;
}

export async function ensureDirectoryWritePermission(handle: FileSystemDirectoryHandle) {
  const permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission === "granted") return;
  if (permission === "prompt") {
    const requested = await handle.requestPermission({ mode: "readwrite" });
    if (requested === "granted") return;
  }
  throw new Error("Local folder write permission was not granted.");
}

export async function writeRecording(blob: Blob, fileName: string, handle: FileSystemDirectoryHandle) {
  const file = await handle.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
}

export function getMimeType() {
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
}
