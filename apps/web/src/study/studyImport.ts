import type {
  StudyDataset,
  StudyDocument,
  StudyProject,
  StudyQuestion,
  StudyQuestionSupport,
  StudyQuestionTopic,
  StudyRubricItem,
  StudyTopicThread,
} from "./studyTypes";
import { withDerivedStudyDomainModel } from "./studyDomainModel";

export interface StudyImportPayload {
  readonly project?: {
    readonly id?: unknown;
    readonly name?: unknown;
    readonly sourceRoot?: unknown;
    readonly extractionWarnings?: unknown;
  };
  readonly documents?: unknown;
  readonly questions?: unknown;
}

export interface StudyImportQuestionPayload {
  readonly id?: unknown;
  readonly prompt?: unknown;
  readonly rawPrompt?: unknown;
  readonly normalizedPrompt?: unknown;
  readonly documentId?: unknown;
  readonly sourceDocument?: unknown;
  readonly sourceAnchor?: unknown;
  readonly sourceYear?: unknown;
  readonly sourceQuizLabel?: unknown;
  readonly pointValue?: unknown;
  readonly topic?: unknown;
  readonly subtype?: unknown;
  readonly extractionConfidence?: unknown;
  readonly dependsOnAssets?: unknown;
  readonly expectedAnswer?: unknown;
  readonly rubric?: unknown;
  readonly hints?: unknown;
  readonly solutionSteps?: unknown;
  readonly commonMistakes?: unknown;
}

export function parseStudyImportJson(rawJson: string, now: string): StudyDataset {
  const parsed = JSON.parse(rawJson) as unknown;
  return normalizeStudyImportPayload(parsed, now);
}

