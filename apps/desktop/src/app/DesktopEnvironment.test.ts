import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as DesktopEnvironment from "./DesktopEnvironment.ts";
import * as DesktopConfig from "./DesktopConfig.ts";

const defaultInput = {
  dirname: "/repo/apps/desktop/dist-electron",
  homeDirectory: "/Users/alice",
  platform: "darwin",
  processArch: "arm64",
  appVersion: "0.0.22",
  appPath: "/Applications/StudyFrame.app/Contents/Resources/app.asar",
  isPackaged: false,
  resourcesPath: "/Applications/StudyFrame.app/Contents/Resources",
  runningUnderArm64Translation: false,
} satisfies DesktopEnvironment.MakeDesktopEnvironmentInput;

const makeEnvironmentLayer = (
  overrides: Partial<DesktopEnvironment.MakeDesktopEnvironmentInput> = {},
  env: Record<string, string | undefined> = {},
) =>
  DesktopEnvironment.layer({
    ...defaultInput,
    ...overrides,
  }).pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, DesktopConfig.layerTest(env))));

const makeEnvironment = (
  overrides: Partial<DesktopEnvironment.MakeDesktopEnvironmentInput> = {},
  env: Record<string, string | undefined> = {},
) =>
  DesktopEnvironment.DesktopEnvironment.pipe(Effect.provide(makeEnvironmentLayer(overrides, env)));

describe("DesktopEnvironment", () => {
  it.effect("derives state paths and development identity inside Effect", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment(
        {},
        {
          STUDYFRAME_HOME: " /tmp/t3 ",
          STUDYFRAME_COMMIT_HASH: " 0123456789abcdef ",
          STUDYFRAME_PORT: "4949",
          VITE_DEV_SERVER_URL: "http://localhost:5173",
          STUDYFRAME_DEV_REMOTE_SERVER_ENTRY_PATH: " /remote/server.mjs ",
          STUDYFRAME_OTLP_TRACES_URL: " http://127.0.0.1:4318/v1/traces ",
          STUDYFRAME_OTLP_EXPORT_INTERVAL_MS: "2500",
        },
      );

      assert.equal(environment.isDevelopment, true);
      assert.equal(
        environment.appDataDirectory,
        environment.path.join("/Users/alice", "Library", "Application Support"),
      );
      assert.equal(environment.baseDir, "/tmp/t3");
      assert.equal(environment.stateDir, environment.path.join("/tmp/t3", "dev"));
      assert.equal(
        environment.desktopSettingsPath,
        environment.path.join("/tmp/t3", "dev", "desktop-settings.json"),
      );
      assert.equal(
        environment.clientSettingsPath,
        environment.path.join("/tmp/t3", "dev", "client-settings.json"),
      );
      assert.equal(
        environment.savedEnvironmentRegistryPath,
        environment.path.join("/tmp/t3", "dev", "saved-environments.json"),
      );
      assert.equal(
        environment.serverSettingsPath,
        environment.path.join("/tmp/t3", "dev", "settings.json"),
      );
      assert.equal(environment.logDir, environment.path.join("/tmp/t3", "dev", "logs"));
      assert.equal(environment.rootDir, environment.path.resolve("/repo"));
      assert.equal(environment.appRoot, environment.path.resolve("/repo"));
      assert.equal(
        environment.backendEntryPath,
        environment.path.join(environment.path.resolve("/repo"), "apps/server/dist/bin.mjs"),
      );
      assert.equal(environment.backendCwd, environment.path.resolve("/repo"));
      assert.equal(environment.appUserModelId, "com.studyframe.app.dev");
      assert.equal(environment.linuxWmClass, "studyframe-dev");
      assert.deepEqual(
        Option.map(environment.devServerUrl, (url) => url.href),
        Option.some("http://localhost:5173/"),
      );
      assert.deepEqual(environment.devRemoteT3ServerEntryPath, Option.some("/remote/server.mjs"));
      assert.deepEqual(environment.configuredBackendPort, Option.some(4949));
      assert.deepEqual(environment.commitHashOverride, Option.some("0123456789abcdef"));
      assert.deepEqual(environment.otlpTracesUrl, Option.some("http://127.0.0.1:4318/v1/traces"));
      assert.equal(environment.otlpExportIntervalMs, 2500);
    }),
  );

  it.effect("derives production state paths under userdata", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment(
        {},
        {
          STUDYFRAME_HOME: "/tmp/t3",
        },
      );

      assert.equal(environment.isDevelopment, false);
      assert.equal(environment.stateDir, environment.path.join("/tmp/t3", "userdata"));
      assert.equal(environment.logDir, environment.path.join("/tmp/t3", "userdata", "logs"));
      assert.equal(
        environment.serverSettingsPath,
        environment.path.join("/tmp/t3", "userdata", "settings.json"),
      );
    }),
  );

  it.effect("resolves picker defaults without nullish sentinels", () =>
    Effect.gen(function* () {
      const environment = yield* makeEnvironment();

      assert.deepEqual(environment.resolvePickFolderDefaultPath(null), Option.none());
      assert.deepEqual(
        environment.resolvePickFolderDefaultPath({ initialPath: " " }),
        Option.none(),
      );
      assert.deepEqual(
        environment.resolvePickFolderDefaultPath({ initialPath: "~" }),
        Option.some("/Users/alice"),
      );
      assert.deepEqual(
        environment.resolvePickFolderDefaultPath({ initialPath: "~/project" }),
        Option.some(environment.path.join("/Users/alice", "project")),
      );
    }),
  );
});
