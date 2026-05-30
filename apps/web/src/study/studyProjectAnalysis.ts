import type { StudyAnalyzeProjectResponse } from "@t3tools/contracts";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";

export async function analyzeStudyProject(input: {
  readonly projectId: string;
}): Promise<StudyAnalyzeProjectResponse> {
  const response = await fetch(
    resolvePrimaryEnvironmentHttpUrl("/api/studyframe/analyze-project"),
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { readonly error?: string } | null;
    throw new Error(payload?.error ?? `Project analysis failed with HTTP ${response.status}`);
  }

  return (await response.json()) as StudyAnalyzeProjectResponse;
}
