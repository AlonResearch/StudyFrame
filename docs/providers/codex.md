# Codex Provider

StudyFrame uses Codex for source-aware course analysis, support generation, grading, and quality audits.

## Setup

Install and authenticate Codex CLI:

```bash
codex login
```

The default provider may use:

```text
Display name: Codex
CODEX_HOME path: ~/.codex
Shadow home path: empty
```

## Multiple Accounts

The inherited provider settings support multiple Codex accounts. Use clear display names and separate authentication homes. Keep provider configuration out of the student study workflow unless setup or recovery is required.

## Product Rule

Provider-backed workflows should degrade visibly to local fallback when Codex is unavailable. Golden acceptance checks require live Codex.
