# Scripts

## Development

- `bun run dev`: start server and web development mode.
- `bun run dev:desktop`: start Electron development mode.
- `bun run build`: build the monorepo.

## Required Checks

- `bun fmt`
- `bun lint`
- `bun typecheck`
- `bun run test`

## StudyFrame QA

- `bun run qa:studyframe:fast`: targeted StudyFrame tests.
- `bun run qa:studyframe:golden`: run the external golden-dataset audit.
- `bun run qa:studyframe:ux`: run StudyFrame browser tests.
- `bun run qa:studyframe:release`: run the full StudyFrame gate.

See `AGENTS.md` for the self-correction protocol.
