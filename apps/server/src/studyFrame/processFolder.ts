import type {
  StudyFrameSnapshot,
  StudyProcessFolderInput,
  StudyProcessingArtifact,
  StudyProcessingEvent,
  StudyProcessingJob,
  StudyProcessingStage,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Scope from "effect/Scope";

import {
  StudyFrameRepository,
  type StudyFrameRepositoryShape,
} from "../persistence/Services/StudyFrame.ts";
import { analyzeProjectWithProvider } from "./analyzeProjectWithProvider.ts";
import { importFolderToSnapshot } from "./importFolder.ts";
import { resolveOptionalStudyFrameTextGeneration } from "./providerTextGeneration.ts";

const runningJobs = new Set<string>();
const cancelledJobs = new Set<string>();
let jobSequence = 0;

export class StudyFrameProcessFolderError extends Data.TaggedError("StudyFrameProcessFolderError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const startStudyFrameProcessingJob = Effect.fn("StudyFrame.startProcessingJob")(function* (
  input: StudyProcessFolderInput,
) {
  const repository = yield* StudyFrameRepository;
  const now = yield* nowIso();
  jobSequence += 1;
  const job: StudyProcessingJob = {
    id: `study-job-${stableHash(`${input.sourceRoot}-${now}-${jobSequence}`)}`,
    projectId: input.projectId ?? null,
    sourceRoot: input.sourceRoot,
    status: "queued",
    stage: "queued",
    progressCurrent: 0,
    progressTotal: 11,
    message: "Queued course processing.",
    error: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  yield* repository.saveProcessingJob(job);
  yield* appendEvent(repository, job.id, "queued", "info", "Queued course processing.", null);
  const jobScope = yield* Scope.make("sequential");
  yield* runStudyFrameProcessingJob(job.id, input).pipe(
    Effect.catch(() => Effect.void),
    Scope.provide(jobScope),
    Effect.ensuring(Scope.close(jobScope, Exit.void)),
    Effect.forkDetach,
  );
  return job;
});

export const retryStudyFrameProcessingJob = Effect.fn("StudyFrame.retryProcessingJob")(function* (
  jobId: string,
) {
  const repository = yield* StudyFrameRepository;
  const job = yield* repository.loadProcessingJob(jobId);
  if (Option.isNone(job)) {
    return yield* new StudyFrameProcessFolderError({
      message: `StudyFrame processing job was not found: ${jobId}`,
    });
  }
  return yield* startStudyFrameProcessingJob({
    ...(job.value.projectId ? { projectId: job.value.projectId } : {}),
    sourceRoot: job.value.sourceRoot,
    mode: "full_ai",
  });
});

export const cancelStudyFrameProcessingJob = Effect.fn("StudyFrame.cancelProcessingJob")(function* (
  jobId: string,
) {
  const repository = yield* StudyFrameRepository;
  const jobOption = yield* repository.loadProcessingJob(jobId);
  if (Option.isNone(jobOption)) {
    return yield* new StudyFrameProcessFolderError({
      message: `StudyFrame processing job was not found: ${jobId}`,
    });
  }
  cancelledJobs.add(jobId);
  const job = jobOption.value;
  if (job.status !== "running" && job.status !== "queued") return job;
  const now = yield* nowIso();
  const cancelled: StudyProcessingJob = {
    ...job,
    status: "cancelled",
    message: "Processing was cancelled.",
    updatedAt: now,
    completedAt: now,
  };
  yield* repository.saveProcessingJob(cancelled);
  yield* appendEvent(repository, job.id, job.stage, "warning", "Processing was cancelled.", null);
  return cancelled;
});

const runStudyFrameProcessingJob = Effect.fn("StudyFrame.runProcessingJob")(function* (
  jobId: string,
  input: StudyProcessFolderInput,
) {
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);
  const repository = yield* StudyFrameRepository;
  const run = Effect.gen(function* () {
    let job = yield* requireJob(repository, jobId);
    job = yield* updateJob(repository, job, {
      status: "running",
      stage: "register_sources",
      progressCurrent: 1,
      message: "Preparing course folder.",
    });
    yield* throwIfCancelled(jobId);

    const provider = yield* resolveOptionalStudyFrameTextGeneration;
    if (Option.isNone(provider)) {
      return yield* failJob(
        repository,
        job,
        "StudyFrame full processing requires a configured text generation provider.",
      );
    }

    job = yield* updateJob(repository, job, {
      stage: "extract_sources",
      progressCurrent: 2,
      message: "Extracting sources and assets.",
    });
    const imported = yield* importFolderToSnapshot({
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.manifestId ? { manifestId: input.manifestId } : {}),
      sourceRoot: input.sourceRoot,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new StudyFrameProcessFolderError({
            message: cause.message,
            cause,
          }),
      ),
    );
    yield* saveArtifact(
      repository,
      job.id,
      "extract_sources",
      "extraction_result",
      imported.result,
    );
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      projectId: imported.result.projectId,
      stage: "scan_source_security",
      progressCurrent: 3,
      message: sourceSecurityMessage(imported.snapshot),
    });
    const securityFindings = imported.snapshot.dataset.sourceSecurityFindings ?? [];
    if (securityFindings.length > 0) {
      yield* appendEvent(
        repository,
        job.id,
        "scan_source_security",
        "warning",
        `Detected and quarantined ${securityFindings.length} source security finding${securityFindings.length === 1 ? "" : "s"}.`,
        { findingCount: securityFindings.length },
      );
    }
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      stage: "classify_sources",
      progressCurrent: 4,
      message: "Classifying sources in batches of up to 50 documents.",
    });
    const analyzed = yield* analyzeProjectWithProvider(
      imported.snapshot,
      { projectId: imported.result.projectId },
      { requireProvider: true, sourceClassificationBatchSize: 50 },
    ).pipe(
      Effect.mapError(
        (cause) =>
          new StudyFrameProcessFolderError({
            message: cause.message,
            cause,
          }),
      ),
    );
    yield* saveArtifact(repository, job.id, "classify_sources", "analysis_result", analyzed.result);
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      stage: "extract_real_questions",
      progressCurrent: 5,
      message: `Prepared ${analyzed.result.classifiedQuestionCount} classified real question candidates.`,
    });
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      stage: "build_course_context",
      progressCurrent: 6,
      message: "Built sanitized course context for generation.",
    });
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      stage: "cluster_topics",
      progressCurrent: 7,
      message: `Clustered questions into ${analyzed.result.topicClusterCount} topic priorities.`,
    });
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      stage: "generate_topic_modules",
      progressCurrent: 8,
      message: `Generated ${analyzed.result.topicModuleCount} topic study module${analyzed.result.topicModuleCount === 1 ? "" : "s"}.`,
    });
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      stage: "generate_question_support",
      progressCurrent: 9,
      message: `Generated ${analyzed.result.practiceItemCount} practice workflow item${analyzed.result.practiceItemCount === 1 ? "" : "s"}.`,
    });
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      stage: "validate_and_correct",
      progressCurrent: 10,
      message: "Validating grounded outputs and quarantined source instructions.",
    });
    const validated = validateAndCorrectProcessedSnapshot(analyzed.snapshot);
    for (const warning of validated.warnings) {
      yield* appendEvent(repository, job.id, "validate_and_correct", "warning", warning, null);
    }
    yield* saveArtifact(repository, job.id, "validate_and_correct", "validation_warnings", {
      warnings: validated.warnings,
    });
    yield* throwIfCancelled(jobId);

    job = yield* updateJob(repository, job, {
      stage: "commit_snapshot",
      progressCurrent: 11,
      message: "Committing processed StudyFrame snapshot.",
    });
    yield* repository.saveSnapshot(validated.snapshot);
    const completedAt = yield* nowIso();
    const completed: StudyProcessingJob = {
      ...job,
      status: "succeeded",
      stage: "completed",
      progressCurrent: 11,
      message: "Course processing completed.",
      updatedAt: completedAt,
      completedAt,
    };
    yield* repository.saveProcessingJob(completed);
    yield* appendEvent(repository, job.id, "completed", "info", "Course processing completed.", {
      projectId: analyzed.result.projectId,
    });
  });
  return yield* run.pipe(
    Effect.catch((cause) =>
      Effect.gen(function* () {
        const job = yield* repository.loadProcessingJob(jobId);
        if (Option.isSome(job) && job.value.status !== "cancelled") {
          yield* failJob(
            repository,
            job.value,
            cause instanceof Error ? cause.message : "StudyFrame course processing failed.",
            cause,
          );
        }
      }),
    ),
    Effect.ensuring(
      Effect.sync(() => {
        runningJobs.delete(jobId);
        cancelledJobs.delete(jobId);
      }),
    ),
  );
});

