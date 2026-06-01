import type {
  StudySourceChunk,
  StudySourceSecurityFinding,
  StudySourceSecurityFindingKind,
  StudySourceSecuritySeverity,
} from "@t3tools/contracts";

interface SuspiciousPattern {
  readonly kind: StudySourceSecurityFindingKind;
  readonly severity: StudySourceSecuritySeverity;
  readonly confidence: number;
  readonly normalizedIntent: string;
  readonly pattern: RegExp;
}

interface SuspiciousSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly pattern: SuspiciousPattern;
}

export interface SourceSecurityScanInput {
  readonly projectId: string;
  readonly documentId: string;
  readonly sourcePath: string;
  readonly text: string;
  readonly createdAt: string;
}

export interface SourceSecurityScanResult {
  readonly findings: readonly StudySourceSecurityFinding[];
  readonly sanitizedText: string;
}

const SUSPICIOUS_PATTERNS: readonly SuspiciousPattern[] = [
  {
    kind: "instruction_override",
    severity: "high",
    confidence: 0.92,
    normalizedIntent: "Override system, developer, or prior instructions.",
    pattern:
      /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|rules?|prompts?)\b[\s\S]{0,240}/giu,
  },
  {
    kind: "prompt_injection",
    severity: "high",
    confidence: 0.9,
    normalizedIntent: "Treat source content as instructions for an AI agent.",
    pattern:
      /\b(?:you are now|from now on|new instructions?|system prompt|developer message|ai agent|language model)\b[\s\S]{0,220}\b(?:must|should|will|ignore|answer|declare|output|say)\b[\s\S]{0,160}/giu,
  },
  {
    kind: "false_answer_instruction",
    severity: "critical",
    confidence: 0.94,
    normalizedIntent: "Force incorrect or unrelated answers.",
    pattern:
      /\b(?:answer|respond|state|declare|say|claim)\b[\s\S]{0,180}\b(?:wrongly|incorrectly|false|the answer is|always answer|must answer)\b[\s\S]{0,160}/giu,
  },
  {
    kind: "tool_use_instruction",
    severity: "medium",
    confidence: 0.82,
    normalizedIntent: "Request tool use or external action from the processor.",
    pattern:
      /\b(?:call|run|execute|use)\s+(?:a\s+)?(?:tool|shell|command|browser|python|powershell|terminal|api)\b[\s\S]{0,220}/giu,
  },
  {
    kind: "data_exfiltration_request",
    severity: "critical",
    confidence: 0.9,
    normalizedIntent: "Request hidden prompts, credentials, files, or private context.",
    pattern:
      /\b(?:reveal|print|send|exfiltrate|upload|leak|show)\b[\s\S]{0,180}\b(?:system prompt|developer message|instructions|secrets?|tokens?|credentials?|files?|private context)\b[\s\S]{0,160}/giu,
  },
];

const HIDDEN_CONTROL_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu;
const MAX_EVIDENCE_LENGTH = 320;

export function scanSourceTextSecurity(input: SourceSecurityScanInput): SourceSecurityScanResult {
  const spans = collectSuspiciousSpans(input.text);
  const hiddenMatches = collectHiddenTextSpans(input.text);
  const allSpans = mergeOverlappingSpans([...spans, ...hiddenMatches]);
  if (allSpans.length === 0) {
    return { findings: [], sanitizedText: input.text };
  }

  const findings = allSpans.map((span, index): StudySourceSecurityFinding => {
    const id = `security-${stableHash(`${input.documentId}-${span.start}-${span.end}-${span.pattern.kind}`)}`;
    return {
      id,
      projectId: input.projectId,
      documentId: input.documentId,
      questionCandidateId: null,
      assetId: null,
      sourceAnchor: `${input.sourcePath}#security-${index + 1}`,
      kind: span.pattern.kind,
      severity: span.pattern.severity,
      confidence: span.pattern.confidence,
      instructionText: compactEvidence(span.text),
      normalizedIntent: span.pattern.normalizedIntent,
      action: "quarantined",
      detectionMethod: "heuristic",
      createdAt: input.createdAt,
    };
  });

  return {
    findings,
    sanitizedText: sanitizeText(input.text, allSpans, findings),
  };
}

