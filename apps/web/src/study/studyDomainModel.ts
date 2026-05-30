import type {
  StudyDataset,
  StudyPracticeItem,
  StudyPracticeSupport,
  StudyQuestionCandidate,
  StudyQuestionClassification,
  StudyQuestionSupport,
  StudySourceDocument,
  StudySourceFileType,
  StudyTopicCluster,
  StudyTopicModule,
} from "./studyTypes";

type StudyDomainCollections = Pick<
  StudyDataset,
  | "sourceDocuments"
  | "sourceAssets"
  | "questionCandidates"
  | "topicClusters"
  | "questionClassifications"
  | "topicModules"
  | "practiceItems"
  | "practiceSupport"
>;

type StudyDatasetWithOptionalDomain = Omit<StudyDataset, keyof StudyDomainCollections> &
  Partial<StudyDomainCollections>;

export function withDerivedStudyDomainModel(dataset: StudyDatasetWithOptionalDomain): StudyDataset {
  const sourceDocuments = dataset.sourceDocuments ?? deriveSourceDocuments(dataset);
  const sourceAssets = dataset.sourceAssets ?? [];
  const questionCandidates = dataset.questionCandidates ?? deriveQuestionCandidates(dataset);
  const topicClusters = dataset.topicClusters ?? deriveTopicClusters(dataset);
  const questionClassifications =
    dataset.questionClassifications ?? deriveQuestionClassifications(dataset);
  const topicModules = dataset.topicModules ?? deriveTopicModules(dataset, topicClusters);
  const practiceItems =
    dataset.practiceItems ??
    derivePracticeItems(dataset, questionCandidates, topicClusters, topicModules);
  const practiceSupport =
    dataset.practiceSupport ?? derivePracticeSupport(dataset.questionSupport, practiceItems);

  return {
    ...dataset,
    sourceDocuments,
    sourceAssets,
    questionCandidates,
    topicClusters,
    questionClassifications,
    topicModules,
    practiceItems,
    practiceSupport,
  };
}

export function withRegeneratedStudyPracticeModel(dataset: StudyDataset): StudyDataset {
  const {
    practiceItems: _practiceItems,
    practiceSupport: _practiceSupport,
    ...withoutPractice
  } = dataset;
  return withDerivedStudyDomainModel(withoutPractice);
}

function deriveSourceDocuments(dataset: Pick<StudyDataset, "documents">): StudySourceDocument[] {
  return dataset.documents.map((document) => ({
    id: document.id,
    projectId: document.projectId,
    sourcePath: document.sourcePath,
    fileType: fileTypeFromPath(document.sourcePath),
    role: "quiz",
    year: document.year,
    quizLabel: document.quizLabel,
    extractionConfidence: 1,
    warnings: [],
  }));
}

function deriveQuestionCandidates(
  dataset: Pick<StudyDataset, "questions">,
): StudyQuestionCandidate[] {
  return dataset.questions
    .filter((question) => question.isRealQuestion)
    .map((question) => ({
      id: questionCandidateId(question.id),
      projectId: question.projectId,
      documentId: question.documentId,
      sourceAnchor: question.sourceAnchor,
      rawPromptMarkdown: question.rawPrompt,
      sourceYear: question.sourceYear,
      sourceQuizLabel: question.sourceQuizLabel,
      pointValue: question.pointValue,
      assetIds: [],
      extractionConfidence: question.extractionConfidence,
      needsManualReview: question.dependsOnAssets || question.extractionConfidence < 0.8,
    }));
}

