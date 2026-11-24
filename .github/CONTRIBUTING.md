# Contributing to Cadence

Thanks for your interest in Cadence! Bug reports, ideas and pull requests are all welcome.

## Before you start

- **Bugs and feature ideas:** open an [issue](https://github.com/kilwizac/cadence/issues/new/choose) first so we can talk it through before you write code.
- **Security problems:** please don't open a public issue. See [SECURITY.md](SECURITY.md).
- By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

You'll need [Bun](https://bun.sh), Node.js 24, and on macOS the Xcode Command Line Tools.

```sh
git clone https://github.com/kilwizac/cadence.git
cd cadence
bun install
bun run dev    # Vite + Electron with hot reload
```

Before opening a pull request, make sure these pass:

```sh
bun run typecheck
bun run test
bun run build
```

## Project conventions

- UI uses Mantine components and `@tabler/icons-react` only; no other UI kits.
- All workspace mutations go through `update((draft) => …)`.
- New persisted fields go in `src/shared/types.ts` with defaults backfilled in `migrate()` using `??=`.
- The renderer never touches the filesystem directly. Add an IPC handler in `electron/main.ts`, expose it in `preload.ts`, type it in `src/shared/api.ts`, and give `storage.ts` a browser fallback.
- If you change runtime dependencies, run `bun run notices` to regenerate `THIRD_PARTY_NOTICES.txt`.

See [AGENTS.md](../AGENTS.md) for more detail on the layout.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Keep each PR focused on one change, and include screenshots for UI changes.
3. Fill out the PR template and link the related issue (e.g. `Closes #12`).
4. CI must pass and a maintainer must approve before merging. PRs are squash-merged.

By submitting a pull request, you agree that your contribution is licensed under the project's [MIT License](../LICENSE).
