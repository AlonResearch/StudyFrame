import * as Schema from "effect/Schema";

const IsoString = Schema.String;

export const StudyQuestionStatus = Schema.Literals([
  "correct",
  "partially_correct",
  "incorrect",
  "revealed",
]);
export type StudyQuestionStatus = typeof StudyQuestionStatus.Type;

export const StudyNextAction = Schema.Literals([
  "repeat_not_100",
  "generate_weak_subtypes",
  "generate_exam_simulation",
  "repeat_all",
]);
export type StudyNextAction = typeof StudyNextAction.Type;

export const StudyScope = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("project"),
    projectId: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("topic"),
    topicThreadId: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("subtype"),
    topicThreadId: Schema.String,
    subtype: Schema.String,
  }),
]);
export type StudyScope = typeof StudyScope.Type;

export const StudyProject = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  sourceRoot: Schema.String,
  importedAt: IsoString,
  extractionWarnings: Schema.Array(Schema.String),
});
export type StudyProject = typeof StudyProject.Type;

export const StudyDocument = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  title: Schema.String,
  sourcePath: Schema.String,
  year: Schema.NullOr(Schema.Number),
  quizLabel: Schema.String,
});
export type StudyDocument = typeof StudyDocument.Type;

export const StudySourceFileType = Schema.Literals([
  "docx",
  "pdf",
  "md",
  "txt",
  "csv",
  "zip",
  "doc",
  "image",
  "other",
]);
export type StudySourceFileType = typeof StudySourceFileType.Type;

export const StudySourceDocumentRole = Schema.Literals([
  "quiz",
  "solution",
  "lecture",
  "data_asset",
  "generated_export",
  "unknown",
]);
export type StudySourceDocumentRole = typeof StudySourceDocumentRole.Type;

export const StudySourceDocument = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  sourcePath: Schema.String,
  fileType: StudySourceFileType,
  role: StudySourceDocumentRole,
  year: Schema.NullOr(Schema.Number),
  quizLabel: Schema.NullOr(Schema.String),
  extractionConfidence: Schema.Number,
  warnings: Schema.Array(Schema.String),
});
export type StudySourceDocument = typeof StudySourceDocument.Type;

export const StudySourceAssetKind = Schema.Literals([
  "image",
  "table",
  "equation",
  "pdf_page",
  "code_block",
  "data_file",
]);
export type StudySourceAssetKind = typeof StudySourceAssetKind.Type;

export const StudySourceAsset = Schema.Struct({
  id: Schema.String,
  documentId: Schema.String,
  kind: StudySourceAssetKind,
  sourceAnchor: Schema.String,
  contentText: Schema.NullOr(Schema.String),
  contentJson: Schema.NullOr(Schema.Unknown),
  localUri: Schema.NullOr(Schema.String),
  extractionConfidence: Schema.Number,
});
export type StudySourceAsset = typeof StudySourceAsset.Type;

export const StudyQuestionCandidate = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  documentId: Schema.String,
  sourceAnchor: Schema.String,
  rawPromptMarkdown: Schema.String,
  sourceYear: Schema.NullOr(Schema.Number),
  sourceQuizLabel: Schema.NullOr(Schema.String),
  pointValue: Schema.NullOr(Schema.Number),
  assetIds: Schema.Array(Schema.String),
  extractionConfidence: Schema.Number,
  needsManualReview: Schema.Boolean,
});
export type StudyQuestionCandidate = typeof StudyQuestionCandidate.Type;

export const StudyQuestion = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  documentId: Schema.String,
  sourceAnchor: Schema.String,
  sourceYear: Schema.NullOr(Schema.Number),
  sourceQuizLabel: Schema.String,
  rawPrompt: Schema.String,
  normalizedPrompt: Schema.String,
  pointValue: Schema.Number,
  isRealQuestion: Schema.Boolean,
  generatedFromQuestionIds: Schema.Array(Schema.String),
  dependsOnAssets: Schema.Boolean,
  extractionConfidence: Schema.Number,
  createdAt: IsoString,
});
export type StudyQuestion = typeof StudyQuestion.Type;

export const StudyRubricItem = Schema.Struct({
  label: Schema.String,
  points: Schema.Number,
  keywords: Schema.Array(Schema.String),
});
export type StudyRubricItem = typeof StudyRubricItem.Type;

export const StudyQuestionSupport = Schema.Struct({
  id: Schema.String,
  questionId: Schema.String,
  summaryContext: Schema.String,
  expectedAnswer: Schema.Array(Schema.String),
  rubric: Schema.Array(StudyRubricItem),
  hints: Schema.Array(Schema.String),
  solutionSteps: Schema.Array(Schema.String),
  commonMistakes: Schema.Array(Schema.String),
  supportConfidence: Schema.Number,
  generatedAt: IsoString,
});
export type StudyQuestionSupport = typeof StudyQuestionSupport.Type;