function deriveTopicClusters(
  dataset: Pick<StudyDataset, "questions" | "questionTopics" | "topicThreads">,
): StudyTopicCluster[] {
  const currentYear = Math.max(...dataset.questions.map((question) => question.sourceYear ?? 0), 0);
  const rankedThreads = [...dataset.topicThreads].sort(
    (left, right) => right.priorityScore - left.priorityScore,
  );

  return rankedThreads.map((thread, index) => {
    const topicQuestions = questionsForThread(dataset, thread.id).filter(
      (question) => question.isRealQuestion,
    );
    const recentQuestionParts = topicQuestions.filter(
      (question) => question.sourceYear !== null && currentYear - question.sourceYear <= 2,
    ).length;
    const olderQuestionAppearances = topicQuestions.length - recentQuestionParts;
    const weightedPoints = topicQuestions.reduce(
      (total, question) => total + question.pointValue,
      0,
    );
    const subtypes = unique(
      dataset.questionTopics
        .filter((topic) => topic.topicThreadId === thread.id)
        .map((topic) => topic.subtype),
    );

    return {
      id: topicClusterId(thread.id),
      projectId: thread.projectId,
      displayName: thread.displayName,
      priorityRank: index + 1,
      priorityScore: thread.priorityScore,
      priorityLabel: priorityLabel(thread.priorityScore),
      priorityRationale: `${thread.displayName} has ${topicQuestions.length} real question part${
        topicQuestions.length === 1 ? "" : "s"
      }, ${recentQuestionParts} recent appearance${
        recentQuestionParts === 1 ? "" : "s"
      }, and ${weightedPoints} weighted point${weightedPoints === 1 ? "" : "s"}.`,
      recentQuestionParts,
      olderQuestionAppearances,
      weightedPoints,
      subtypes,
    };
  });
}

function deriveQuestionClassifications(
  dataset: Pick<StudyDataset, "questionTopics">,
): StudyQuestionClassification[] {
  return dataset.questionTopics.map((topic) => ({
    id: `classification-${topic.id}`,
    questionCandidateId: questionCandidateId(topic.questionId),
    topicClusterId: topicClusterId(topic.topicThreadId),
    subtype: topic.subtype,
    confidence: topic.confidence,
    isPrimary: topic.isPrimary,
  }));
}

function deriveTopicModules(
  dataset: Pick<StudyDataset, "topicThreads">,
  topicClusters: readonly StudyTopicCluster[],
): StudyTopicModule[] {
  const clusterByThreadId = new Map(
    topicClusters.map((cluster) => [threadIdFromClusterId(cluster.id), cluster]),
  );

  return dataset.topicThreads.map((thread) => {
    const cluster = clusterByThreadId.get(thread.id);
    return {
      id: topicModuleId(thread.id),
      projectId: thread.projectId,
      topicClusterId: cluster?.id ?? topicClusterId(thread.id),
      theorySummaryMarkdown: thread.summary,
      formulaSheetMarkdown: "",
      commonTrapsMarkdown: "",
      subtypeCoverageJson: {
        subtypes: cluster?.subtypes ?? [],
      },
      firstExposureComplete: thread.firstExposureComplete,
    };
  });
}

function derivePracticeItems(
  dataset: Pick<StudyDataset, "questions" | "questionTopics" | "topicThreads">,
  questionCandidates: readonly StudyQuestionCandidate[],
  topicClusters: readonly StudyTopicCluster[],
  topicModules: readonly StudyTopicModule[],
): StudyPracticeItem[] {
  const candidateBySource = new Map(
    questionCandidates.map((candidate) => [sourceKey(candidate), candidate]),
  );
  const moduleByThreadId = new Map(
    dataset.topicThreads.flatMap((thread) => {
      const cluster = topicClusters.find(
        (candidate) =>
          candidate.projectId === thread.projectId && candidate.displayName === thread.displayName,
      );
      const module =
        topicModules.find((candidate) => candidate.topicClusterId === cluster?.id) ??
        topicModules.find((candidate) => threadIdFromModuleId(candidate.id) === thread.id);
      return module ? [[thread.id, module] as const] : [];
    }),
  );

  return dataset.questions.flatMap((question) => {
    const classification = dataset.questionTopics.find((topic) => topic.questionId === question.id);
    if (!classification) return [];
    const module = moduleByThreadId.get(classification.topicThreadId);
    if (!module) return [];
    const candidate = candidateBySource.get(sourceKey(question));
    return [
      {
        id: practiceItemId(question.id),
        projectId: question.projectId,
        topicModuleId: module.id,
        sourceQuestionCandidateId: question.isRealQuestion ? (candidate?.id ?? null) : null,
        itemOrigin: question.isRealQuestion ? "real_question" : "generated_variant",
        subtype: classification.subtype,
        promptMarkdown: question.rawPrompt,
        answerInputType: "free_text",
        pointValue: question.pointValue,
        assetIds: candidate?.assetIds ?? [],
        sourceMetadataJson: {
          sourceAnchor: question.sourceAnchor,
          sourceQuizLabel: question.sourceQuizLabel,
          sourceYear: question.sourceYear,
          generatedFromQuestionIds: question.generatedFromQuestionIds,
        },
      },
    ];
  });
}

