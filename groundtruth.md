# StudyFrame Technical Ground Truth

Last traced: 2026-05-31

This document is the implementation-facing source of truth for technical and pipeline reviews. Read
it with `README.md`, which remains the product contract, and `docs/studyframe-upstream.md`, which
defines the downstream-fork boundary.

Update this file in the same change whenever a technical change alters runtime behavior, data
contracts, persistence, extraction, provider use, build or release pipelines, required environment
configuration, or validation commands. Keep statements tied to current code paths rather than
planned behavior.

## Review Scope

StudyFrame is a Bun/Turbo TypeScript monorepo derived from T3 Code. Its active product is the
desktop-oriented study workspace. The inherited server, provider, authentication, WebSocket,
desktop, remote-access, and updater infrastructure still exists and is used where it supports the
study workflow.

The implemented StudyFrame workflow is:

```text
course folder or StudyFrame JSON
 -> register and classify source files
 -> extract text and assets where supported
 -> scan source text for prompt-injection-like instructions and quarantine findings
 -> create source-grounded real-question candidates
 -> process and prioritize topics through the configured provider for full course processing
 -> study real questions in a prioritized queue
 -> progressive direction check, hint, reveal, submit, and review
 -> unlock generated variants only after real questions in scope are attempted
 -> persist the normalized snapshot to SQLite
```

## Repository Map

