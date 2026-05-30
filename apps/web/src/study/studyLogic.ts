import type {
  StudyAttempt,
  StudyCompletionSummary,
  StudyDataset,
  StudyFeedbackResult,
  StudyNextAction,
  StudyQuestion,
  StudyQuestionStatus,
  StudyQuestionSupport,
  StudyScope,
} from "./studyTypes";

export function getQuestionSupport(
  dataset: Pick<StudyDataset, "questionSupport">,
  questionId: string,
): StudyQuestionSupport | null {
  return dataset.questionSupport.find((support) => support.questionId === questionId) ?? null;
}

export function getQuestionTopic(
  dataset: Pick<StudyDataset, "questionTopics">,
  questionId: string,
) {
  return dataset.questionTopics.find((topic) => topic.questionId === questionId) ?? null;
}

export function getQuestionsForTopicThread(
  dataset: Pick<StudyDataset, "questions" | "questionTopics">,
  topicThreadId: string,
): StudyQuestion[] {
  const ids = new Set(
    dataset.questionTopics
      .filter((topic) => topic.topicThreadId === topicThreadId)
      .map((topic) => topic.questionId),
  );
  return dataset.questions.filter((question) => ids.has(question.id));
}

export function getQuestionsForScope(
  dataset: Pick<StudyDataset, "questions" | "questionTopics">,
  scope: StudyScope,
): StudyQuestion[] {
  if (scope.kind === "project") {
    return dataset.questions.filter((question) => question.projectId === scope.projectId);
  }

  const topicQuestions = getQuestionsForTopicThread(dataset, scope.topicThreadId);
  if (scope.kind === "topic") {
    return topicQuestions;
  }

  return topicQuestions.filter(
    (question) => getQuestionTopic(dataset, question.id)?.subtype === scope.subtype,
  );
}

export function getAttemptsForQuestion(
  attempts: readonly StudyAttempt[],
  questionId: string,
): StudyAttempt[] {
  return attempts.filter((attempt) => attempt.questionId === questionId);
}

export function getBestAttempt(
  attempts: readonly StudyAttempt[],
  questionId: string,
): StudyAttempt | null {
  const questionAttempts = getAttemptsForQuestion(attempts, questionId);
  if (questionAttempts.length === 0) return null;

  return questionAttempts.reduce((best, attempt) =>
    attempt.scorePercent > best.scorePercent ? attempt : best,
  );
}

export function isQuestionAttempted(
  attempts: readonly StudyAttempt[],
  questionId: string,
): boolean {
  return attempts.some((attempt) => attempt.questionId === questionId);
}

export function getHintCountForQuestion(
  hintCountsByQuestionId: Readonly<Record<string, number>>,
  questionId: string,
): number {
  return hintCountsByQuestionId[questionId] ?? 0;
}

export function getNextHint(input: {
  readonly support: StudyQuestionSupport | null;
  readonly currentHintCount: number;
}): string {
  const hints = input.support?.hints ?? [];
  if (hints.length === 0) {
    return "No generated hint is available for this extracted question yet.";
  }

  return hints[Math.min(input.currentHintCount, hints.length - 1)] ?? hints[hints.length - 1] ?? "";
}

export function getUnattemptedRealQuestions(
  dataset: Pick<StudyDataset, "questions" | "questionTopics">,
  attempts: readonly StudyAttempt[],
  topicThreadId: string,
): StudyQuestion[] {
  return getQuestionsForTopicThread(dataset, topicThreadId).filter(
    (question) => question.isRealQuestion && !isQuestionAttempted(attempts, question.id),
  );
}

export function getNotPerfectRealQuestions(
  dataset: Pick<StudyDataset, "questions" | "questionTopics">,
  attempts: readonly StudyAttempt[],
  topicThreadId: string,
): StudyQuestion[] {
  return getQuestionsForTopicThread(dataset, topicThreadId).filter((question) => {
    if (!question.isRealQuestion) return false;
    const best = getBestAttempt(attempts, question.id);
    return !best || best.scorePercent < 100;
  });
}

