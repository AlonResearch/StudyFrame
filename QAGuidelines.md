# StudyFrame QA Guidelines

## Purpose

StudyFrame QA validates the complete study workflow without weakening product rules or modifying the
external course repository:

```text
course folder
 -> import and source registration
 -> text and asset extraction
 -> real-question identification
 -> live Codex topic analysis
 -> topic priority and review material
 -> no-leakage practice flow
 -> real-question exhaustion
 -> optional generated variants
 -> markdown exports
```

The external golden dataset audit is optional and input-only. When you run it, never edit the
dataset, its reference markdown, manifest expectations, topic-ranking guard rails, minimum coverage,
no-leakage rules, or real-question-first rules to make QA pass.

## Optional Golden Dataset Audit

The default golden dataset is:

```text
G:\My Drive\Bar-Ilan\Signal and Data Analysis\Quiz
```

Override it when needed:

```powershell
$env:STUDYFRAME_GOLDEN_ROOT='G:\My Drive\Bar-Ilan\Signal and Data Analysis\Quiz'
```

The app-owned manifest is:

```text
apps/server/src/studyFrame/golden/signal-data-analysis.manifest.json
```

It registers the full folder while excluding known generated exports and helper folders from
question extraction and topic priority.

## Commands

Run the narrowest useful command while iterating:

```powershell
bun run qa:studyframe:fast
bun run qa:studyframe:ux
```

Run the full StudyFrame gate before completion:

```powershell
bun run qa:studyframe:release
```

Use the repository completion checks for technical changes:

```powershell
bun fmt
bun lint
bun typecheck
bun run test
```

Use `bun run test`, never `bun test`.

## What Each Layer Checks

### `qa:studyframe:fast`

Fast deterministic checks for product invariants:

- importer registration, exclusions, contamination protection, and manual-review flags
- DOCX raster extraction and WMF/EMF warnings
- local analysis, provider enrichment, and fallback behavior
- no-leakage visibility helpers
- real-question-first queueing, exhaustion, generated-variant separation, and exports
- touched contract typechecking

Run this after each patch.

### `qa:studyframe:golden`

Optional live external-dataset validation:

1. Scan the full course folder.
2. Apply manifest exclusions without hiding registered files.
3. Import raw sources and assets.
4. Run live Codex classification and enrichment.
5. Enforce deterministic topic-ranking and contamination guard rails.
6. Audit topic-module quality with a compact live semantic review.
7. Audit real-question grounding, unresolved context, manual-review state, and hint leakage in small
   live batches.
8. Write JSON and markdown reports.

The semantic audit intentionally excludes persisted `rawStructuredResult` provenance from evaluator
payloads. Provenance remains stored in app state for reviewability, but it is not relevant evidence
for semantic QA and can exceed model request limits.

Hidden author-only expected answers, rubrics, solution steps, and common mistakes are included in QA
projections only to detect whether hints leak them. Their presence is not itself a leakage failure.

### `qa:studyframe:ux`

Chromium-backed browser checks for the student workflow:

- prioritized real-question workspace rendering
- source grounding and extraction confidence
- absence of answers before submit or reveal
- hint, direction-check, submission, reveal, and attempt-history behavior
- generated-practice lock until real-question exhaustion
- generated labels and separate scoring
- solution-review mode
- markdown export triggers
- example import and progress reset

### `qa:studyframe:release`

Release-oriented composition:

```text
fast QA
 -> browser UX QA
 -> format
 -> lint
 -> typecheck
 -> all tests
 -> desktop smoke test
```

## Artifacts

Optional golden runs write outside tracked source files:

```text
.codex-logs/studyframe-golden/<timestamp>/
```

Review:

```text
import-summary.json
analysis-summary.json
report.json
report.md
```

Do not use an empty timestamp directory from an interrupted or concurrent run. Select the latest
directory containing `report.md`.

## Reading Failures

Treat failures by layer:

| Failure                               | Likely owner                                               |
| ------------------------------------- | ---------------------------------------------------------- |
| Generated files become questions      | importer manifest or source-role classification            |
| Missing raster assets or WMF warnings | DOCX extraction                                            |
| File/table references marked ready    | importer external-context detection                        |
| Expected topics absent                | local topic catalog or live provider classification        |
| Priority guard rail fails             | classification, recency, point weighting, or ranking       |
| Hint reveals an answer                | provider prompt, support generation, or visibility logic   |
| Hidden support appears before reveal  | web visibility gating                                      |
| Generated variants unlock early       | queue logic and server-side generation authorization       |
| Oversized semantic request            | golden-audit projection or batching, not golden thresholds |

Fix application code, prompts, schemas, tests, or selectors. Do not make expected outcomes weaker.

## Self-Correction Loop

When validating or improving StudyFrame:

1. Record `git status --short`.
2. Run `bun run qa:studyframe:fast`.
3. Run `bun run qa:studyframe:ux`.
4. Patch only this application repository.
5. Rerun the narrowest failing command.
6. After it passes, run `bun run qa:studyframe:release`.
7. Run `bun run qa:studyframe:golden` only when intentionally reviewing the full external dataset,
   then read the generated reports.
8. Stop after three unsuccessful correction cycles and report the repeated blocker with evidence.

When a long live audit is running, check for concurrent repository changes before editing. Preserve
unrelated user changes and read the latest completed report explicitly.
