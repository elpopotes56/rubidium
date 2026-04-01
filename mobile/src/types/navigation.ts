import type { Session } from "@supabase/supabase-js";
import type { Problem } from "./history";

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  Home: { session: Session };
  ProblemDetail: { problemId: string; initialProblem: Problem; demoMode?: boolean };
};
