# CLAUDE.md

## Project Overview

Eclipse GLSP VS Code Integration — TypeScript monorepo providing glue code to integrate GLSP (Graphical Language Server Platform) diagrams into VS Code. Uses pnpm workspaces.

## Build & Development Commands

- **Package manager**: pnpm — do not use yarn or npm
- **Install & build**: `pnpm build` (installs deps + compiles TypeScript)

## Validation

- After completing any code changes, always run the `/fix` skill before reporting completion. It builds first (hard gate), then auto-fixes lint/format/header issues; manually resolve anything it could not auto-fix (remaining lint errors) and re-run it.
