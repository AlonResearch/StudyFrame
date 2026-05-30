# Claude Provider

StudyFrame inherits Claude provider support from T3 Code. Codex is the primary StudyFrame provider, but Claude may remain available as an optional analysis provider.

## Setup

Install and authenticate Claude Code:

```bash
claude auth login
```

Default settings:

```text
Display name: Claude
Binary path: claude
Claude HOME path: empty
```

Use separate Claude home paths for isolated accounts or configurations. Mark tokens and API keys as sensitive in provider settings.

## Product Rule

Provider settings are infrastructure. Keep account, router, and environment-variable details out of the main study UX unless the user opens settings.

