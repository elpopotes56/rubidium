import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { historyRouter } from "./routes/history.js";
import { mixingRouter } from "./routes/mixing.js";
import { voiceRouter } from "./routes/voice.js";

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

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`API running on http://0.0.0.0:${env.PORT}`);
});
