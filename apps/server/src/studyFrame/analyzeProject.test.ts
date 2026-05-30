import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { analyzeProjectSnapshot } from "./analyzeProject.ts";
import { importFolderToSnapshot } from "./importFolder.ts";

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
});
