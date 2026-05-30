import type {
  StudyDataset,
  StudyExtractionResult,
  StudyFrameSnapshot,
  StudyImportFolderInput,
  StudyPracticeItem,
  StudyPracticeSupport,
  StudyQuestion,
  StudyQuestionCandidate,
  StudyQuestionClassification,
  StudyQuestionSupport,
  StudyQuestionTopic,
  StudySourceAsset,
  StudySourceDocument,
  StudySourceFileType,
  StudyTopicCluster,
  StudyTopicModule,
  StudyTopicThread,
} from "@t3tools/contracts";
import { inflateRawSync } from "node:zlib";
import * as DateTime from "effect/DateTime";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  ".venv",
  "__pycache__",
  "dist",
  "build",
]);

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
]);
const DATA_EXTENSIONS = new Set([
  ".csv",
  ".mat",
  ".pkl",
  ".pickle",
  ".m",
  ".json",
  ".xlsx",
  ".xls",
]);
const TEXT_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const DOCUMENT_EXTENSIONS = new Set([".docx", ".doc", ".pdf", ...TEXT_EXTENSIONS]);

interface ExtractedText {
  readonly text: string;
  readonly confidence: number;
  readonly warnings: readonly string[];
}

interface FileRecord {
  readonly absolutePath: string;
  readonly relativePath: string;
}

interface CandidateDraft {
  readonly sourceAnchor: string;
  readonly rawPromptMarkdown: string;
  readonly label: string;
  readonly pointValue: number | null;
}

