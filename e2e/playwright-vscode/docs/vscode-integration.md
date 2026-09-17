# The VS Code integration

This document covers only what is specific to running the GLSP Playwright framework against VS Code.
The framework concepts it builds on — integrations, page objects, extensions, flows and capabilities
— are documented once, in the core package:
[glsp-core/e2e/playwright/docs](https://github.com/eclipse-glsp/glsp-core/tree/master/e2e/playwright/docs).

## Setup is a separate project

Unlike a browser based integration, VS Code has to be downloaded and the extension under test has to
be installed before anything can run. That is a Playwright _setup project_, which the test project
declares as a dependency:

```ts
{ name: 'vscode-setup', testMatch: ['setup/vscode.setup.js'], use: { integrationOptions } },
{ name: 'vscode', testMatch: ['**/*.spec.js'], dependencies: ['vscode-setup'], use: { integrationOptions } }
```

The setup project writes the resolved VS Code executable path to `storagePath`; the integration reads
it back when launching. Both projects therefore need the _same_ `integrationOptions`.

## Options

`defineVSCodeIntegration()` is the only supported way to build the options: it fills in the
discriminator and the factory that the `integration` fixture uses, so a hand-written options literal
is a compile error.

| Option          | Required | Description                                                             |
| --------------- | -------- | ----------------------------------------------------------------------- |
| `workspace`     | yes      | Path to the workspace directory VS Code opens                           |
| `vsixId`        | yes      | Extension identifier, i.e. `<publisher>.<name>` lowercased              |
| `vsixPath`      | yes      | Path to the packaged `.vsix` to install                                 |
| `storagePath`   | yes      | File the setup project writes the VS Code executable path to            |
| `file`          | no       | File in the workspace to open; when omitted no editor is opened         |
| `extensionsDir` | no       | Directory to install into and launch against; defaults to VS Code's own |

### Testing more than one variant of an extension

`extensionsDir` exists for the case where two packaged variants of the same extension are under test
— for example a desktop and a web build. VS Code resolves a single extensions directory per
installation, so installing both variants into it puts two extensions in the workbench that
contribute the _same_ custom editor, and whichever VS Code picked would silently decide what the
tests exercise. Give each variant its own directory instead:

```ts
extensionsDir: path.join(configDir, '.vscode-test', project, 'extensions');
```

## Webview nesting

The diagram is rendered two frames deep, and `prefixRootSelector` resolves the outer frame by class
(`iframe.webview`) rather than by tag. A _web_ extension is hosted in an additional hidden
worker-host iframe, so a bare `iframe` selector is ambiguous in that configuration.

## Parallel workers need a display each

Every Playwright worker launches a VS Code window of its own, and windows that share a display
interfere with each other: the enter and leave events of a window that opens or closes cancel a hover
another worker is waiting on, so the hover-driven tests time out waiting for a popup. Sharing a
display therefore limits a run to one worker.

Setting `GLSP_VSCODE_ISOLATED_DISPLAYS=true` makes the integration start one `Xvfb` per worker
process and launch that worker's VS Code on it, which removes the interference. The configuration
asks `supportsDisplayIsolation()` — Linux plus an `Xvfb` binary — for how many workers it may use:

```ts
workers: supportsDisplayIsolation() ? 4 : 1;
```

The displays are invisible, so a run that should be watched is one without isolation, and therefore
single-worker. macOS and Windows have no equivalent mechanism and always run with one worker.

## Launching the GLSP server

The extension decides for itself whether to spawn a GLSP server. The Workflow example skips spawning
when `GLSP_SERVER_DEBUG=true` and connects to `GLSP_SERVER_PORT` / `GLSP_WEBSOCKET_PATH` instead.
Those variables are read from `process.env` at activation time, and the extension host inherits the
environment of the process that launched it — so exporting them from `playwright.config.ts` is what
puts the extension on the server Playwright started.

See [`workflow-vscode-e2e`](../../workflow-vscode-e2e/README.md) for a complete configuration.

## License

This program and the accompanying materials are made available under the terms of the
[Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0) which is available at
https://www.eclipse.org/legal/epl-2.0, or the
[GNU General Public License, version 2](https://www.gnu.org/software/classpath/license.html)
with the GNU Classpath Exception.

SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
