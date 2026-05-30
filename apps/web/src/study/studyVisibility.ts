import type { StudyAttempt } from "./studyTypes";

type VisibilityAttempt = Pick<StudyAttempt, "questionId" | "scorePercent" | "status">;

export interface StudySupportVisibility {
  readonly hasAttempt: boolean;
  readonly hasSubmittedAnswer: boolean;
  readonly isSolved: boolean;
  readonly isRevealed: boolean;
  readonly isReviewMode: boolean;
  readonly isPreAnswer: boolean;
  readonly sourceSupportSummaryVisible: boolean;
  readonly expectedAnswerVisible: boolean;
  readonly rubricVisible: boolean;
  readonly solutionVisible: boolean;
  readonly commonMistakesVisible: boolean;
}

export function getStudySupportVisibility(input: {
  readonly questionId: string | null;
  readonly attempts: readonly VisibilityAttempt[];
  readonly solutionOpen: boolean;
  readonly reviewMode: boolean;
}): StudySupportVisibility {
  const questionAttempts = input.questionId
    ? input.attempts.filter((attempt) => attempt.questionId === input.questionId)
    : [];
  const hasAttempt = questionAttempts.length > 0;
  const hasSubmittedAnswer = questionAttempts.some((attempt) => attempt.status !== "revealed");
  const isSolved = questionAttempts.some(
    (attempt) => attempt.status === "correct" || attempt.scorePercent >= 100,
  );
  const isRevealed =
    input.solutionOpen || questionAttempts.some((attempt) => attempt.status === "revealed");
  const supportUnlocked = input.reviewMode || hasSubmittedAnswer || isSolved || isRevealed;

  return {
    hasAttempt,
    hasSubmittedAnswer,
    isSolved,
    isRevealed,
    isReviewMode: input.reviewMode,
    isPreAnswer: !supportUnlocked,
    sourceSupportSummaryVisible: supportUnlocked,
    expectedAnswerVisible: supportUnlocked,
    rubricVisible: supportUnlocked,
    solutionVisible: supportUnlocked,
    commonMistakesVisible: supportUnlocked,
  };
}

export function getVisibleSourceContextSupport(input: {
  readonly supportSummary: string | null;
  readonly expectedAnswer: readonly string[];
  readonly visibility: Pick<
    StudySupportVisibility,
    "sourceSupportSummaryVisible" | "expectedAnswerVisible"
  >;
}): {
  readonly supportSummary: string | null;
  readonly expectedAnswer: readonly string[];
} {
  return {
    supportSummary: input.visibility.sourceSupportSummaryVisible ? input.supportSummary : null,
    expectedAnswer: input.visibility.expectedAnswerVisible ? input.expectedAnswer : [],
  };
}