export const StudyQuestionTopic = Schema.Struct({
  id: Schema.String,
  questionId: Schema.String,
  topicThreadId: Schema.String,
  topic: Schema.String,
  subtype: Schema.String,
  confidence: Schema.Number,
  isPrimary: Schema.Boolean,
});
export type StudyQuestionTopic = typeof StudyQuestionTopic.Type;

export const StudyPriorityLabel = Schema.Literals(["very_high", "high", "medium", "low"]);
export type StudyPriorityLabel = typeof StudyPriorityLabel.Type;

export const StudyTopicCluster = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  displayName: Schema.String,
  priorityRank: Schema.Number,
  priorityScore: Schema.Number,
  priorityLabel: StudyPriorityLabel,
  priorityRationale: Schema.String,
  recentQuestionParts: Schema.Number,
  olderQuestionAppearances: Schema.Number,
  weightedPoints: Schema.Number,
  subtypes: Schema.Array(Schema.String),
});
export type StudyTopicCluster = typeof StudyTopicCluster.Type;

export const StudyQuestionClassification = Schema.Struct({
  id: Schema.String,
  questionCandidateId: Schema.String,
  topicClusterId: Schema.String,
  subtype: Schema.String,
  confidence: Schema.Number,
  isPrimary: Schema.Boolean,
});
export type StudyQuestionClassification = typeof StudyQuestionClassification.Type;

export const StudyTopicThread = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  topic: Schema.String,
  displayName: Schema.String,
  summary: Schema.String,
  priorityScore: Schema.Number,
  firstExposureComplete: Schema.Boolean,
  status: Schema.Literals(["ready", "in_progress", "completed"]),
  createdAt: IsoString,
  updatedAt: IsoString,
});
export type StudyTopicThread = typeof StudyTopicThread.Type;

export const StudyTopicModule = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  topicClusterId: Schema.String,
  theorySummaryMarkdown: Schema.String,
  formulaSheetMarkdown: Schema.String,
  commonTrapsMarkdown: Schema.String,
  subtypeCoverageJson: Schema.NullOr(Schema.Unknown),
  firstExposureComplete: Schema.Boolean,
});
export type StudyTopicModule = typeof StudyTopicModule.Type;

export const StudyPracticeItemOrigin = Schema.Literals(["real_question", "generated_variant"]);
export type StudyPracticeItemOrigin = typeof StudyPracticeItemOrigin.Type;

export const StudyAnswerInputType = Schema.Literals([
  "free_text",
  "numeric",
  "formula",
  "multiple_choice",
  "multi_select",
  "table",
  "plot_checklist",
  "file_upload",
]);
export type StudyAnswerInputType = typeof StudyAnswerInputType.Type;

export const StudyPracticeItem = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  topicModuleId: Schema.String,
  sourceQuestionCandidateId: Schema.NullOr(Schema.String),
  itemOrigin: StudyPracticeItemOrigin,
  subtype: Schema.String,
  promptMarkdown: Schema.String,
  answerInputType: StudyAnswerInputType,
  pointValue: Schema.Number,
  assetIds: Schema.Array(Schema.String),
  sourceMetadataJson: Schema.NullOr(Schema.Unknown),
});
export type StudyPracticeItem = typeof StudyPracticeItem.Type;

export const StudyPracticeSupport = Schema.Struct({
  id: Schema.String,
  practiceItemId: Schema.String,
  expectedAnswerJson: Schema.Unknown,
  rubricJson: Schema.Unknown,
  hintsJson: Schema.Array(Schema.String),
  stepByStepSolutionMarkdown: Schema.String,
  commonMistakesMarkdown: Schema.String,
  supportConfidence: Schema.Number,
});
export type StudyPracticeSupport = typeof StudyPracticeSupport.Type;

export const StudyFeedbackResult = Schema.Struct({
  tone: Schema.Literals(["direction", "graded", "solution"]),
  gradingMode: Schema.optionalKey(Schema.Literals(["ai", "local_fallback"])),
  status: StudyQuestionStatus,
  score: Schema.Number,
  maxScore: Schema.Number,
  scorePercent: Schema.Number,
  matchedRubricLabels: Schema.Array(Schema.String),
  missingRubricLabels: Schema.Array(Schema.String),
  feedback: Schema.String,
  nextStep: Schema.String,
});
export type StudyFeedbackResult = typeof StudyFeedbackResult.Type;

export const StudyAttempt = Schema.Struct({
  id: Schema.String,
  questionId: Schema.String,
  topicThreadId: Schema.String,
  answer: Schema.String,
  feedback: StudyFeedbackResult,
  score: Schema.Number,
  maxScore: Schema.Number,
  scorePercent: Schema.Number,
  status: StudyQuestionStatus,
  usedHintsCount: Schema.Number,
  usedCheckDirection: Schema.Boolean,
  attemptNumber: Schema.Number,
  createdAt: IsoString,
});
export type StudyAttempt = typeof StudyAttempt.Type;

