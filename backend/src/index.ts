import cors from "cors";
import express from "express";

// Log all env vars available at startup for Railway debugging
console.log("[startup] NODE_ENV:", process.env.NODE_ENV);
console.log("[startup] PORT from env:", process.env.PORT);
console.log("[startup] DATABASE_URL set:", !!process.env.DATABASE_URL);
console.log("[startup] SUPABASE_URL set:", !!process.env.SUPABASE_URL);
console.log("[startup] SUPABASE_ANON_KEY set:", !!process.env.SUPABASE_ANON_KEY);

import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { historyRouter } from "./routes/history.js";
import { mixingRouter } from "./routes/mixing.js";
import { voiceRouter } from "./routes/voice.js";

console.log("[startup] env parsed OK, PORT =", env.PORT);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/health", healthRouter);
app.use("/history", historyRouter);
app.use("/mixing", mixingRouter);
app.use("/voice", voiceRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(500).json({ error: "Unexpected server error." });
});

const port = env.PORT;
app.listen(port, "0.0.0.0", () => {
  console.log(`[startup] API running on http://0.0.0.0:${port}`);
});
