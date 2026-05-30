import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

interface GoldenImportResult {
  readonly snapshot: unknown;
  readonly result: {
    readonly projectId: string;
    readonly sourceAssetCount: number;
    readonly warnings: readonly string[];
    readonly scan: {
      readonly registeredDocumentCount: number;
      readonly excludedDocumentCount: number;
    };
  };
}

interface GoldenSemanticAuditResult {
  readonly analysisMode: "ai" | "local_fallback";
  readonly passed: boolean;
  readonly topicClusters: readonly unknown[];
  readonly findings: readonly {
    readonly severity: "blocker" | "major" | "minor";
    readonly category: string;
    readonly evidence: readonly string[];
    readonly correction: string;
  }[];
}

interface GoldenSemanticAuditModule {
  readonly runStudyFrameGoldenSemanticAudit: (
    snapshot: unknown,
    projectId: string,
  ) => Effect.Effect<
    GoldenSemanticAuditResult,
    StudyFrameGoldenAuditError,
    FileSystem.FileSystem | Path.Path
  >;
}

interface ImportFolderModule {
  readonly importFolderToSnapshot: (input: {
    readonly sourceRoot: string;
    readonly manifestId: string;
  }) => Effect.Effect<
    GoldenImportResult,
    StudyFrameGoldenAuditError,
    FileSystem.FileSystem | Path.Path
  >;
}

class StudyFrameGoldenAuditError extends Data.TaggedError("StudyFrameGoldenAuditError")<{
  readonly message: string;
}> {}

function isImportFolderModule(value: unknown): value is ImportFolderModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "importFolderToSnapshot" in value &&
    typeof value.importFolderToSnapshot === "function"
  );
}

function isGoldenSemanticAuditModule(value: unknown): value is GoldenSemanticAuditModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "runStudyFrameGoldenSemanticAudit" in value &&
    typeof value.runStudyFrameGoldenSemanticAudit === "function"
  );
}

const defaultSourceRoot = "G:\\My Drive\\Bar-Ilan\\Signal and Data Analysis\\Quiz";
const datasetId = "signal-data-analysis";
const encodeJsonString = Schema.encodeUnknownSync(Schema.UnknownFromJsonString);

