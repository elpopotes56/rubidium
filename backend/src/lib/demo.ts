import { env } from "../config/env.js";

export function isDemoUser(email?: string | null) {
  if (!email || !env.DEMO_EMAIL) {
    return false;
  }

  return email.toLowerCase() === env.DEMO_EMAIL.toLowerCase();
}
