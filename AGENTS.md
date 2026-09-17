# AGENTS.md

- Use pnpm. Find workspace commands in the root `package.json` and package-specific commands in each package's `package.json`.
- Consult `README.md` for package layout and development setup. The example extension is built and packaged with `pnpm build` and `pnpm package:examples`.
- `@eclipse-glsp/vscode-integration/browser` is the entry point for web extensions and must stay free of Node dependencies; keep Node-only code out of the modules it pulls in.
- Document public APIs with TSDoc and use `{@link Symbol}` for cross-references. Explain behavior and non-obvious decisions rather than restating signatures.
- After code changes, run the /fix skill. Resolve failures and repeat until build, lint, formatting, and headers pass.
- The e2e suites are not part of /fix because they package both VSIX variants and download VS Code. Run them with `pnpm test:e2e` (`pnpm test:e2e:headless` without a display) when changing anything under `e2e/` or the diagram integration itself.
- `CHANGELOG.md` is generated from the merged PRs before a release. Do not add or bump entries manually.
