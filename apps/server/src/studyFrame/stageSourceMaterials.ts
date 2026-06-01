import { randomUUID } from "node:crypto";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import type { Multipart } from "effect/unstable/http";

import { ServerConfig } from "../config.ts";

const MAX_STAGED_MATERIALS = 2_000;

export class StudyFrameStageSourceMaterialsError extends Data.TaggedError(
  "StudyFrameStageSourceMaterialsError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const stageStudyFrameSourceMaterials = Effect.fn("StudyFrame.stageSourceMaterials")(
  function* (input: {
    readonly files: readonly Multipart.PersistedFile[];
    readonly relativePaths: readonly string[];
    readonly sourceName: string;
  }) {
    if (input.files.length === 0) {
      return yield* new StudyFrameStageSourceMaterialsError({
        message: "Choose at least one source material before processing.",
      });
    }
    if (input.files.length > MAX_STAGED_MATERIALS) {
      return yield* new StudyFrameStageSourceMaterialsError({
        message: `A course folder can contain at most ${MAX_STAGED_MATERIALS} staged materials.`,
      });
    }
    if (input.files.length !== input.relativePaths.length) {
      return yield* new StudyFrameStageSourceMaterialsError({
        message: "The staged source material list did not match the selected file list.",
      });
    }

    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const config = yield* ServerConfig;
    const relativePaths = yield* Effect.try({
      try: () => normalizeStagedRelativePaths(input.relativePaths),
      catch: (cause) =>
        cause instanceof StudyFrameStageSourceMaterialsError
          ? cause
          : new StudyFrameStageSourceMaterialsError({
              message: "Could not validate the selected source material paths.",
              cause,
            }),
    });
    const stagingContainer = path.join(
      config.attachmentsDir,
      "studyframe-source-materials",
      randomUUID(),
    );
    const sourceRoot = path.join(stagingContainer, sanitizeSourceName(input.sourceName));

    yield* fs.makeDirectory(sourceRoot, { recursive: true }).pipe(
      Effect.mapError(
        (cause) =>
          new StudyFrameStageSourceMaterialsError({
            message: "Could not create a server-side source staging folder.",
            cause,
          }),
      ),
    );

    yield* Effect.forEach(
      input.files,
      (file, index) =>
        Effect.gen(function* () {
          const relativePath = relativePaths[index]!;
          const destination = path.resolve(sourceRoot, ...relativePath.split("/"));
          assertPathInsideRoot(path, sourceRoot, destination);
          yield* fs.makeDirectory(path.dirname(destination), { recursive: true });
          yield* fs.copyFile(file.path, destination);
        }).pipe(
          Effect.mapError((cause) =>
            cause instanceof StudyFrameStageSourceMaterialsError
              ? cause
              : new StudyFrameStageSourceMaterialsError({
                  message: `Could not stage source material: ${relativePaths[index] ?? file.name}`,
                  cause,
                }),
          ),
        ),
      { concurrency: 8 },
    ).pipe(Effect.tapError(() => fs.remove(stagingContainer, { recursive: true, force: true })));

    return {
      sourceRoot,
      materialCount: input.files.length,
    };
  },
);

export function normalizeStagedRelativePaths(relativePaths: readonly string[]): readonly string[] {
  const segmented = relativePaths.map(splitRelativePath);
  const sharedRoot =
    segmented.length > 0 &&
    segmented.every((segments) => segments.length > 1 && segments[0] === segmented[0]![0])
      ? segmented[0]![0]
      : null;
  const normalized = segmented.map((segments) =>
    (sharedRoot ? segments.slice(1) : segments).join("/"),
  );
  const seen = new Set<string>();
  for (const relativePath of normalized) {
    const key = relativePath.toLowerCase();
    if (seen.has(key)) {
      throw new StudyFrameStageSourceMaterialsError({
        message: `The selected materials contain a duplicate path: ${relativePath}`,
      });
    }
    seen.add(key);
  }
  return normalized;
}

function splitRelativePath(relativePath: string): readonly string[] {
  if (
    relativePath.trim().length === 0 ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("\\") ||
    /^[a-z]:/iu.test(relativePath)
  ) {
    throw new StudyFrameStageSourceMaterialsError({
      message: `Source material path must be relative: ${relativePath}`,
    });
  }
  const segments = relativePath.split(/[\\/]/u);
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0") ||
        segment.includes(":"),
    )
  ) {
    throw new StudyFrameStageSourceMaterialsError({
      message: `Source material path is not allowed: ${relativePath}`,
    });
  }
  return segments;
}

function assertPathInsideRoot(path: Path.Path, sourceRoot: string, destination: string): void {
  const relative = path.relative(sourceRoot, destination);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new StudyFrameStageSourceMaterialsError({
      message: "A source material resolved outside the staging folder.",
    });
  }
}

function sanitizeSourceName(sourceName: string): string {
  const sanitized = sourceName
    .trim()
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, "_")
    .replace(/[. ]+$/gu, "")
    .slice(0, 100);
  return sanitized || "Selected materials";
}
