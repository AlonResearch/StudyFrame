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

export const StudyFeedbackResult = Schema.Struct({
  tone: Schema.Literals(["direction", "graded", "solution"]),
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
