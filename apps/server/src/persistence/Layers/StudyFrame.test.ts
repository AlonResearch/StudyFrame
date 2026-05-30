import type { StudyFrameSnapshot } from "@t3tools/contracts";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { StudyFrameRepository } from "../Services/StudyFrame.ts";
import { SqlitePersistenceMemory } from "./Sqlite.ts";
import { StudyFrameRepositoryLive } from "./StudyFrame.ts";

const layer = it.layer(StudyFrameRepositoryLive.pipe(Layer.provide(SqlitePersistenceMemory)));

const llmMetadata = {
  providerInstanceId: "codex",
  model: "gpt-5",
  promptVersion: "studyframe-test-v1",
  generatedAt: "2026-05-29T20:00:00.000Z",
  warnings: [],
  rawStructuredResult: { ok: true },
};

const snapshot: StudyFrameSnapshot = {
  dataset: {
    projects: [
      {
        id: "project-1",
        name: "Signal",
        sourceRoot: "G:/Signal/Quiz",
        importedAt: "2026-05-29T20:00:00.000Z",
        extractionWarnings: ["needs review"],
      },
    ],
    documents: [
      {
        id: "doc-1",
        projectId: "project-1",
        title: "Quiz 2024",
        sourcePath: "Quiz/2024.pdf",
        year: 2024,
        quizLabel: "Quiz 2024",
      },
    ],
    sourceDocuments: [
      {
        id: "source-doc-1",
        projectId: "project-1",
        sourcePath: "Quiz/2024.pdf",
        fileType: "pdf",
        role: "quiz",
        year: 2024,
        quizLabel: "Quiz 2024",
        extractionConfidence: 0.95,
        warnings: ["low contrast page"],
      },
    ],
    sourceAssets: [
      {
        id: "asset-1",
        documentId: "source-doc-1",
        kind: "table",
        sourceAnchor: "2024.pdf#page=1&table=1",
        contentText: "spikes,time_ms",
        contentJson: { columns: ["spikes", "time_ms"] },
        localUri: null,
        extractionConfidence: 0.9,
      },
    ],
    questionCandidates: [
      {
        id: "candidate-1",
        projectId: "project-1",
        documentId: "source-doc-1",
        sourceAnchor: "2024.pdf#page=1",
        rawPromptMarkdown: "Compute the firing rate.",
        sourceYear: 2024,
        sourceQuizLabel: "Quiz 2024 Q1",
        pointValue: 10,
        assetIds: ["asset-1"],
        extractionConfidence: 0.95,
        needsManualReview: false,
      },
    ],
    topicThreads: [
      {
        id: "topic-1",
        projectId: "project-1",
        topic: "Spike trains",
        displayName: "Spike trains",
        summary: "Practice spike-count statistics.",
        priorityScore: 0.9,
        firstExposureComplete: false,
        status: "ready",
        createdAt: "2026-05-29T20:00:00.000Z",
        updatedAt: "2026-05-29T20:00:00.000Z",
      },
    ],
    topicClusters: [
      {
        id: "cluster-1",
        projectId: "project-1",
        displayName: "Spike trains",
        priorityRank: 1,
        priorityScore: 0.9,
        priorityLabel: "very_high",
        priorityRationale: "Appears in recent quizzes with high point weight.",
        recentQuestionParts: 1,
        olderQuestionAppearances: 0,
        weightedPoints: 10,
        subtypes: ["Firing rate"],
      },
    ],
    questions: [
      {
        id: "question-1",
        projectId: "project-1",
        documentId: "doc-1",
        sourceAnchor: "2024.pdf#page=1",
        sourceYear: 2024,
        sourceQuizLabel: "Quiz 2024 Q1",
        rawPrompt: "Compute the firing rate.",
        normalizedPrompt: "Compute firing rate.",
        pointValue: 10,
        isRealQuestion: true,
        generatedFromQuestionIds: [],
        dependsOnAssets: false,
        extractionConfidence: 0.95,
        createdAt: "2026-05-29T20:00:00.000Z",
      },
    ],
    questionSupport: [
      {
        id: "support-1",
        questionId: "question-1",
        summaryContext: "Use count divided by time.",
        expectedAnswer: ["20 Hz"],
        rubric: [{ label: "rate", points: 10, keywords: ["20 Hz"] }],
        hints: ["Convert ms to seconds."],
        solutionSteps: ["Divide spikes by seconds."],
        commonMistakes: ["Leaving the window in ms."],
        supportConfidence: 0.9,
        generatedAt: "2026-05-29T20:00:00.000Z",
        generationMetadataJson: llmMetadata,
      },
    ],
    questionTopics: [
      {
        id: "question-topic-1",
        questionId: "question-1",
        topicThreadId: "topic-1",
        topic: "Spike trains",
        subtype: "Firing rate",
        confidence: 0.9,
        isPrimary: true,
      },
    ],
    questionClassifications: [
      {
        id: "classification-1",
        questionCandidateId: "candidate-1",
        topicClusterId: "cluster-1",
        subtype: "Firing rate",
        confidence: 0.9,
        isPrimary: true,
      },
    ],
    topicModules: [
      {
        id: "module-1",
        projectId: "project-1",
        topicClusterId: "cluster-1",
        theorySummaryMarkdown: "Rate is count divided by time.",
        formulaSheetMarkdown: "rate = count / seconds",
        commonTrapsMarkdown: "Use seconds, not ms.",
        subtypeCoverageJson: { "Firing rate": 1 },
        firstExposureComplete: false,
        generationMetadataJson: llmMetadata,
      },
    ],
    practiceItems: [
      {
        id: "practice-1",
        projectId: "project-1",
        topicModuleId: "module-1",
        sourceQuestionCandidateId: "candidate-1",
        itemOrigin: "real_question",
        subtype: "Firing rate",
        promptMarkdown: "Compute the firing rate.",
        answerInputType: "free_text",
        pointValue: 10,
        assetIds: ["asset-1"],
        sourceMetadataJson: { sourceAnchor: "2024.pdf#page=1" },
      },
    ],
    practiceSupport: [
      {
        id: "practice-support-1",
        practiceItemId: "practice-1",
        expectedAnswerJson: ["20 Hz"],
        rubricJson: [{ label: "rate", points: 10, keywords: ["20 Hz"] }],
        hintsJson: ["Convert ms to seconds."],
        stepByStepSolutionMarkdown: "1. Divide spikes by seconds.",
        commonMistakesMarkdown: "- Leaving the window in ms.",
        supportConfidence: 0.9,
        generationMetadataJson: llmMetadata,
      },
    ],
  },
  attempts: [
    {
      id: "attempt-1",
      questionId: "question-1",
      topicThreadId: "topic-1",
      answer: "20 Hz",
      feedback: {
        tone: "graded",
        status: "correct",
        score: 10,
        maxScore: 10,
        scorePercent: 100,
        matchedRubricLabels: ["rate"],
        missingRubricLabels: [],
        feedback: "Correct.",
        nextStep: "Continue.",
        generationMetadataJson: llmMetadata,
      },
      score: 10,
      maxScore: 10,
      scorePercent: 100,
      status: "correct",
      usedHintsCount: 0,
      usedCheckDirection: false,
      attemptNumber: 1,
      createdAt: "2026-05-29T20:01:00.000Z",
    },
  ],
  completionSummaries: [
    {
      id: "summary-1",
      projectId: "project-1",
      topicThreadId: "topic-1",
      scope: "topic",
      realQuestionsAttempted: 1,
      generatedQuestionsAttempted: 0,
      weightedScorePercent: 100,
      unweightedScorePercent: 100,
      questions100Percent: 1,
      questionsNot100Percent: 0,
      questionsRevealed: 0,
      weakSubtypes: [],
      recommendedNextAction: "repeat_all",
      createdAt: "2026-05-29T20:02:00.000Z",
    },
  ],
  generatedQuestionBatches: [
    {
      id: "batch-1",
      projectId: "project-1",
      topicThreadId: "topic-1",
      sourceQuestionIds: ["question-1"],
      generationReason: "exhausted_real_questions",
      createdAt: "2026-05-29T20:03:00.000Z",
      generationMetadataJson: llmMetadata,
    },
  ],
};

layer("StudyFrameRepositoryLive", (it) => {
  it.effect("round-trips a normalized StudyFrame snapshot", () =>
    Effect.gen(function* () {
      const repository = yield* StudyFrameRepository;

      yield* repository.saveSnapshot(snapshot);
      const loaded = yield* repository.loadSnapshot();

      assert.deepEqual(
        Option.match(loaded, {
          onNone: () => null,
          onSome: (value) => value,
        }),
        snapshot,
      );
    }),
  );
});
