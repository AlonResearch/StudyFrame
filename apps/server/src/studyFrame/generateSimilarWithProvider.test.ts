import { assert, it } from "@effect/vitest";
import { type StudyFrameSnapshot, TextGenerationError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { ServerSettingsService } from "../serverSettings.ts";
import { TextGeneration, type TextGenerationShape } from "../textGeneration/TextGeneration.ts";
import { generateSimilarWithProvider } from "./generateSimilarWithProvider.ts";

function makeSnapshot(attempted: boolean): StudyFrameSnapshot {
  return {
    dataset: {
      projects: [
        {
          id: "project-course",
          name: "Course",
          sourceRoot: ".",
          importedAt: "2026-05-30T00:00:00.000Z",
          extractionWarnings: [],
        },
      ],
      documents: [],
      questions: [
        {
          id: "question-rate",
          projectId: "project-course",
          documentId: "document-quiz",
          sourceAnchor: "q1",
          sourceYear: 2026,
          sourceQuizLabel: "Quiz 2026",
          rawPrompt: "Compute the firing rate.",
          normalizedPrompt: "compute the firing rate",
          pointValue: 4,
          isRealQuestion: true,
          generatedFromQuestionIds: [],
          dependsOnAssets: false,
          extractionConfidence: 1,
          createdAt: "2026-05-30T00:00:00.000Z",
        },
      ],
      questionSupport: [],
      questionTopics: [
        {
          id: "topic-rate",
          questionId: "question-rate",
          topicThreadId: "thread-rate",
          topic: "Spike-train statistics",
          subtype: "Firing rate",
          confidence: 1,
          isPrimary: true,
        },
      ],
      topicThreads: [
        {
          id: "thread-rate",
          projectId: "project-course",
          topic: "Spike-train statistics",
          displayName: "Spike-train statistics",
          summary: "Rates",
          priorityScore: 1,
          firstExposureComplete: false,
          status: "ready",
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T00:00:00.000Z",
        },
      ],
    },
    attempts: attempted
      ? [
          {
            id: "attempt-rate",
            questionId: "question-rate",
            topicThreadId: "thread-rate",
            answer: "4 Hz",
            feedback: {
              tone: "graded",
              gradingMode: "local_fallback",
              status: "correct",
              score: 4,
              maxScore: 4,
              scorePercent: 100,
              matchedRubricLabels: [],
              missingRubricLabels: [],
              feedback: "Correct.",
              nextStep: "Continue.",
            },
            score: 4,
            maxScore: 4,
            scorePercent: 100,
            status: "correct",
            usedHintsCount: 0,
            usedCheckDirection: false,
            attemptNumber: 1,
            createdAt: "2026-05-30T00:00:00.000Z",
          },
        ]
      : [],
    completionSummaries: [],
    generatedQuestionBatches: [],
  };
}

function makeTextGeneration(
  generateStructured: TextGenerationShape["generateStructured"],
): TextGenerationShape {
  return {
    generateCommitMessage: () => Effect.die("not used"),
    generatePrContent: () => Effect.die("not used"),
    generateBranchName: () => Effect.die("not used"),
    generateThreadTitle: () => Effect.die("not used"),
    generateStructured,
  };
}

function provideTextGeneration(textGeneration: TextGenerationShape) {
  return Effect.provide(
    Layer.mergeAll(
      ServerSettingsService.layerTest(),
      Layer.succeed(TextGeneration, textGeneration),
    ),
  );
}

it.effect("returns prompt-only variants after real-question exhaustion", () =>
  Effect.gen(function* () {
    const variants = yield* generateSimilarWithProvider(makeSnapshot(true), {
      topicThreadId: "thread-rate",
      sourceQuestionIds: ["question-rate"],
    }).pipe(
      provideTextGeneration(
        makeTextGeneration((() =>
          Effect.succeed({
            variants: [
              {
                sourceQuestionId: "question-rate",
                promptMarkdown: "Compute the firing rate for a new spike count and duration.",
              },
            ],
          })) as TextGenerationShape["generateStructured"]),
      ),
    );

    assert.isTrue(Option.isSome(variants));
    if (Option.isNone(variants)) return;
    assert.deepEqual(variants.value.variants, [
      {
        sourceQuestionId: "question-rate",
        promptMarkdown: "Compute the firing rate for a new spike count and duration.",
      },
    ]);
    assert.equal(variants.value.generationMetadataJson.promptVersion, "studyframe-generation-v1");
  }),
);

it.effect("rejects generation before all real questions are attempted", () =>
  Effect.gen(function* () {
    const result = yield* generateSimilarWithProvider(makeSnapshot(false), {
      topicThreadId: "thread-rate",
      sourceQuestionIds: ["question-rate"],
    }).pipe(Effect.result);

    assert.isTrue(Result.isFailure(result));
    if (Result.isFailure(result)) {
      assert.equal(result.failure._tag, "StudyFrameGenerateSimilarError");
    }
  }),
);

it.effect("keeps local variants when provider generation fails", () =>
  Effect.gen(function* () {
    const variants = yield* generateSimilarWithProvider(makeSnapshot(true), {
      topicThreadId: "thread-rate",
      sourceQuestionIds: ["question-rate"],
    }).pipe(
      provideTextGeneration(
        makeTextGeneration(() =>
          Effect.fail(
            new TextGenerationError({
              operation: "generateStructured",
              detail: "provider unavailable",
            }),
          ),
        ),
      ),
    );

    assert.isTrue(Option.isNone(variants));
  }),
);
