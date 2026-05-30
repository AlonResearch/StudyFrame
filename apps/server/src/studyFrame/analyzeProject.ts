import type {
  StudyAnalysisResult,
  StudyAnalyzeProjectInput,
  StudyAnalyzeProjectResponse,
  StudyDataset,
  StudyFrameSnapshot,
  StudyPracticeItem,
  StudyPracticeSupport,
  StudyQuestion,
  StudyQuestionCandidate,
  StudyQuestionClassification,
  StudyQuestionSupport,
  StudyQuestionTopic,
  StudyTopicCluster,
  StudyTopicModule,
  StudyTopicThread,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";

interface TopicDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly keywords: readonly string[];
  readonly subtypeRules: readonly {
    readonly name: string;
    readonly keywords: readonly string[];
  }[];
  readonly defaultSubtype: string;
  readonly summary: string;
  readonly theory: string;
  readonly formulas: string;
  readonly traps: readonly string[];
  readonly hint: string;
}

interface CandidateAnalysis {
  readonly candidate: StudyQuestionCandidate;
  readonly definition: TopicDefinition;
  readonly subtype: string;
  readonly confidence: number;
}

interface TopicAnalysis {
  readonly definition: TopicDefinition;
  readonly candidates: readonly CandidateAnalysis[];
  readonly recentQuestionParts: number;
  readonly olderQuestionAppearances: number;
  readonly weightedPoints: number;
  readonly rawPriority: number;
}

const UNCLASSIFIED_TOPIC: TopicDefinition = {
  id: "unclassified-import",
  displayName: "Unclassified imported questions",
  keywords: [],
  subtypeRules: [],
  defaultSubtype: "Needs manual analysis",
  summary: "Imported questions that need a manual topic assignment.",
  theory: "Review the source question and assign a topic before relying on generated study notes.",
  formulas: "",
  traps: ["Treating an unclassified question as fully analyzed."],
  hint: "Identify the governing concept and the requested output before solving.",
};

