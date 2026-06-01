import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vitest";

import { CodexSettings, ProviderInstanceId } from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";

import { ServerConfig } from "../config.ts";
import { makeCodexTextGeneration } from "./CodexTextGeneration.ts";

type ChildProcessCommand = {
  readonly args: ReadonlyArray<string>;
};

const decodeCodexSettings = Schema.decodeSync(CodexSettings);

function makeHandle(exitCode: Effect.Effect<ChildProcessSpawner.ExitCode>) {
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.empty,
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });
}

function getCommandArgument(command: ChildProcessCommand, flag: string): string {
  const index = command.args.indexOf(flag);
  const value = command.args[index + 1];
  if (index < 0 || value === undefined) {
    throw new Error(`Missing Codex CLI argument: ${flag}`);
  }
  return value;
}

describe("makeCodexTextGeneration", () => {
  it.layer(NodeServices.layer)("structured generation temp-file lifecycle", (it) => {
    it.effect("keeps temp files alive after the detached caller scope closes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const spawnedPaths = yield* Deferred.make<{
          readonly schemaPath: string;
          readonly outputPath: string;
        }>();
        const continueCommand = yield* Deferred.make<void>();
        const spawner = ChildProcessSpawner.make((rawCommand) => {
          const command = rawCommand as unknown as ChildProcessCommand;
          const schemaPath = getCommandArgument(command, "--output-schema");
          const outputPath = getCommandArgument(command, "--output-last-message");
          return Deferred.succeed(spawnedPaths, { schemaPath, outputPath }).pipe(
            Effect.as(
              makeHandle(
                Deferred.await(continueCommand).pipe(
                  Effect.andThen(
                    fs
                      .writeFileString(outputPath, JSON.stringify({ summary: "ready" }))
                      .pipe(Effect.orDie),
                  ),
                  Effect.as(ChildProcessSpawner.ExitCode(0)),
                ),
              ),
            ),
          );
        });
        const callerScope = yield* Scope.make("sequential");
        const generationFiber = yield* Effect.gen(function* () {
          const textGeneration = yield* makeCodexTextGeneration(
            decodeCodexSettings({ binaryPath: "fake-codex" }),
          );
          return yield* textGeneration.generateStructured({
            cwd: process.cwd(),
            prompt: "Build a StudyFrame summary.",
            outputSchema: Schema.Struct({ summary: Schema.String }),
            modelSelection: createModelSelection(ProviderInstanceId.make("codex"), "gpt-5"),
          });
        }).pipe(
          Scope.provide(callerScope),
          Effect.provide(
            Layer.merge(
              ServerConfig.layerTest(process.cwd(), { prefix: "studyframe-codex-text-" }),
              Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner),
            ),
          ),
          Effect.forkDetach,
        );

        const paths = yield* Deferred.await(spawnedPaths);
        yield* Scope.close(callerScope, Exit.void);
        expect(yield* fs.exists(paths.schemaPath)).toBe(true);
        expect(yield* fs.exists(paths.outputPath)).toBe(true);

        yield* Deferred.succeed(continueCommand, undefined);
        expect(yield* Fiber.join(generationFiber)).toEqual({ summary: "ready" });
        expect(yield* fs.exists(paths.schemaPath)).toBe(false);
        expect(yield* fs.exists(paths.outputPath)).toBe(false);
      }),
    );
  });
});