export function normalizeStudyImportPayload(input: unknown, now: string): StudyDataset {
  if (isStudyDataset(input)) {
    return withDerivedStudyDomainModel(input);
  }

  if (!isRecord(input)) {
    throw new Error("Import must be a JSON object.");
  }

  const payload = input as StudyImportPayload;
  const questionPayloads = readArray(payload.questions, "questions");
  if (questionPayloads.length === 0) {
    throw new Error("Import must include at least one question.");
  }

  const projectName =
    readOptionalString(payload.project?.name) ??
    readOptionalString(input.name) ??
    "Imported course";
  const projectId =
    readOptionalString(payload.project?.id) ?? `project-${stableSlug(projectName) || "imported"}`;
  const project: StudyProject = {
    id: projectId,
    name: projectName,
    sourceRoot: readOptionalString(payload.project?.sourceRoot) ?? "Imported JSON",
    importedAt: now,
    extractionWarnings: readStringArray(payload.project?.extractionWarnings),
  };

  const documents = normalizeDocuments(payload.documents, projectId);
  const documentByKey = new Map(documents.map((document) => [document.id, document]));
  const topicThreadByTopic = new Map<string, StudyTopicThread>();
  const questions: StudyQuestion[] = [];
  const questionSupport: StudyQuestionSupport[] = [];
  const questionTopics: StudyQuestionTopic[] = [];

  for (const [index, rawQuestion] of questionPayloads.entries()) {
    if (!isRecord(rawQuestion)) {
      throw new Error(`Question ${index + 1} must be an object.`);
    }
    const raw = rawQuestion as StudyImportQuestionPayload;
    const prompt = readOptionalString(raw.rawPrompt) ?? readOptionalString(raw.prompt);
    if (!prompt) {
      throw new Error(`Question ${index + 1} is missing a prompt.`);
    }
    const topic = readOptionalString(raw.topic) ?? "Unclassified";
    const subtype = readOptionalString(raw.subtype) ?? "General";
    const sourceQuizLabel = readOptionalString(raw.sourceQuizLabel) ?? `Imported Q${index + 1}`;
    const questionId =
      readOptionalString(raw.id) ??
      `q-${stableSlug(`${projectId}-${sourceQuizLabel}-${index + 1}`) || index + 1}`;
    const documentId =
      readOptionalString(raw.documentId) ??
      resolveDocumentIdForQuestion({
        documents,
        documentByKey,
        sourceDocument: readOptionalString(raw.sourceDocument),
        projectId,
        now,
      });
    if (!documentByKey.has(documentId)) {
      const document: StudyDocument = {
        id: documentId,
        projectId,
        title: readOptionalString(raw.sourceDocument) ?? sourceQuizLabel,
        sourcePath: readOptionalString(raw.sourceDocument) ?? "Imported JSON",
        year: readOptionalNumber(raw.sourceYear),
        quizLabel: sourceQuizLabel,
      };
      documents.push(document);
      documentByKey.set(document.id, document);
    }

    const topicThread =
      topicThreadByTopic.get(topic) ??
      createTopicThread({
        projectId,
        topic,
        now,
      });
    topicThreadByTopic.set(topic, topicThread);

    questions.push({
      id: questionId,
      projectId,
      documentId,
      sourceAnchor: readOptionalString(raw.sourceAnchor) ?? `imported:${questionId}`,
      sourceYear: readOptionalNumber(raw.sourceYear),
      sourceQuizLabel,
      rawPrompt: prompt,
      normalizedPrompt: readOptionalString(raw.normalizedPrompt) ?? prompt,
      pointValue: readOptionalNumber(raw.pointValue) ?? 1,
      isRealQuestion: true,
      generatedFromQuestionIds: [],
      dependsOnAssets: readOptionalBoolean(raw.dependsOnAssets) ?? false,
      extractionConfidence: readOptionalNumber(raw.extractionConfidence) ?? 0.85,
      createdAt: now,
    });

    questionTopics.push({
      id: `qt-${questionId}`,
      questionId,
      topicThreadId: topicThread.id,
      topic,
      subtype,
      confidence: readOptionalNumber(raw.extractionConfidence) ?? 0.85,
      isPrimary: true,
    });

    questionSupport.push({
      id: `support-${questionId}`,
      questionId,
      summaryContext: "",
      expectedAnswer: readStringArray(raw.expectedAnswer),
      rubric: normalizeRubric(raw.rubric),
      hints: readStringArray(raw.hints),
      solutionSteps: readStringArray(raw.solutionSteps),
      commonMistakes: readStringArray(raw.commonMistakes),
      supportConfidence: 0.75,
      generatedAt: now,
    });
  }

  const topicThreads = [...topicThreadByTopic.values()].map((thread) => {
    const priorityScore = computeTopicPriority(thread.topic, questions, questionTopics);
    return {
      id: thread.id,
      projectId: thread.projectId,
      topic: thread.topic,
      displayName: thread.displayName,
      summary: thread.summary,
      priorityScore,
      firstExposureComplete: thread.firstExposureComplete,
      status: thread.status,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  });

  return withDerivedStudyDomainModel({
    projects: [project],
    documents,
    questions,
    questionSupport,
    questionTopics,
    topicThreads,
  });
}

function normalizeDocuments(input: unknown, projectId: string): StudyDocument[] {
  const rawDocuments = Array.isArray(input) ? input : [];
  return rawDocuments.flatMap((rawDocument, index) => {
    if (!isRecord(rawDocument)) return [];
    const title = readOptionalString(rawDocument.title) ?? `Imported document ${index + 1}`;
    const id = readOptionalString(rawDocument.id) ?? `document-${stableSlug(title) || index + 1}`;
    return [
      {
        id,
        projectId,
        title,
        sourcePath: readOptionalString(rawDocument.sourcePath) ?? title,
        year: readOptionalNumber(rawDocument.year),
        quizLabel: readOptionalString(rawDocument.quizLabel) ?? title,
      },
    ];
  });
}

function resolveDocumentIdForQuestion(input: {
  readonly documents: readonly StudyDocument[];
  readonly documentByKey: ReadonlyMap<string, StudyDocument>;
  readonly sourceDocument: string | undefined;
  readonly projectId: string;
  readonly now: string;
}): string {
  if (!input.sourceDocument) {
    return input.documents[0]?.id ?? `document-${input.projectId}`;
  }
  const directMatch = input.documentByKey.get(input.sourceDocument);
  if (directMatch) return directMatch.id;
  const byTitle = input.documents.find(
    (document) =>
      document.title === input.sourceDocument || document.sourcePath === input.sourceDocument,
  );
  if (byTitle) return byTitle.id;
  return `document-${stableSlug(input.sourceDocument) || input.projectId}`;
}

function createTopicThread(input: {
  readonly projectId: string;
  readonly topic: string;
  readonly now: string;
}): StudyTopicThread {
  return {
    id: `topic-${stableSlug(input.topic) || "unclassified"}`,
    projectId: input.projectId,
    topic: input.topic,
    displayName: input.topic,
    summary: `Real extracted questions grouped under ${input.topic}.`,
    priorityScore: 0,
    firstExposureComplete: false,
    status: "ready",
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function computeTopicPriority(
  topic: string,
  questions: readonly StudyQuestion[],
  questionTopics: readonly StudyQuestionTopic[],
): number {
  const topicQuestionIds = new Set(
    questionTopics.filter((entry) => entry.topic === topic).map((entry) => entry.questionId),
  );
  const topicQuestions = questions.filter((question) => topicQuestionIds.has(question.id));
  if (topicQuestions.length === 0) return 0;

  const currentYear = Math.max(...questions.map((question) => question.sourceYear ?? 0), 0);
  const recentCount =
    topicQuestions.filter(
      (question) => question.sourceYear && currentYear - question.sourceYear <= 2,
    ).length / Math.max(1, topicQuestions.length);
  const maxPoints = Math.max(...questions.map((question) => question.pointValue), 1);
  const pointWeight =
    topicQuestions.reduce((total, question) => total + question.pointValue / maxPoints, 0) /
    topicQuestions.length;
  const recurrence =
    new Set(topicQuestions.map((question) => question.sourceYear).filter(Boolean)).size /
    Math.max(1, new Set(questions.map((question) => question.sourceYear).filter(Boolean)).size);
  const extractionConfidence =
    topicQuestions.reduce((total, question) => total + question.extractionConfidence, 0) /
    topicQuestions.length;

  return roundPriority(
    0.4 * recentCount +
      0.3 * pointWeight +
      0.15 * recurrence +
      0.1 * 0.5 +
      0.05 * extractionConfidence,
  );
}

function normalizeRubric(input: unknown): StudyRubricItem[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item, index) => {
    if (typeof item === "string") {
      return [{ label: item, points: 1, keywords: [item] }];
    }
    if (!isRecord(item)) return [];
    const label = readOptionalString(item.label) ?? `Rubric item ${index + 1}`;
    return [
      {
        label,
        points: readOptionalNumber(item.points) ?? 1,
        keywords:
          readStringArray(item.keywords).length > 0 ? readStringArray(item.keywords) : [label],
      },
    ];
  });
}

function isStudyDataset(input: unknown): input is StudyDataset {
  return (
    isRecord(input) &&
    Array.isArray(input.projects) &&
    Array.isArray(input.documents) &&
    Array.isArray(input.questions) &&
    Array.isArray(input.questionSupport) &&
    Array.isArray(input.questionTopics) &&
    Array.isArray(input.topicThreads)
  );
}

function readArray(input: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(input)) {
    throw new Error(`Import must include a ${label} array.`);
  }
  return input;
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((value) => {
    const normalized = readOptionalString(value);
    return normalized ? [normalized] : [];
  });
}

function readOptionalString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}

function readOptionalNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readOptionalBoolean(input: unknown): boolean | null {
  return typeof input === "boolean" ? input : null;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function stableSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function roundPriority(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}