export function makeSourceChunks(input: {
  readonly projectId: string;
  readonly documentId: string;
  readonly sourcePath: string;
  readonly rawText: string;
  readonly sanitizedText: string;
  readonly findings: readonly StudySourceSecurityFinding[];
  readonly maxChunkChars?: number;
}): StudySourceChunk[] {
  const maxChunkChars = input.maxChunkChars ?? 4_000;
  const chunks: StudySourceChunk[] = [];
  const text = input.rawText;
  const sanitized = input.sanitizedText;
  const total = Math.max(text.length, sanitized.length);
  if (total === 0) return chunks;

  for (let start = 0, index = 0; start < total; start += maxChunkChars, index += 1) {
    const end = Math.min(start + maxChunkChars, total);
    const sanitizedSlice = sanitized.slice(start, end);
    const findingIds = input.findings
      .filter((finding) => sanitizedSlice.includes(finding.id))
      .map((finding) => finding.id);
    chunks.push({
      id: `chunk-${stableHash(`${input.documentId}-${index}-${start}-${end}`)}`,
      projectId: input.projectId,
      documentId: input.documentId,
      sourceAnchor: `${input.sourcePath}#chunk-${index + 1}`,
      chunkIndex: index,
      text: text.slice(start, end),
      sanitizedText: sanitizedSlice,
      tokenEstimate: estimateTokens(sanitizedSlice),
      securityFindingIds: findingIds,
    });
  }
  return chunks;
}

function collectSuspiciousSpans(text: string): SuspiciousSpan[] {
  const spans: SuspiciousSpan[] = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    pattern.pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern.pattern)) {
      if (match.index === undefined) continue;
      const matchedText = match[0] ?? "";
      if (matchedText.trim().length === 0) continue;
      spans.push({
        start: match.index,
        end: match.index + matchedText.length,
        text: matchedText,
        pattern,
      });
    }
  }
  return spans;
}

function collectHiddenTextSpans(text: string): SuspiciousSpan[] {
  const hiddenPattern: SuspiciousPattern = {
    kind: "suspicious_encoding",
    severity: "medium",
    confidence: 0.78,
    normalizedIntent: "Hide or alter source text using invisible unicode control characters.",
    pattern: HIDDEN_CONTROL_PATTERN,
  };
  return [...text.matchAll(HIDDEN_CONTROL_PATTERN)].flatMap((match): SuspiciousSpan[] => {
    if (match.index === undefined) return [];
    const start = Math.max(0, match.index - 120);
    const end = Math.min(text.length, match.index + 121);
    return [
      {
        start,
        end,
        text: text.slice(start, end),
        pattern: hiddenPattern,
      },
    ];
  });
}

function mergeOverlappingSpans(spans: readonly SuspiciousSpan[]): SuspiciousSpan[] {
  const sorted = [...spans].sort((left, right) => left.start - right.start || right.end - left.end);
  const merged: SuspiciousSpan[] = [];
  for (const span of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || span.start > previous.end) {
      merged.push(span);
      continue;
    }
    if (severityRank(span.pattern.severity) > severityRank(previous.pattern.severity)) {
      merged[merged.length - 1] = {
        ...span,
        start: previous.start,
        end: Math.max(previous.end, span.end),
        text: `${previous.text}\n${span.text}`,
      };
      continue;
    }
    merged[merged.length - 1] = {
      ...previous,
      end: Math.max(previous.end, span.end),
      text: `${previous.text}\n${span.text}`,
    };
  }
  return merged;
}

function sanitizeText(
  text: string,
  spans: readonly SuspiciousSpan[],
  findings: readonly StudySourceSecurityFinding[],
): string {
  let cursor = 0;
  const parts: string[] = [];
  spans.forEach((span, index) => {
    parts.push(text.slice(cursor, span.start));
    parts.push(`[Quarantined source instruction: ${findings[index]?.id ?? "unknown"}]`);
    cursor = span.end;
  });
  parts.push(text.slice(cursor));
  return parts.join("").replace(HIDDEN_CONTROL_PATTERN, "");
}

function compactEvidence(text: string): string {
  const compacted = text.replace(/\s+/gu, " ").trim();
  return compacted.length > MAX_EVIDENCE_LENGTH
    ? `${compacted.slice(0, MAX_EVIDENCE_LENGTH - 1)}...`
    : compacted;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function severityRank(severity: StudySourceSecuritySeverity): number {
  switch (severity) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "info":
      return 1;
  }
}

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
