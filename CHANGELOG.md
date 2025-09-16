# Eclipse GLSP VSCode Integration Changelog

## v2.6.0 - active

### Changes

### Potentially Breaking Changes

## [v2.5.0 - 07/09/2025](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v2.5.0)

### Changes

-   [api] Allow configuration of messenger instance in `GLSPVscodeConnector` [#75](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/75)
-   [diagram] Update layout command to dispatch new `TriggerLayoutAction` [#77](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/77)

### Potentially Breaking Changes

-[node] Update minimum requirements for Node to >=20 [#78](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/78)

## [v2.4.0 - 04/04/2025](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v2.4.0)

### Changes

-   [diagram] Dispose pending progress reporters on diagram close [#72](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/72)
-   [diagram] Fix wrong CSS for `--glsp-warning-foreground` [#73](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/73)

### Potentially Breaking Changes

## [v2.3.0 - 19/12/2024](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v2.3.0)

### Changes

-   [diagram] Update default styling to consistently use vscode theme variables [#68](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/68)
-   [deps] Drop support for node `16`. New minimum version is `18.x` [#69](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/69)

## [v2.2.1 - 22/07/2024](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v2.2.1)

### Changes

-   [diagram] Fix minor styling and behavioral issues when using `GLSPProjectionView` [#62](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/62)
-   [diagram] Removed the context menu module from the default integration as it is currently not supported in VS Code [#63](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/63)

### Potentially Breaking Changes

-   [protocol] Fix a bug in the client-server action forwarding that prevented proper marking and handling of server received actions [#58](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/58)</br> Following classes and methods are now deprecated:
    -   `VsCodeGLSPModelSource`: Rebinding to a custom model source is no longer necessary. Use the default `GLSPModelSource` instead.
    -   `ExtensionAction`: The concept of marking actions as locally dispatched `ExtensionActions` is no longer necessary and usage is discouraged.
    -   `GlspVscodeConnector.sendToActiveClient`: Use `GlspVscodeConnector.dispatchAction` instead.
    -   `GlspVscodeConnector.setActionToClient`: Use `GlspVscodeConnector.dispatchAction` instead.

## [v2.1.0 - 24/01/2024](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v2.1.0)

## [v2.0.0 - 14/10/2023](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v2.0.0)

### Changes

-   [launch] Socket-based launch quickstart components now support auto-assigned ports [#33](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/33)
-   [diagram] Fix a bug where the context key for selected elements was not updated properly [#28](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/28)
-   [diagram] Implement support for `MessageAction` notifications [#35](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/35)
-   [diagram] Improve dirty state handling to also enable dirty state change evens that have not been triggered by an operation [#37](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/37)
-   [launch] Provide `NodeGlspVscodeServer` to enable direct server integration in the extension context without a dedicated server process [#38](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/37)
-   [diagram] Fixed a bug that prevented proper server-side disposal of diagram sessions [#40](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/40)
-   [API] Restructured packages to also provide a node-dependency free entry point for web-extensions ('@eclipse-glsp/vscode-integration/browser`) [#39](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/39)
-   [diagram] Add support for server progress reporting [#47](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/47)
-   [example] Add keybinding for triggering `ExportSvgAction`s [#41](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/41)

### Breaking Changes

-   [deps] Update to vscode-jsonrpc 8.0.2 & update minimum requirements for Node to >=16.11.0 [#31](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/31)
-   [launch] Refactor socket-based quickstart components to also support WebSocket connections [#37](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/37)
    -   Renamed `JavaSocketServerLaunchOptions` -> `SocketServerLaunchOptions` and removed `serverType` property
    -   Renamed `GlspServerLauncher` -> `GLSPSocketServerLauncher`
    -   Replaced `serverPort` property of `SocketGlspVscodeServerOptions` with `connectionOptions`
    -   Added `start()` and `onReady` to `GlspVscodeServer` interface
-   [API] Refactored `GlspVscodeConnector.onSelectionUpdate` event [#40](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/40)
    -   `Event<string[]>` -> `Event<{selectedElementIDs:string[], deselectedElementIDs:[]}>`
-   [API] Drop dependency to `sprotty-vscode-webview` [#36](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/36)
    -   Classes,Types and symbols provide by `sprotty-vscode-webview` are no longer exported via main index
    -   `SprottyDiagramIdentifier`->`GLSPDiagramIdentifier`
    -   `SprottyStarter`-> `GLSPStarter`
    -   `GLSPVscodeDiagramWidget`-> `GLSPDiagramWidget`
-   [API] Refactor webview communication into a `WebviewEndpoint` service and use `vscode-messenger` protocol for webview communication [#51](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/51) [#52](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/52)
    -   Extract vscode specific diagram bindings into custom feature modules
    -   Replace `GLSPVscodeExtensionHandler` with `HostExtensionHandler`

## [v1.0.0 - 30/06/2022](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v1.0.0)

### Changes

-   [example] Improved and modernized styling of the GLSP workflow example [#22](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/22)
-   [build] Updated Typescript to version 4.5.5 and enforced `noImplicitOverride` [#26](https://github.com/eclipse-glsp/glsp-vscode-integration/pull/26)

## [v0.9.0- 09/12/2021](https://github.com/eclipse-glsp/glsp-vscode-integration/releases/tag/v0.9.0)

Inception of the Eclipse VScode integration.
This project provides the glue code to integrate a GLSP diagram editor into VSCode.
This is achieved by using the VSCode extension API for creating custom editors.
