# StudyFrame Upstream Policy

StudyFrame is a downstream product fork of T3 Code, not a thin UI skin and not a branch intended
to merge back upstream. The main StudyFrame experience is allowed to overhaul and prune T3 Code's
chat-first agent workflow so the app can become a focused real-questions-first spaced learning
workspace.

The maintenance flow is one-way: pull useful upstream changes into StudyFrame when they improve the
backend, providers, runtime infrastructure, security, settings, desktop support, or another feature
StudyFrame actually needs. Do not shape StudyFrame work around upstream contribution, upstream pull
requests, or keeping the coding-agent UI compatible.

The upstream boundary is selective:

- Track upstream for dependencies, backend/runtime infrastructure, provider plumbing, auth,
  settings, desktop packaging, remote connection support, persistence foundations, and security
  fixes.
- Own StudyFrame's primary UI, navigation, study workflow, question/attempt domain, and visible
  product language inside this fork.
- Ignore or prune upstream UI/workflow changes when they only improve the coding-agent experience
  and do not affect shared infrastructure we still depend on.
- Preserve provider and settings surfaces carefully; they are part of the upstream-owned
  infrastructure StudyFrame should continue to receive updates for.

Canonical upstream:

```bash
git remote add upstream https://github.com/pingdotgg/t3code.git
git remote set-url --push upstream DISABLED
```

The local `upstream` remote should be fetch-only. StudyFrame changes should be organized so
upstream backend/provider/config updates can be applied into this fork without needing to keep
upstream's main agent UI. Never push StudyFrame commits to `upstream` or prepare them as an
upstream PR unless that is explicitly requested as a separate task.

## Version Rule

Use the versions pinned by the current upstream commit:

- `package.json`
- `bun.lock`
- every workspace `package.json`
- `patches/**`
- `turbo.json`
- root TypeScript and build config

Do not bump React, Vite, Effect, provider SDKs, Electron, Bun, Node types, or package-manager pins
inside a StudyFrame feature patch. Let upstream own those changes.

The exception is an explicit StudyFrame platform decision documented in the PR or commit. Routine
product work should not modify dependency-owned files.

StudyFrame app release numbers are a separate product concern. Use the root
`studyframe.version.json` file for StudyFrame desktop/release version bumps and keep workspace
package manifests pinned to upstream unless a package-level divergence is deliberately documented.

## Ownership Boundary

### Upstream-Owned

Prefer accepting upstream changes in these areas and resolve conflicts toward upstream unless the
change directly breaks StudyFrame:

- root dependency and build metadata: `package.json`, `bun.lock`, `patches/**`, `turbo.json`,
  `tsconfig.base.json`
- provider/runtime/server packages and contracts
- desktop packaging, update, IPC, remote connection, auth, and settings infrastructure
- provider configuration UI, model/provider settings, diagnostics, pairing, and connection screens
- security, persistence, protocol, and observability fixes

### StudyFrame-Owned

Prefer StudyFrame behavior in these areas, even when upstream changes the coding-agent workflow:

- default route and primary application shell
- study dashboard, topic navigation, question practice, grading, exhaustion, review, and generation
  workflows
- question/attempt/completion/generated-variant domain model
- visible product language and terminology
- study-specific sidebar, panels, drawers, and exports

### Adapter Areas

These files should stay small and boring because they connect StudyFrame-owned UI to
upstream-owned infrastructure:

- route wiring
- app shell layout wiring
- settings/provider entry points
- backend API adapters for study services

When a conflict appears in an adapter area, split the decision explicitly: keep upstream on the
infrastructure side and StudyFrame on the product side.

## Local Requirements

Check the current upstream `engines` and `packageManager` fields before development:

```bash
git show upstream/main:package.json
```

For the current base, use:

- Bun satisfying upstream `engines.bun`
- Node satisfying upstream `engines.node`
- `bun install --frozen-lockfile`

## Updating From Upstream

1. Fetch the current upstream state.

```bash
git fetch upstream main --tags
```

2. Integrate upstream into StudyFrame before adding more StudyFrame work.

```bash
git rebase upstream/main
```

Use a rebase, merge, or cherry-pick based on conflict size, but the direction is always
`upstream/main` into the StudyFrame fork. Do not merge StudyFrame back into T3 Code.

3. Confirm dependency-owned files are unchanged by StudyFrame product work.

```bash
git diff --name-status upstream/main -- package.json bun.lock "apps/*/package.json" "packages/*/package.json" scripts/package.json patches turbo.json tsconfig.base.json
```

That command should normally print nothing. If it prints a package, lockfile, patch, or build-tooling
change, either drop it or document why StudyFrame must intentionally diverge.

4. Review upstream changes by ownership boundary:

- accept infrastructure/provider/settings/security updates
- inspect provider/settings UI changes and port what StudyFrame still needs
- ignore or delete coding-agent UI/workflow changes that do not apply to the study product
- keep adapter files small so conflicts remain obvious

5. Keep new StudyFrame code in product-owned areas where practical:

- `apps/web/src/study/**`
- `apps/web/src/components/study/**`
- `packages/contracts/src/study.ts`
- additive server migrations and study services
- small shell/route wiring changes that route the existing infrastructure to the study experience

StudyFrame persistence should stay additive: keep the study snapshot API and SQLite repository
isolated from upstream provider/auth/settings tables so dependency and provider updates can be
accepted without merging through the study workflow.

6. Run the normal checks after the update:

```bash
bun fmt
bun lint
bun typecheck
bun run test
```

Use targeted package filters while iterating, but run the full required checks before calling a
change complete.
