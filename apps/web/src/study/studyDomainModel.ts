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
  | "sourceChunks"
  | "sourceSecurityFindings"
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
  const sourceChunks = dataset.sourceChunks ?? [];
  const sourceSecurityFindings = dataset.sourceSecurityFindings ?? [];
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
    sourceChunks,
    sourceSecurityFindings,
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
    const review = getDefaultTopicReview(thread.displayName, thread.summary);
    return {
      id: topicModuleId(thread.id),
      projectId: thread.projectId,
      topicClusterId: cluster?.id ?? topicClusterId(thread.id),
      theorySummaryMarkdown: review.theorySummaryMarkdown,
      formulaSheetMarkdown: review.formulaSheetMarkdown,
      commonTrapsMarkdown: review.commonTrapsMarkdown,
      subtypeCoverageJson: {
        subtypes: cluster?.subtypes ?? review.subtypes,
        highYieldSkills: review.highYieldSkills,
        questionPatterns: review.questionPatterns,
        practiceDrills: review.practiceDrills,
        studyFlow: review.studyFlow,
      },
      firstExposureComplete: thread.firstExposureComplete,
    };
  });
}

function getDefaultTopicReview(
  displayName: string,
  summary: string,
): {
  readonly theorySummaryMarkdown: string;
  readonly formulaSheetMarkdown: string;
  readonly subtypes: readonly string[];
  readonly highYieldSkills: readonly string[];
  readonly questionPatterns: readonly string[];
  readonly practiceDrills: readonly {
    readonly title: string;
    readonly sourceAnchors: readonly string[];
    readonly promptMarkdown: string;
  }[];
  readonly studyFlow: readonly string[];
  readonly commonTrapsMarkdown: string;
} {
  const normalized = displayName.toLowerCase();
  if (normalized.includes("spike-train")) {
    return {
      theorySummaryMarkdown: [
        "Spike-train questions ask you to summarize event times without losing the distinction between count variability and interval variability.",
        "",
        "- Use firing rate when the question gives spike counts and a recording duration.",
        "- Use Fano factor when counts vary across equal windows or repeated trials.",
        "- Use CV when the data are inter-spike intervals.",
        "- Compare results to the Poisson benchmark: `FF = 1`, `CV = 1`, exponential ISIs, and constant hazard.",
        "- Refractory periods, bursting, and modulation are common reasons real neurons deviate from Poisson.",
      ].join("\n"),
      formulaSheetMarkdown: [
        "- Mean firing rate: $r = N_{spikes} / T$",
        "- Poisson expected count: $\\lambda = rT$",
        "- Fano factor: $FF = Var[N] / E[N]$",
        "- Coefficient of variation: $CV = \\sigma_{ISI} / \\mu_{ISI}$",
        "- Poisson ISI density: $p(\\tau) = r e^{-r\\tau}$",
        "- Hazard: $h(\\tau)$ is the instantaneous firing probability given no spike yet.",
      ].join("\n"),
      subtypes: [
        "Firing rate",
        "Fano factor",
        "Coefficient of variation",
        "Inter-spike intervals",
        "Hazard and refractory logic",
      ],
      highYieldSkills: [
        "Choose the statistic from the data type: counts, intervals, or hazard.",
        "Convert milliseconds to seconds before reporting Hz.",
        "Compare CV and FF with the Poisson benchmark without treating either as proof.",
      ],
      questionPatterns: [
        "Given spike counts across trials or windows, compute rate, variance, and Fano factor.",
        "Given ISIs, compute mean interval, CV, and regularity relative to Poisson.",
        "Given a spike-generation rule, reason about hazard, refractoriness, and whether the process is Poisson-like.",
      ],
      practiceDrills: [
        {
          title: "Rate and Fano factor from counts",
          sourceAnchors: ["Quiz 2024 Q2"],
          promptMarkdown:
            "A neuron is observed across equal windows. Compute the mean firing rate, the Fano factor, and state whether the count variability is below, equal to, or above the Poisson benchmark.",
        },
        {
          title: "CV from inter-spike intervals",
          sourceAnchors: ["Quiz 2023 Q1"],
          promptMarkdown:
            "Given a mean ISI and an ISI standard deviation, compute the coefficient of variation and interpret the spike-train regularity relative to a Poisson process.",
        },
      ],
      studyFlow: [
        "Identify whether the random quantity is count, interval, or hazard.",
        "Convert time units before computing rates.",
        "Compute the requested statistic.",
        "Compare with the Poisson benchmark and state the interpretation.",
      ],
      commonTrapsMarkdown: [
        "- Converting milliseconds incorrectly before computing Hz.",
        "- Using CV on spike counts or FF on ISIs.",
        "- Claiming a train is Poisson from `CV = 1` or `FF = 1` alone.",
      ].join("\n"),
    };
  }

  if (normalized.includes("information theory")) {
    return {
      theorySummaryMarkdown: [
        "Information-theory questions measure uncertainty and how much uncertainty drops after observing data.",
        "",
        "- Start by writing the probability table and checking that probabilities sum to one.",
        "- Compute marginal probabilities before entropy or mutual information.",
        "- Entropy measures uncertainty; conditional entropy measures uncertainty left after observing another variable.",
        "- Mutual information is the reduction in uncertainty and is zero for independent variables.",
        "- Spike-pattern entropy can exceed spike-count entropy because timing patterns can share the same count.",
      ].join("\n"),
      formulaSheetMarkdown: [
        "- Surprise: $h(x) = -\\log_2 p(x)$",
        "- Entropy: $H(X) = -\\sum_x p(x)\\log_2 p(x)$",
        "- Joint entropy: $H(X,Y) = -\\sum_x\\sum_y p(x,y)\\log_2 p(x,y)$",
        "- Conditional entropy: $H(X\\mid Y) = H(X,Y) - H(Y)$",
        "- Mutual information: $I(X;Y) = H(X) - H(X\\mid Y)$",
        "- Equivalent: $I(X;Y) = H(X) + H(Y) - H(X,Y)$",
      ].join("\n"),
      subtypes: [
        "Entropy",
        "Joint entropy",
        "Conditional entropy",
        "Mutual information",
        "Spike-pattern entropy",
      ],
      highYieldSkills: [
        "Build the full probability table before computing entropy.",
        "Compute marginals explicitly before using joint or conditional identities.",
        "Explain each number as uncertainty or uncertainty reduction.",
      ],
      questionPatterns: [
        "Given a probability table, compute entropy, joint entropy, conditional entropy, and mutual information.",
        "Given neural responses and stimuli, estimate entropy and information from empirical distributions.",
        "Compare spike-count entropy with spike-pattern entropy and explain what timing adds.",
      ],
      practiceDrills: [
        {
          title: "Entropy from a probability table",
          sourceAnchors: ["Quiz 2024 information theory"],
          promptMarkdown:
            "A categorical state has four probabilities. Compute the entropy in bits, compare it to the maximum possible entropy, and explain what the distribution shape means.",
        },
        {
          title: "Mutual information from binary features",
          sourceAnchors: ["Quiz 2024 information theory"],
          promptMarkdown:
            "Given a table of states and binary features, compute which feature reduces the most uncertainty about the state. State the mutual-information interpretation in words.",
        },
      ],
      studyFlow: [
        "Build the probability table.",
        "Check normalization and compute marginals.",
        "Choose the entropy identity that matches the question.",
        "Compute in bits and explain the interpretation.",
      ],
      commonTrapsMarkdown: [
        "- Using natural logs when the answer should be in bits.",
        "- Replacing joint probabilities with marginals.",
        "- Forgetting that conditional entropy and mutual information cannot be negative.",
      ].join("\n"),
    };
  }

  return {
    theorySummaryMarkdown: summary,
    formulaSheetMarkdown: "",
    subtypes: [],
    highYieldSkills: [],
    questionPatterns: [],
    practiceDrills: [],
    studyFlow: [],
    commonTrapsMarkdown: "",
  };
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
        generationMetadataJson: support.generationMetadataJson ?? null,
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
