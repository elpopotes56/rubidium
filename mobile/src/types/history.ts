export type SolutionStep = {
  id: string;
  stepNumber: number;
  title?: string | null;
  explanation: string;
  latex?: string | null;
};

export type Problem = {
  id: string;
  title?: string | null;
  prompt: string;
  normalizedText?: string | null;
  finalAnswer?: string | null;
  explanation?: string | null;
  status: "pending" | "solved" | "failed";
  inputType: "text" | "voice" | "image";
  createdAt: string;
  steps: SolutionStep[];
};
