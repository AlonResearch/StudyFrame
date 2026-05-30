# Contributing

StudyFrame is an early downstream fork of T3 Code. Read `README.md` and `AGENTS.md` before changing behavior.

## Direction

Changes should improve the student workflow:

```text
course import -> priority ordering -> brief concept refresher
 -> real-question PBL practice -> spaced review -> optional variants
```

Preserve real-questions-first behavior, no-answer-leakage rules, source grounding, and a quiet study-focused UX.

## Pull Requests

- Keep changes focused.
- Explain the student-facing reason for the change.
- Include before/after screenshots for visible UI changes.
- Add or update tests for changed behavior.
- Do not mix upstream infrastructure updates with StudyFrame product work unless necessary.

## Required Checks

```bash
bun fmt
bun lint
bun typecheck
bun run test
```

For StudyFrame workflow changes, also run the relevant `qa:studyframe:*` checks described in `AGENTS.md`.

