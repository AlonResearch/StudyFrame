# Release Checklist

StudyFrame inherits desktop packaging and release plumbing from T3 Code. Rebrand inherited package names, domains, and distribution metadata before a public release.

## Required Gate

```bash
bun run qa:studyframe:release
```

This includes StudyFrame QA, formatting, linting, typechecking, tests, and the desktop smoke test.

## Release Review

- Verify Windows, macOS, and Linux desktop artifacts as applicable.
- Verify app branding says StudyFrame.
- Verify the first-run course import flow.
- Verify provider setup and local fallback behavior.
- Verify golden-dataset QA artifacts contain no blocker or major findings.
- Verify packaged builds do not write into imported course repositories.
- Verify update channels and hosted-web settings before enabling inherited release automation.

Treat `.github/workflows/release.yml` and packaging scripts as inherited infrastructure until the StudyFrame distribution model is finalized.
