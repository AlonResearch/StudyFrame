import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Multipart from "effect/unstable/http/Multipart";
import { describe } from "vitest";

import { ServerConfig } from "../config.ts";
import {
  normalizeStagedRelativePaths,
  stageStudyFrameSourceMaterials,
  StudyFrameStageSourceMaterialsError,
} from "./stageSourceMaterials.ts";

describe("normalizeStagedRelativePaths", () => {
  it("removes the shared selected-folder prefix while preserving nested paths", () => {
    expect(
      normalizeStagedRelativePaths([
        "Signal and Data/2024/quiz-1.docx",
        "Signal and Data/lectures/week-1.pdf",
      ]),
    ).toEqual(["2024/quiz-1.docx", "lectures/week-1.pdf"]);
  });

  it("keeps direct file selections relative to the staged course root", () => {
    expect(normalizeStagedRelativePaths(["quiz-1.docx", "lecture.pdf"])).toEqual([
      "quiz-1.docx",
      "lecture.pdf",
    ]);
  });

  it.each(["../secret.txt", "folder/../../secret.txt", "C:\\secret.txt", "/secret.txt"])(
    "rejects source paths that can escape the staging folder: %s",
    (relativePath) => {
      expect(() => normalizeStagedRelativePaths([relativePath])).toThrow(
        StudyFrameStageSourceMaterialsError,
      );
    },
  );

  it("rejects duplicate staged destinations", () => {
    expect(() => normalizeStagedRelativePaths(["Course/quiz.docx", "Course/QUIZ.docx"])).toThrow(
      "duplicate path",
    );
  });
});

it.layer(NodeServices.layer)("stageStudyFrameSourceMaterials", (it) => {
  it.effect("copies browser-selected files into a processable server source root", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const uploadRoot = yield* fs.makeTempDirectoryScoped({ prefix: "studyframe-upload-" });
      const uploadedFilePath = path.join(uploadRoot, "multipart-file");
      yield* fs.writeFileString(uploadedFilePath, "# Question 1\nCompute the firing rate.");

      const staged = yield* stageStudyFrameSourceMaterials({
        files: [
          {
            [Multipart.TypeId]: Multipart.TypeId,
            _tag: "PersistedFile",
            key: "files",
            name: "quiz.md",
            contentType: "text/markdown",
            path: uploadedFilePath,
          } as Multipart.PersistedFile,
        ],
        relativePaths: ["Signal and Data/2024/quiz.md"],
        sourceName: "Signal and Data",
      });

      expect(path.basename(staged.sourceRoot)).toBe("Signal and Data");
      expect(staged.materialCount).toBe(1);
      expect(yield* fs.readFileString(path.join(staged.sourceRoot, "2024", "quiz.md"))).toBe(
        "# Question 1\nCompute the firing rate.",
      );
    }).pipe(
      Effect.provide(
        ServerConfig.layerTest(process.cwd(), { prefix: "studyframe-stage-materials-" }),
      ),
    ),
  );
});