export class StudyFrameImportFolderError extends Data.TaggedError("StudyFrameImportFolderError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

function fileImportError(input: {
  readonly message: string;
  readonly cause?: PlatformError.PlatformError;
}): StudyFrameImportFolderError {
  return new StudyFrameImportFolderError(input);
}

function mapFileSystemError(message: string) {
  return Effect.mapError((cause: PlatformError.PlatformError) =>
    fileImportError({ message, cause }),
  );
}

export const importFolderToSnapshot = Effect.fn("StudyFrame.importFolderToSnapshot")(function* (
  input: StudyImportFolderInput,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceRoot = path.resolve(input.sourceRoot);
  const rootStats = yield* fs
    .stat(sourceRoot)
    .pipe(mapFileSystemError(`Import source could not be read: ${sourceRoot}`));
  if (rootStats.type !== "Directory") {
    return yield* fileImportError({ message: `Import source is not a folder: ${sourceRoot}` });
  }

  const now = DateTime.formatIso(yield* DateTime.now);
  const projectName = path.basename(sourceRoot) || "Imported course";
  const projectId = input.projectId ?? `project-${stableSlug(projectName) || "imported-course"}`;
  const files = yield* scanFiles({ fs, path, sourceRoot });
  const orderedFiles = files.toSorted(
    (left, right) =>
      Number(isExtractedTextMirror(left.relativePath)) -
        Number(isExtractedTextMirror(right.relativePath)) ||
      left.relativePath.localeCompare(right.relativePath),
  );
  const sourceDocuments: StudySourceDocument[] = [];
  const sourceAssets: StudySourceAsset[] = [];
  const questionCandidates: StudyQuestionCandidate[] = [];
  const questions: StudyQuestion[] = [];
  const questionSupport: StudyQuestionSupport[] = [];
  const questionTopics: StudyQuestionTopic[] = [];
  const warnings: string[] = [];
  const originalQuestionFingerprints = new Set<string>();

  for (const file of orderedFiles) {
    const classification = classifySourceFile(file.relativePath);
    const year = extractYear(file.relativePath);
    const quizLabel = makeQuizLabel(file.relativePath, year);
    const sourceDocumentId = `source-${stableSlug(file.relativePath) || stableHash(file.relativePath)}`;
    let extraction: ExtractedText = { text: "", confidence: 0.85, warnings: [] };

    if (classification.canExtractText) {
      extraction = yield* extractText(fs, file.absolutePath, classification.fileType);
    }

    const documentWarnings = [
      ...classification.warnings,
      ...extraction.warnings.map((warning) => `${file.relativePath}: ${warning}`),
    ];
    warnings.push(...documentWarnings);
    sourceDocuments.push({
      id: sourceDocumentId,
      projectId,
      sourcePath: file.relativePath,
      fileType: classification.fileType,
      role: classification.role,
      year,
      quizLabel,
      extractionConfidence: extraction.confidence,
      warnings: documentWarnings,
    });

    if (classification.assetKind) {
      const assetText = yield* readAssetPreview(fs, file.absolutePath, classification.fileType);
      sourceAssets.push({
        id: `asset-${stableSlug(file.relativePath) || stableHash(file.relativePath)}`,
        documentId: sourceDocumentId,
        kind: classification.assetKind,
        sourceAnchor: file.relativePath,
        contentText: assetText,
        contentJson: null,
        localUri: file.absolutePath,
        extractionConfidence: extraction.confidence,
      });
    }

    if (!classification.canCreateQuestions || extraction.text.trim().length === 0) {
      continue;
    }

    const candidateDrafts = extractQuestionDrafts(extraction.text, file.relativePath);
    for (const [index, draft] of candidateDrafts.entries()) {
      const fingerprint = normalizePrompt(draft.rawPromptMarkdown);
      if (
        isExtractedTextMirror(file.relativePath) &&
        originalQuestionFingerprints.has(fingerprint)
      ) {
        continue;
      }
      if (!isExtractedTextMirror(file.relativePath)) {
        originalQuestionFingerprints.add(fingerprint);
      }
      const candidateId = `candidate-${stableSlug(`${file.relativePath}-${draft.label}-${index + 1}`) || stableHash(`${file.relativePath}-${index}`)}`;
      const questionId = `q-${stableSlug(`${file.relativePath}-${draft.label}-${index + 1}`) || stableHash(candidateId)}`;
      const needsManualReview = extraction.confidence < 0.8 || documentWarnings.length > 0;
      const pointValue = draft.pointValue ?? 1;

      questionCandidates.push({
        id: candidateId,
        projectId,
        documentId: sourceDocumentId,
        sourceAnchor: draft.sourceAnchor,
        rawPromptMarkdown: draft.rawPromptMarkdown,
        sourceYear: year,
        sourceQuizLabel: quizLabel ? `${quizLabel} ${draft.label}` : draft.label,
        pointValue,
        assetIds: [],
        extractionConfidence: extraction.confidence,
        needsManualReview,
      });
      questions.push({
        id: questionId,
        projectId,
        documentId: sourceDocumentId,
        sourceAnchor: draft.sourceAnchor,
        sourceYear: year,
        sourceQuizLabel: quizLabel ? `${quizLabel} ${draft.label}` : draft.label,
        rawPrompt: draft.rawPromptMarkdown,
        normalizedPrompt: normalizePrompt(draft.rawPromptMarkdown),
        pointValue,
        isRealQuestion: true,
        generatedFromQuestionIds: [],
        dependsOnAssets: false,
        extractionConfidence: extraction.confidence,
        createdAt: now,
      });
      questionTopics.push({
        id: `qt-${questionId}`,
        questionId,
        topicThreadId: "topic-unclassified-import",
        topic: "Unclassified imported questions",
        subtype: "Needs analysis",
        confidence: 0.4,
        isPrimary: true,
      });
      questionSupport.push({
        id: `support-${questionId}`,
        questionId,
        summaryContext: "",
        expectedAnswer: [],
        rubric: [],
        hints: [],
        solutionSteps: [],
        commonMistakes: [],
        supportConfidence: 0,
        generatedAt: now,
      });
    }
  }

  const studyDocuments = sourceDocuments
    .filter((document) =>
      questionCandidates.some((candidate) => candidate.documentId === document.id),
    )
    .map((document) => ({
      id: document.id,
      projectId,
      title: document.quizLabel ?? pathBasename(document.sourcePath),
      sourcePath: document.sourcePath,
      year: document.year,
      quizLabel: document.quizLabel ?? pathBasename(document.sourcePath),
    }));
  const topicThreads = makeTopicThreads({ projectId, questions, now });
  const topicClusters = makeTopicClusters({ projectId, questions });
  const questionClassifications = makeQuestionClassifications(questionCandidates, topicClusters);
  const topicModules = makeTopicModules({ projectId, topicClusters });
  const practiceItems = makePracticeItems({
    projectId,
    questionCandidates,
    topicModules,
  });
  const practiceSupport = makePracticeSupport(practiceItems);
  const dataset: StudyDataset = {
    projects: [
      {
        id: projectId,
        name: projectName,
        sourceRoot,
        importedAt: now,
        extractionWarnings: unique(warnings),
      },
    ],
    documents: studyDocuments,
    questions,
    questionSupport,
    questionTopics,
    topicThreads,
    sourceDocuments,
    sourceAssets,
    questionCandidates,
    topicClusters,
    questionClassifications,
    topicModules,
    practiceItems,
    practiceSupport,
  };
  const snapshot: StudyFrameSnapshot = {
    dataset,
    attempts: [],
    completionSummaries: [],
    generatedQuestionBatches: [],
  };
  const result: StudyExtractionResult = {
    projectId,
    sourceRoot,
    importedDocumentCount: sourceDocuments.length,
    sourceAssetCount: sourceAssets.length,
    questionCandidateCount: questionCandidates.length,
    warnings: dataset.projects[0]?.extractionWarnings ?? [],
  };

  return { snapshot, result };
});

function scanFiles(input: {
  readonly fs: FileSystem.FileSystem;
  readonly path: Path.Path;
  readonly sourceRoot: string;
}): Effect.Effect<FileRecord[], StudyFrameImportFolderError> {
  return Effect.gen(function* () {
    const out: FileRecord[] = [];

    function visit(directory: string): Effect.Effect<void, StudyFrameImportFolderError> {
      return Effect.gen(function* () {
        const entries = yield* input.fs
          .readDirectory(directory, { recursive: false })
          .pipe(mapFileSystemError(`Folder contents could not be read: ${directory}`));
        for (const entryName of entries) {
          if (entryName.startsWith("~$")) continue;
          const absolutePath = input.path.join(directory, entryName);
          const info = yield* input.fs
            .stat(absolutePath)
            .pipe(mapFileSystemError(`Folder entry could not be inspected: ${absolutePath}`));
          if (info.type === "Directory") {
            if (!EXCLUDED_DIRECTORIES.has(entryName)) {
              yield* visit(absolutePath);
            }
            continue;
          }
          if (info.type !== "File") continue;
          out.push({
            absolutePath,
            relativePath: toPortablePath(input.path.relative(input.sourceRoot, absolutePath)),
          });
        }
      });
    }

    yield* visit(input.sourceRoot);
    return out.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  });
}

function classifySourceFile(relativePath: string): {
  readonly fileType: StudySourceFileType;
  readonly role: StudySourceDocument["role"];
  readonly canExtractText: boolean;
  readonly canCreateQuestions: boolean;
  readonly assetKind: StudySourceAsset["kind"] | null;
  readonly warnings: readonly string[];
} {
  const extension = pathExtname(relativePath).toLowerCase();
  const normalized = relativePath.toLowerCase();
  const fileType = sourceFileType(extension);
  const generatedExport = isGeneratedMarkdownExport(relativePath);
  const role: StudySourceDocument["role"] = generatedExport
    ? "generated_export"
    : /(?:^|[/_. -])(?:ans|answers?|solutions?|rubric|official[_ -]?key)(?:[/_. -]|$)/.test(
          normalized,
        )
      ? "solution"
      : /lecture|slides|notes|alllec/.test(normalized)
        ? "lecture"
        : DATA_EXTENSIONS.has(extension) || IMAGE_EXTENSIONS.has(extension)
          ? "data_asset"
          : /quiz|exam|test|question|past/.test(normalized)
            ? "quiz"
            : DOCUMENT_EXTENSIONS.has(extension)
              ? "unknown"
              : "data_asset";
  const warnings =
    extension === ".doc" ? ["Legacy DOC files can only be registered for manual review."] : [];

  return {
    fileType,
    role,
    canExtractText: DOCUMENT_EXTENSIONS.has(extension) && extension !== ".doc",
    canCreateQuestions: role === "quiz" || role === "unknown",
    assetKind: IMAGE_EXTENSIONS.has(extension)
      ? "image"
      : DATA_EXTENSIONS.has(extension) && extension !== ".json"
        ? "data_file"
        : null,
    warnings,
  };
}

function extractText(
  fs: FileSystem.FileSystem,
  filePath: string,
  fileType: StudySourceFileType,
): Effect.Effect<ExtractedText, StudyFrameImportFolderError> {
  return Effect.gen(function* () {
    if (fileType === "md" || fileType === "txt" || fileType === "csv") {
      const text = yield* fs
        .readFileString(filePath)
        .pipe(mapFileSystemError(`Text content could not be read: ${filePath}`));
      return {
        text,
        confidence: text.trim().length > 0 ? 0.98 : 0.2,
        warnings: text.trim().length > 0 ? [] : ["No text content was found."],
      };
    }

    if (fileType === "docx") {
      return yield* extractDocxText(fs, filePath);
    }

    if (fileType === "pdf") {
      return yield* extractPdfText(fs, filePath);
    }

    return {
      text: "",
      confidence: 0,
      warnings: [`No text extractor is available for ${fileType} files yet.`],
    };
  });
}

function extractDocxText(
  fs: FileSystem.FileSystem,
  filePath: string,
): Effect.Effect<ExtractedText, StudyFrameImportFolderError> {
  return Effect.gen(function* () {
    const buffer = Buffer.from(
      yield* fs
        .readFile(filePath)
        .pipe(mapFileSystemError(`DOCX content could not be read: ${filePath}`)),
    );
    const documentXml = readZipEntry(buffer, "word/document.xml");
    if (!documentXml) {
      return {
        text: "",
        confidence: 0.25,
        warnings: ["DOCX document text could not be found."],
      };
    }

    const text = stripDocxXml(documentXml.toString("utf8"));
    return {
      text,
      confidence: text.trim().length > 0 ? 0.9 : 0.35,
      warnings: text.trim().length > 0 ? [] : ["DOCX extraction produced no text."],
    };
  });
}

function extractPdfText(
  fs: FileSystem.FileSystem,
  filePath: string,
): Effect.Effect<ExtractedText, StudyFrameImportFolderError> {
  return Effect.gen(function* () {
    const buffer = Buffer.from(
      yield* fs
        .readFile(filePath)
        .pipe(mapFileSystemError(`PDF content could not be read: ${filePath}`)),
    );
    const text = extractPdfLiteralText(buffer);
    const warnings =
      text.trim().length < 80
        ? ["PDF text extraction produced little text; OCR/manual review may be required."]
        : [];
    return {
      text,
      confidence: warnings.length === 0 ? 0.65 : 0.35,
      warnings,
    };
  });
}

function readZipEntry(buffer: Buffer, entryName: string): Buffer | null {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) return null;
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) return null;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.toString("utf8", cursor + 46, cursor + 46 + fileNameLength);

    if (fileName === entryName) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      return null;
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function stripDocxXml(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPdfLiteralText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const textParts: string[] = [];
  const literalPattern = /\((?:\\.|[^\\)])*\)\s*(?:Tj|'|"|,|\])/g;
  for (const match of raw.matchAll(literalPattern)) {
    const token = match[0];
    const open = token.indexOf("(");
    const close = token.lastIndexOf(")");
    if (open >= 0 && close > open) {
      textParts.push(decodePdfLiteral(token.slice(open + 1, close)));
    }
  }
  return textParts.join(" ").replace(/\s+/g, " ").trim();
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\\d{1,3}/g, "");
}

