# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the TypeScript plugin source; entry point is `src/main.ts`.
- `src/modal/` holds modal UI classes; shared utilities live in `src/utils.ts`.
- Build/config files: `esbuild.config.mjs`, `tsconfig.json`, `version-bump.mjs`, `manifest.json`, `versions.json`.
- Plugin assets: `styles.css` for UI styling; `main.js` is the bundled output.
- Tests are configured in `jest.config.js` to live under `test/` (none are checked in yet).

## Build, Test, and Development Commands
- `npm run dev` builds with esbuild in watch mode, writing `main.js`.
- `npm run build` runs TypeScript type checks then produces a production bundle.
- `npm run test` runs Jest once; `npm run test:watch` watches for changes.
- `npm run version` bumps `manifest.json` and `versions.json` and stages them.

## Coding Style & Naming Conventions
- TypeScript with strict null checks and ESNext modules (see `tsconfig.json`).
- Use tabs for indentation to match existing `src/` files.
- File names use lower camel case (e.g., `cuboxApi.ts`); classes use PascalCase.
- Keep implementations minimal and maintainable; avoid defensive edge handling unless needed.
- Debug with log/print output instead of pattern matching; fail loudly when errors occur.
- Only add `@@@title - explanation` comments in tricky sections.

## Testing Guidelines
- Jest + ts-jest with `jsdom` are configured; tests should be named `*.test.ts` under `test/`.
- The Obsidian API is mocked via `test/__mocks__/obsidian.ts`.
- Coverage is enabled (text + lcov), so keep tests focused and small.

## Commit & Pull Request Guidelines
- Recent commits use short prefixes like `fix:` and `update:` and occasional version-only commits.
- Keep commit subjects concise; use prefixes when they clarify intent.
- PRs should describe user-visible changes, list manual test steps in Obsidian, and mention any `manifest.json`/`versions.json` updates.
