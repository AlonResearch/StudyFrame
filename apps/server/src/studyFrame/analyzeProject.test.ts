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
                      uploadAccept: null,
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
        "studyframe-analysis-v4",
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

  it.effect("generates each topic guide once from all classified topic questions", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        prefix: "studyframe-analysis-topic-guide-",
      });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        Array.from({ length: 13 }, (_, index) =>
          [
            `Question ${index + 1} (1 point)`,
            `Compute the firing rate and Fano factor for spike train ${index + 1}.`,
          ].join("\n"),
        ).join("\n\n"),
      );

      const imported = yield* importFolderToSnapshot({ sourceRoot: root });
      const topicGuideQuestionCounts: number[] = [];
      const supportBatchSizes: number[] = [];
      const analyzed = yield* analyzeProjectWithProvider(imported.snapshot, {
        projectId: imported.result.projectId,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            ServerSettingsService.layerTest(),
            Layer.succeed(
              TextGeneration,
              makeTextGeneration(((input) => {
                const payload = JSON.parse(
                  input.prompt.slice(input.prompt.lastIndexOf("\n\n") + 2),
                ) as {
                  readonly sourceDocuments?: readonly { readonly id: string }[];
                  readonly questions?: readonly { readonly id: string }[];
                  readonly topicRequests?: readonly {
                    readonly realQuestions: readonly { readonly id: string }[];
                  }[];
                };
                if (input.prompt.includes("You are classifying")) {
                  return Effect.succeed({
                    sourceRoles:
                      payload.sourceDocuments?.map((document) => ({
                        documentId: document.id,
                        role: "quiz" as const,
                        confidence: 0.99,
                        warnings: [],
                      })) ?? [],
                    questionClassifications:
                      payload.questions?.map((question) => ({
                        questionId: question.id,
                        topicClusterId: "cluster-spike-train-statistics",
                        subtype: "Fano factor",
                        confidence: 0.98,
                      })) ?? [],
                  });
                }
                if (input.prompt.includes("compact app-native topic slots")) {
                  topicGuideQuestionCounts.push(
                    payload.topicRequests?.[0]?.realQuestions.length ?? 0,
                  );
                  return Effect.succeed({
                    topicModules: [
                      {
                        topicClusterId: "cluster-spike-train-statistics",
                        priorityRationale:
                          "All supplied spike-train questions make this top priority.",
                        theorySummaryMarkdown:
                          "## Brief Explanation\n\nSpike-train statistics review.",
                        formulaSheetMarkdown: "- $FF = Var[N] / E[N]$",
                        commonTrapsMarkdown: "- Do not use CV on spike counts.",
                        subtopics: ["Fano factor"],
                        highYieldSkills: ["Separate count variability from interval variability."],
                        questionPatterns: ["Compute FF from repeated windows."],
                        studyFlow: [
                          "Identify counts.",
                          "Compute mean and variance.",
                          "Interpret FF.",
                        ],
                        practiceDrills: [
                          {
                            title: "Fano factor drill",
                            sourceAnchors: ["quiz-2024.md#question=1"],
                            promptMarkdown: "Compute FF for counts `[1, 2, 3]` without using CV.",
                          },
                        ],
                      },
                    ],
                  });
                }
                supportBatchSizes.push(payload.questions?.length ?? 0);
                return Effect.succeed({
                  questionSupport: [],
                  practiceItems: [],
                });
              }) as TextGenerationShape["generateStructured"]),
            ),
          ),
        ),
      );

      assert.deepEqual(topicGuideQuestionCounts, [13]);
      assert.deepEqual(supportBatchSizes, [12, 1]);
      const module = analyzed.snapshot.dataset.topicModules?.find(
        (candidate) => candidate.topicClusterId === "cluster-spike-train-statistics",
      );
      const coverage = module?.subtypeCoverageJson as
        | {
            readonly highYieldSkills?: readonly string[];
            readonly practiceDrills?: readonly { readonly title: string }[];
          }
        | undefined;
      assert.include(module?.commonTrapsMarkdown ?? "", "Do not use CV");
      assert.deepEqual(coverage?.highYieldSkills, [
        "Separate count variability from interval variability.",
      ]);
      assert.equal(coverage?.practiceDrills?.[0]?.title, "Fano factor drill");
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

  it.effect("materializes provider-selected catalog topics missed by local keywords", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-analysis-catalog-" });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        "Question 1\nUse the supplied decomposition to find the reduced representation.",
      );

      const imported = yield* importFolderToSnapshot({ sourceRoot: root });
      const questionId = imported.snapshot.dataset.questions[0]?.id;
      assert.isDefined(questionId);
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
                return providerCallCount === 1
                  ? Effect.succeed({
                      sourceRoles: [],
                      questionClassifications: [
                        {
                          questionId,
                          topicClusterId: "cluster-pca-dimensionality-reduction",
                          subtype: "Principal components",
                          confidence: 0.94,
                        },
                      ],
                    })
                  : Effect.succeed({
                      topicModules: [],
                      questionSupport: [],
                      practiceItems: [],
                    });
              }) as TextGenerationShape["generateStructured"]),
            ),
          ),
        ),
      );

      assert.equal(analyzed.result.mode, "ai");
      assert.include(
        analyzed.snapshot.dataset.topicClusters?.map((cluster) => cluster.id) ?? [],
        "cluster-pca-dimensionality-reduction",
      );
      assert.equal(
        analyzed.snapshot.dataset.questionTopics[0]?.topicThreadId,
        "topic-pca-dimensionality-reduction",
      );
      assert.include(
        analyzed.snapshot.dataset.topicModules?.map((module) => module.id) ?? [],
        "module-pca-dimensionality-reduction",
      );
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

  it.effect(
    "classifies more than 50 source documents in bounded batches and repairs omissions",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-analysis-batches-" });
        for (let index = 0; index < 51; index += 1) {
          yield* fs.writeFileString(
            path.join(root, `quiz-${String(index).padStart(2, "0")}-2024.md`),
            `Question 1\nCompute the firing rate for spike train ${index}.`,
          );
        }

        const imported = yield* importFolderToSnapshot({ sourceRoot: root });
        const classificationBatchSizes: number[] = [];
        const classificationQuestionCounts: number[] = [];
        const analyzed = yield* analyzeProjectWithProvider(
          imported.snapshot,
          {
            projectId: imported.result.projectId,
          },
          { requireProvider: true },
        ).pipe(
          Effect.provide(
            Layer.mergeAll(
              ServerSettingsService.layerTest(),
              Layer.succeed(
                TextGeneration,
                makeTextGeneration(((input) => {
                  if (!input.prompt.includes("You are classifying")) {
                    return Effect.succeed({
                      topicModules: [],
                      questionSupport: [],
                      practiceItems: [],
                    });
                  }
                  const payload = JSON.parse(
                    input.prompt.slice(input.prompt.lastIndexOf("\n\n") + 2),
                  ) as {
                    readonly sourceDocuments: readonly { readonly id: string }[];
                    readonly questions: readonly { readonly id: string }[];
                  };
                  classificationBatchSizes.push(payload.sourceDocuments.length);
                  classificationQuestionCounts.push(payload.questions.length);
                  return Effect.succeed({
                    sourceRoles:
                      classificationBatchSizes.length === 1
                        ? payload.sourceDocuments.map((document) => ({
                            documentId: document.id,
                            role: "quiz" as const,
                            confidence: 0.99,
                            warnings: [],
                          }))
                        : [],
                    questionClassifications: [],
                  });
                }) as TextGenerationShape["generateStructured"]),
              ),
            ),
          ),
        );

        assert.deepEqual(classificationBatchSizes, [50, 1]);
        assert.deepEqual(classificationQuestionCounts, [50, 1]);
        const repairedDocument = analyzed.snapshot.dataset.sourceDocuments?.find(
          (document) => document.sourcePath === "quiz-50-2024.md",
        );
        assert.equal(repairedDocument?.role, "unknown");
        assert.include(
          repairedDocument?.warnings ?? [],
          "Provider omitted this document during batched source classification; marked unknown for review.",
        );
      }),
  );
});