function readAssetPreview(
  fs: FileSystem.FileSystem,
  filePath: string,
  fileType: StudySourceFileType,
): Effect.Effect<string | null, StudyFrameImportFolderError> {
  return Effect.gen(function* () {
    if (fileType !== "csv" && fileType !== "txt" && fileType !== "md") return null;
    const text = yield* fs
      .readFileString(filePath)
      .pipe(mapFileSystemError(`Asset preview could not be read: ${filePath}`));
    return text.slice(0, 4_000);
  });
}

function extractQuestionDrafts(text: string, relativePath: string): CandidateDraft[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const markerPattern =
    /(?:^|\n)\s*(?:(question|problem|exercise)\s+|q(?:uestion)?\.?\s*)(\d+[a-z]?)(?:\s*[:.)-]|\s+)/gi;
  const markers = [...normalized.matchAll(markerPattern)].map((match) => ({
    index: match.index ?? 0,
    label: `Q${match[2] ?? ""}`.trim(),
  }));

  if (markers.length === 0) {
    return looksLikeQuestion(normalized)
      ? [
          {
            sourceAnchor: `${relativePath}#question=1`,
            rawPromptMarkdown: normalized,
            label: "Q1",
            pointValue: extractPointValue(normalized),
          },
        ]
      : [];
  }

  return markers
    .map((marker, index) => {
      const next = markers[index + 1]?.index ?? normalized.length;
      const section = normalized.slice(marker.index, next).trim();
      return {
        sourceAnchor: `${relativePath}#question=${marker.label.replace(/^Q/i, "") || index + 1}`,
        rawPromptMarkdown: section,
        label: marker.label || `Q${index + 1}`,
        pointValue: extractPointValue(section),
      };
    })
    .filter((draft) => draft.rawPromptMarkdown.length >= 20);
}

