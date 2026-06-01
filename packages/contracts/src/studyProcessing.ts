import * as Schema from "effect/Schema";

export const StudySourceChunk = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  documentId: Schema.String,
  sourceAnchor: Schema.String,
  chunkIndex: Schema.Number,
  text: Schema.String,
  sanitizedText: Schema.String,
  tokenEstimate: Schema.Number,
  securityFindingIds: Schema.Array(Schema.String),
});
export type StudySourceChunk = typeof StudySourceChunk.Type;

export const StudyProcessingStage = Schema.Literals([
  "queued",
  "register_sources",
  "extract_sources",
  "scan_source_security",
  "classify_sources",
  "extract_real_questions",
  "build_course_context",
  "cluster_topics",
  "generate_topic_modules",
  "generate_question_support",
  "validate_and_correct",
  "commit_snapshot",
  "completed",
]);
export type StudyProcessingStage = typeof StudyProcessingStage.Type;

export const StudyProcessingJobStatus = Schema.Literals([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type StudyProcessingJobStatus = typeof StudyProcessingJobStatus.Type;

export const StudyProcessFolderInput = Schema.Struct({
  projectId: Schema.optionalKey(Schema.String),
  sourceRoot: Schema.String,
  providerInstanceId: Schema.optionalKey(Schema.String),
  manifestId: Schema.optionalKey(Schema.String),
  mode: Schema.optionalKey(Schema.Literal("full_ai")),
});
export type StudyProcessFolderInput = typeof StudyProcessFolderInput.Type;

export const StudyProcessingJob = Schema.Struct({
  id: Schema.String,
  projectId: Schema.NullOr(Schema.String),
  sourceRoot: Schema.String,
  status: StudyProcessingJobStatus,
  stage: StudyProcessingStage,
  progressCurrent: Schema.Number,
  progressTotal: Schema.Number,
  message: Schema.String,
  error: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  completedAt: Schema.NullOr(Schema.String),
});
export type StudyProcessingJob = typeof StudyProcessingJob.Type;

export const StudyProcessingEventLevel = Schema.Literals(["info", "warning", "error"]);
export type StudyProcessingEventLevel = typeof StudyProcessingEventLevel.Type;

export const StudyProcessingEvent = Schema.Struct({
  id: Schema.String,
  jobId: Schema.String,
  stage: StudyProcessingStage,
  level: StudyProcessingEventLevel,
  message: Schema.String,
  metadataJson: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.String,
});
export type StudyProcessingEvent = typeof StudyProcessingEvent.Type;

export const StudyProcessingArtifact = Schema.Struct({
  id: Schema.String,
  jobId: Schema.String,
  stage: StudyProcessingStage,
  artifactType: Schema.String,
  artifactJson: Schema.Unknown,
  createdAt: Schema.String,
});
export type StudyProcessingArtifact = typeof StudyProcessingArtifact.Type;

export const StudyProcessFolderResponse = Schema.Struct({
  job: StudyProcessingJob,
});
export type StudyProcessFolderResponse = typeof StudyProcessFolderResponse.Type;

export const StudyStageSourceMaterialsResponse = Schema.Struct({
  sourceRoot: Schema.String,
  materialCount: Schema.Number,
});
export type StudyStageSourceMaterialsResponse = typeof StudyStageSourceMaterialsResponse.Type;

export const StudyProcessingJobResponse = Schema.Struct({
  job: Schema.NullOr(StudyProcessingJob),
});
export type StudyProcessingJobResponse = typeof StudyProcessingJobResponse.Type;

export const StudyProcessingEventsResponse = Schema.Struct({
  events: Schema.Array(StudyProcessingEvent),
});
export type StudyProcessingEventsResponse = typeof StudyProcessingEventsResponse.Type;
