import { Router } from "express";
import { z } from "zod";

import { isDemoUser } from "../lib/demo.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const createVoiceSessionSchema = z.object({
  problemId: z.string().uuid().nullable().optional(),
  provider: z.string().min(1).max(60).default("local-prep"),
  externalCallId: z.string().max(160).nullable().optional(),
  summary: z.string().max(500).nullable().optional(),
  transcript: z.string().nullable().optional()
});

const updateVoiceSessionSchema = z.object({
  externalCallId: z.string().max(160).nullable().optional(),
  summary: z.string().max(1000).nullable().optional(),
  transcript: z.string().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional()
});

const createVoiceMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000)
});

export const voiceRouter = Router();

voiceRouter.use(requireAuth);

voiceRouter.post("/sessions", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const payload = createVoiceSessionSchema.parse(req.body);

  if (isDemoUser(email)) {
    return res.status(201).json({
      data: {
        id: crypto.randomUUID(),
        userId,
        problemId: payload.problemId ?? null,
        provider: payload.provider,
        externalCallId: payload.externalCallId ?? null,
        transcript: payload.transcript ?? null,
        summary: payload.summary ?? "Sesion local en modo demo.",
        startedAt: new Date().toISOString(),
        endedAt: null,
        demoMode: true,
        messages: []
      }
    });
  }

  await prisma.profile.upsert({
    where: { id: userId },
    update: { email },
    create: {
      id: userId,
      email
    }
  });

  if (payload.problemId) {
    const problem = await prisma.problem.findFirst({
      where: {
        id: payload.problemId,
        userId
      },
      select: { id: true }
    });

    if (!problem) {
      return res.status(404).json({ error: "Problem not found for this voice session." });
    }
  }

  const session = await prisma.voiceSession.create({
    data: {
      userId,
      problemId: payload.problemId ?? undefined,
      provider: payload.provider,
      externalCallId: payload.externalCallId ?? undefined,
      summary: payload.summary ?? undefined,
      transcript: payload.transcript ?? undefined
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  return res.status(201).json({ data: session });
});

voiceRouter.post("/sessions/:sessionId/messages", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const payload = createVoiceMessageSchema.parse(req.body);

  if (isDemoUser(email)) {
    return res.status(201).json({
      data: {
        id: crypto.randomUUID(),
        voiceSessionId: req.params.sessionId,
        role: payload.role,
        content: payload.content,
        createdAt: new Date().toISOString(),
        demoMode: true
      }
    });
  }

  const session = await prisma.voiceSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId
    },
    select: {
      id: true,
      transcript: true
    }
  });

  if (!session) {
    return res.status(404).json({ error: "Voice session not found." });
  }

  const message = await prisma.voiceMessage.create({
    data: {
      voiceSessionId: session.id,
      role: payload.role,
      content: payload.content
    }
  });

  const transcriptEntry = `${payload.role === "assistant" ? "Rubidium" : "Usuario"}: ${payload.content}`;
  const nextTranscript = session.transcript ? `${session.transcript}\n${transcriptEntry}` : transcriptEntry;

  await prisma.voiceSession.update({
    where: { id: session.id },
    data: {
      transcript: nextTranscript
    }
  });

  return res.status(201).json({ data: message });
});

voiceRouter.patch("/sessions/:sessionId", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const payload = updateVoiceSessionSchema.parse(req.body);

  if (isDemoUser(email)) {
    return res.json({
      data: {
        id: req.params.sessionId,
        endedAt: payload.endedAt ?? null,
        externalCallId: payload.externalCallId ?? null,
        summary: payload.summary ?? null,
        transcript: payload.transcript ?? null,
        demoMode: true
      }
    });
  }

  const session = await prisma.voiceSession.findFirst({
    where: {
      id: req.params.sessionId,
      userId
    },
    select: { id: true }
  });

  if (!session) {
    return res.status(404).json({ error: "Voice session not found." });
  }

  const updatedSession = await prisma.voiceSession.update({
    where: { id: session.id },
    data: {
      externalCallId: payload.externalCallId === undefined ? undefined : payload.externalCallId,
      summary: payload.summary === undefined ? undefined : payload.summary,
      transcript: payload.transcript === undefined ? undefined : payload.transcript,
      endedAt: payload.endedAt === undefined ? undefined : payload.endedAt ? new Date(payload.endedAt) : null
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  return res.json({ data: updatedSession });
});