function looksLikeQuestion(text: string): boolean {
  return (
    text.includes("?") ||
    /\b(compute|calculate|derive|explain|prove|estimate|show|find|choose|state)\b/i.test(text)
  );
}

function extractPointValue(text: string): number | null {
  const match = text.match(/(?:\(|\[)?\s*(\d+(?:\.\d+)?)\s*(?:points?|pts?)\s*(?:\)|\])?/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeTopicThreads(input: {
  readonly projectId: string;
  readonly questions: readonly StudyQuestion[];
  readonly now: string;
}): StudyTopicThread[] {
  if (input.questions.length === 0) return [];
  return [
    {
      id: "topic-unclassified-import",
      projectId: input.projectId,
      topic: "Unclassified imported questions",
      displayName: "Unclassified imported questions",
      summary:
        "Raw real questions imported from the course folder. Run analysis to classify them into topics and subtypes.",
      priorityScore: 0,
      firstExposureComplete: false,
      status: "ready",
      createdAt: input.now,
      updatedAt: input.now,
    },
  ];
}

function makeTopicClusters(input: {
  readonly projectId: string;
  readonly questions: readonly StudyQuestion[];
}): StudyTopicCluster[] {
  if (input.questions.length === 0) return [];
  const weightedPoints = input.questions.reduce(
    (total, question) => total + question.pointValue,
    0,
  );
  return [
    {
      id: "cluster-unclassified-import",
      projectId: input.projectId,
      displayName: "Unclassified imported questions",
      priorityRank: 1,
      priorityScore: 0,
      priorityLabel: "low",
      priorityRationale: "Imported questions are waiting for analysis.",
      recentQuestionParts: input.questions.length,
      olderQuestionAppearances: 0,
      weightedPoints,
      subtypes: ["Needs analysis"],
    },
  ];
}

function makeQuestionClassifications(
  candidates: readonly StudyQuestionCandidate[],
  clusters: readonly StudyTopicCluster[],
): StudyQuestionClassification[] {
  const cluster = clusters[0];
  if (!cluster) return [];
  return candidates.map((candidate) => ({
    id: `classification-${candidate.id}`,
    questionCandidateId: candidate.id,
    topicClusterId: cluster.id,
    subtype: "Needs analysis",
    confidence: 0.4,
    isPrimary: true,
  }));
}

function makeTopicModules(input: {
  readonly projectId: string;
  readonly topicClusters: readonly StudyTopicCluster[];
}): StudyTopicModule[] {
  return input.topicClusters.map((cluster) => ({
    id: `module-${cluster.id}`,
    projectId: input.projectId,
    topicClusterId: cluster.id,
    theorySummaryMarkdown: "",
    formulaSheetMarkdown: "",
    commonTrapsMarkdown: "",
    subtypeCoverageJson: { subtypes: cluster.subtypes },
    firstExposureComplete: false,
  }));
}

function makePracticeItems(input: {
  readonly projectId: string;
  readonly questionCandidates: readonly StudyQuestionCandidate[];
  readonly topicModules: readonly StudyTopicModule[];
}): StudyPracticeItem[] {
  const module = input.topicModules[0];
  if (!module) return [];
  return input.questionCandidates.map((candidate) => ({
    id: `practice-${candidate.id}`,
    projectId: input.projectId,
    topicModuleId: module.id,
    sourceQuestionCandidateId: candidate.id,
    itemOrigin: "real_question",
    subtype: "Needs analysis",
    promptMarkdown: candidate.rawPromptMarkdown,
    answerInputType: "free_text",
    pointValue: candidate.pointValue ?? 1,
    assetIds: candidate.assetIds,
    sourceMetadataJson: {
      sourceAnchor: candidate.sourceAnchor,
      sourceQuizLabel: candidate.sourceQuizLabel,
      sourceYear: candidate.sourceYear,
    },
  }));
}

function makePracticeSupport(practiceItems: readonly StudyPracticeItem[]): StudyPracticeSupport[] {
  return practiceItems.map((item) => ({
    id: `practice-support-${item.id}`,
    practiceItemId: item.id,
    expectedAnswerJson: [],
    rubricJson: [],
    hintsJson: [],
    stepByStepSolutionMarkdown: "",
    commonMistakesMarkdown: "",
    supportConfidence: 0,
  }));
}

function sourceFileType(extension: string): StudySourceFileType {
  if (extension === ".docx") return "docx";
  if (extension === ".pdf") return "pdf";
  if (extension === ".md" || extension === ".markdown") return "md";
  if (extension === ".txt") return "txt";
  if (extension === ".csv") return "csv";
  if (extension === ".zip") return "zip";
  if (extension === ".doc") return "doc";
  if (IMAGE_EXTENSIONS.has(extension)) return "image";
  return "other";
}

function isGeneratedMarkdownExport(relativePath: string): boolean {
  const extension = pathExtname(relativePath).toLowerCase();
  if (extension !== ".md" && extension !== ".markdown") return false;
  const name = pathBasename(relativePath).toLowerCase();
  return (
    /topic_\d+/.test(name) ||
    name.includes("topic_priority_report") ||
    name.includes("priority_report") ||
    name.includes("final_report") ||
    name.includes("mistakes_review") ||
    name.includes("score_summary") ||
    name.includes("review_material") ||
    name.includes("study_summary") ||
    name.includes("revised-plan")
  );
}

function isExtractedTextMirror(relativePath: string): boolean {
  return toPortablePath(relativePath).toLowerCase().startsWith("_quiz_text/");
}

function makeQuizLabel(relativePath: string, year: number | null): string | null {
  const base = pathBasename(relativePath, pathExtname(relativePath)).replace(/[_-]+/g, " ").trim();
  if (!base) return year ? `Quiz ${year}` : null;
  return year && !base.includes(String(year)) ? `${base} ${year}` : base;
}

function extractYear(value: string): number | null {
  const match = value.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function normalizePrompt(prompt: string): string {
  return prompt.toLowerCase().replace(/\s+/g, " ").trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function toPortablePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function pathBasename(value: string, extension = ""): string {
  const normalized = toPortablePath(value);
  const segment = normalized.slice(normalized.lastIndexOf("/") + 1);
  return extension.length > 0 && segment.endsWith(extension)
    ? segment.slice(0, -extension.length)
    : segment;
}

function pathExtname(value: string): string {
  const base = pathBasename(value);
  const index = base.lastIndexOf(".");
  return index > 0 ? base.slice(index) : "";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function stableSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function stableHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