const TOPIC_DEFINITIONS: readonly TopicDefinition[] = [
  {
    id: "information-theory",
    displayName: "Information theory",
    keywords: [
      "entropy",
      "mutual information",
      "conditional entropy",
      "joint entropy",
      "information theory",
      "redundancy",
    ],
    subtypeRules: [
      { name: "Mutual information", keywords: ["mutual information"] },
      { name: "Conditional entropy", keywords: ["conditional entropy"] },
      { name: "Entropy", keywords: ["entropy"] },
    ],
    defaultSubtype: "Information measures",
    summary: "Entropy and information measures used to quantify uncertainty and dependence.",
    theory:
      "Entropy quantifies uncertainty in a random variable. Mutual information quantifies how much observing one variable reduces uncertainty about another.",
    formulas: "- $H(X) = -\\sum_x p(x)\\log_2 p(x)$\n- $I(X;Y) = H(X) - H(X\\mid Y)$",
    traps: [
      "Mixing logarithm bases.",
      "Using marginal probabilities where joint probabilities are required.",
    ],
    hint: "Write the required distribution first, then choose the matching entropy or information identity.",
  },
  {
    id: "psth-rate-estimation",
    displayName: "PSTH and rate estimation",
    keywords: ["psth", "peri-stimulus", "rate estimation", "smoothing", "bin width", "window"],
    subtypeRules: [
      { name: "PSTH", keywords: ["psth", "peri-stimulus"] },
      { name: "Smoothing", keywords: ["smoothing", "window"] },
      { name: "Bin width", keywords: ["bin width"] },
    ],
    defaultSubtype: "Rate estimation",
    summary: "Estimating time-varying firing rates from repeated neural responses.",
    theory:
      "A PSTH estimates firing rate over time by counting spikes in aligned time bins across repeated trials.",
    formulas: "- $\\hat{r}(t) = \\frac{\\text{spikes in bin}}{\\text{trials} \\cdot \\Delta t}$",
    traps: [
      "Forgetting to divide by bin width.",
      "Comparing PSTHs that use incompatible bin widths.",
    ],
    hint: "Track the number of trials and express the time bin in seconds.",
  },
  {
    id: "correlation-correlograms",
    displayName: "Correlation and correlograms",
    keywords: ["correlation", "autocorrelation", "cross-correlation", "correlogram", "covariance"],
    subtypeRules: [
      { name: "Autocorrelation", keywords: ["autocorrelation"] },
      { name: "Cross-correlation", keywords: ["cross-correlation", "correlogram"] },
      { name: "Correlation", keywords: ["correlation", "covariance"] },
    ],
    defaultSubtype: "Correlation",
    summary: "Dependence measurements across signals, spike trains, and time offsets.",
    theory:
      "Correlation summarizes dependence. Correlograms retain the time-lag structure needed to interpret repeated or coupled activity.",
    formulas: "- $R_{xy}(\\tau) = E[x(t)y(t+\\tau)]$",
    traps: ["Ignoring the lag sign convention.", "Interpreting correlation as causation."],
    hint: "State which signals are compared and what a positive lag means.",
  },
  {
    id: "spike-train-statistics",
    displayName: "Spike-train statistics",
    keywords: [
      "spike",
      "firing rate",
      "fano",
      "coefficient of variation",
      "cv",
      "isi",
      "inter-spike",
      "hazard",
      "poisson",
      "refractory",
    ],
    subtypeRules: [
      { name: "Fano factor", keywords: ["fano"] },
      { name: "Coefficient of variation", keywords: ["coefficient of variation", "cv"] },
      { name: "Inter-spike intervals", keywords: ["isi", "inter-spike", "hazard", "refractory"] },
      { name: "Firing rate", keywords: ["firing rate", "spike"] },
    ],
    defaultSubtype: "Spike-count statistics",
    summary: "Spike counts, firing rates, variability, and interval statistics.",
    theory:
      "Spike-train statistics describe response rate and variability. Choose a statistic that matches whether the question is about counts or inter-spike intervals.",
    formulas:
      "- $r = \\frac{N_{spikes}}{T}$\n- $FF = \\frac{Var[N]}{E[N]}$\n- $CV = \\frac{\\sigma_{ISI}}{\\mu_{ISI}}$",
    traps: [
      "Using milliseconds without converting to seconds.",
      "Confusing count variability with interval variability.",
    ],
    hint: "Decide whether the random quantity is a spike count or an inter-spike interval.",
  },
  {
    id: "sta-encoding",
    displayName: "STA and encoding models",
    keywords: ["spike-triggered average", "sta", "tuning", "encoding", "linear filter"],
    subtypeRules: [
      { name: "Spike-triggered average", keywords: ["spike-triggered average", "sta"] },
      { name: "Encoding model", keywords: ["encoding", "linear filter", "tuning"] },
    ],
    defaultSubtype: "Neural encoding",
    summary: "Stimulus-response relationships and spike-triggered summaries.",
    theory:
      "Spike-triggered averaging estimates stimulus features associated with spikes under assumptions about the stimulus ensemble.",
    formulas: "- $STA(\\tau) = E[s(t-\\tau) \\mid spike\\ at\\ t]$",
    traps: [
      "Ignoring the stimulus distribution assumptions.",
      "Reversing the time axis around the spike.",
    ],
    hint: "Align stimulus segments to spike times before averaging.",
  },
  {
    id: "roc-discrimination",
    displayName: "ROC and discrimination",
    keywords: [
      "roc",
      "auc",
      "receiver operating",
      "false positive",
      "true positive",
      "d-prime",
      "discrimination",
    ],
    subtypeRules: [
      {
        name: "ROC curve",
        keywords: ["roc", "receiver operating", "true positive", "false positive"],
      },
      { name: "AUC", keywords: ["auc"] },
      { name: "d-prime", keywords: ["d-prime"] },
    ],
    defaultSubtype: "Discrimination",
    summary: "Threshold-based discrimination performance and receiver operating curves.",
    theory:
      "An ROC curve traces the tradeoff between true-positive and false-positive rates as the decision threshold changes.",
    formulas: "- $d' = \\frac{\\mu_1 - \\mu_0}{\\sigma}$ for equal-variance Gaussian classes",
    traps: [
      "Using accuracy in place of a threshold sweep.",
      "Swapping false-positive and true-positive axes.",
    ],
    hint: "List the threshold outcomes before plotting or interpreting the curve.",
  },
  {
    id: "ml-map-bayes",
    displayName: "ML, MAP, and Bayes estimation",
    keywords: ["likelihood", "maximum likelihood", "mle", "map", "bayes", "prior", "posterior"],
    subtypeRules: [
      { name: "Maximum likelihood", keywords: ["maximum likelihood", "mle", "likelihood"] },
      { name: "MAP estimation", keywords: ["map", "prior", "posterior"] },
      { name: "Bayesian inference", keywords: ["bayes", "prior", "posterior"] },
    ],
    defaultSubtype: "Statistical estimation",
    summary: "Likelihood-based and Bayesian parameter estimation.",
    theory:
      "Maximum likelihood uses the data likelihood. MAP estimation adds prior information and maximizes the posterior.",
    formulas:
      "- $\\hat{\\theta}_{ML}=\\arg\\max_\\theta p(x\\mid\\theta)$\n- $\\hat{\\theta}_{MAP}=\\arg\\max_\\theta p(\\theta\\mid x)$",
    traps: [
      "Dropping a parameter-dependent term.",
      "Treating the prior as part of maximum likelihood.",
    ],
    hint: "Write the objective explicitly and remove only terms that are constant in the parameter.",
  },
  {
    id: "sampling-filtering-spectral",
    displayName: "Sampling, filtering, and spectra",
    keywords: [
      "sampling",
      "filter",
      "fir",
      "iir",
      "spectrum",
      "spectral",
      "fourier",
      "alias",
      "lti",
      "convolution",
    ],
    subtypeRules: [
      { name: "Sampling and aliasing", keywords: ["sampling", "alias"] },
      { name: "Filtering", keywords: ["filter", "fir", "iir", "lti", "convolution"] },
      { name: "Spectral analysis", keywords: ["spectrum", "spectral", "fourier"] },
    ],
    defaultSubtype: "Signal processing",
    summary: "Discrete-time sampling, systems, filters, and frequency-domain analysis.",
    theory:
      "Sampling maps continuous signals into discrete observations. Linear filtering can be analyzed in time with convolution or in frequency with transfer functions.",
    formulas: "- $y[n] = \\sum_k h[k]x[n-k]$\n- $f_s > 2f_{max}$",
    traps: [
      "Ignoring the sampling rate.",
      "Confusing a filter's impulse response with its frequency response.",
    ],
    hint: "Choose the time-domain or frequency-domain representation that makes the requested operation simplest.",
  },
  {
    id: "snr-noise-stationarity",
    displayName: "SNR, noise, and stationarity",
    keywords: ["snr", "signal-to-noise", "noise", "stationarity", "stationary", "wss"],
    subtypeRules: [
      { name: "Signal-to-noise ratio", keywords: ["snr", "signal-to-noise"] },
      { name: "Stationarity", keywords: ["stationarity", "stationary", "wss"] },
      { name: "Noise", keywords: ["noise"] },
    ],
    defaultSubtype: "Noise analysis",
    summary: "Noise models, signal quality, and stationarity assumptions.",
    theory:
      "Noise analysis separates signal structure from variability. Stationarity assumptions determine whether moments may be treated as time invariant.",
    formulas: "- $SNR = \\frac{P_{signal}}{P_{noise}}$",
    traps: [
      "Mixing amplitude ratios with power ratios.",
      "Assuming stationarity without checking the stated conditions.",
    ],
    hint: "Determine whether the problem uses amplitudes, powers, or time-dependent statistics.",
  },
  {
    id: "pca-dimensionality-reduction",
    displayName: "PCA and dimensionality reduction",
    keywords: ["pca", "principal component", "eigenvector", "eigenvalue", "dimensionality"],
    subtypeRules: [
      { name: "Principal components", keywords: ["pca", "principal component"] },
      { name: "Eigen decomposition", keywords: ["eigenvector", "eigenvalue"] },
    ],
    defaultSubtype: "Dimensionality reduction",
    summary: "Variance-preserving projections and low-dimensional representations.",
    theory: "PCA projects centered data onto orthogonal directions ordered by explained variance.",
    formulas: "- $C = \\frac{1}{n}X^TX$\n- $Cv_i = \\lambda_i v_i$",
    traps: ["Skipping centering.", "Sorting components in ascending explained variance."],
    hint: "Center the observations before computing the covariance matrix.",
  },
];

