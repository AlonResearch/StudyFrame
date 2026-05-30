import { assert, it } from "@effect/vitest";

import { compactQuestionSupport, topicMatchesExpected } from "./runGoldenSemanticAudit.ts";

it("omits provider provenance from bounded semantic-audit question support", () => {
  const support = compactQuestionSupport({
    id: "support-1",
    questionId: "question-1",
    summaryContext: "A grounded summary.",
    expectedAnswer: ["16 Hz"],
    rubric: [{ label: "Rate", points: 1, keywords: ["spikes per second"] }],
    hints: ["Count spikes and divide by the observation duration."],
    solutionSteps: ["Compute 8 / 0.5."],
    commonMistakes: ["Using the spike count without dividing by time."],
    supportConfidence: 0.9,
    generatedAt: "2026-05-30T00:00:00.000Z",
    generationMetadataJson: {
      providerInstanceId: "codex",
      model: "test-model",
      promptVersion: "test-v1",
      generatedAt: "2026-05-30T00:00:00.000Z",
      warnings: [],
      rawStructuredResult: { repeatedPayload: "x".repeat(2_000_000) },
    },
  });

  assert.notProperty(support, "generationMetadataJson");
  assert.notInclude(JSON.stringify(support), "repeatedPayload");
  assert.deepEqual(support?.expectedAnswer, ["16 Hz"]);
});

it("matches semantic topic naming variants used by the golden guard rails", () => {
  assert.isTrue(topicMatchesExpected("ML, MAP, and Bayes estimation", "ML/MAP/Bayes"));
  assert.isTrue(
    topicMatchesExpected(
      "Sampling, filtering, and spectral analysis",
      "Sampling/filtering/spectral analysis",
    ),
  );
  assert.isFalse(topicMatchesExpected("ROC and discrimination", "PCA/dimensionality reduction"));
});
