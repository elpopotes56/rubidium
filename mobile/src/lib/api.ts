import { NativeModules, Platform } from "react-native";

import { supabase } from "./supabase";

function normalizeApiUrl(rawUrl: string) {
  const trimmedUrl = rawUrl.trim();

  if (!trimmedUrl) {
    return "";
  }

  // When the app runs on a physical device, localhost/127.0.0.1 point to the
  // phone itself. In dev we can infer the computer host from Metro's bundle URL.
  if (Platform.OS !== "web") {
    try {
      const parsedUrl = new URL(trimmedUrl);

      if (parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost") {
        const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;

        if (scriptUrl) {
          const bundleUrl = new URL(scriptUrl);
          parsedUrl.hostname = bundleUrl.hostname;
          return parsedUrl.toString().replace(/\/$/, "");
        }
      }
    } catch {
      return trimmedUrl.replace(/\/$/, "");
    }
  }

  return trimmedUrl.replace(/\/$/, "");
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