export function makeStudyFrameTopicCatalog(projectId: string, now: string) {
  const topics: TopicAnalysis[] = TOPIC_DEFINITIONS.map((definition) => ({
    definition,
    candidates: [],
    recentQuestionParts: 0,
    olderQuestionAppearances: 0,
    weightedPoints: 0,
    rawPriority: 0,
  }));
  return {
    clusters: makeTopicClusters(projectId, topics, 1),
    threads: makeTopicThreads(projectId, topics, 1, now),
    modules: makeTopicModules(projectId, topics),
  };
}

export class StudyFrameAnalyzeProjectError extends Data.TaggedError(
  "StudyFrameAnalyzeProjectError",
)<{
  readonly message: string;
}> {}

export const analyzeProjectSnapshot = Effect.fn("StudyFrame.analyzeProjectSnapshot")(function* (
  snapshot: StudyFrameSnapshot,
  input: StudyAnalyzeProjectInput,
): Effect.fn.Return<StudyAnalyzeProjectResponse, StudyFrameAnalyzeProjectError> {
  const project = snapshot.dataset.projects.find((candidate) => candidate.id === input.projectId);
  if (!project) {
    return yield* new StudyFrameAnalyzeProjectError({
      message: `StudyFrame project was not found: ${input.projectId}`,
    });
  }

  const now = DateTime.formatIso(yield* DateTime.now);
  const targetQuestions = snapshot.dataset.questions.filter(
    (question) => question.projectId === project.id && question.isRealQuestion,
  );
  const targetQuestionIds = new Set(
    snapshot.dataset.questions
      .filter((question) => question.projectId === project.id)
      .map((question) => question.id),
  );
  const existingCandidates = snapshot.dataset.questionCandidates ?? [];
  const targetCandidates = ensureQuestionCandidates(
    existingCandidates.filter((candidate) => candidate.projectId === project.id),
    targetQuestions,
  );
  const analyses = targetCandidates.map(analyzeCandidate);
  const currentYear = Math.max(...analyses.map(({ candidate }) => candidate.sourceYear ?? 0), 0);
  const topicAnalyses = aggregateTopics(analyses, currentYear);
  const maxRawPriority = Math.max(...topicAnalyses.map((topic) => topic.rawPriority), 1);
  const topicClusters = makeTopicClusters(project.id, topicAnalyses, maxRawPriority);
  const topicThreads = makeTopicThreads(project.id, topicAnalyses, maxRawPriority, now);
  const topicModules = makeTopicModules(project.id, topicAnalyses);
  const questionClassifications = makeQuestionClassifications(analyses);
  const questionTopics = makeQuestionTopics(targetQuestions, analyses);
  const questionSupport = makeQuestionSupport(snapshot.dataset, targetQuestions, analyses, now);
  const practiceItems = makePracticeItems(project.id, analyses);
  const practiceSupport = makePracticeSupport(practiceItems, targetQuestions, questionSupport);
  const warnings = analyses.some(({ definition }) => definition === UNCLASSIFIED_TOPIC)
    ? ["Some imported questions could not be classified and need manual topic assignment."]
    : [];
  const previousPracticeItemIds = new Set(
    (snapshot.dataset.practiceItems ?? [])
      .filter((item) => item.projectId === project.id)
      .map((item) => item.id),
  );
  const dataset: StudyDataset = {
    ...snapshot.dataset,
    questions: snapshot.dataset.questions.filter(
      (question) => question.projectId !== project.id || question.isRealQuestion,
    ),
    questionSupport: [
      ...snapshot.dataset.questionSupport.filter(
        (support) => !targetQuestionIds.has(support.questionId),
      ),
      ...questionSupport,
    ],
    questionTopics: [
      ...snapshot.dataset.questionTopics.filter(
        (topic) => !targetQuestionIds.has(topic.questionId),
      ),
      ...questionTopics,
    ],
    topicThreads: [
      ...snapshot.dataset.topicThreads.filter((thread) => thread.projectId !== project.id),
      ...topicThreads,
    ],
    questionCandidates: [
      ...existingCandidates.filter((candidate) => candidate.projectId !== project.id),
      ...targetCandidates,
    ],
    topicClusters: [
      ...(snapshot.dataset.topicClusters ?? []).filter(
        (cluster) => cluster.projectId !== project.id,
      ),
      ...topicClusters,
    ],
    questionClassifications: [
      ...(snapshot.dataset.questionClassifications ?? []).filter(
        (classification) =>
          !existingCandidates.some(
            (candidate) =>
              candidate.projectId === project.id &&
              candidate.id === classification.questionCandidateId,
          ),
      ),
      ...questionClassifications,
    ],
    topicModules: [
      ...(snapshot.dataset.topicModules ?? []).filter((module) => module.projectId !== project.id),
      ...topicModules,
    ],
    practiceItems: [
      ...(snapshot.dataset.practiceItems ?? []).filter((item) => item.projectId !== project.id),
      ...practiceItems,
    ],
    practiceSupport: [
      ...(snapshot.dataset.practiceSupport ?? []).filter(
        (support) => !previousPracticeItemIds.has(support.practiceItemId),
      ),
      ...practiceSupport,
    ],
  };
  const result: StudyAnalysisResult = {
    projectId: project.id,
    topicClusterCount: topicClusters.length,
    classifiedQuestionCount: analyses.length,
    topicModuleCount: topicModules.length,
    practiceItemCount: practiceItems.length,
    warnings,
    mode: "local_fallback",
  };

  return {
    snapshot: {
      dataset,
      attempts: snapshot.attempts.filter((attempt) => !targetQuestionIds.has(attempt.questionId)),
      completionSummaries: snapshot.completionSummaries.filter(
        (summary) => summary.projectId !== project.id,
      ),
      generatedQuestionBatches: snapshot.generatedQuestionBatches.filter(
        (batch) => batch.projectId !== project.id,
      ),
    },
    result,
  };
});

