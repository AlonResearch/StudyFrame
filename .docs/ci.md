# CI Quality Gates

Baseline checks:

```bash
bun lint
bun typecheck
bun run test
```

StudyFrame workflow changes should also run:

```bash
bun run qa:studyframe:fast
bun run qa:studyframe:golden
bun run qa:studyframe:ux
```

The golden audit uses the external Signal/Data Analysis dataset described in `README.md`. It must never rewrite that dataset to make a failure pass.

