# Workspace Layout

- `apps/server`: backend, StudyFrame HTTP services, SQLite persistence, and provider integration.
- `apps/web`: React/Vite StudyFrame UI and client-side study state.
- `apps/web/src/study`: study-domain client logic.
- `apps/web/src/components/study`: student-facing workspace components.
- `apps/desktop`: Electron shell.
- `packages/contracts/src/study.ts`: shared StudyFrame schemas.
- `packages/shared`: inherited shared runtime utilities.
- `docs/studyframe-upstream.md`: boundary between StudyFrame product code and inherited T3 Code infrastructure.