function ensureQuestionCandidates(
  candidates: readonly StudyQuestionCandidate[],
  questions: readonly StudyQuestion[],
): StudyQuestionCandidate[] {
  const bySource = new Map(candidates.map((candidate) => [sourceKey(candidate), candidate]));
  return [
    ...candidates,
    ...questions.flatMap((question) => {
      if (bySource.has(sourceKey(question))) return [];
      return [
        {
          id: `candidate-${question.id}`,
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
        },
      ];
    }),
  ];
}

function analyzeCandidate(candidate: StudyQuestionCandidate): CandidateAnalysis {
  const prompt = candidate.rawPromptMarkdown.toLowerCase();
  const ranked = TOPIC_DEFINITIONS.map((definition) => ({
    definition,
    matchCount: countKeywordMatches(prompt, definition.keywords),
  })).sort((left, right) => right.matchCount - left.matchCount);
  const match = ranked[0];
  if (!match || match.matchCount === 0) {
    return {
      candidate,
      definition: UNCLASSIFIED_TOPIC,
      subtype: UNCLASSIFIED_TOPIC.defaultSubtype,
      confidence: 0.35,
    };
  }
  return {
    candidate,
    definition: match.definition,
    subtype: matchingSubtype(prompt, match.definition),
    confidence: Math.min(0.94, 0.7 + match.matchCount * 0.06),
  };
}