function sourceSecurityMessage(snapshot: StudyFrameSnapshot): string {
  const count = snapshot.dataset.sourceSecurityFindings?.length ?? 0;
  return count === 0
    ? "No source prompt-injection patterns detected."
    : `Quarantined ${count} source security finding${count === 1 ? "" : "s"}.`;
}

export function validateAndCorrectProcessedSnapshot(snapshot: StudyFrameSnapshot): {
  readonly snapshot: StudyFrameSnapshot;
  readonly warnings: readonly string[];
} {
  const warnings: string[] = [];
  const findings = snapshot.dataset.sourceSecurityFindings ?? [];
  if (findings.length === 0) return { snapshot, warnings };
  const evidence = findings
    .map((finding) => finding.instructionText.trim())
    .filter((text) => text.length > 20);
  const corrected = redactQuarantinedEvidence(snapshot, evidence);
  if (corrected.redactedCount > 0) {
    warnings.push(
      `Removed ${corrected.redactedCount} generated field occurrence${corrected.redactedCount === 1 ? "" : "s"} matching quarantined source instructions.`,
    );
  }
  return { snapshot: corrected.snapshot, warnings };
}

function redactQuarantinedEvidence(
  snapshot: StudyFrameSnapshot,
  evidence: readonly string[],
): { readonly snapshot: StudyFrameSnapshot; readonly redactedCount: number } {
  let redactedCount = 0;
  const redactText = (value: string): string => {
    let redacted = value;
    for (const instruction of evidence) {
      redacted = redacted.replace(new RegExp(escapeRegExp(instruction), "giu"), () => {
        redactedCount += 1;
        return "[Removed quarantined source instruction]";
      });
    }
    return redacted;
  };
  const redactUnknown = <T>(value: T): T => {
    if (typeof value === "string") return redactText(value) as T;
    if (Array.isArray(value)) return value.map(redactUnknown) as T;
    if (typeof value !== "object" || value === null) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactUnknown(entry)]),
    ) as T;
  };

  return {
    snapshot: {
      ...snapshot,
      dataset: {
        ...snapshot.dataset,
        questions: snapshot.dataset.questions.map((question) => {
          const rawPrompt = redactText(question.rawPrompt);
          return {
            ...question,
            rawPrompt,
            normalizedPrompt: normalizeGeneratedPrompt(rawPrompt),
          };
        }),
        questionSupport: snapshot.dataset.questionSupport.map(redactUnknown),
        ...(snapshot.dataset.questionCandidates
          ? { questionCandidates: snapshot.dataset.questionCandidates.map(redactUnknown) }
          : {}),
        ...(snapshot.dataset.topicModules
          ? { topicModules: snapshot.dataset.topicModules.map(redactUnknown) }
          : {}),
        ...(snapshot.dataset.practiceItems
          ? { practiceItems: snapshot.dataset.practiceItems.map(redactUnknown) }
          : {}),
        ...(snapshot.dataset.practiceSupport
          ? { practiceSupport: snapshot.dataset.practiceSupport.map(redactUnknown) }
          : {}),
      },
    },
    redactedCount,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function normalizeGeneratedPrompt(value: string): string {
  return value.toLowerCase().replace(/\s+/gu, " ").trim();
}

function requireJob(repository: StudyFrameRepositoryShape, jobId: string) {
  return repository.loadProcessingJob(jobId).pipe(
    Effect.flatMap((job) =>
      Option.match(job, {
        onNone: () =>
          Effect.fail(
            new StudyFrameProcessFolderError({
              message: `StudyFrame processing job was not found: ${jobId}`,
            }),
          ),
        onSome: Effect.succeed,
      }),
    ),
  );
}

function updateJob(
  repository: StudyFrameRepositoryShape,
  job: StudyProcessingJob,
  patch: Partial<
    Pick<
      StudyProcessingJob,
      "projectId" | "status" | "stage" | "progressCurrent" | "progressTotal" | "message" | "error"
    >
  >,
) {
  return Effect.gen(function* () {
    const updatedAt = yield* nowIso();
    const next: StudyProcessingJob = {
      ...job,
      ...patch,
      updatedAt,
    };
    yield* repository.saveProcessingJob(next);
    yield* appendEvent(
      repository,
      next.id,
      next.stage,
      patch.error ? "error" : "info",
      next.message,
      { progressCurrent: next.progressCurrent, progressTotal: next.progressTotal },
    );
    return next;
  });
}

function failJob(
  repository: StudyFrameRepositoryShape,
  job: StudyProcessingJob,
  message: string,
  cause?: unknown,
) {
  return Effect.gen(function* () {
    const now = yield* nowIso();
    const failed: StudyProcessingJob = {
      ...job,
      status: "failed",
      message,
      error: message,
      updatedAt: now,
      completedAt: now,
    };
    yield* repository.saveProcessingJob(failed);
    yield* appendEvent(repository, job.id, job.stage, "error", message, {
      cause: cause instanceof Error ? cause.message : String(cause ?? ""),
    });
    return failed;
  });
}

function appendEvent(
  repository: StudyFrameRepositoryShape,
  jobId: string,
  stage: StudyProcessingStage,
  level: StudyProcessingEvent["level"],
  message: string,
  metadataJson: unknown,
) {
  return Effect.gen(function* () {
    const createdAt = yield* nowIso();
    const event: StudyProcessingEvent = {
      id: `study-event-${stableHash(`${jobId}-${stage}-${level}-${message}-${createdAt}`)}`,
      jobId,
      stage,
      level,
      message,
      metadataJson,
      createdAt,
    };
    yield* repository.appendProcessingEvent(event);
  });
}

function saveArtifact(
  repository: StudyFrameRepositoryShape,
  jobId: string,
  stage: StudyProcessingStage,
  artifactType: string,
  artifactJson: unknown,
) {
  return Effect.gen(function* () {
    const createdAt = yield* nowIso();
    const artifact: StudyProcessingArtifact = {
      id: `study-artifact-${stableHash(`${jobId}-${stage}-${artifactType}`)}`,
      jobId,
      stage,
      artifactType,
      artifactJson,
      createdAt,
    };
    yield* repository.saveProcessingArtifact(artifact);
  });
}

function throwIfCancelled(jobId: string) {
  return cancelledJobs.has(jobId)
    ? Effect.fail(
        new StudyFrameProcessFolderError({
          message: "StudyFrame processing job was cancelled.",
        }),
      )
    : Effect.void;
}

function nowIso() {
  return DateTime.now.pipe(Effect.map(DateTime.formatIso));
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