export function getDueRealQuestions(
  dataset: Pick<StudyDataset, "questions" | "questionTopics">,
  attempts: readonly StudyAttempt[],
  projectId: string,
): StudyQuestion[] {
  return orderRealQuestionQueue(
    dataset,
    dataset.questions.filter(
      (question) => question.projectId === projectId && question.isRealQuestion,
    ),
    attempts,
  );
}

export function getNextRealQuestion(
  dataset: Pick<StudyDataset, "questions" | "questionTopics">,
  attempts: readonly StudyAttempt[],
  topicThreadId: string,
): StudyQuestion | null {
  return (
    orderRealQuestionQueue(
      dataset,
      getQuestionsForTopicThread(dataset, topicThreadId).filter(
        (question) => question.isRealQuestion,
      ),
      attempts,
    )[0] ?? null
  );
}

export function orderRealQuestionQueue(
  dataset: Pick<StudyDataset, "questionTopics">,
  questions: readonly StudyQuestion[],
  attempts: readonly StudyAttempt[],
): StudyQuestion[] {
  const subtypeAttemptCounts = new Map<string, number>();
  for (const question of questions) {
    const topic = getQuestionTopic(dataset, question.id);
    const subtype = topic?.subtype ?? "Unclassified";
    if (isQuestionAttempted(attempts, question.id)) {
      subtypeAttemptCounts.set(subtype, (subtypeAttemptCounts.get(subtype) ?? 0) + 1);
    }
  }

  return [...questions].sort((left, right) => {
    const leftAttempted = isQuestionAttempted(attempts, left.id);
    const rightAttempted = isQuestionAttempted(attempts, right.id);
    if (leftAttempted !== rightAttempted) return leftAttempted ? 1 : -1;

    const leftBest = getBestAttempt(attempts, left.id)?.scorePercent ?? -1;
    const rightBest = getBestAttempt(attempts, right.id)?.scorePercent ?? -1;
    if (leftBest !== rightBest) return leftBest - rightBest;

    if (left.pointValue !== right.pointValue) return right.pointValue - left.pointValue;

    const leftYear = left.sourceYear ?? 0;
    const rightYear = right.sourceYear ?? 0;
    if (leftYear !== rightYear) return rightYear - leftYear;

    const leftSubtype = getQuestionTopic(dataset, left.id)?.subtype ?? "Unclassified";
    const rightSubtype = getQuestionTopic(dataset, right.id)?.subtype ?? "Unclassified";
    const leftSubtypeCount = subtypeAttemptCounts.get(leftSubtype) ?? 0;
    const rightSubtypeCount = subtypeAttemptCounts.get(rightSubtype) ?? 0;
    if (leftSubtypeCount !== rightSubtypeCount) return leftSubtypeCount - rightSubtypeCount;

    return right.extractionConfidence - left.extractionConfidence;
  });
}

export function isRealQuestionScopeExhausted(input: {
  readonly dataset: Pick<StudyDataset, "questions" | "questionTopics">;
  readonly attempts: readonly StudyAttempt[];
  readonly scope: StudyScope;
}): boolean {
  const realQuestions = getQuestionsForScope(input.dataset, input.scope).filter(
    (question) => question.isRealQuestion,
  );
  return (
    realQuestions.length > 0 &&
    realQuestions.every((question) => isQuestionAttempted(input.attempts, question.id))
  );
}