function derivePracticeSupport(
  questionSupport: readonly StudyQuestionSupport[],
  practiceItems: readonly StudyPracticeItem[],
): StudyPracticeSupport[] {
  const practiceItemByQuestionId = new Map(
    practiceItems.map((item) => [questionIdFromPracticeItemId(item.id), item]),
  );

  return questionSupport.flatMap((support) => {
    const item = practiceItemByQuestionId.get(support.questionId);
    if (!item) return [];
    return [
      {
        id: `practice-support-${support.id}`,
        practiceItemId: item.id,
        expectedAnswerJson: support.expectedAnswer,
        rubricJson: support.rubric,
        hintsJson: support.hints,
        stepByStepSolutionMarkdown: support.solutionSteps
          .map((step, index) => `${index + 1}. ${step}`)
          .join("\n"),
        commonMistakesMarkdown: support.commonMistakes.map((mistake) => `- ${mistake}`).join("\n"),
        supportConfidence: support.supportConfidence,
      },
    ];
  });
}

function questionsForThread(
  dataset: Pick<StudyDataset, "questions" | "questionTopics">,
  topicThreadId: string,
) {
  const questionIds = new Set(
    dataset.questionTopics
      .filter((topic) => topic.topicThreadId === topicThreadId)
      .map((topic) => topic.questionId),
  );
  return dataset.questions.filter((question) => questionIds.has(question.id));
}

function priorityLabel(score: number): StudyTopicCluster["priorityLabel"] {
  if (score >= 0.85) return "very_high";
  if (score >= 0.7) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function fileTypeFromPath(path: string): StudySourceFileType {
  const extension = path.toLowerCase().split(".").pop();
  if (extension === "docx") return "docx";
  if (extension === "pdf") return "pdf";
  if (extension === "md" || extension === "markdown") return "md";
  if (extension === "txt") return "txt";
  if (extension === "csv") return "csv";
  if (extension === "zip") return "zip";
  if (extension === "doc") return "doc";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff"].includes(extension ?? "")) {
    return "image";
  }
  return "other";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function questionCandidateId(questionId: string): string {
  return `candidate-${questionId}`;
}

function topicClusterId(topicThreadId: string): string {
  return `cluster-${topicThreadId}`;
}

function topicModuleId(topicThreadId: string): string {
  return `module-${topicThreadId}`;
}

function practiceItemId(questionId: string): string {
  return `practice-${questionId}`;
}

function threadIdFromClusterId(clusterId: string): string {
  return clusterId.replace(/^cluster-/, "");
}

function threadIdFromModuleId(moduleId: string): string {
  return moduleId.replace(/^module-/, "");
}

function questionIdFromPracticeItemId(itemId: string): string {
  return itemId.replace(/^practice-/, "");
}

function sourceKey(input: Pick<StudyQuestionCandidate, "documentId" | "sourceAnchor">): string {
  return `${input.documentId}\0${input.sourceAnchor}`;
}
