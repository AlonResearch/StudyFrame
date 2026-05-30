import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { importFolderToSnapshot } from "./importFolder.ts";

it.layer(NodeServices.layer)("importFolderToSnapshot", (it) => {
  it.effect("imports raw course folders while separating generated exports and data assets", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-import-" });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        [
          "Question 1 (10 points)",
          "Compute the firing rate from 8 spikes in 0.5 seconds.",
          "",
          "Question 2",
          "Explain why the Fano factor is useful.",
        ].join("\n"),
      );
      yield* fs.writeFileString(
        path.join(root, "Quiz_Topic_Priority_Report.md"),
        "# Topic Priority Report\n\nThis is a generated export.",
      );
      yield* fs.writeFileString(path.join(root, "measurements.csv"), "trial,spikes\n1,8\n");

      const { snapshot, result } = yield* importFolderToSnapshot({ sourceRoot: root });

      assert.equal(result.importedDocumentCount, 3);
      assert.equal(result.questionCandidateCount, 2);
      assert.equal(result.sourceAssetCount, 1);
      assert.equal(
        snapshot.dataset.sourceDocuments?.find(
          (document) => document.sourcePath === "Quiz_Topic_Priority_Report.md",
        )?.role,
        "generated_export",
      );
      assert.equal(
        snapshot.dataset.sourceDocuments?.find((document) => document.sourcePath === "quiz-2024.md")
          ?.role,
        "quiz",
      );
      assert.lengthOf(snapshot.dataset.questions, 2);
      assert.equal(
        snapshot.dataset.topicThreads[0]?.displayName,
        "Unclassified imported questions",
      );
      assert.isTrue(
        snapshot.dataset.practiceItems?.every((item) => item.itemOrigin === "real_question"),
      );
    }),
  );

  it.effect("filters solution files and duplicate extracted-text mirrors", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-import-mirrors-" });
      yield* fs.makeDirectory(path.join(root, "2024"), { recursive: true });
      yield* fs.makeDirectory(path.join(root, "2018"), { recursive: true });
      yield* fs.makeDirectory(path.join(root, "_quiz_text"), { recursive: true });
      const repeatedQuestion = "Question 1\nCompute the firing rate from the observed spike train.";
      yield* fs.writeFileString(path.join(root, "2024", "quiz-2024.md"), repeatedQuestion);
      yield* fs.writeFileString(
        path.join(root, "_quiz_text", "2024__quiz-2024.md.txt"),
        repeatedQuestion,
      );
      yield* fs.writeFileString(
        path.join(root, "_quiz_text", "2012__Test.doc.txt"),
        "Question 1\nCompute the entropy of the response distribution.",
      );
      yield* fs.writeFileString(
        path.join(root, "2018", "SDA2018-Q1-Ans.md"),
        "Question 1\nThe firing rate answer is 16 Hz.",
      );
      yield* fs.writeFileString(
        path.join(root, "revised-plan-real-questions-first.md"),
        "Question 1\nDescribe a future implementation task.",
      );
      yield* fs.writeFileString(path.join(root, "alllec.md"), "Question 1\nLecture notes.");

      const { snapshot, result } = yield* importFolderToSnapshot({ sourceRoot: root });

      assert.equal(result.importedDocumentCount, 6);
      assert.equal(result.questionCandidateCount, 2);
      assert.equal(
        snapshot.dataset.sourceDocuments?.find(
          (document) => document.sourcePath === "2018/SDA2018-Q1-Ans.md",
        )?.role,
        "solution",
      );
      assert.equal(
        snapshot.dataset.sourceDocuments?.find(
          (document) => document.sourcePath === "revised-plan-real-questions-first.md",
        )?.role,
        "generated_export",
      );
      assert.equal(
        snapshot.dataset.sourceDocuments?.find((document) => document.sourcePath === "alllec.md")
          ?.role,
        "lecture",
      );
    }),
  );
});
