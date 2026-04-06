import { supabase } from "./supabase";

// When using `adb reverse tcp:PORT tcp:PORT`, 127.0.0.1 on the device is
// tunnelled directly to the PC — do NOT remap the hostname.
// If you ever switch to Wi-Fi (no USB cable), change EXPO_PUBLIC_API_URL to
// the PC's local IP (e.g. http://192.168.x.x:4000) instead.
function normalizeApiUrl(rawUrl: string) {
  return rawUrl.trim().replace(/\/$/, "");
}

const apiUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL ?? "");

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? "Request failed.");
  }

  return response.json();
}
