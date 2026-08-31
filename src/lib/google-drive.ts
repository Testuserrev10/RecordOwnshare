export type GoogleTokenClient = { requestAccessToken: () => void };

declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: (response: { access_token?: string; error?: string }) => void }) => GoogleTokenClient } } };
  }
}

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export function requestDriveToken(clientId: string) {
  return new Promise<string>((resolve, reject) => {
    if (!window.google) return reject(new Error("Google Identity Services is not loaded."));
    const client = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: DRIVE_SCOPE, callback: (response) => response.access_token ? resolve(response.access_token) : reject(new Error(response.error ?? "Google authorization failed.")) });
    client.requestAccessToken();
  });
}

export async function uploadToDrive(blob: Blob, fileName: string, accessToken: string) {
  const boundary = `capture_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: fileName, mimeType: blob.type || "video/webm" });
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${blob.type || "video/webm"}\r\n\r\n`, blob, `\r\n--${boundary}--`]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  if (!response.ok) {
    let reason = "Google Drive rejected the upload.";
    try {
      const payload = await response.json() as { error?: { message?: string } };
      if (payload.error?.message) reason = payload.error.message;
    } catch (parseError) {
      console.warn("Google Drive returned a non-JSON upload error", parseError);
    }
    throw new Error(`Drive upload failed (${response.status}): ${reason}`);
  }
  return response.json() as Promise<{ id: string; webViewLink?: string }>;
}
