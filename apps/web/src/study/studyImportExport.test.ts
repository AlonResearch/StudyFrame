import { describe, expect, it } from "vitest";

import { exportScoreSummary, exportTopicPriorityReport, exportTopicThread } from "./studyExport";
import { normalizeStudyImportPayload } from "./studyImport";
import { studySeedData } from "./studySeedData";
import type { StudyAttempt } from "./studyTypes";

describe("study import/export", () => {
  it("normalizes simple real-question imports into a StudyFrame dataset", () => {
    const dataset = normalizeStudyImportPayload(
      {
        project: {
          name: "Physics Final",
          sourceRoot: "past-exams",
        },
        questions: [
          {
            sourceQuizLabel: "2024 Q1",
            sourceYear: 2024,
            pointValue: 12,
            topic: "Waves",
            subtype: "Standing waves",
            prompt: "A real extracted standing-wave question.",
            rubric: [{ label: "Uses boundary condition", points: 4, keywords: ["boundary"] }],
          },
          {
            sourceQuizLabel: "2023 Q3",
            sourceYear: 2023,
            pointValue: 8,
            topic: "Waves",
            subtype: "Energy",
            prompt: "A real extracted energy question.",
          },
        ],
      },
      "2026-05-29T00:00:00.000Z",
    );

    expect(dataset.projects[0]?.name).toBe("Physics Final");
    expect(dataset.questions).toHaveLength(2);
    expect(dataset.questions.every((question) => question.isRealQuestion)).toBe(true);
    expect(dataset.topicThreads).toHaveLength(1);
    expect(dataset.questionSupport[0]?.rubric[0]?.label).toBe("Uses boundary condition");
    expect(dataset.sourceDocuments).toHaveLength(1);
    expect(dataset.questionCandidates).toHaveLength(2);
    expect(dataset.topicClusters?.[0]?.displayName).toBe("Waves");
    expect(dataset.topicModules).toHaveLength(1);
    expect(dataset.practiceItems?.every((item) => item.itemOrigin === "real_question")).toBe(true);
    expect(dataset.practiceSupport?.[0]?.rubricJson).toEqual([
      { label: "Uses boundary condition", points: 4, keywords: ["boundary"] },
    ]);
  });

  it("exports priority and score reports as markdown", () => {
    const priority = exportTopicPriorityReport(studySeedData);
    expect(priority).toContain("# Topic Priority Report");
    expect(priority).toContain("Spike-train statistics");

    const summary = exportScoreSummary({
      dataset: studySeedData,
      attempts: [
        makeAttempt({
          questionId: "q-spike-2024-rate-fano",
          topicThreadId: "topic-spike-train-statistics",
          scorePercent: 100,
        }),
      ],
      projectId: "signal-data-analysis",
      topicThreadId: null,
    });
    expect(summary).toContain("Real-Question Score Summary");
    expect(summary).toContain("Real questions attempted: 1");
  });

  it("labels generated variants separately in topic exports", () => {
    const dataset = {
      ...studySeedData,
      questions: [
        ...studySeedData.questions,
        {
          ...studySeedData.questions[0]!,
          id: "generated-q",
          sourceQuizLabel: "Generated variant",
          isRealQuestion: false,
          generatedFromQuestionIds: ["q-spike-2024-rate-fano"],
        },
      ],
      questionTopics: [
        ...studySeedData.questionTopics,
        {
          ...studySeedData.questionTopics[0]!,
          id: "generated-qt",
          questionId: "generated-q",
        },
      ],
    };

    const markdown = exportTopicThread({
      dataset,
      attempts: [],
      topicThread: studySeedData.topicThreads[0]!,
    });

    expect(markdown).toContain("## Real Questions");
    expect(markdown).toContain("## Generated Variants");
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