export const StudyCompletionSummary = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  topicThreadId: Schema.NullOr(Schema.String),
  scope: Schema.Literals(["project", "topic", "subtype"]),
  realQuestionsAttempted: Schema.Number,
  generatedQuestionsAttempted: Schema.Number,
  weightedScorePercent: Schema.Number,
  unweightedScorePercent: Schema.Number,
  questions100Percent: Schema.Number,
  questionsNot100Percent: Schema.Number,
  questionsRevealed: Schema.Number,
  weakSubtypes: Schema.Array(Schema.String),
  recommendedNextAction: StudyNextAction,
  createdAt: IsoString,
});
export type StudyCompletionSummary = typeof StudyCompletionSummary.Type;

export const StudyGeneratedQuestionBatch = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  topicThreadId: Schema.String,
  sourceQuestionIds: Schema.Array(Schema.String),
  generationReason: Schema.Literals([
    "exhausted_real_questions",
    "weak_subtype_drill",
    "exam_simulation",
  ]),
  createdAt: IsoString,
});
export type StudyGeneratedQuestionBatch = typeof StudyGeneratedQuestionBatch.Type;

export const StudyDataset = Schema.Struct({
  projects: Schema.Array(StudyProject),
  documents: Schema.Array(StudyDocument),
  questions: Schema.Array(StudyQuestion),
  questionSupport: Schema.Array(StudyQuestionSupport),
  questionTopics: Schema.Array(StudyQuestionTopic),
  topicThreads: Schema.Array(StudyTopicThread),
  sourceDocuments: Schema.optionalKey(Schema.Array(StudySourceDocument)),
  sourceAssets: Schema.optionalKey(Schema.Array(StudySourceAsset)),
  questionCandidates: Schema.optionalKey(Schema.Array(StudyQuestionCandidate)),
  topicClusters: Schema.optionalKey(Schema.Array(StudyTopicCluster)),
  questionClassifications: Schema.optionalKey(Schema.Array(StudyQuestionClassification)),
  topicModules: Schema.optionalKey(Schema.Array(StudyTopicModule)),
  practiceItems: Schema.optionalKey(Schema.Array(StudyPracticeItem)),
  practiceSupport: Schema.optionalKey(Schema.Array(StudyPracticeSupport)),
});
export type StudyDataset = typeof StudyDataset.Type;

export const StudyFrameSnapshot = Schema.Struct({
  dataset: StudyDataset,
  attempts: Schema.Array(StudyAttempt),
  completionSummaries: Schema.Array(StudyCompletionSummary),
  generatedQuestionBatches: Schema.Array(StudyGeneratedQuestionBatch),
});
export type StudyFrameSnapshot = typeof StudyFrameSnapshot.Type;

export const StudyFrameSnapshotResponse = Schema.Struct({
  snapshot: Schema.NullOr(StudyFrameSnapshot),
});
export type StudyFrameSnapshotResponse = typeof StudyFrameSnapshotResponse.Type;

export const StudyImportFolderInput = Schema.Struct({
  projectId: Schema.optionalKey(Schema.String),
  sourceRoot: Schema.String,
});
export type StudyImportFolderInput = typeof StudyImportFolderInput.Type;

export const StudyExtractionResult = Schema.Struct({
  projectId: Schema.String,
  sourceRoot: Schema.String,
  importedDocumentCount: Schema.Number,
  sourceAssetCount: Schema.Number,
  questionCandidateCount: Schema.Number,
  warnings: Schema.Array(Schema.String),
});
export type StudyExtractionResult = typeof StudyExtractionResult.Type;

export const StudyImportFolderResponse = Schema.Struct({
  snapshot: StudyFrameSnapshot,
  result: StudyExtractionResult,
});
export type StudyImportFolderResponse = typeof StudyImportFolderResponse.Type;

export const StudyAnalyzeProjectInput = Schema.Struct({
  projectId: Schema.String,
});
export type StudyAnalyzeProjectInput = typeof StudyAnalyzeProjectInput.Type;

export const StudyAnalysisMode = Schema.Literals(["ai", "local_fallback"]);
export type StudyAnalysisMode = typeof StudyAnalysisMode.Type;

export const StudyAnalysisResult = Schema.Struct({
  projectId: Schema.String,
  topicClusterCount: Schema.Number,
  classifiedQuestionCount: Schema.Number,
  topicModuleCount: Schema.Number,
  practiceItemCount: Schema.Number,
  warnings: Schema.Array(Schema.String),
  mode: StudyAnalysisMode,
});
export type StudyAnalysisResult = typeof StudyAnalysisResult.Type;

export const StudyAnalyzeProjectResponse = Schema.Struct({
  snapshot: StudyFrameSnapshot,
  result: StudyAnalysisResult,
});
export type StudyAnalyzeProjectResponse = typeof StudyAnalyzeProjectResponse.Type;
