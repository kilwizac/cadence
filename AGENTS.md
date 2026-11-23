# Cadence

Desktop app (Electron + React + Mantine 9 + React Three Fiber) for mapping, documenting and improving business systems on an isometric 3D map.

## Commands

- `bun install` — install (postinstall fetches the Electron binary)
- `bun run dev` — Vite + Electron with hot reload
- `bun run build` — typecheck, renderer build, main/preload bundle. Must pass before every push.
- `bun run start` — production build and launch

## Layout

- `electron/` main process (storage, dialogs, `app://` protocol) and preload bridge. Bundled with `bun build`; resolve paths from `app.getAppPath()`, never `__dirname` (bun inlines it at build time).
- `src/shared/` types and the `OpsApi` bridge contract shared by both processes.
- `src/renderer/model.ts` domain constants, factories and `migrate()`; `store.tsx` immer-based workspace store with debounced autosave.
- `src/renderer/map/` 3D map; `assets.ts` maps area kinds to Kenney CC0 models in `public/models/`.
- `src/renderer/components/` Mantine UI.

## Conventions

- Use Mantine components and `@tabler/icons-react`; no other UI kits.
- All workspace mutations go through `update((draft) => …)`.
- New persisted fields: add them to `src/shared/types.ts` and backfill defaults in `migrate()` with `??=`. Do not bump `version` for additive fields.
- Renderer never touches the filesystem directly; add an IPC handler in `electron/main.ts`, expose it in `preload.ts`, type it in `src/shared/api.ts` and give `storage.ts` a browser fallback.

## Git

Work lands directly on `main`; there are no feature branches or PRs. Commit in small, focused steps and before pushing run `git fetch origin && git rebase origin/main`, re-run `bun run build`, then `git push origin HEAD:main`. Resolve rebase conflicts by keeping both sides' intent; never force-push.
