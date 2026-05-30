import { describe, expect, it } from "vitest";

import {
  checkDirection,
  createCompletionSummary,
  getNextRealQuestion,
  getNotPerfectRealQuestions,
  gradeAnswer,
  isRealQuestionScopeExhausted,
} from "./studyLogic";
import { studySeedData } from "./studySeedData";
import type { StudyAttempt } from "./studyTypes";

describe("studyLogic", () => {
  it("orders unattempted real questions before attempted questions", () => {
    const topicThreadId = "topic-spike-train-statistics";
    const first = getNextRealQuestion(studySeedData, [], topicThreadId);
    expect(first?.id).toBe("q-spike-2024-rate-fano");

    const attempts = [
      makeAttempt({
        questionId: "q-spike-2024-rate-fano",
        topicThreadId,
        scorePercent: 100,
      }),
    ];

    const next = getNextRealQuestion(studySeedData, attempts, topicThreadId);
    expect(next?.id).toBe("q-spike-2023-isi-cv");
  });

  it("marks a real-question topic exhausted only after every real question has an attempt", () => {
    const topicThreadId = "topic-information-theory";
    const scope = { kind: "topic" as const, topicThreadId };

    expect(isRealQuestionScopeExhausted({ dataset: studySeedData, attempts: [], scope })).toBe(
      false,
    );

    const attempts = [
      makeAttempt({ questionId: "q-info-2024-mutual-info", topicThreadId, scorePercent: 60 }),
      makeAttempt({ questionId: "q-info-2022-entropy", topicThreadId, scorePercent: 100 }),
    ];

    expect(isRealQuestionScopeExhausted({ dataset: studySeedData, attempts, scope })).toBe(true);
  });

  it("keeps generated questions out of real-question completion scoring", () => {
    const topicThreadId = "topic-information-theory";
    const attempts = [
      makeAttempt({ questionId: "q-info-2024-mutual-info", topicThreadId, scorePercent: 50 }),
      makeAttempt({ questionId: "q-info-2022-entropy", topicThreadId, scorePercent: 100 }),
      makeAttempt({ questionId: "generated-question", topicThreadId, scorePercent: 100 }),
    ];

    const summary = createCompletionSummary({
      dataset: {
        ...studySeedData,
        questions: [
          ...studySeedData.questions,
          {
            ...studySeedData.questions[2]!,
            id: "generated-question",
            isRealQuestion: false,
            generatedFromQuestionIds: ["q-info-2024-mutual-info"],
          },
        ],
        questionTopics: [
          ...studySeedData.questionTopics,
          {
            ...studySeedData.questionTopics[2]!,
            id: "generated-question-topic",
            questionId: "generated-question",
          },
        ],
      },
      attempts,
      scope: { kind: "topic", topicThreadId },
      now: "2026-05-29T00:00:00.000Z",
      id: "summary",
    });

    expect(summary.realQuestionsAttempted).toBe(2);
    expect(summary.generatedQuestionsAttempted).toBe(1);
    expect(summary.questions100Percent).toBe(1);
    expect(summary.recommendedNextAction).toBe("repeat_not_100");
  });

  it("returns not-perfect real questions for repeat mode", () => {
    const topicThreadId = "topic-bayes-map";
    const attempts = [
      makeAttempt({ questionId: "q-bayes-2023-map", topicThreadId, scorePercent: 100 }),
      makeAttempt({ questionId: "q-bayes-2022-ml-vs-map", topicThreadId, scorePercent: 67 }),
    ];

    expect(
      getNotPerfectRealQuestions(studySeedData, attempts, topicThreadId).map((q) => q.id),
    ).toEqual(["q-bayes-2022-ml-vs-map"]);
  });

  it("grades against rubric markers without revealing the final answer in direction mode", () => {
    const question = studySeedData.questions.find(
      (candidate) => candidate.id === "q-spike-2024-rate-fano",
    )!;
    const support = studySeedData.questionSupport.find(
      (candidate) => candidate.questionId === question.id,
    )!;

    const feedback = gradeAnswer({
      question,
      support,
      answer: "The window is 0.5 s, so rate is 16 Hz.",
    });

    expect(feedback.status).toBe("partially_correct");
    expect(feedback.gradingMode).toBe("local_fallback");
    expect(feedback.missingRubricLabels).toContain("Computes Fano factor as 12 / 8 = 1.5");
  });

  it("keeps direction checks free of answer markers and rubric labels", () => {
    const question = studySeedData.questions.find(
      (candidate) => candidate.id === "q-spike-2024-rate-fano",
    )!;
    const support = studySeedData.questionSupport.find(
      (candidate) => candidate.questionId === question.id,
    )!;

    const feedback = checkDirection({
      question,
      support,
      answer: "The window is 0.5 s, so rate is 16 Hz.",
    });
    const visibleFeedback = [feedback.feedback, feedback.nextStep].join(" ").toLowerCase();

    expect(feedback.tone).toBe("direction");
    expect(feedback.gradingMode).toBe("local_fallback");
    expect(feedback.matchedRubricLabels).toEqual([]);
    expect(feedback.missingRubricLabels).toEqual([]);
    for (const forbidden of [
      ...support.expectedAnswer,
      ...support.rubric.map((item) => item.label),
      ...support.solutionSteps,
      ...support.commonMistakes,
    ]) {
      expect(visibleFeedback).not.toContain(forbidden.toLowerCase());
    }
  });
});

function makeAttempt(input: {
  readonly questionId: string;
  readonly topicThreadId: string;
  readonly scorePercent: number;
}): StudyAttempt {
  return {
    id: `attempt-${input.questionId}`,
    questionId: input.questionId,
    topicThreadId: input.topicThreadId,
    answer: "",
    feedback: {
      tone: "graded",
      status: input.scorePercent >= 100 ? "correct" : "partially_correct",
      score: input.scorePercent,
      maxScore: 100,
      scorePercent: input.scorePercent,
      matchedRubricLabels: [],
      missingRubricLabels: [],
      feedback: "",
      nextStep: "",
    },
    score: input.scorePercent,
    maxScore: 100,
    scorePercent: input.scorePercent,
    status: input.scorePercent >= 100 ? "correct" : "partially_correct",
    usedHintsCount: 0,
    usedCheckDirection: false,
    attemptNumber: 1,
    createdAt: "2026-05-29T00:00:00.000Z",
  };
}
