import * as Schema from "effect/Schema";

export const StudySourceSecurityFindingKind = Schema.Literals([
  "prompt_injection",
  "instruction_override",
  "false_answer_instruction",
  "tool_use_instruction",
  "data_exfiltration_request",
  "hidden_text_instruction",
  "suspicious_encoding",
  "benign_course_content",
]);
export type StudySourceSecurityFindingKind = typeof StudySourceSecurityFindingKind.Type;

export const StudySourceSecuritySeverity = Schema.Literals([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);
export type StudySourceSecuritySeverity = typeof StudySourceSecuritySeverity.Type;

export const StudySourceSecurityAction = Schema.Literals([
  "ignored",
  "quarantined",
  "requires_review",
  "blocked",
]);
export type StudySourceSecurityAction = typeof StudySourceSecurityAction.Type;

export const StudySourceSecurityDetectionMethod = Schema.Literals([
  "heuristic",
  "ai_audit",
  "validator",
]);
export type StudySourceSecurityDetectionMethod = typeof StudySourceSecurityDetectionMethod.Type;

export const StudySourceSecurityFinding = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  documentId: Schema.String,
  questionCandidateId: Schema.NullOr(Schema.String),
  assetId: Schema.NullOr(Schema.String),
  sourceAnchor: Schema.String,
  kind: StudySourceSecurityFindingKind,
  severity: StudySourceSecuritySeverity,
  confidence: Schema.Number,
  instructionText: Schema.String,
  normalizedIntent: Schema.String,
  action: StudySourceSecurityAction,
  detectionMethod: StudySourceSecurityDetectionMethod,
  createdAt: Schema.String,
});
export type StudySourceSecurityFinding = typeof StudySourceSecurityFinding.Type;
