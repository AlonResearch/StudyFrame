#!/usr/bin/env node

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { fromJsonStringPretty } from "@t3tools/shared/schemaJson";

export const releaseVersionFiles = ["studyframe.version.json"] as const;

interface UpdateReleasePackageVersionsOptions {
  readonly rootDir?: string | undefined;
}

const VersionJsonSchema = Schema.Record(Schema.String, Schema.Unknown);
const VersionJsonPrettyJson = fromJsonStringPretty(VersionJsonSchema);
const decodeVersionJson = Schema.decodeUnknownEffect(VersionJsonPrettyJson);
const encodeVersionJson = Schema.encodeEffect(VersionJsonPrettyJson);

export const updateReleasePackageVersions = Effect.fn("updateReleasePackageVersions")(function* (
  version: string,
  options: UpdateReleasePackageVersionsOptions = {},
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  let changed = false;

  for (const relativePath of releaseVersionFiles) {
    const filePath = path.join(rootDir, relativePath);
    const versionJson = yield* fs.readFileString(filePath).pipe(Effect.flatMap(decodeVersionJson));
    if (versionJson.version === version) {
      continue;
    }

    const versionJsonString = yield* encodeVersionJson({ ...versionJson, version });
    yield* fs.writeFileString(filePath, `${versionJsonString}\n`);
    changed = true;
  }

  return { changed };
});

const writeGithubOutput = Effect.fn("writeGithubOutput")(function* (changed: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const githubOutputPath = yield* Config.nonEmptyString("GITHUB_OUTPUT");
  yield* fs.writeFileString(githubOutputPath, `changed=${changed}\n`, { flag: "a" });
});

export const updateReleasePackageVersionsCommand = Command.make(
  "update-release-package-versions",
  {
    version: Argument.string("version").pipe(
      Argument.withDescription("StudyFrame release version to write into studyframe.version.json."),
    ),
    root: Flag.string("root").pipe(
      Flag.withDescription("Workspace root used to resolve studyframe.version.json."),
      Flag.optional,
    ),
    githubOutput: Flag.boolean("github-output").pipe(
      Flag.withDescription("Append changed=<boolean> to GITHUB_OUTPUT."),
      Flag.withDefault(false),
    ),
  },
  ({ version, root, githubOutput }) =>
    updateReleasePackageVersions(version, {
      rootDir: Option.getOrUndefined(root),
    }).pipe(
      Effect.tap(({ changed }) =>
        changed
          ? Effect.void
          : Console.log("StudyFrame version file already matches release version."),
      ),
      Effect.tap(({ changed }) => (githubOutput ? writeGithubOutput(changed) : Effect.void)),
    ),
).pipe(Command.withDescription("Update the StudyFrame release version file."));

if (import.meta.main) {
  Command.run(updateReleasePackageVersionsCommand, { version: "0.0.0" }).pipe(
    Effect.provide(NodeServices.layer),
    NodeRuntime.runMain,
  );
}
