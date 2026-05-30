# Observability

StudyFrame inherits the server observability foundation from T3 Code.

## Signals

- Human-readable logs go to stdout.
- Completed spans are written to the local NDJSON trace file.
- Traces and metrics can optionally be exported over OTLP.
- StudyFrame golden-audit artifacts are written under `.codex-logs/studyframe-golden/`.

Default trace path:

```text
~/.t3/userdata/logs/server.trace.ndjson
```

Relevant code:

- `apps/server/src/observability/**`
- `apps/server/src/studyFrame/**`
- `scripts/studyframe-golden-audit.ts`

## StudyFrame Guidance

Instrument import, extraction, provider analysis, persistence, grading, and export boundaries. Include project identifiers and source-relative paths when useful, but do not log student answers, API keys, tokens, or raw course content unnecessarily.

When debugging the golden workflow, inspect the generated QA report first and use traces to investigate the failing stage.

