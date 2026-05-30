# AGENTS.md

## Product Contract

Read `README.md` before changing behavior or UX. StudyFrame is a desktop study workspace, not a coding-agent product.

The primary workflow is:

```text
course folder -> extraction -> topic priority -> brief concept refresher
 -> real-question PBL practice -> spaced review -> optional generated variants
```

Preserve these invariants:

- Real extracted questions come before generated variants.
- Generated variants unlock only after real questions in scope are attempted.
- Before submit or reveal, never leak expected answers, rubric keywords, solution steps, or answer-revealing traps.
- Topic ordering adapts like a spaced-repetition queue using source priority, performance, and review timing.
- Questions retain source grounding and warnings for unclear images, tables, equations, or layouts.
- Keep the main UX focused on studying. Avoid chat-first, coding-agent, or internal-analysis surfaces.

## Task Completion Requirements

- Run `bun fmt`, `bun lint`, and `bun typecheck` before considering tasks complete.
- Run `bun run test`, never `bun test`.
- If changing native mobile code, run `bun lint:mobile`.
- For StudyFrame workflow changes, run the narrowest relevant `qa:studyframe:*` command while iterating and `bun run qa:studyframe:release` before completion when the golden dataset is available.

## Package Roles

- `apps/server`: backend, StudyFrame HTTP services, SQLite persistence, provider integration, and inherited runtime infrastructure.
- `apps/web`: React/Vite StudyFrame UI and client-side study state.
- `apps/desktop`: Electron shell.
- `packages/contracts`: shared Effect schemas and TypeScript contracts. Keep this package schema-only.
- `packages/shared`: shared runtime utilities.

Prefer StudyFrame product code in:

- `apps/server/src/studyFrame/**`
- `apps/web/src/study/**`
- `apps/web/src/components/study/**`
- `packages/contracts/src/study.ts`

Keep adapters between StudyFrame-owned UX and inherited infrastructure small.

## Engineering Priorities

1. Correct learning behavior.
2. No answer leakage.
3. Source-grounded questions and visible uncertainty.
4. Reliability and predictable persistence.
5. Focused, low-friction UX.
6. Maintainability.

Reuse shared logic instead of duplicating behavior. Prefer additive StudyFrame changes over broad rewrites of inherited provider, auth, desktop, and persistence infrastructure.

## Upstream Boundary

StudyFrame is a downstream fork of T3 Code. Read `docs/studyframe-upstream.md` before updating inherited infrastructure.

Pull useful upstream provider, security, desktop, settings, and runtime changes into StudyFrame. Do not preserve coding-agent UX when it conflicts with the study workflow, and do not shape StudyFrame work for an upstream PR unless explicitly requested.

## StudyFrame Self-Correction Protocol

When asked to validate or improve StudyFrame:

1. Record `git status --short`.
2. Run `bun run qa:studyframe:fast`.
3. Run `bun run qa:studyframe:golden`.
4. Run `bun run qa:studyframe:ux`.
5. Read the generated JSON and markdown QA reports.
6. Patch only this application repository. Never modify the external golden dataset, manifest expectations, or golden reference markdown to hide failures.
7. Rerun the narrowest failing command.
8. After it passes, rerun `bun run qa:studyframe:release`.
9. Stop after three unsuccessful correction cycles and report the repeated blocker with evidence.

Allowed automatic changes include application code, tests, selectors, extraction logic, prompts, schemas, migrations, UI layout, and accessibility metadata.

Forbidden automatic changes include external golden dataset files, expected topic-ranking guard rails, minimum coverage thresholds, no-leakage rules, real-question-first rules, and exclusion-manifest entries unless a newly discovered derived artifact is documented in the QA report.
