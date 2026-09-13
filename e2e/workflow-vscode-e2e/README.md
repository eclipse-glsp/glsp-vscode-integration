# Workflow Example — VS Code E2E Tests

VS Code integration tests for the GLSP `Workflow Example`.

This package holds what is specific to VS Code:

- [./tests](./tests/): One registration of the reusable Workflow contract, with the cases VS Code
  does not support skipped, plus the setup spec that downloads VS Code and installs the extension.
- [./configs](./configs/): The Playwright projects and the web server that starts the GLSP server.

The integration-agnostic test bodies live in `@eclipse-glsp-examples/workflow-e2e`, which is
developed in [glsp-core](https://github.com/eclipse-glsp/glsp-core). This package registers the
aggregate contract locally, so newly published suites run automatically and stay customizable.

## Projects

Both packaged variants of the example extension are covered, each as a `<name>-setup` plus `<name>`
pair. The setup project downloads VS Code and installs that variant's VSIX; the test project depends
on it.

| Project      | Extension                           |
| ------------ | ----------------------------------- |
| `vscode`     | `workflow-vscode-example` (desktop) |
| `vscode-web` | `workflow-vscode-example-web` (web) |

The two variants contribute the same custom editor, so each is installed into its own extensions
directory under `.vscode-test/<project>/`. Installing both into one directory would leave VS Code to
pick between them.

## Running

From the repository root:

```console
pnpm install
pnpm test:e2e
```

`test:e2e` builds the workspace, packages both VSIX variants and then runs the suites. Once those
artifacts exist, the tests can be re-run on their own:

```console
pnpm e2e test            # both variants
pnpm e2e test:desktop    # only `vscode`
pnpm e2e test:web        # only `vscode-web`
```

On a headless machine, wrap the run in `xvfb-run -a`.

Playwright starts the bundled Workflow Node server; the extension is run with `GLSP_SERVER_DEBUG`,
so it attaches to that server instead of spawning one of its own.

## Configuration

All variables are optional and can be set in the environment or in an `.env` file in `e2e/`
(see [`.env.example`](../.env.example)).

| Variable               | Default   | Description                                                                |
| ---------------------- | --------- | -------------------------------------------------------------------------- |
| `GLSP_SERVER_PORT`     | `8081`    | Port of the Workflow GLSP server                                           |
| `GLSP_SERVER_TYPE`     | `node`    | `node` starts the bundled server; `java` expects an externally started one |
| `GLSP_SERVER_EXTERNAL` | unset     | `true` to attach to a server started by hand, e.g. under a debugger        |
| `VSCODE_VERSION`       | `1.101.0` | VS Code release the tests run against                                      |

### Testing against another server

Only the bundled Node server is started by Playwright. Any other server — the Java server from the
[glsp-server](https://github.com/eclipse-glsp/glsp-server) repository, or a Node server under a
debugger — has to be listening on `GLSP_SERVER_PORT` before the tests are started:

```console
# in a separate shell, from your glsp-server checkout
java -jar examples/org.eclipse.glsp.example.workflow/target/*-glsp.jar --websocket --port 8081

GLSP_SERVER_TYPE=java pnpm e2e test
```

## License

This program and the accompanying materials are made available under the terms of the
[Eclipse Public License v. 2.0](http://www.eclipse.org/legal/epl-2.0) which is available at
https://www.eclipse.org/legal/epl-2.0, or the
[GNU General Public License, version 2](https://www.gnu.org/software/classpath/license.html)
with the GNU Classpath Exception.

SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
