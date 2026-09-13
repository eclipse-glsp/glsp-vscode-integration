# @eclipse-glsp/playwright-vscode

VS Code integration for the GLSP Playwright testing framework.

Use this package to test a GLSP diagram editor running inside VS Code. It contributes the
`VSCode` integration, the workbench page objects and the setup fixtures that download VS Code and
install the extension under test; everything else comes from
[`@eclipse-glsp/playwright`](https://github.com/eclipse-glsp/glsp-core/tree/master/e2e/playwright),
which is developed in the [glsp-core](https://github.com/eclipse-glsp/glsp-core) repository.

## Usage

Create the integration options with `defineVSCodeIntegration()` in your Playwright configuration.
The returned options carry the factory that the `integration` fixture uses, so no further
registration is needed:

```ts
import { defineVSCodeIntegration } from '@eclipse-glsp/playwright-vscode';

const integrationOptions = defineVSCodeIntegration({
    workspace: '../workspace',
    file: 'example1.wf',
    vsixId: 'eclipse-glsp.workflow-vscode-example',
    vsixPath: '/path/to/workflow-vscode-example.vsix',
    storagePath: 'playwright/.storage/vscode.setup.json'
});
```

Tests need two projects: a setup project that downloads VS Code and installs the VSIX, and the test
project that depends on it. See [`docs/vscode-integration.md`](./docs/vscode-integration.md).

Tests themselves stay integration-agnostic and keep importing `test` and `expect` from
`@eclipse-glsp/playwright`.

## Documentation

The framework concepts (integrations, page objects, extensions, flows) are documented once, in the
core package: [concepts](https://github.com/eclipse-glsp/glsp-core/tree/master/e2e/playwright/docs).
Only what is specific to VS Code is documented here, under [`docs/`](./docs).

## Building

This package is built as part of the [glsp-vscode-integration](https://github.com/eclipse-glsp/glsp-vscode-integration)
workspace:

```console
pnpm install
pnpm compile
```

## License

This program and the accompanying materials are made available under the terms of the
[Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0) which is available at
https://www.eclipse.org/legal/epl-2.0, or the
[GNU General Public License, version 2](https://www.gnu.org/software/classpath/license.html)
with the GNU Classpath Exception.

SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
