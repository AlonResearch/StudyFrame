import type {
  StudyFeedbackInput,
  StudyFeedbackResponse,
  StudyFeedbackResult,
} from "@t3tools/contracts";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";

export async function requestStudyFeedback(
  input: StudyFeedbackInput,
): Promise<StudyFeedbackResult | null> {
  const response = await fetch(resolvePrimaryEnvironmentHttpUrl("/api/studyframe/feedback"), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) return null;
  return ((await response.json()) as StudyFeedbackResponse).feedback;
}