function aggregateTopics(
  analyses: readonly CandidateAnalysis[],
  currentYear: number,
): TopicAnalysis[] {
  const byTopic = new Map<string, CandidateAnalysis[]>();
  for (const analysis of analyses) {
    const current = byTopic.get(analysis.definition.id) ?? [];
    current.push(analysis);
    byTopic.set(analysis.definition.id, current);
  }
  return [...byTopic.values()]
    .map((candidates) => {
      const definition = candidates[0]?.definition ?? UNCLASSIFIED_TOPIC;
      const recentQuestionParts = candidates.filter(
        ({ candidate }) =>
          candidate.sourceYear !== null &&
          currentYear > 0 &&
          currentYear - candidate.sourceYear <= 2,
      ).length;
      const olderQuestionAppearances = candidates.length - recentQuestionParts;
      const weightedPoints = candidates.reduce(
        (total, { candidate }) => total + (candidate.pointValue ?? 1),
        0,
      );
      return {
        definition,
        candidates,
        recentQuestionParts,
        olderQuestionAppearances,
        weightedPoints,
        rawPriority: recentQuestionParts + olderQuestionAppearances * 0.15 + weightedPoints / 100,
      };
    })
    .sort(
      (left, right) =>
        right.rawPriority - left.rawPriority ||
        left.definition.displayName.localeCompare(right.definition.displayName),
    );
}

