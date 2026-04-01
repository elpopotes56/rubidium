import type { NextFunction, Request, Response } from "express";

import { supabase } from "../lib/supabase.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token." });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    req.user = {
      sub: data.user.id,
      email: data.user.email,
      role: data.user.role
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}
