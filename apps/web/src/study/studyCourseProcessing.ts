import type {
  StudyFrameSnapshotResponse,
  StudyProcessFolderResponse,
  StudyProcessingEventsResponse,
  StudyProcessingJobResponse,
  StudyStageSourceMaterialsResponse,
} from "@t3tools/contracts";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary";

export async function startStudyCourseProcessing(input: {
  readonly projectId: string | null;
  readonly sourceRoot: string;
  readonly manifestId?: string;
}): Promise<StudyProcessFolderResponse> {
  const response = await fetch(resolvePrimaryEnvironmentHttpUrl("/api/studyframe/process-folder"), {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.manifestId ? { manifestId: input.manifestId } : {}),
      sourceRoot: input.sourceRoot,
      mode: "full_ai",
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { readonly error?: string } | null;
    throw new Error(payload?.error ?? `Course processing failed with HTTP ${response.status}`);
  }

  return (await response.json()) as StudyProcessFolderResponse;
}

export async function stageStudySourceMaterials(
  materials: readonly {
    readonly file: File;
    readonly relativePath: string;
  }[],
  sourceName: string,
): Promise<StudyStageSourceMaterialsResponse> {
  const body = new FormData();
  for (const material of materials) {
    body.append("files", material.file, material.file.name);
  }
  body.append("relativePaths", JSON.stringify(materials.map((material) => material.relativePath)));
  body.append("sourceName", sourceName);
  const response = await fetch(
    resolvePrimaryEnvironmentHttpUrl("/api/studyframe/stage-source-materials"),
    {
      method: "POST",
      credentials: "include",
      body,
    },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { readonly error?: string } | null;
    throw new Error(
      payload?.error ?? `Source material staging failed with HTTP ${response.status}`,
    );
  }
  return (await response.json()) as StudyStageSourceMaterialsResponse;
}

export async function getStudyProcessingJob(jobId: string): Promise<StudyProcessingJobResponse> {
  const response = await fetch(
    resolvePrimaryEnvironmentHttpUrl(`/api/studyframe/processing-jobs/${jobId}`),
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(`Processing job load failed with HTTP ${response.status}`);
  }
  return (await response.json()) as StudyProcessingJobResponse;
}

export async function getStudyProcessingEvents(
  jobId: string,
): Promise<StudyProcessingEventsResponse> {
  const response = await fetch(
    resolvePrimaryEnvironmentHttpUrl(`/api/studyframe/processing-jobs/${jobId}/events`),
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(`Processing event load failed with HTTP ${response.status}`);
  }
  return (await response.json()) as StudyProcessingEventsResponse;
}

export async function cancelStudyProcessingJob(jobId: string): Promise<StudyProcessingJobResponse> {
  const response = await fetch(
    resolvePrimaryEnvironmentHttpUrl(`/api/studyframe/processing-jobs/${jobId}/cancel`),
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(`Processing cancel failed with HTTP ${response.status}`);
  }
  return (await response.json()) as StudyProcessingJobResponse;
}

export async function retryStudyProcessingJob(jobId: string): Promise<StudyProcessingJobResponse> {
  const response = await fetch(
    resolvePrimaryEnvironmentHttpUrl(`/api/studyframe/processing-jobs/${jobId}/retry`),
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!response.ok) {
    throw new Error(`Processing retry failed with HTTP ${response.status}`);
  }
  return (await response.json()) as StudyProcessingJobResponse;
}

export async function loadStudyFrameSnapshot(): Promise<StudyFrameSnapshotResponse> {
  const response = await fetch(resolvePrimaryEnvironmentHttpUrl("/api/studyframe/snapshot"), {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`StudyFrame snapshot load failed with HTTP ${response.status}`);
  }
  return (await response.json()) as StudyFrameSnapshotResponse;
}