| Area                                 | Role                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`                        | HTTP server, authenticated StudyFrame API, extraction, analysis, optional provider enrichment, SQLite persistence, inherited runtime infrastructure |
| `apps/web`                           | React/Vite UI, Zustand study store, server snapshot sync, queueing and local grading, exports                                                       |
| `apps/desktop`                       | Electron shell, local backend lifecycle, preload bridge, IPC, updater and remote-access plumbing                                                    |
| `apps/mobile`                        | Inherited Expo infrastructure; not the current StudyFrame product focus                                                                             |
| `apps/marketing`                     | Inherited Astro marketing site                                                                                                                      |
| `packages/contracts`                 | Shared Effect schemas and wire contracts; StudyFrame contracts are exported from `src/study*.ts`                                                    |
| `packages/shared`                    | Shared inherited runtime utilities                                                                                                                  |
| `packages/client-runtime`            | Shared client connection and state helpers used by web and mobile                                                                                   |
| `packages/effect-acp`                | Inherited ACP protocol package                                                                                                                      |
| `packages/effect-codex-app-server`   | Inherited Codex app-server protocol package                                                                                                         |
| `packages/ssh`, `packages/tailscale` | Remote environment and exposure support                                                                                                             |
| `scripts`                            | Development launcher, desktop artifact build, updater manifest tools, release smoke tests, golden audit                                             |

StudyFrame-owned implementation should normally stay in:

```text
apps/server/src/studyFrame/**
apps/server/src/persistence/Layers/StudyFrame.ts
apps/server/src/persistence/Migrations/031_StudyFrameSchema.ts
apps/server/src/persistence/Migrations/032_StudyFramePersistencePatch.ts
apps/server/src/persistence/Migrations/033_StudyFrameDomainModel.ts
apps/server/src/persistence/Migrations/034_StudyFrameLlmMetadata.ts
apps/web/src/study/**
apps/web/src/components/study/**
packages/contracts/src/study*.ts
```

## Runtime Topology

### Development

`bun run dev` calls `node scripts/dev-runner.ts dev`. The launcher selects available ports, sets
environment variables, and runs Turbo for contracts, web, and server in parallel.

Default ports:

| Service                                    | Default |
| ------------------------------------------ | ------- |
| Server HTTP and WebSocket                  | `13773` |
| Vite web dev server                        | `5733`  |
| Packaged Electron local backend scan start | `3773`  |

`STUDYFRAME_PORT_OFFSET` or `STUDYFRAME_DEV_INSTANCE` can shift development ports. The launcher
sets `VITE_HTTP_URL`, `VITE_WS_URL`, `VITE_DEV_SERVER_URL`, and `STUDYFRAME_HOME`. The default state
root is `~/.studyframe`.

### Server

`apps/server/src/bin.ts` starts the Effect CLI. `apps/server/src/server.ts` composes the HTTP server,
runtime services, auth, provider infrastructure, SQLite persistence, migrations, and route layers.
The server chooses Bun HTTP and SQLite services under Bun and Node equivalents under Node.

StudyFrame API routes are registered in `apps/server/src/studyFrame/http.ts`:

| Method | Route                                           | Behavior                                                                                                |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/studyframe/snapshot`                      | Load the persisted StudyFrame snapshot or `null`                                                        |
| `PUT`  | `/api/studyframe/snapshot`                      | Validate and save the complete StudyFrame snapshot                                                      |
| `POST` | `/api/studyframe/import-folder`                 | Deterministic fixture/demo import path: scan a local folder, extract sources, build a snapshot, save it |
| `POST` | `/api/studyframe/stage-source-materials`        | Stage browser-selected source files under the server state root and return a processable source root    |
| `POST` | `/api/studyframe/process-folder`                | Start the provider-required full course processing job                                                  |
| `GET`  | `/api/studyframe/processing-jobs/:jobId`        | Load processing job status                                                                              |
| `GET`  | `/api/studyframe/processing-jobs/:jobId/events` | Load processing job progress events                                                                     |
| `POST` | `/api/studyframe/processing-jobs/:jobId/cancel` | Mark a queued/running processing job cancelled                                                          |
| `POST` | `/api/studyframe/processing-jobs/:jobId/retry`  | Start a retry job from the same source root                                                             |
| `POST` | `/api/studyframe/analyze-project`               | Analyze the imported project, optionally enrich through a configured provider, save it                  |
| `POST` | `/api/studyframe/feedback`                      | Return optional provider feedback for direction checks or grading                                       |
| `POST` | `/api/studyframe/generate-similar`              | Return optional provider-generated variants after server-side unlock validation                         |

Every StudyFrame HTTP route authenticates through `ServerAuth`. Invalid request bodies become HTTP
`400`; persistence failures become HTTP `500`.

### Web

`apps/web/src/main.tsx` installs the TanStack router. Study routes render
`apps/web/src/components/study/StudyWorkspace.tsx`; inherited route names remain under `_chat`, but
their primary visible content is the study workspace. `StudySidebar.tsx` drives course processing,
including visible progress plus cancel and failed-job retry actions, JSON fixture import, project
analysis, course selection, nested topic-thread selection, settings
navigation, and demo reset. The import modal uses the Electron folder picker when the desktop bridge
is available. In normal-browser development it opens a directory input instead, and it also accepts
dropped files or directories as a local material list. Browser-provided materials are staged under
the authenticated server state root before the footer action is enabled, then processed through the
same server-visible folder pipeline as desktop-selected paths. On `/settings/*` routes the
shell sidebar renders the inherited settings section navigation instead of the course/topic tree.

The study workspace header exposes a three-dots `Extra information` menu on course dashboards for
course details or markdown reports in the shared right-side overlay sheet. Topic practice is one
reading sheet: a compact topic header, brief explanation, workflow progress, and the active question
remain in one surface while questions switch in place. The topic review renders the StudyFrame topic
module as a manual-study equivalent with optional agent-fillable sections: brief explanation,
definitions and formulas, high-yield skills, recurring question types, representative unsolved
quiz-style drills, solve flow, and generic topic traps. Empty optional sections are skipped so
topics without formulas do not show placeholder UI. Question-specific common mistakes are treated
as answer-derived support and render only after submit or reveal as the relevant
`Watch for this question` list. The topic card header exposes its own
three-dots `Question details` menu for the real-question queue or spoiler-safe question details.
Those details include question-scoped source provenance, extraction status, source security
findings, classification, warnings, and linked assets. Prompt-injection-like source instructions are
shown as escaped plain text metadata and are ignored as source instructions. Answer-derived support stays hidden until submit or reveal. The sheet
starts closed after course or topic navigation so the primary dashboard and answer workspace keep
their full width. The next-question action stays hidden until the visible answer has been submitted
or explicitly revealed.
Study prompts, refreshers, revealed solution steps, and solution-review steps render markdown with
KaTeX equation support.

On workspace mount, `apps/web/src/study/studyServerSync.ts`:

1. Loads `/api/studyframe/snapshot`.
2. Applies the server snapshot when one exists.
3. Seeds the server from the current Zustand state when no server snapshot exists.
4. Subscribes to store changes and debounces complete-snapshot saves by `350 ms`.

The Zustand store in `apps/web/src/study/studyStore.ts` also persists browser state under
`studyframe:study-state:v1`. The web store is optimized for immediate interaction; the normalized
SQLite snapshot is the server-side durable representation.

### Desktop

`bun run dev:desktop` runs Electron and Vite in parallel through `scripts/dev-runner.ts`. The
Electron program starts in `apps/desktop/src/main.ts` and `apps/desktop/src/app/DesktopApp.ts`.
Desktop startup configures user data, protocol handling, updater behavior, IPC handlers, server
exposure, and the local backend process.

`apps/desktop/src/preload.ts` exposes the constrained `desktopBridge`, including environment
bootstrap, settings, SSH, updater, context menu, confirmation, external URL, and folder picker IPC.
The StudyFrame import dialog invokes the desktop folder picker for the primary local workflow and
keeps a typed server-visible folder path under secondary source-material options for remote cases.

## Study Data Contract

`packages/contracts/src/study.ts` is the primary schema source. Supporting request contracts live in
`studyFeedback.ts`, `studyGeneration.ts`, and `studyLlm.ts`.

The persisted `StudyFrameSnapshot` contains:

```text
dataset
attempts
completionSummaries
generatedQuestionBatches
```

The dataset has two related model layers:

| Layer                     | Main records                                                                                                                                                                  | Purpose                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Core study model          | projects, documents, questions, questionSupport, questionTopics, topicThreads                                                                                                 | Real-question study UX and progress                                        |
| Extended extraction model | sourceDocuments, sourceAssets, sourceChunks, sourceSecurityFindings, questionCandidates, topicClusters, questionClassifications, topicModules, practiceItems, practiceSupport | Source traceability, richer extraction, review metadata, module generation |

The extended fields are optional in the contract for compatibility. Web derivation code in
`apps/web/src/study/studyDomainModel.ts` regenerates missing derived structures from the core model.

LLM-produced support and batches may include:

```text
providerInstanceId
model
promptVersion
generatedAt
warnings
rawStructuredResult
```

This metadata is persisted for reviewability.

## Import And Extraction

Folder import is implemented in `apps/server/src/studyFrame/importFolder.ts`.

Browser-selected folders are first staged by `apps/server/src/studyFrame/stageSourceMaterials.ts`.
The staging path is rooted below `attachments/studyframe-source-materials`, preserves safe relative
paths, rejects traversal and duplicate destinations, and becomes the `sourceRoot` passed to the
normal folder processor.

The scanner recursively walks the selected root and skips `.git`, `.svn`, `.hg`, `node_modules`,
`.venv`, `__pycache__`, `dist`, and `build`. It registers source documents, classifies roles, extracts
supported text, collects assets, creates question candidates, creates real questions, and initializes
support and topic placeholders.

Current source handling:

| Input                           | Handling                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Markdown, text, CSV             | Read as text                                                                                                                               |
| DOCX                            | Extract structured OOXML paragraphs, tables, list-style question parts, stable anchors, and embedded media; raster media becomes data URIs |
| PDF                             | Literal text extraction only; low-text PDFs warn that OCR/manual review may be required                                                    |
| Legacy DOC                      | Registered with no extractor and manual-review warning                                                                                     |
| Images and data files           | Registered as source assets; text-like previews are used where supported                                                                   |
| vector media such as EMF or WMF | Register with manual-review warning; not rendered                                                                                          |

First import questions are limited to files classified as `quiz` or `unknown`. Solution files,
lectures, generated exports, data assets, and configured exclusions are registered and can be used
as context for answer style, notation, formulas, examples, and asset grounding, but they do not
create first-pass real questions. Import warnings and confidence values must remain visible to
reviewers and users.

Each extracted text source is also scanned by `apps/server/src/studyFrame/sourceSecurity.ts`.
Heuristics detect source instructions that look like prompt injection, instruction overrides, false
answer instructions, tool-use instructions, data-exfiltration requests, or hidden/suspicious unicode
encoding. Findings are stored in `sourceSecurityFindings`, offending spans are replaced by
quarantine markers in `sourceChunks.sanitizedText`, and downstream provider prompts use sanitized
source context. The final processing validator removes exact quarantined instruction occurrences
from generated study fields before committing a snapshot. The UI renders the findings in the
question details drawer.

Question text that references external files or supplied tables, matrices, figures, graphs, plots,
distributions, or data is conservatively marked as asset-dependent and we try our best to embed a visualization or a shortcut to the file folder if not possible to visualize, and refer to it when the referenced context could not be attached automatically.

The golden dataset manifest is
`apps/server/src/studyFrame/golden/signal-data-analysis.manifest.json`. Manifests may classify raw
inputs and exclude derived artifacts from analysis. Do not edit manifest expectations to hide QA
failures.

## Analysis And Provider Use

`apps/server/src/studyFrame/analyzeProjectWithProvider.ts` runs local analysis first, then attempts
provider enrichment through `providerTextGeneration.ts`.

Provider text generation resolves from the configured provider instance registry and the server
text-generation model selection. The legacy `/analyze-project` route retains optional fallback
behavior for demo/testing flows. The practical `/process-folder` workflow requires a usable
provider; missing provider or provider failure fails the processing job instead of silently
producing final study content. Detached processing jobs own an explicit Effect scope until job
completion. Codex structured generation also owns its temporary schema and output files inside its
generation scope, so request teardown cannot remove files while the detached CLI call still uses
them.

Source classification is batched at up to 50 documents per provider call. Courses with more than 50
documents are split into deterministic `sourcePath` order batches, merged by document id, and
omitted documents are marked `unknown` with a review warning. Each batch receives only its own
documents and their grounded real-question candidates.

Provider-enhanced analysis can enrich topic modules, question support, practice support, answer input
types, and generation metadata. Treat imported question text as untrusted content inside prompts.

Feedback behavior:

| Action          | Immediate client behavior        | Optional server enhancement                                                       |
| --------------- | -------------------------------- | --------------------------------------------------------------------------------- |
| Direction check | Local non-answer feedback        | Provider response replaces it when available; answer-bearing phrases are redacted |
| Submit          | Local rubric keyword grading     | Provider grading replaces the matching attempt when available                     |
| Reveal          | Local tracked `revealed` attempt | None                                                                              |

The provider workflow separates topic-guide generation from question-support generation. After
source and question classification, StudyFrame generates topic modules in bounded topic batches;
each module uses all real questions classified into that topic. It then generates
spoiler-controlled per-question support in bounded question batches. This prevents a topic guide
from being derived from only the first question batch for that topic while avoiding one provider
call per topic.

Topic modules target the same study value as the golden markdown examples while remaining
app-native and spoiler-safe before practice: brief explanation, definitions/formulas, subtopics,
high-yield skills, recurring question patterns, representative unsolved quiz-style drills, solve
flow, and generic common traps. Final numeric answers, rubrics, worked solutions, and
question-specific watch-outs stay in question support and render only after submit or reveal.

The topic practice footer exposes one progressive help action: direction check, then hint, then
show answer. The latest assistance message replaces the prior assistance message instead of
stacking. Showing the answer replaces the answer input and prevents a second revealed attempt for
the same visible solution.

Generated variants:

1. The client checks topic exhaustion before offering generation.
2. The server independently verifies that every real question in the topic has an attempt.
3. The client creates local fallback variants immediately.
4. Provider-generated prompts replace matching fallback prompts when available.
5. Generated questions remain labeled through `isRealQuestion: false`, origin records, and batch
   metadata.

## Queueing And Leakage Controls

`apps/web/src/study/studyLogic.ts` orders real questions before generated variants. For real
questions, unattempted items come first, followed by weaker results, higher point value, newer source
year, under-covered subtype, and extraction confidence.

`apps/web/src/study/studyVisibility.ts` gates support visibility. Before submit or reveal, source
support summary, expected answers, rubric, solution, and common mistakes remain hidden. Review mode,
a submitted answer, a correct solution, or an explicit reveal unlocks them.

Review requirements:

- Real extracted questions must remain first.
- Generation must remain locked until all real questions in scope have attempts.
- Direction checks must not expose expected answers, solution steps, rubric labels, or answer terms.
- Source anchors, warnings, confidence, assets, real/generated identity, and generation metadata
  must survive persistence and export.

## Persistence

Server paths are derived in `apps/server/src/config.ts`. Under `STUDYFRAME_HOME`, runtime state uses
`dev/` when a development URL is configured and `userdata/` otherwise. That state directory
contains `state.sqlite` and `attachments/`.

SQLite migrations run automatically at server startup. StudyFrame migrations are `031` through
`035`. The repository adapter is `apps/server/src/persistence/Layers/StudyFrame.ts`.

Normalized StudyFrame tables:

```text
study_projects
study_documents
questions
question_support
question_topics
topic_threads
attempts
completion_summaries
generated_question_batches
study_source_documents
study_source_assets
study_source_chunks
study_source_security_findings
study_question_candidates
study_topic_clusters
study_question_classifications
study_topic_modules
study_practice_items
study_practice_support
study_processing_jobs
study_processing_events
study_processing_artifacts
```

`saveSnapshot` rewrites normalized StudyFrame state transactionally. Schema changes require an
additive migration, contract updates, repository read/write updates, and tests.

## Validation Pipeline

Use `bun run test`, never `bun test`.

Baseline local completion gate:

```bash
bun fmt
bun lint
bun typecheck
bun run test
```

StudyFrame workflow gate:

```bash
bun run qa:studyframe:fast
bun run qa:studyframe:golden
bun run qa:studyframe:ux
bun run qa:studyframe:release
```

| Command                 | Coverage                                                            |
| ----------------------- | ------------------------------------------------------------------- |
| `qa:studyframe:fast`    | Server StudyFrame tests, web study tests, contract typecheck        |
| `qa:studyframe:golden`  | External dataset import and semantic audit                          |
| `qa:studyframe:ux`      | Browser tests under `apps/web/src/components/study`                 |
| `qa:studyframe:release` | Fast, golden, UX, format, lint, typecheck, all tests, desktop smoke |

The golden audit requires:

```text
STUDYFRAME_GOLDEN_ROOT=<external Signal and Data Analysis course folder>
```

It writes review artifacts under `.codex-logs/studyframe-golden/<timestamp>/`. The external dataset
is input-only: never modify it, golden reference markdown, manifest expectations, thresholds,
no-leakage rules, or real-question-first rules to make a run pass.

The live semantic audit uses bounded projections rather than serializing persisted provider
provenance. It checks deterministic topic guard rails in code, audits topic/module quality in one
compact provider call, and audits real-question grounding, manual-review state, and hint leakage in
small sequential batches. Hidden author-only solution metadata is supplied only to compare against
hints; its presence is not treated as learner-visible leakage.

## CI And Release Pipeline

`.github/workflows/ci.yml` runs:

1. Bun and Node setup from root `package.json`.
2. Frozen dependency install.
3. Electron runtime verification.
4. Format check, lint, typecheck, and all tests.
5. Chromium browser runtime installation and web browser tests.
6. Desktop pipeline build and preload bundle verification.
7. Separate macOS mobile native static analysis.
8. Separate release smoke workflow exercise.

`.github/workflows/release.yml` is inherited release infrastructure. It supports stable tags,
scheduled nightlies, and manual dispatch. It resolves release metadata, runs preflight lint,
typecheck, and tests, builds Electron artifacts for macOS arm64/x64, Linux x64, and Windows x64,
optionally signs artifacts, merges macOS updater manifests, publishes GitHub releases, deploys the
hosted web app to Vercel aliases, updates stable version strings, and announces releases to Discord.

Before a public StudyFrame release, audit inherited `T3 Code` package names, GitHub repository
metadata, domains, update channels, signing configuration, and distribution behavior. The current
release workflow still contains inherited branding and hosted-web assumptions.

## Toolchain Specifications

Root `package.json` is authoritative:

| Tool            | Required version |
| --------------- | ---------------- |
| Bun             | `^1.3.11`        |
| Node            | `^24.13.1`       |
| Package manager | `bun@1.3.11`     |
| Turbo           | `^2.3.3`         |
| TypeScript      | `~6.0.3`         |

Install with:

```bash
bun install --frozen-lockfile
```

Important environment variables:

| Variable                                                        | Purpose                           |
| --------------------------------------------------------------- | --------------------------------- |
| `STUDYFRAME_HOME`                                               | Runtime state root                |
| `STUDYFRAME_PORT`, `STUDYFRAME_HOST`                            | Server bind configuration         |
| `STUDYFRAME_PORT_OFFSET`, `STUDYFRAME_DEV_INSTANCE`             | Development port selection        |
| `VITE_HTTP_URL`, `VITE_WS_URL`, `VITE_DEV_SERVER_URL`           | Web-to-server and Vite wiring     |
| `STUDYFRAME_GOLDEN_ROOT`                                        | External golden dataset path      |
| `STUDYFRAME_AUTH_TOKEN`                                         | Auth bootstrap where configured   |
| `STUDYFRAME_TAILSCALE_SERVE`, `STUDYFRAME_TAILSCALE_SERVE_PORT` | Optional Tailscale exposure       |
| `APP_VERSION`, `VITE_HOSTED_APP_URL`, `VITE_HOSTED_APP_CHANNEL` | Release-hosted web build metadata |

## Current Review Risks

- Visible desktop, web, connection, and SSH helper copy uses the StudyFrame brand. Some inherited
  mobile, package, repository, release automation, and hosted-domain identifiers still reference T3
  Code. Treat public distribution as blocked until those assumptions are reviewed and rebranded to
  AlonResearch-owned StudyFrame distribution metadata.
- Folder import uses the desktop picker locally, accepts browser-selected or dropped material lists
  for inspection without upload, and exposes a typed server-visible path as a secondary option.
  Extraction requires a path the server can read. Verify path visibility and remote-environment
  rules for hosted web, SSH, and remote environments before expanding distribution.
- Client actions update the local store immediately and save snapshots asynchronously. Provider
  feedback and generation are also asynchronous enhancements. Review race behavior when changing
  synchronization, selection, or multi-client support.
- The snapshot PUT endpoint accepts the complete validated snapshot from the authenticated client.
  Preserve server-side enforcement for security-sensitive invariants such as generated-variant
  unlock rules; do not rely only on UI checks.
- Extraction is best-effort. DOCX list-style question parts and tables are preserved where detected,
  but same-paragraph multipart questions may still need review. PDF quality, images, equations,
  vector media, and legacy DOC inputs require visible uncertainty and manual review rather than
  silent assumptions.
- `apps/mobile` remains inherited infrastructure and is not yet a StudyFrame-equivalent experience.

## Technical Change Checklist

For every technical change:

1. Update this file when the trace, contracts, storage, pipeline, configuration, or known risks
   change.
2. Update `README.md` when the student-facing product contract changes.
3. Update `docs/studyframe-upstream.md` when the ownership boundary changes.
4. Add an additive SQLite migration for persisted schema changes.
5. Update shared contracts before server and client consumers.
6. Run the narrowest relevant tests while iterating.
7. Run the required completion gate from `AGENTS.md`.
8. For StudyFrame workflow changes, run `bun run qa:studyframe:release` when the golden dataset is
   available and review generated reports.