function makeTopicClusters(
  projectId: string,
  topics: readonly TopicAnalysis[],
  maxRawPriority: number,
): StudyTopicCluster[] {
  return topics.map((topic, index) => {
    const priorityScore = topic.rawPriority / maxRawPriority;
    return {
      id: clusterId(topic.definition),
      projectId,
      displayName: topic.definition.displayName,
      priorityRank: index + 1,
      priorityScore,
      priorityLabel: priorityLabel(priorityScore),
      priorityRationale: `${topic.definition.displayName} has ${topic.recentQuestionParts} recent question part${
        topic.recentQuestionParts === 1 ? "" : "s"
      }, ${topic.olderQuestionAppearances} older appearance${
        topic.olderQuestionAppearances === 1 ? "" : "s"
      }, and ${topic.weightedPoints} weighted point${topic.weightedPoints === 1 ? "" : "s"}.`,
      recentQuestionParts: topic.recentQuestionParts,
      olderQuestionAppearances: topic.olderQuestionAppearances,
      weightedPoints: topic.weightedPoints,
      subtypes: unique(topic.candidates.map(({ subtype }) => subtype)),
    };
  });
}

function makeTopicThreads(
  projectId: string,
  topics: readonly TopicAnalysis[],
  maxRawPriority: number,
  now: string,
): StudyTopicThread[] {
  return topics.map((topic) => ({
    id: threadId(topic.definition),
    projectId,
    topic: topic.definition.displayName,
    displayName: topic.definition.displayName,
    summary: topic.definition.summary,
    priorityScore: topic.rawPriority / maxRawPriority,
    firstExposureComplete: false,
    status: "ready",
    createdAt: now,
    updatedAt: now,
  }));
}

function makeTopicModules(projectId: string, topics: readonly TopicAnalysis[]): StudyTopicModule[] {
  return topics.map((topic) => ({
    id: moduleId(topic.definition),
    projectId,
    topicClusterId: clusterId(topic.definition),
    theorySummaryMarkdown: topic.definition.theory,
    formulaSheetMarkdown: topic.definition.formulas,
    commonTrapsMarkdown: topic.definition.traps.map((trap) => `- ${trap}`).join("\n"),
    subtypeCoverageJson: Object.fromEntries(
      unique(topic.candidates.map(({ subtype }) => subtype)).map((subtype) => [
        subtype,
        topic.candidates.filter((candidate) => candidate.subtype === subtype).length,
      ]),
    ),
    firstExposureComplete: false,
  }));
}

function makeQuestionClassifications(
  analyses: readonly CandidateAnalysis[],
): StudyQuestionClassification[] {
  return analyses.map((analysis) => ({
    id: `classification-${analysis.candidate.id}`,
    questionCandidateId: analysis.candidate.id,
    topicClusterId: clusterId(analysis.definition),
    subtype: analysis.subtype,
    confidence: analysis.confidence,
    isPrimary: true,
  }));
}

function makeQuestionTopics(
  questions: readonly StudyQuestion[],
  analyses: readonly CandidateAnalysis[],
): StudyQuestionTopic[] {
  const analysisBySource = new Map(
    analyses.map((analysis) => [sourceKey(analysis.candidate), analysis]),
  );
  return questions.flatMap((question) => {
    const analysis = analysisBySource.get(sourceKey(question));
    if (!analysis) return [];
    return [
      {
        id: `qt-${question.id}`,
        questionId: question.id,
        topicThreadId: threadId(analysis.definition),
        topic: analysis.definition.displayName,
        subtype: analysis.subtype,
        confidence: analysis.confidence,
        isPrimary: true,
      },
    ];
  });
}

