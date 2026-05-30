import signalDataAnalysis from "./signal-data-analysis.manifest.json" with { type: "json" };

export interface StudyFrameImportManifest {
  readonly datasetId: string;
  readonly defaultRoot: string;
  readonly rawInputRules: {
    readonly include: readonly string[];
    readonly excludeFromAnalysis: readonly string[];
    readonly roleOverrides: Readonly<Record<string, string>>;
  };
  readonly expectedTopics?: readonly string[];
  readonly expectedPriorityOrder?: {
    readonly top3: readonly string[];
    readonly top5: readonly string[];
  };
  readonly expectedKnownAssets?: readonly string[];
  readonly expectedWarnings?: readonly string[];
  readonly exportGoldenReferences?: readonly string[];
}

const manifests = new Map<string, StudyFrameImportManifest>([
  [signalDataAnalysis.datasetId, signalDataAnalysis],
]);

export function getStudyFrameImportManifest(
  manifestId: string | undefined,
): StudyFrameImportManifest | null {
  if (!manifestId) return null;
  return manifests.get(manifestId) ?? null;
}

export function matchesManifestPattern(relativePath: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", "\u0000")
    .replaceAll("*", "[^/]*")
    .replaceAll("\u0000", ".*");
  return new RegExp(`^${escaped}$`, "i").test(relativePath.replaceAll("\\", "/"));
}
