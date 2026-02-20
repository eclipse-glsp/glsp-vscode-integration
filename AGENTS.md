# Repository Guidelines

## Project Structure & Module Organization

This repository is a Yarn workspace/Lerna monorepo for GLSP VS Code integration.

-   `packages/vscode-integration/`: extension-side integration library (`src/browser`, `src/common`, `src/node`).
-   `packages/vscode-integration-webview/`: webview-side integration library (`src/`, `css/`).
-   `example/workflow/extension/`: desktop VS Code example extension.
-   `example/workflow/web-extension/`: web extension example.
-   `example/workflow/webview/`: bundled webview app used by examples.
-   `documentation/`: project media and docs assets.

## Build, Test, and Development Commands

Use Node `>=20` and Yarn classic (`>=1.7.0 <2`). From repo root:

-   `yarn install`: install workspace dependencies and build via `prepare`.
-   `yarn build`: TypeScript build plus webpack bundles across packages.
-   `yarn compile`: run `tsc -b` project references only.
-   `yarn watch`: run TypeScript/watch bundles for root and workflow examples.
-   `yarn lint` / `yarn lint:fix`: run ESLint (or autofix).
-   `yarn format` / `yarn format:check`: run Prettier write/check.
-   `yarn headers:check` / `yarn headers:fix`: validate/fix Eclipse copyright headers.
-   `yarn check:all`: full local gate used before CI-style submissions.

## Coding Style & Naming Conventions

TypeScript is the primary language. Formatting and linting are enforced by:

-   Prettier (`@eclipse-glsp/prettier-config`)
-   ESLint (`@eclipse-glsp/eslint-config`)

Follow existing naming patterns: kebab-case filenames (for example `glsp-editor-provider.ts`), PascalCase types/classes, camelCase functions/variables. Keep imports on GLSP re-exports (avoid direct `sprotty`/`sprotty-protocol` imports per lint warnings).

## Testing Guidelines

There is currently no dedicated root `test` script or committed `*.spec`/`*.test` suites in this repo. Treat static checks as mandatory quality gates:

1. `yarn lint`
2. `yarn format:check`
3. `yarn headers:check`
4. `yarn build`

For behavior validation, run the workflow example launch configurations in VS Code.

## Commit & Pull Request Guidelines

Use issue-first workflow: open an issue in `eclipse-glsp/glsp`, then branch as `issues/<issue_number>`. Reference the issue in commit/PR text using the absolute URL (not just `#123`).

Commit style in this repo is concise and imperative, often with issue keys (for example `GLSP-1578: Switch to github actions`). PRs should include:

-   clear scope and rationale,
-   linked issue URL,
-   screenshots/video for UI behavior changes,
-   confirmation that lint/format/build checks pass,
-   Eclipse Contributor Agreement (ECA) compliance.