export function createCompletionSummary(input: {
  readonly dataset: Pick<StudyDataset, "questions" | "questionTopics">;
  readonly attempts: readonly StudyAttempt[];
  readonly scope: StudyScope;
  readonly now: string;
  readonly id: string;
}): StudyCompletionSummary {
  const questions = getQuestionsForScope(input.dataset, input.scope);
  const realQuestions = questions.filter((question) => question.isRealQuestion);
  const generatedQuestions = questions.filter((question) => !question.isRealQuestion);
  const bestRealAttempts = realQuestions.flatMap((question) => {
    const best = getBestAttempt(input.attempts, question.id);
    return best ? [best] : [];
  });
  const bestGeneratedAttempts = generatedQuestions.flatMap((question) => {
    const best = getBestAttempt(input.attempts, question.id);
    return best ? [best] : [];
  });
  const weightedScorePercent = weightedScore(realQuestions, bestRealAttempts);
  const unweightedScorePercent = average(bestRealAttempts.map((attempt) => attempt.scorePercent));
  const questions100Percent = bestRealAttempts.filter(
    (attempt) => attempt.scorePercent >= 100,
  ).length;
  const questionsRevealed = bestRealAttempts.filter(
    (attempt) => attempt.status === "revealed",
  ).length;
  const weakSubtypes = getWeakSubtypes(input.dataset, realQuestions, bestRealAttempts);

  return {
    id: input.id,
    projectId: realQuestions[0]?.projectId ?? questions[0]?.projectId ?? "",
    topicThreadId: input.scope.kind === "project" ? null : input.scope.topicThreadId,
    scope: input.scope.kind,
    realQuestionsAttempted: bestRealAttempts.length,
    generatedQuestionsAttempted: bestGeneratedAttempts.length,
    weightedScorePercent,
    unweightedScorePercent,
    questions100Percent,
    questionsNot100Percent: Math.max(0, bestRealAttempts.length - questions100Percent),
    questionsRevealed,
    weakSubtypes,
    recommendedNextAction: getRecommendedNextAction({
      weightedScorePercent,
      weakSubtypes,
    }),
    createdAt: input.now,
  };
}

export function getRecommendedNextAction(input: {
  readonly weightedScorePercent: number;
  readonly weakSubtypes: readonly string[];
}): StudyNextAction {
  if (input.weightedScorePercent < 85) {
    return "repeat_not_100";
  }

  if (input.weightedScorePercent >= 95) {
    return "generate_exam_simulation";
  }

  if (input.weakSubtypes.length > 0) {
    return "generate_weak_subtypes";
  }

  return "repeat_all";
}

export function checkDirection(input: {
  readonly answer: string;
  readonly question: StudyQuestion;
  readonly support: StudyQuestionSupport | null;
}): StudyFeedbackResult {
  const graded = gradeAnswer(input);
  const feedback =
    graded.scorePercent >= 70
      ? "Your setup is moving in the right direction. Tighten the reasoning before submitting."
      : "The current direction is missing core setup. Revisit the first hint before calculating.";

  return {
    ...graded,
    tone: "direction",
    matchedRubricLabels: [],
    missingRubricLabels: [],
    feedback,
    nextStep:
      graded.scorePercent >= 70
        ? "Submit when your reasoning, units, and interpretation are all explicit."
        : "Name the relevant method and define the quantities you need.",
  };
}

export function gradeAnswer(input: {
  readonly answer: string;
  readonly question: StudyQuestion;
  readonly support: StudyQuestionSupport | null;
}): StudyFeedbackResult {
  const maxScore =
    input.support?.rubric.reduce((total, item) => total + item.points, 0) ??
    input.question.pointValue;
  const normalizedAnswer = normalizeText(input.answer);
  const matchedRubricLabels: string[] = [];
  const missingRubricLabels: string[] = [];
  let score = 0;

  for (const item of input.support?.rubric ?? []) {
    const matched = item.keywords.some((keyword) =>
      normalizedAnswer.includes(normalizeText(keyword)),
    );
    if (matched) {
      matchedRubricLabels.push(item.label);
      score += item.points;
    } else {
      missingRubricLabels.push(item.label);
    }
  }

  if (!input.support || input.support.rubric.length === 0) {
    score = normalizedAnswer.trim().length > 0 ? Math.round(maxScore * 0.5) : 0;
  }

  const scorePercent = clampPercent((score / Math.max(1, maxScore)) * 100);
  const status = feedbackStatus(scorePercent);

  return {
    tone: "graded",
    status,
    score,
    maxScore,
    scorePercent,
    matchedRubricLabels,
    missingRubricLabels,
    feedback: gradedFeedback(status, missingRubricLabels),
    nextStep: nextStepForStatus(status, missingRubricLabels),
  };
}

