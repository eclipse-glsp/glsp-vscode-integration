# CLAUDE.md

## Project Overview

Eclipse GLSP VS Code Integration — TypeScript monorepo providing glue code to integrate GLSP (Graphical Language Server Platform) diagrams into VS Code. Uses Yarn workspaces + Lerna.

## Build & Development Commands

-   **Package manager**: Yarn 1.x (classic) — do not use Yarn 2+/Berry or npm
-   **Install & build**: `yarn build` (installs deps + compiles TypeScript)

## Validation

-   After completing any code changes, always run the `/verify` skill before reporting completion
-   If verification fails, run the `/fix` skill to auto-fix issues, then re-run `/verify`
