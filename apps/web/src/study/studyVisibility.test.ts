import { describe, expect, it } from "vitest";

import { getStudySupportVisibility, getVisibleSourceContextSupport } from "./studyVisibility";

describe("studyVisibility", () => {
  it("hides answer-bearing support before an attempt, reveal, or review", () => {
    const visibility = getStudySupportVisibility({
      questionId: "question-1",
      attempts: [],
      solutionOpen: false,
      reviewMode: false,
    });
    const sourceSupport = getVisibleSourceContextSupport({
      supportSummary: "Use 8 / 0.5 = 16 Hz.",
      expectedAnswer: ["16 Hz", "Fano factor 1.5"],
      visibility,
    });

    expect(visibility.isPreAnswer).toBe(true);
    expect(visibility.expectedAnswerVisible).toBe(false);
    expect(visibility.rubricVisible).toBe(false);
    expect(visibility.solutionVisible).toBe(false);
    expect(visibility.commonMistakesVisible).toBe(false);
    expect(sourceSupport).toEqual({ supportSummary: null, expectedAnswer: [] });
  });

  it("unlocks support after the student submits an answer", () => {
    const visibility = getStudySupportVisibility({
      questionId: "question-1",
      attempts: [
        {
          questionId: "question-1",
          scorePercent: 50,
          status: "partially_correct",
        },
      ],
      solutionOpen: false,
      reviewMode: false,
    });
    const sourceSupport = getVisibleSourceContextSupport({
      supportSummary: "Use the count variance divided by the mean.",
      expectedAnswer: ["Fano factor 1.5"],
      visibility,
    });

    expect(visibility.isPreAnswer).toBe(false);
    expect(visibility.expectedAnswerVisible).toBe(true);
    expect(visibility.rubricVisible).toBe(true);
    expect(visibility.solutionVisible).toBe(true);
    expect(visibility.commonMistakesVisible).toBe(true);
    expect(sourceSupport).toEqual({
      supportSummary: "Use the count variance divided by the mean.",
      expectedAnswer: ["Fano factor 1.5"],
    });
  });

  it("unlocks support for explicit reveal and review states", () => {
    const revealed = getStudySupportVisibility({
      questionId: "question-1",
      attempts: [],
      solutionOpen: true,
      reviewMode: false,
    });
    const review = getStudySupportVisibility({
      questionId: "question-1",
      attempts: [],
      solutionOpen: false,
      reviewMode: true,
    });

    expect(revealed.solutionVisible).toBe(true);
    expect(revealed.expectedAnswerVisible).toBe(true);
    expect(review.solutionVisible).toBe(true);
    expect(review.expectedAnswerVisible).toBe(true);
  });
});
