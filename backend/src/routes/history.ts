import { Router } from "express";
import { z } from "zod";

import { isDemoUser } from "../lib/demo.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const createProblemSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  prompt: z.string().min(1),
  normalizedText: z.string().optional(),
  topicId: z.string().uuid().optional(),
  inputType: z.enum(["text", "voice", "image"]).default("text"),
  finalAnswer: z.string().optional(),
  explanation: z.string().optional(),
  status: z.enum(["pending", "solved", "failed"]).default("pending"),
  steps: z
    .array(
      z.object({
        stepNumber: z.number().int().positive(),
        title: z.string().max(120).optional(),
        explanation: z.string().min(1),
        latex: z.string().optional()
      })
    )
    .default([])
});

export const historyRouter = Router();

historyRouter.use(requireAuth);

historyRouter.get("/me", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (isDemoUser(email)) {
    return res.json({
      data: {
        id: userId,
        email,
        fullName: "Perfil demo",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        demoMode: true
      }
    });
  }

  const profile = await prisma.profile.upsert({
    where: { id: userId },
    update: {
      email
    },
    create: {
      id: userId,
      email
    }
  });

  return res.json({ data: profile });
});

historyRouter.get("/problems", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (isDemoUser(email)) {
    return res.json({ data: [], demoMode: true });
  }

  const problems = await prisma.problem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" }
      },
      topic: true,
      voiceSessions: {
        orderBy: { startedAt: "desc" },
        take: 1
      }
    }
  });

  res.json({ data: problems });
});

historyRouter.get("/problems/:problemId", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (isDemoUser(email)) {
    return res.status(404).json({ error: "Problem not found in demo mode." });
  }

  const problem = await prisma.problem.findFirst({
    where: {
      id: req.params.problemId,
      userId
    },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" }
      },
      topic: true,
      voiceSessions: {
        include: {
          messages: {
            orderBy: { createdAt: "asc" }
          }
        },
        orderBy: { startedAt: "desc" }
      }
    }
  });

  if (!problem) {
    return res.status(404).json({ error: "Problem not found." });
  }

  return res.json({ data: problem });
});

historyRouter.post("/problems", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const payload = createProblemSchema.parse(req.body);

  if (isDemoUser(email)) {
    return res.status(201).json({
      data: {
        id: crypto.randomUUID(),
        userId,
        title: payload.title ?? "Consulta demo",
        prompt: payload.prompt,
        normalizedText: payload.normalizedText ?? null,
        topicId: payload.topicId ?? null,
        inputType: payload.inputType,
        status: payload.status,
        finalAnswer: payload.finalAnswer ?? null,
        explanation: payload.explanation ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: payload.steps.map((step) => ({
          id: crypto.randomUUID(),
          stepNumber: step.stepNumber,
          title: step.title ?? null,
          explanation: step.explanation,
          latex: step.latex ?? null,
          createdAt: new Date().toISOString()
        })),
        demoMode: true
      }
    });
  }

  await prisma.profile.upsert({
    where: { id: userId },
    update: {
      email
    },
    create: {
      id: userId,
      email
    }
  });

  const problem = await prisma.problem.create({
    data: {
      userId,
      title: payload.title,
      prompt: payload.prompt,
      normalizedText: payload.normalizedText,
      topicId: payload.topicId,
      inputType: payload.inputType,
      finalAnswer: payload.finalAnswer,
      explanation: payload.explanation,
      status: payload.status,
      steps: payload.steps.length
        ? {
            create: payload.steps.map((step) => ({
              user: {
                connect: {
                  id: userId
                }
              },
              stepNumber: step.stepNumber,
              title: step.title,
              explanation: step.explanation,
              latex: step.latex
            }))
          }
        : undefined
    },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" }
      }
    }
  });

  res.status(201).json({ data: problem });
});

historyRouter.delete("/problems/:problemId", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (isDemoUser(email)) {
    // In demo mode, history is kept only in frontend state.
    // Returning success allows the mobile app to remove it from state.
    return res.json({ success: true, message: "Problem deleted from demo state." });
  }

  try {
    const problem = await prisma.problem.findFirst({
      where: {
        id: req.params.problemId,
        userId
      }
    });

    if (!problem) {
      return res.status(404).json({ error: "Problem not found." });
    }

    await prisma.problem.delete({
      where: { id: req.params.problemId }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting problem:", error);
    return res.status(500).json({ error: "Failed to delete problem." });
  }
});