const runGoldenAudit = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceRoot = yield* Config.string("STUDYFRAME_GOLDEN_ROOT").pipe(
    Config.withDefault(defaultSourceRoot),
  );
  const startedAt = DateTime.formatIso(yield* DateTime.now);
  const artifactRoot = path.resolve(
    ".codex-logs",
    "studyframe-golden",
    startedAt.replaceAll(":", "-"),
  );
  yield* fs.makeDirectory(artifactRoot, { recursive: true });

  const importFolderModulePath = [
    "..",
    "apps",
    "server",
    "src",
    "studyFrame",
    "importFolder.ts",
  ].join("/");
  const importFolderModule: unknown = yield* Effect.promise(() => import(importFolderModulePath));
  if (!isImportFolderModule(importFolderModule)) {
    return yield* new StudyFrameGoldenAuditError({
      message: "StudyFrame folder importer could not be loaded.",
    });
  }

  const imported = yield* importFolderModule.importFolderToSnapshot({
    sourceRoot,
    manifestId: datasetId,
  });
  const importSummaryPath = path.join(artifactRoot, "import-summary.json");
  yield* fs.writeFileString(importSummaryPath, `${encodeJsonString(imported.result)}\n`);

  const semanticAuditModulePath = [
    "..",
    "apps",
    "server",
    "src",
    "studyFrame",
    "golden",
    "runGoldenSemanticAudit.ts",
  ].join("/");
  const semanticAuditModule: unknown = yield* Effect.promise(() => import(semanticAuditModulePath));
  if (!isGoldenSemanticAuditModule(semanticAuditModule)) {
    return yield* new StudyFrameGoldenAuditError({
      message: "StudyFrame golden semantic audit module could not be loaded.",
    });
  }
  const semanticAudit = yield* semanticAuditModule
    .runStudyFrameGoldenSemanticAudit(imported.snapshot, imported.result.projectId)
    .pipe(
      Effect.catch((cause) =>
        Effect.succeed({
          analysisMode: "local_fallback" as const,
          topicClusters: [],
          passed: false,
          findings: [
            {
              severity: "blocker" as const,
              category: "question_quality",
              evidence: [String(cause)],
              correction: "Inspect the live Codex invocation and rerun the golden audit.",
            },
          ],
        }),
      ),
    );
  const analysisSummaryPath = path.join(artifactRoot, "analysis-summary.json");
  yield* fs.writeFileString(analysisSummaryPath, `${encodeJsonString(semanticAudit)}\n`);

  const completedAt = DateTime.formatIso(yield* DateTime.now);
  const hasKnownWmfWarning = imported.result.warnings.some((warning) =>
    warning.includes("2023/SDA-2023-Quiz-3.docx#word/media/image"),
  );
  const assetChecksPassed = imported.result.sourceAssetCount > 0 && hasKnownWmfWarning;
  const failures = [
    ...(assetChecksPassed
      ? []
      : [
          {
            id: "golden-asset-guard-rails",
            severity: "blocker" as const,
            stage: "assets",
            message: "Golden DOCX raster or 2023 Quiz 3 WMF asset guard rails failed.",
            evidence: [importSummaryPath],
            suggestedFiles: ["apps/server/src/studyFrame/importFolder.ts"],
          },
        ]),
    ...semanticAudit.findings.map((finding, index) => ({
      id: `semantic-${finding.category}-${index + 1}`,
      severity: finding.severity,
      stage: "semantic-audit",
      message: finding.correction,
      evidence: [...finding.evidence, analysisSummaryPath],
      suggestedFiles: [
        "apps/server/src/studyFrame/analyzeProjectWithProvider.ts",
        "scripts/studyframe-golden-audit.ts",
      ],
    })),
  ];
  const importMessage = `Registered ${imported.result.scan.registeredDocumentCount} documents and excluded ${imported.result.scan.excludedDocumentCount} derived documents from analysis.`;
  const assetMessage = `Registered ${imported.result.sourceAssetCount} source assets; 2023 Quiz 3 WMF warning present: ${hasKnownWmfWarning}.`;
  const semanticMessage = `Live analysis mode: ${semanticAudit.analysisMode}; semantic findings: ${semanticAudit.findings.length}.`;
  const passed = assetChecksPassed && semanticAudit.passed && failures.length === 0;
  const report = {
    datasetId,
    sourceRoot,
    startedAt,
    completedAt,
    passed,
    stages: [
      { id: "import", passed: true, message: importMessage },
      { id: "assets", passed: assetChecksPassed, message: assetMessage },
      { id: "semantic-audit", passed: semanticAudit.passed, message: semanticMessage },
    ],
    artifacts: [importSummaryPath, analysisSummaryPath],
    screenshots: [],
    failures,
  };
  const reportJsonPath = path.join(artifactRoot, "report.json");
  const reportMarkdownPath = path.join(artifactRoot, "report.md");
  yield* fs.writeFileString(reportJsonPath, `${encodeJsonString(report)}\n`);
  yield* fs.writeFileString(
    reportMarkdownPath,
    [
      "# StudyFrame Golden QA Report",
      "",
      `- Dataset: ${datasetId}`,
      `- Source root: ${sourceRoot}`,
      `- Passed: ${report.passed}`,
      "",
      "## Import",
      "",
      importMessage,
      "",
      "## Assets",
      "",
      assetMessage,
      "",
      "## Semantic Audit",
      "",
      semanticMessage,
      "",
      "## Findings",
      "",
      ...(failures.length > 0
        ? failures.map((failure) => `- [${failure.severity}] ${failure.message}`)
        : ["- None"]),
      "",
    ].join("\n"),
  );

  yield* Console.log(`StudyFrame golden QA report: ${reportMarkdownPath}`);
  if (!passed) {
    return yield* new StudyFrameGoldenAuditError({
      message: "StudyFrame golden QA reported acceptance failures.",
    });
  }
});

runGoldenAudit.pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