export function revealSolutionFeedback(input: {
  readonly question: StudyQuestion;
  readonly support: StudyQuestionSupport | null;
}): StudyFeedbackResult {
  const maxScore =
    input.support?.rubric.reduce((total, item) => total + item.points, 0) ??
    input.question.pointValue;
  return {
    tone: "solution",
    status: "revealed",
    score: 0,
    maxScore,
    scorePercent: 0,
    matchedRubricLabels: [],
    missingRubricLabels: input.support?.rubric.map((item) => item.label) ?? [],
    feedback: "Solution revealed. This is tracked separately from an incorrect submitted answer.",
    nextStep:
      "Review the solution, then repeat this real question later without the solution visible.",
  };
}

export function nextAttemptNumber(attempts: readonly StudyAttempt[], questionId: string): number {
  return getAttemptsForQuestion(attempts, questionId).length + 1;
}

function feedbackStatus(scorePercent: number): Exclude<StudyQuestionStatus, "revealed"> {
  if (scorePercent >= 100) return "correct";
  if (scorePercent >= 45) return "partially_correct";
  return "incorrect";
}

function gradedFeedback(
  status: Exclude<StudyQuestionStatus, "revealed">,
  missingRubricLabels: readonly string[],
): string {
  if (status === "correct") {
    return "Full-credit answer. The core computation and interpretation are both present.";
  }

  if (status === "partially_correct") {
    return `Partially correct. Missing: ${missingRubricLabels.join("; ")}.`;
  }

  return `Not correct yet. Start by fixing: ${missingRubricLabels[0] ?? "the setup"}.`;
}

function nextStepForStatus(
  status: Exclude<StudyQuestionStatus, "revealed">,
  missingRubricLabels: readonly string[],
): string {
  if (status === "correct") {
    return "Compare against the solution if you want, or move to the next real question.";
  }

  if (status === "partially_correct") {
    return missingRubricLabels[0] ?? "Add the missing reasoning and submit again.";
  }

  return "Use a hint or rewrite the setup before retrying.";
}

function weightedScore(
  questions: readonly StudyQuestion[],
  attempts: readonly StudyAttempt[],
): number {
  const attemptsByQuestionId = new Map(attempts.map((attempt) => [attempt.questionId, attempt]));
  let weightedEarned = 0;
  let weightedMax = 0;
  for (const question of questions) {
    const attempt = attemptsByQuestionId.get(question.id);
    if (!attempt) continue;
    weightedEarned += question.pointValue * (attempt.scorePercent / 100);
    weightedMax += question.pointValue;
  }

  return weightedMax === 0 ? 0 : clampPercent((weightedEarned / weightedMax) * 100);
}

function getWeakSubtypes(
  dataset: Pick<StudyDataset, "questionTopics">,
  questions: readonly StudyQuestion[],
  attempts: readonly StudyAttempt[],
): string[] {
  const attemptsByQuestionId = new Map(attempts.map((attempt) => [attempt.questionId, attempt]));
  const scoresBySubtype = new Map<string, number[]>();
  for (const question of questions) {
    const attempt = attemptsByQuestionId.get(question.id);
    if (!attempt) continue;
    const subtype = getQuestionTopic(dataset, question.id)?.subtype ?? "Unclassified";
    const scores = scoresBySubtype.get(subtype) ?? [];
    scores.push(attempt.scorePercent);
    scoresBySubtype.set(subtype, scores);
  }

  return [...scoresBySubtype.entries()]
    .filter(([, scores]) => average(scores) < 85)
    .map(([subtype]) => subtype);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return clampPercent(values.reduce((total, value) => total + value, 0) / values.length);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
