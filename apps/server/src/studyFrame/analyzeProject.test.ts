import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { TextGenerationError } from "@t3tools/contracts";

import { ServerSettingsService } from "../serverSettings.ts";
import { TextGeneration, type TextGenerationShape } from "../textGeneration/TextGeneration.ts";
import { analyzeProjectSnapshot } from "./analyzeProject.ts";
import { analyzeProjectWithProvider } from "./analyzeProjectWithProvider.ts";
import { importFolderToSnapshot } from "./importFolder.ts";

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

it.layer(NodeServices.layer)("analyzeProjectSnapshot", (it) => {
  it.effect("classifies imported questions into prioritized study modules", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-analysis-" });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        [
          "Question 1 (20 points)",
          "Compute the firing rate and Fano factor for the spike train.",
          "",
          "Question 2 (10 points)",
          "Explain how mutual information differs from entropy.",
        ].join("\n"),
      );
      yield* fs.writeFileString(
        path.join(root, "quiz-2017.md"),
        ["Question 1 (5 points)", "Estimate the firing rate from the observed spikes."].join("\n"),
      );

      const imported = yield* importFolderToSnapshot({ sourceRoot: root });
      const analyzed = yield* analyzeProjectSnapshot(imported.snapshot, {
        projectId: imported.result.projectId,
      });

      assert.equal(analyzed.result.mode, "local_fallback");
      assert.equal(analyzed.result.classifiedQuestionCount, 3);
      assert.equal(analyzed.result.topicClusterCount, 2);
      assert.equal(analyzed.result.topicModuleCount, 2);
      assert.equal(analyzed.result.practiceItemCount, 3);
      assert.deepEqual(analyzed.result.warnings, []);
      assert.deepEqual(
        analyzed.snapshot.dataset.topicClusters?.map((cluster) => cluster.displayName),
        ["Spike-train statistics", "Information theory"],
      );
      assert.equal(analyzed.snapshot.dataset.topicClusters?.[0]?.recentQuestionParts, 1);
      assert.equal(analyzed.snapshot.dataset.topicClusters?.[0]?.olderQuestionAppearances, 1);
      assert.include(
        analyzed.snapshot.dataset.questionTopics.map((topic) => topic.subtype),
        "Fano factor",
      );
      assert.include(analyzed.snapshot.dataset.topicModules?.[0]?.formulaSheetMarkdown ?? "", "FF");
      assert.isTrue(
        analyzed.snapshot.dataset.practiceItems?.every(
          (item) => item.itemOrigin === "real_question",
        ),
      );
      assert.isTrue(
        analyzed.snapshot.dataset.questionSupport.every((support) => support.hints.length > 0),
      );
    }),
  );

  it.effect("keeps unmatched imports visible for manual topic assignment", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-analysis-manual-" });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        "Question 1\nExplain the requested result using the supplied diagram.",
      );

      const imported = yield* importFolderToSnapshot({ sourceRoot: root });
      const analyzed = yield* analyzeProjectSnapshot(imported.snapshot, {
        projectId: imported.result.projectId,
      });

      assert.equal(
        analyzed.snapshot.dataset.topicThreads[0]?.displayName,
        "Unclassified imported questions",
      );
      assert.lengthOf(analyzed.result.warnings, 1);
    }),
  );

  it.effect("enriches local analysis with configured provider output", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-analysis-provider-" });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        "Question 1 (4 points)\nCompute the firing rate for the spike train.",
      );

      const imported = yield* importFolderToSnapshot({ sourceRoot: root });
      const importedQuestionId = imported.snapshot.dataset.questions[0]?.id;
      const importedDocumentId = imported.snapshot.dataset.sourceDocuments?.[0]?.id;
      assert.isDefined(importedQuestionId);
      assert.isDefined(importedDocumentId);
      let providerCallCount = 0;
      const generated = analyzeProjectWithProvider(imported.snapshot, {
        projectId: imported.result.projectId,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            ServerSettingsService.layerTest(),
            Layer.succeed(
              TextGeneration,
              makeTextGeneration((() => {
                providerCallCount += 1;
                if (providerCallCount === 1) {
                  return Effect.succeed({
                    sourceRoles: [
                      {
                        documentId: importedDocumentId,
                        role: "quiz",
                        confidence: 0.97,
                        warnings: ["Provider reviewed the quiz role."],
                      },
                    ],
                    questionClassifications: [
                      {
                        questionId: importedQuestionId,
                        topicClusterId: "cluster-spike-train-statistics",
                        subtype: "Provider rate calculation",
                        confidence: 0.98,
                      },
                    ],
                  });
                }
                return Effect.succeed({
                  topicModules: [
                    {
                      topicClusterId: "cluster-spike-train-statistics",
                      priorityRationale: "Recent weighted questions make this topic the priority.",
                      theorySummaryMarkdown: "Provider theory",
                      formulaSheetMarkdown: "$r = N/T$",
                      commonTrapsMarkdown: "- Provider trap",
                    },
                  ],
                  questionSupport: [
                    {
                      questionId: importedQuestionId,
                      summaryContext: "Provider summary",
                      expectedAnswer: ["4 Hz"],
                      rubric: [{ label: "rate", points: 4, keywords: ["4"] }],
                      hints: ["Count spikes before dividing by time."],
                      solutionSteps: ["Count spikes.", "Divide by the duration."],
                      commonMistakes: ["Using milliseconds as seconds."],
                      supportConfidence: 0.9,
                    },
                  ],
                  practiceItems: [
                    {
                      questionId: importedQuestionId,
                      cleanedPromptMarkdown: "Compute the cleaned provider firing-rate prompt.",
                      answerInputType: "numeric",
                      answerOptions: [],
                      tableColumns: [],
                      plotChecklistItems: [],
                    },
                  ],
                });
              }) as TextGenerationShape["generateStructured"]),
            ),
          ),
        ),
      );
      const analyzed = yield* generated;

      assert.equal(analyzed.result.mode, "ai");
      assert.equal(
        analyzed.snapshot.dataset.questionTopics[0]?.subtype,
        "Provider rate calculation",
      );
      assert.equal(
        analyzed.snapshot.dataset.topicModules?.[0]?.theorySummaryMarkdown,
        "Provider theory",
      );
      assert.equal(
        analyzed.snapshot.dataset.topicClusters?.[0]?.priorityRationale,
        "Recent weighted questions make this topic the priority.",
      );
      assert.deepEqual(analyzed.snapshot.dataset.questionSupport[0]?.expectedAnswer, ["4 Hz"]);
      assert.deepEqual(analyzed.snapshot.dataset.practiceSupport?.[0]?.expectedAnswerJson, [
        "4 Hz",
      ]);
      assert.equal(analyzed.snapshot.dataset.practiceItems?.[0]?.answerInputType, "numeric");
      assert.equal(
        analyzed.snapshot.dataset.questions[0]?.rawPrompt,
        "Compute the cleaned provider firing-rate prompt.",
      );
      assert.equal(
        analyzed.snapshot.dataset.questionCandidates?.[0]?.rawPromptMarkdown,
        "Compute the cleaned provider firing-rate prompt.",
      );
      assert.equal(
        analyzed.snapshot.dataset.practiceItems?.[0]?.promptMarkdown,
        "Compute the cleaned provider firing-rate prompt.",
      );
      assert.equal(
        analyzed.snapshot.dataset.topicModules?.[0]?.generationMetadataJson?.promptVersion,
        "studyframe-analysis-v1",
      );
      assert.include(
        analyzed.snapshot.dataset.projects[0]?.extractionWarnings ?? [],
        "quiz-2024.md: Provider reviewed the quiz role.",
      );
      assert.isDefined(
        analyzed.snapshot.dataset.topicModules?.[0]?.generationMetadataJson?.rawStructuredResult,
      );
    }),
  );

  it.effect("uses local analysis when configured provider generation fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-analysis-fallback-" });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        "Question 1\nCompute the firing rate for the spike train.",
      );

      const imported = yield* importFolderToSnapshot({ sourceRoot: root });
      const analyzed = yield* analyzeProjectWithProvider(imported.snapshot, {
        projectId: imported.result.projectId,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            ServerSettingsService.layerTest(),
            Layer.succeed(
              TextGeneration,
              makeTextGeneration(() =>
                Effect.fail(
                  new TextGenerationError({
                    operation: "generateStructured",
                    detail: "provider unavailable",
                  }),
                ),
              ),
            ),
          ),
        ),
      );

      assert.equal(analyzed.result.mode, "local_fallback");
      assert.equal(analyzed.result.classifiedQuestionCount, 1);
    }),
  );

  it.effect("recomputes normalized views after provider topic correction", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "studyframe-analysis-correction-",
      });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        [
          "Question 1 (4 points)",
          "Compute the firing rate for the spike train.",
          "",
          "Question 2 (6 points)",
          "Compute the entropy of the response distribution.",
        ].join("\n"),
      );

      const imported = yield* importFolderToSnapshot({ sourceRoot: root });
      const rateQuestion = imported.snapshot.dataset.questions.find((question) =>
        question.rawPrompt.includes("firing rate"),
      );
      const entropyQuestion = imported.snapshot.dataset.questions.find((question) =>
        question.rawPrompt.includes("entropy"),
      );
      assert.isDefined(rateQuestion);
      assert.isDefined(entropyQuestion);
      const rateCandidate = imported.snapshot.dataset.questionCandidates?.find(
        (candidate) =>
          candidate.documentId === rateQuestion.documentId &&
          candidate.sourceAnchor === rateQuestion.sourceAnchor,
      );
      assert.isDefined(rateCandidate);
      let providerCallCount = 0;
      const analyzed = yield* analyzeProjectWithProvider(imported.snapshot, {
        projectId: imported.result.projectId,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            ServerSettingsService.layerTest(),
            Layer.succeed(
              TextGeneration,
              makeTextGeneration((() => {
                providerCallCount += 1;
                if (providerCallCount === 1) {
                  return Effect.succeed({
                    sourceRoles: [],
                    questionClassifications: [
                      {
                        questionId: rateQuestion.id,
                        topicClusterId: "cluster-information-theory",
                        subtype: "Corrected channel-rate subtype",
                        confidence: 0.88,
                      },
                      {
                        questionId: entropyQuestion.id,
                        topicClusterId: "cluster-information-theory",
                        subtype: "Entropy",
                        confidence: 0.96,
                      },
                    ],
                  });
                }
                return Effect.succeed({
                  topicModules: [],
                  questionSupport: [],
                  practiceItems: [],
                });
              }) as TextGenerationShape["generateStructured"]),
            ),
          ),
        ),
      );

      assert.equal(
        analyzed.snapshot.dataset.questionTopics.find(
          (topic) => topic.questionId === rateQuestion.id,
        )?.topicThreadId,
        "topic-information-theory",
      );
      assert.equal(
        analyzed.snapshot.dataset.practiceItems?.find(
          (item) => item.sourceQuestionCandidateId === rateCandidate.id,
        )?.topicModuleId,
        "module-information-theory",
      );
      assert.equal(analyzed.snapshot.dataset.topicClusters?.[0]?.id, "cluster-information-theory");
      assert.equal(analyzed.snapshot.dataset.topicClusters?.[0]?.recentQuestionParts, 2);
    }),
  );
});
