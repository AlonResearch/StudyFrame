import type { StudyGenerateSimilarInput, StudyGenerateSimilarResponse } from "@t3tools/contracts";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";

export async function requestStudyGeneratedVariants(
  input: StudyGenerateSimilarInput,
): Promise<StudyGenerateSimilarResponse | null> {
  const response = await fetch(
    resolvePrimaryEnvironmentHttpUrl("/api/studyframe/generate-similar"),
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) return null;
  return (await response.json()) as StudyGenerateSimilarResponse;
}
