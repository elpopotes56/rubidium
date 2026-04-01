import { Router } from "express";
import { z } from "zod";

import { isDemoUser } from "../lib/demo.js";
import { prisma } from "../lib/prisma.js";
import { solveConstantVolumeMixing } from "../lib/mixing.js";
import { requireAuth } from "../middleware/auth.js";

const solveMixingSchema = z.object({
  initialVolumeLiters: z.number().positive(),
  initialSoluteKg: z.number().min(0),
  inflowRateLitersPerMin: z.number().positive(),
  outflowRateLitersPerMin: z.number().positive(),
  inflowConcentrationKgPerLiter: z.number().min(0)
});

export const mixingRouter = Router();

mixingRouter.use(requireAuth);

mixingRouter.post("/solve", async (req, res) => {
  const userId = req.user?.sub;
  const email = req.user?.email ?? null;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const payload = solveMixingSchema.parse(req.body);
  const solution = solveConstantVolumeMixing(payload);

  if (isDemoUser(email)) {
    return res.status(201).json({
      data: {
        id: crypto.randomUUID(),
        userId,
        title: solution.title,
        prompt: solution.prompt,
        normalizedText: solution.normalizedText,
        status: "solved",
        inputType: "text",
        finalAnswer: solution.finalAnswer,
        explanation: solution.explanation,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: solution.steps.map((step) => ({
          id: crypto.randomUUID(),
          stepNumber: step.stepNumber,
          title: step.title,
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
    update: { email },
    create: { id: userId, email }
  });

  const problem = await prisma.problem.create({
    data: {
      userId,
      title: solution.title,
      prompt: solution.prompt,
      normalizedText: solution.normalizedText,
      status: "solved",
      inputType: "text",
      finalAnswer: solution.finalAnswer,
      explanation: solution.explanation,
      steps: {
        create: solution.steps.map((step) => ({
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
    },
    include: {
      steps: {
        orderBy: { stepNumber: "asc" }
      }
    }
  });

  return res.status(201).json({ data: problem });
});
