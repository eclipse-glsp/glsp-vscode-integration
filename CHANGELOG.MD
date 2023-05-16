# Eclipse GLSP VSCode Integration Changelog

## [1.1.0 - Upcoming]()

### Changes

-   [launch] Socket-based launch quickstart components now support auto-assigned ports [#33](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/33)

### Breaking Changes

-   [deps] Update to vscode-jsonrpc 8.0.2 & update minimum requirements for Node to >=16.11.0 [#31](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/31)
-   [launch] Refactor socket-based quickstart components to also support WebSocket connections [#37](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/37)
    -   Renamed `JavaSocketServerLaunchOptions` -> `SocketServerLaunchOptions` and removed `serverType` property
    -   Renamed `GlspServerLauncher` -> `GLSPSocketServerLauncher`
    -   Replaced `serverPort` property of `SocketGlspVscodeServerOptions` with `connectionOptions`
    -   Added `start()` and `onReady` to `GlspVscodeServer` interface
    -   Introduced new `NodeGlspVscodeServer`

## [v1.0.0 - 30/06/2022](https://github.com/eclipse-glsp/glsp-client/releases/tag/v1.0.0)

### Changes

-   [example] Improved and modernized styling of the GLSP workflow example [#22](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/22)
-   [build] Updated Typescript to version 4.5.5 and enforced `noImplicitOverride` [#26](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/26)

## [v0.9.0- 09/12/2021](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v0.9.0)

Inception of the Eclipse VScode integration.
This project provides the glue code to integrate a GLSP diagram editor into VSCode.
This is achieved by using the VSCode extension API for creating custom editors.
