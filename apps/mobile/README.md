# StudyFrame Mobile

The mobile app is inherited infrastructure and is not the current StudyFrame product focus.

Do not extend coding-agent, terminal, or review-diff UX for StudyFrame unless explicitly requested. Prioritize the desktop study workflow described in the root `README.md`.

Run commands from `apps/mobile`.

```bash
bun run dev:client
bun run ios:dev
node ../../scripts/mobile-native-static-check.ts
```

Native modules require the Expo Dev Client; Expo Go is not supported.