function makeQuestionSupport(
  dataset: StudyDataset,
  questions: readonly StudyQuestion[],
  analyses: readonly CandidateAnalysis[],
  now: string,
): StudyQuestionSupport[] {
  const analysisBySource = new Map(
    analyses.map((analysis) => [sourceKey(analysis.candidate), analysis]),
  );
  const existingSupportByQuestionId = new Map(
    dataset.questionSupport.map((support) => [support.questionId, support]),
  );
  return questions.map((question) => {
    const analysis = analysisBySource.get(sourceKey(question));
    const definition = analysis?.definition ?? UNCLASSIFIED_TOPIC;
    const support = existingSupportByQuestionId.get(question.id);
    return {
      id: support?.id ?? `support-${question.id}`,
      questionId: question.id,
      summaryContext: support?.summaryContext || definition.summary,
      expectedAnswer: support?.expectedAnswer ?? [],
      rubric: support?.rubric ?? [],
      hints: support?.hints.length ? support.hints : [definition.hint],
      solutionSteps: support?.solutionSteps ?? [],
      commonMistakes: support?.commonMistakes.length
        ? support.commonMistakes
        : [...definition.traps],
      supportConfidence: support?.supportConfidence ?? 0.35,
      generatedAt: support?.generatedAt ?? now,
    };
  });
}

function makePracticeItems(
  projectId: string,
  analyses: readonly CandidateAnalysis[],
): StudyPracticeItem[] {
  return analyses.map(({ candidate, definition, subtype }) => ({
    id: `practice-${candidate.id}`,
    projectId,
    topicModuleId: moduleId(definition),
    sourceQuestionCandidateId: candidate.id,
    itemOrigin: "real_question",
    subtype,
    promptMarkdown: candidate.rawPromptMarkdown,
    answerInputType: "free_text",
    pointValue: candidate.pointValue ?? 1,
    assetIds: candidate.assetIds,
    sourceMetadataJson: {
      documentId: candidate.documentId,
      sourceAnchor: candidate.sourceAnchor,
      sourceQuizLabel: candidate.sourceQuizLabel,
      sourceYear: candidate.sourceYear,
    },
  }));
}

function makePracticeSupport(
  practiceItems: readonly StudyPracticeItem[],
  questions: readonly StudyQuestion[],
  questionSupport: readonly StudyQuestionSupport[],
): StudyPracticeSupport[] {
  const questionBySource = new Map(questions.map((question) => [sourceKey(question), question]));
  const supportByQuestionId = new Map(
    questionSupport.map((support) => [support.questionId, support]),
  );
  return practiceItems.map((item) => {
    const metadata = item.sourceMetadataJson as {
      readonly documentId?: string;
      readonly sourceAnchor?: string;
    } | null;
    const question =
      metadata?.documentId && metadata.sourceAnchor
        ? questionBySource.get(`${metadata.documentId}\0${metadata.sourceAnchor}`)
        : undefined;
    const support = question ? supportByQuestionId.get(question.id) : undefined;
    return {
      id: `practice-support-${item.id}`,
      practiceItemId: item.id,
      expectedAnswerJson: support?.expectedAnswer ?? [],
      rubricJson: support?.rubric ?? [],
      hintsJson: support?.hints ?? [],
      stepByStepSolutionMarkdown: (support?.solutionSteps ?? [])
        .map((step, index) => `${index + 1}. ${step}`)
        .join("\n"),
      commonMistakesMarkdown: (support?.commonMistakes ?? [])
        .map((mistake) => `- ${mistake}`)
        .join("\n"),
      supportConfidence: support?.supportConfidence ?? 0.35,
    };
  });
}

function countKeywordMatches(prompt: string, keywords: readonly string[]): number {
  return keywords.filter((keyword) => prompt.includes(keyword)).length;
}

function matchingSubtype(prompt: string, definition: TopicDefinition): string {
  return (
    definition.subtypeRules.find(({ keywords }) =>
      keywords.some((keyword) => prompt.includes(keyword)),
    )?.name ?? definition.defaultSubtype
  );
}

function clusterId(definition: TopicDefinition): string {
  return `cluster-${definition.id}`;
}

function threadId(definition: TopicDefinition): string {
  return `topic-${definition.id}`;
}

function moduleId(definition: TopicDefinition): string {
  return `module-${definition.id}`;
}

function sourceKey(
  input: Pick<StudyQuestion | StudyQuestionCandidate, "documentId" | "sourceAnchor">,
) {
  return `${input.documentId}\0${input.sourceAnchor}`;
}

function priorityLabel(score: number): StudyTopicCluster["priorityLabel"] {
  if (score >= 0.85) return "very_high";
  if (score >= 0.7) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
