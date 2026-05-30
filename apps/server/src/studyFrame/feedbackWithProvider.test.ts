import { assert, it } from "@effect/vitest";
import { type StudyFrameSnapshot, TextGenerationError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { ServerSettingsService } from "../serverSettings.ts";
import { TextGeneration, type TextGenerationShape } from "../textGeneration/TextGeneration.ts";
import { generateStudyFeedbackWithProvider } from "./feedbackWithProvider.ts";

const snapshot: StudyFrameSnapshot = {
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
    questionSupport: [
      {
        id: "support-rate",
        questionId: "question-rate",
        summaryContext: "Count spikes over time.",
        expectedAnswer: ["4 Hz"],
        rubric: [{ label: "firing rate", points: 4, keywords: ["4 Hz"] }],
        hints: ["Count spikes first."],
        solutionSteps: ["Divide the spike count by duration to obtain 4 Hz."],
        commonMistakes: ["Using milliseconds as seconds."],
        supportConfidence: 0.9,
        generatedAt: "2026-05-30T00:00:00.000Z",
      },
    ],
    questionTopics: [],
    topicThreads: [],
  },
  attempts: [],
  completionSummaries: [],
  generatedQuestionBatches: [],
};

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

it.effect("returns AI grading from the configured provider", () =>
  Effect.gen(function* () {
    const feedback = yield* generateStudyFeedbackWithProvider(snapshot, {
      questionId: "question-rate",
      answer: "The rate is four spikes per second.",
      action: "grade_attempt",
    }).pipe(
      provideTextGeneration(
        makeTextGeneration((() =>
          Effect.succeed({
            status: "correct",
            score: 4,
            matchedRubricLabels: ["firing rate"],
            missingRubricLabels: [],
            feedback: "Correct equivalent method.",
            nextStep: "Continue.",
          })) as TextGenerationShape["generateStructured"]),
      ),
    );

    assert.isTrue(Option.isSome(feedback));
    if (Option.isNone(feedback)) return;
    assert.equal(feedback.value.gradingMode, "ai");
    assert.equal(feedback.value.scorePercent, 100);
    assert.deepEqual(feedback.value.matchedRubricLabels, ["firing rate"]);
  }),
);

it.effect("redacts answer-revealing provider direction feedback", () =>
  Effect.gen(function* () {
    const feedback = yield* generateStudyFeedbackWithProvider(snapshot, {
      questionId: "question-rate",
      answer: "I will divide the count by time.",
      action: "check_direction",
    }).pipe(
      provideTextGeneration(
        makeTextGeneration((() =>
          Effect.succeed({
            status: "partially_correct",
            score: 2,
            matchedRubricLabels: ["firing rate"],
            missingRubricLabels: [],
            feedback: "Use the firing rate calculation to obtain 4 Hz.",
            nextStep: "Divide the spike count by duration to obtain 4 Hz.",
          })) as TextGenerationShape["generateStructured"]),
      ),
    );

    assert.isTrue(Option.isSome(feedback));
    if (Option.isNone(feedback)) return;
    assert.notInclude(feedback.value.feedback, "4 Hz");
    assert.notInclude(feedback.value.feedback, "firing rate");
    assert.notInclude(feedback.value.nextStep, "4 Hz");
    assert.deepEqual(feedback.value.matchedRubricLabels, []);
  }),
);

it.effect("keeps local fallback when the provider fails", () =>
  Effect.gen(function* () {
    const feedback = yield* generateStudyFeedbackWithProvider(snapshot, {
      questionId: "question-rate",
      answer: "",
      action: "grade_attempt",
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

    assert.isTrue(Option.isNone(feedback));
  }),
);
