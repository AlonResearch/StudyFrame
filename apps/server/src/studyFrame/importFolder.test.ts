import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { importFolderToSnapshot } from "./importFolder.ts";

function makeStoredZip(
  entries: ReadonlyArray<{ readonly name: string; readonly content: Buffer }>,
) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(entry.content.length, 18);
    localHeader.writeUInt32LE(entry.content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, entry.content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(entry.content.length, 20);
    centralHeader.writeUInt32LE(entry.content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + entry.content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

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
      assert.deepEqual(result.scan, {
        registeredDocumentCount: 3,
        analysisDocumentCount: 3,
        excludedDocumentCount: 0,
        questionCandidateCount: 2,
        sourceAssetCount: 1,
        warningCount: 0,
      });
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
      assert.equal(result.questionCandidateCount, 1);
      assert.equal(result.scan.registeredDocumentCount, 6);
      assert.equal(result.scan.analysisDocumentCount, 4);
      assert.equal(result.scan.excludedDocumentCount, 2);
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

  it.effect("applies golden manifest exclusions without hiding registered source documents", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-import-golden-" });
      yield* fs.makeDirectory(path.join(root, "_pdf_checks"), { recursive: true });
      yield* fs.makeDirectory(path.join(root, "study_app"), { recursive: true });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        "Question 1\nCompute the firing rate from the observed spike train.",
      );
      yield* fs.writeFileString(
        path.join(root, "_pdf_checks", "quiz-2023.md"),
        "Question 1\nCompute the entropy from the plotted response distribution.",
      );
      yield* fs.writeFileString(
        path.join(root, "study_app", "quiz-generated.md"),
        "Question 1\nDescribe the generated practice implementation.",
      );
      yield* fs.writeFileString(
        path.join(root, "Study_Summary_L1_to_Information_Theory.md"),
        "Question 1\nSummarize the generated course review.",
      );

      const { snapshot, result } = yield* importFolderToSnapshot({
        sourceRoot: root,
        manifestId: "signal-data-analysis",
      });

      assert.equal(result.scan.registeredDocumentCount, 4);
      assert.equal(result.scan.analysisDocumentCount, 1);
      assert.equal(result.scan.excludedDocumentCount, 3);
      assert.equal(result.questionCandidateCount, 1);
      assert.lengthOf(snapshot.dataset.sourceDocuments ?? [], 4);
      assert.equal(
        snapshot.dataset.sourceDocuments?.find(
          (document) => document.sourcePath === "Study_Summary_L1_to_Information_Theory.md",
        )?.role,
        "generated_export",
      );
    }),
  );

  it.effect("extracts DOCX raster media and warns for vector media", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-import-docx-media-" });
      yield* fs.writeFile(
        path.join(root, "quiz-2024.docx"),
        makeStoredZip([
          {
            name: "word/document.xml",
            content: Buffer.from(
              "<w:document><w:body><w:p><w:r><w:t>Question 1 Compute the value shown in the distribution plot.</w:t></w:r></w:p></w:body></w:document>",
            ),
          },
          { name: "word/media/image1.png", content: Buffer.from("png") },
          { name: "word/media/image2.wmf", content: Buffer.from("wmf") },
        ]),
      );

      const { snapshot, result } = yield* importFolderToSnapshot({ sourceRoot: root });
      const candidate = snapshot.dataset.questionCandidates?.[0];
      const question = snapshot.dataset.questions[0];
      const assets = snapshot.dataset.sourceAssets ?? [];

      assert.equal(result.sourceAssetCount, 2);
      assert.lengthOf(assets, 2);
      assert.lengthOf(candidate?.assetIds ?? [], 2);
      assert.isTrue(candidate?.needsManualReview);
      assert.isTrue(question?.dependsOnAssets);
      assert.match(assets[0]?.localUri ?? "", /^data:image\/png;base64,/);
      assert.isNull(assets[1]?.localUri);
      assert.include(result.warnings.join("\n"), "Vector DOCX asset (WMF)");
    }),
  );

  it.effect("marks questions that reference external context for manual review", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-import-context-" });
      yield* fs.writeFileString(
        path.join(root, "quiz-2024.md"),
        [
          "Question 1",
          "Use file Q2-2024-data.csv to compute the entropy.",
          "",
          "Question 2",
          "Given the covariance matrix below, find the first principal component.",
          "",
          "Question 3",
          "Compute the firing rate from 8 spikes in 0.5 seconds.",
        ].join("\n"),
      );

      const { snapshot } = yield* importFolderToSnapshot({ sourceRoot: root });
      const candidates = snapshot.dataset.questionCandidates ?? [];

      assert.isTrue(snapshot.dataset.questions[0]?.dependsOnAssets);
      assert.isTrue(candidates[0]?.needsManualReview);
      assert.isTrue(snapshot.dataset.questions[1]?.dependsOnAssets);
      assert.isTrue(candidates[1]?.needsManualReview);
      assert.isFalse(snapshot.dataset.questions[2]?.dependsOnAssets);
      assert.isFalse(candidates[2]?.needsManualReview);
    }),
  );
});
