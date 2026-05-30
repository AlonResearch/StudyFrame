import type { StudyImportFolderResponse } from "@t3tools/contracts";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";

export async function importStudyFolder(input: {
  readonly projectId: string | null;
  readonly sourceRoot: string;
  readonly manifestId?: string;
}): Promise<StudyImportFolderResponse> {
  const response = await fetch(resolvePrimaryEnvironmentHttpUrl("/api/studyframe/import-folder"), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.manifestId ? { manifestId: input.manifestId } : {}),
      sourceRoot: input.sourceRoot,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { readonly error?: string } | null;
    throw new Error(payload?.error ?? `Folder import failed with HTTP ${response.status}`);
  }

  return (await response.json()) as StudyImportFolderResponse;
}
