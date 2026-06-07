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

- Read `groundtruth.md` before technical changes. Update it in the same change whenever runtime
  behavior, data contracts, persistence, extraction, provider use, build or release pipelines,
  required environment configuration, validation commands, or known technical risks change.
- Keep git history maintainable: make small commits for each coherent feature, fix, or behavior
  change, and push each commit after validation. Avoid bundling unrelated edits into one commit.
- Run `bun fmt`, `bun lint`, and `bun typecheck` before considering tasks complete.
- Run `bun run test`, never `bun test`.
- If changing native mobile code, run `bun lint:mobile`.
- For StudyFrame workflow changes, run the narrowest relevant `qa:studyframe:*` command while iterating and `bun run qa:studyframe:release` before completion.

## Browser Verification

- For StudyFrame UI changes, run `bun run qa:studyframe:ux` first. It is the default headless Chromium regression check.
- Use detached Playwright Chromium only when full-app startup, integration behavior, or real testing needs coverage beyond the UX suite.
- Start the full local stack before detached inspection;

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

## StudyFrame QA

For validation or self-correction tasks, follow `QAGuidelines.md`. If you run the optional external
golden audit, treat that dataset and its guard rails as input-only; fix application code instead of
weakening QA expectations.
