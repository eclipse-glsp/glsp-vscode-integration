# Eclipse GLSP VSCode Integration
This package contains the glue code for integrating [GLSP](https://www.eclipse.org/glsp/)
diagrams in VS Code. This library enables the implementation of GLSP Diagram editors
for VS Code base on the [Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors).

## Where to find the sources?
In addition to this repository, the related source code can be found here:

-   https://github.com/eclipse-glsp/glsp-server
-   https://github.com/eclipse-glsp/glsp-client

## Getting started
This section will show you how to get your first GLPS extension up and running using
the *GLSP VSCode Integration*.

### Example Extension
You can find a complete example extension that uses this package
[here](https://github.com/eclipse-glsp/glsp-vscode-integration/tree/master/example/workflow).
It makes heavy use of default implementations like the default GLSP server, the
default GLSP client and the default GLSP Sprotty client.

### Example Code
There are a few steps that are absolutely necessary for the GLSP VSCode Integration
to work. They are outlined in this section.

#### Extension
First you need to set up your extension starter code. This is done by setting the
`"main"` field of your `package.json` to the entry point of your extension and exporting
an `activate()` function from that file. For more information on how to set up your
VSCode extension please visit https://code.visualstudio.com/api.

<details><summary>Code Example</summary>

```typescript
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Your extension code here.
}
```
</details>

#### Server
Next we will start a GLSP server from within the activate function. If you have
already have the server running through some other process you can skip this step.

If you are using the default GLSP server implementation provided at https://github.com/eclipse-glsp/glsp-server,
you can use the `GlspServerLauncher` [quickstart component](#Quickstart-Components)
to start the server with very little code:

<details><summary>Code Example</summary>

```typescript
import { GlspServerLauncher } from '@eclipse-glsp/vscode-integration/lib/quickstart-components';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const serverProcess = new GlspServerLauncher({
        jarPath: '/your/path/to/server.jar',
        serverPort: 5007
    });
    context.subscriptions.push(serverProcess);
    await serverProcess.start();
}
```
</details>

#### Server Interface and GLSP VSCode Connector
A connector class is needed to provide an interface for the *GLSP VSCode integration*
to communicate with the server. If you are using the default GLSP server which communicates
over JSON-RPC, you can make use of the `SocketGlspVscodeServer` [quickstart component](#Quickstart-Components)
to implement the needed interface with very little boilerplate code.

If we have a server component providing the needed interface we can create an instance
of the `GlspVscodeConnector` and pass the server component. The `GlspVscodeConnector`
lies at the core of this package and provides all the needed functionality.

<details><summary>Code Example</summary>

```typescript
import { GlspVscodeConnector } from '@eclipse-glsp/vscode-integration';
import { SocketGlspVscodeServer } from '@eclipse-glsp/vscode-integration/lib/quickstart-components';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // (Server startup code from above here...)

    const workflowServer = new SocketGlspVscodeServer({
        clientId: 'some.client.id',
        clientName: 'SomeClientName',
        serverPort: 5007
    });

    const glspVscodeConnector = new GlspVscodeConnector({ server: workflowServer });

    context.subscriptions.push(workflowServer, glspVscodeConnector)
}
```
</details>

#### Custom Editor Provider
In order to have a custom editor in VSCode a component implementing the `vscode.CustomEditorProvider`
needs to be registered from within the extension (more information on custom editors
[here](https://code.visualstudio.com/api/extension-guides/custom-editors)).

The GLSP VSCode integration package gives you free reign over how you implement
your `CustomEditorProvider`, however a few function calls at certain places are
needed for the integration to work properly:

- The `onDidChangeCustomDocument` of your `CustomEditorProvider` should always fire
  at least when `GlspVscodeConnector.onDidChangeCustomDocument` fires.
- `GlspVscodeConnector.saveDocument(document)` should be called when `CustomEditorProvider.saveCustomDocument`
  is called.
- `GlspVscodeConnector.saveDocument(document, destination)` should be called when
  `CustomEditorProvider.saveCustomDocumentAs` is called.
- `GlspVscodeConnector.revertDocument()` should be called when `CustomEditorProvider.revertCustomDocument`
  is called.

You can use the `GlspEditorProvider` [quickstart component](#Quickstart-Components)
to set up such an editor provider without much boilerplate code.

If you chose to create a `CustomEditorProvider` yourself, the `resolveCustomEditor`
function of the `CustomEditorProvider` act as an excellent place to register your
GLSP clients. You can do this with the `GlspVscodeConnector.registerClient(client)`
function. You are free to choose on how your clients implement the needed interface,
however if you need inspiration on how to do it with the default GLSP components,
you can take a look at the example
[here](https://github.com/eclipse-glsp/glsp-vscode-integration/tree/master/example/workflow).

<details><summary>Code Example</summary>

```typescript
import MyCustomEditorProvider from './my-custom-editor-provider.ts';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // (Server startup code from above here...)
    // (GlspVscodeConnector code from above here...)

    const customEditorProvider = vscode.window.registerCustomEditorProvider(
        'your.custom.editor',
        new MyCustomEditorProvider(glspVscodeConnector),
        {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false
        }
    );

    context.subscriptions.push(customEditorProvider);
}
```

```typescript
// my-custom-editor-provider.ts
export default class WorkflowEditorProvider implements vscode.CustomEditorProvider {

    onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentContentChangeEvent<vscode.CustomDocument>>;

    constructor(
        private readonly glspVscodeConnector: GlspVscodeConnector
    ) {
        this.onDidChangeCustomDocument = glspVscodeConnector.onDidChangeCustomDocument; // necessary
    }

    // (Any other methods needed for the vscode.CustomEditorProvider interface here.)

    saveCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        return this.glspVscodeConnector.saveDocument(document); // necessary
    }

    saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
        return this.glspVscodeConnector.saveDocument(document, destination); // necessary
    }

    revertCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        return this.glspVscodeConnector.revertDocument(document, 'your.diagram.type'); // necessary
    }

    resolveCustomEditor(document:
        vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): void | Thenable<void> {

        const onSendToClientEmitter = new vscode.EventEmitter<unknown>();
        const onClientMessage = new vscode.EventEmitter<unknown>();

        // (Your code to send event content to webview here using onSendToClientEmitter.)
        // (Your code to emit messages from client with onClientSendEmitter.)

        this.glspVscodeConnector.registerClient({
            clientId: 'your.glsp.client.id.here', // Should be different each time resolve custom Editor is called - must be equal to the ids the client will send in its messages
            document: document,
            webviewPanel: webviewPanel,
            onClientMessage: onClientSendEmitter.event,
            onSendToClientEmitter: onSendToClientEmitter
        });

        webviewPanel.webview.html = `(Your webview HTML here)`;
    }
}
```
</details>

#### Final touches
All that's left to do is a final call to start the server and the extension
should be up and running.

<details><summary>Code Example</summary>

```typescript

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // (Server startup code from above here...)
    // (GlspVscodeConnector code from above here...)
    // (CustomEditorProvider code from above here...)

    workflowServer.start();
}
```
</details>

## API
This package exports a number of members, the most important one being the `GlspVscodeConnector`-Class.

### GlspVscodeConnector
This is the core of the VSCode integration and provides various functionality. It
primarily intercepts certain GLSP Actions sent from the clients or server to trigger
VSCode specific contributions. This currently includes:

- File dirty state
- File "Save" and "Save as..."
- File reverting
- Diagnostics or "markers" and "validations"
- External target navigation
- Exporting as SVG (with dialog window)
- Providing element selection context to extensions

#### Options
The `GlspVscodeConnector` takes one constructor argument - an object containing its configuration.

```typescript
export interface GlspVscodeConnectorOptions {

    /**
     * The GLSP server (or its wrapper) that the VSCode integration should use.
     */
    server: GlspVscodeServer;

    /**
     * Wether the GLSP-VSCode integration should log various events. This is useful
     * if you want to find out what events the VSCode integration is receiving from
     * and sending to the server and clients.
     *
     * Defaults to `false`.
     */
    logging?: boolean;

    /**
     * Optional property to intercept (and/or modify) messages sent from the client
     * to the VSCode integration via `GlspVscodeClient.onClientSend`.
     *
     * @param message Contains the original message sent by the client.
     * @param callback A callback to control how messages are handled further.
     */
    onBeforeReceiveMessageFromClient?: (message: unknown, callback: InterceptorCallback) => void;

    /**
     * Optional property to intercept (and/or modify) messages sent from the server
     * to the VSCode integration via `GlspVscodeServer.onServerSend`.
     *
     * @param message Contains the original message sent by the client.
     * @param callback A callback to control how messages are handled further.
     */
    onBeforeReceiveMessageFromServer?(message: unknown, callback: InterceptorCallback): void;

    /**
     * Optional property to intercept (and/or modify) messages sent from the VSCode
     * integration to the server via the `GlspVscodeServer.onServerReceiveEmitter`.
     *
     * The returned value from this function is the message that will be propagated
     * to the server. It can be modified to anything. Returning `undefined` will
     * cancel the propagation.
     *
     * @param originalMessage The original message received by the VSCode integration
     * from the client.
     * @param processedMessage If the VSCode integration modified the received message
     * in any way, this parameter will contain the modified message. If the VSCode
     * integration did not modify the message, this parameter will be identical to
     * `originalMessage`.
     * @param messageChanged This parameter will indicate wether the VSCode integration
     * modified the incoming message. In other words: Whether `originalMessage`
     * and `processedMessage` are different.
     * @returns A message that will be propagated to the server. If the message
     * is `undefined` the propagation will be cancelled.
     */
    onBeforePropagateMessageToServer?(
        originalMessage: unknown, processedMessage: unknown, messageChanged: boolean
    ): unknown | undefined;

    /**
     * Optional property to intercept (and/or modify) messages sent from the VSCode
     * integration to a client via the `GlspVscodeClient.onClientReceiveEmitter`.
     *
     * The returned value from this function is the message that will be propagated
     * to the client. It can be modified to anything. Returning `undefined` will
     * cancel the propagation.
     *
     * @param originalMessage The original message received by the VSCode integration
     * from the server.
     * @param processedMessage If the VSCode integration modified the received message
     * in any way, this parameter will contain the modified message. If the VSCode
     * integration did not modify the message, this parameter will be identical to
     * `originalMessage`.
     * @param messageChanged This parameter will indicate wether the VSCode integration
     * modified the incoming message. In other words: Whether `originalMessage`
     * and `processedMessage` are different.
     * @returns A message that will be propagated to the client. If the message
     * is `undefined` the propagation will be cancelled.
     */
    onBeforePropagateMessageToClient?(
        originalMessage: unknown, processedMessage: unknown, messageChanged: boolean
    ): unknown | undefined;
}
```

#### Methods and Fields

```typescript
interface GlspVscodeConnector<D extends vscode.CustomDocument = vscode.CustomDocument> extends vscode.Disposable {

  /**
   * A subscribable event which fires with an array containing the IDs of all
   * selected elements when the selection of the editor changes.
   */
  onSelectionUpdate: vscode.Event<string[]>;

  /**
   * A subscribable event which fires when a document changed. The event body
   * will contain that document. Use this event for the onDidChangeCustomDocument
   * on your implementation of the `CustomEditorProvider`.
   */
  onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentEditEvent<D>>;

  /**
   * Register a client on the GLSP-VSCode connector. All communication will subsequently
   * run through the VSCode integration. Clients do not need to be unregistered
   * as they are automatically disposed of when the panel they belong to is closed.
   *
   * @param client The client to register.
   */
  registerClient(client: GlspVscodeClient<D>): void;

  /**
   * Send an action to the client/panel that is currently focused. If no registered
   * panel is focused, the message will not be sent.
   *
   * @param action The action to send to the active client.
   */
  sendActionToActiveClient(action: Action): void;

  /**
   * Saves a document. Make sure to call this function in the `saveCustomDocument`
   * and `saveCustomDocumentAs` functions of your `CustomEditorProvider` implementation.
   *
   * @param document The document to save.
   * @param destination Optional parameter. When this parameter is provided the
   * file will instead be saved at this location.
   * @returns A promise that resolves when the file has been successfully saved.
   */
  async saveDocument(document: D, destination?: vscode.Uri): Promise<void>;

  /**
   * Reverts a document. Make sure to call this function in the `revertCustomDocument`
   * functions of your `CustomEditorProvider` implementation.
   *
   * @param document Document to revert.
   * @param diagramType Diagram type as it is configured on the server.
   * @returns A promise that resolves when the file has been successfully reverted.
   */
   async revertDocument(document: D, diagramType: string): Promise<void>;
}
```

### GlspVscodeServer

```typescript
/**
 * The server or server wrapper used by the VSCode integration needs to implement
 * this interface.
 */
export interface GlspVscodeServer {

    /**
     * An event emitter used by the VSCode extension to send messages to the server.
     *
     * You should subscribe to the event attached to this emitter to receive messages
     * from the client/VSCode integration and pass them to the server.
     *
     * Use the properties `onBeforeReceiveMessageFromClient` and `onBeforePropagateMessageToServer`
     * of the GlspVscodeConnector in order to control what messages are propagated
     * and processed.
     */
    readonly onSendToServerEmitter: vscode.EventEmitter<unknown>;

    /**
     * An event the VSCode integration uses to receive messages from the server.
     * The messages are then propagated to the client or processed by the VSCode
     * integration to provide functionality.
     *
     * Fire this event with the message the server wants to send to the client.
     *
     * Use the properties `onBeforeReceiveMessageFromServer` and `onBeforePropagateMessageToClient`
     * of the GlspVscodeConnector in order to control what messages are propagated
     * and processed.
     */
    readonly onServerMessage: vscode.Event<unknown>;
}
```

### GlspVscodeClient

```typescript
/**
 * Any clients registered on the GLSP VSCode integration need to implement this
 * interface.
 */
export interface GlspVscodeClient<D extends vscode.CustomDocument = vscode.CustomDocument> {

    /**
     * A unique identifier for the client/panel with which the client will be registered
     * on the server.
     */
    readonly clientId: string;

    /**
     * The webview belonging to the client.
     */
    readonly webviewPanel: vscode.WebviewPanel;

    /**
     * The document object belonging to the client;
     */
    readonly document: D;

    /**
     * This event emitter is used by the VSCode integration to pass messages/actions
     * to the client. These messages can come from the server or the VSCode integration
     * itself.
     *
     * You should subscribe to the attached event and pass contents of the event
     * to the webview.
     *
     * Use the properties `onBeforeReceiveMessageFromServer` and `onBeforePropagateMessageToClient`
     * of the GlspVscodeConnector in order to control what messages are propagated
     * and processed.
     */
    readonly onSendToClientEmitter: vscode.EventEmitter<unknown>;

    /**
     * The VSCode integration will subscribe to this event to listen to messages
     * from the client.
     *
     * Fire this event with the message the client wants to send to the server.
     *
     * Use the properties `onBeforeReceiveMessageFromClient` and `onBeforePropagateMessageToServer`
     * of the GlspVscodeConnector in order to control what messages are propagated
     * and processed.
     */
    readonly onClientMessage: vscode.Event<unknown>;
}
```

### Quickstart Components
This package also exposes components which can be taken advantage of if you are using the default GLSP components.

They can be imported using

```ts
import * as QuickstartComponents from '@eclipse-glsp/vscode-integration/lib/quickstart-components';
```

#### GlspServerLauncher
A small class used to start a default implementation GLSP server.

```ts
interface GlspServerLauncher extends vscode.Disposable {
    constructor(options: JavaSocketServerLauncherOptions);

    /**
     * Starts up the server.
     */
    async start(): Promise<void>;

    /**
     * Stops the server.
     */
    stop(): void;
}

interface JavaSocketServerLauncherOptions {
    /** Path to the location of the jar file that should be launched as process */
    readonly jarPath: string;
    /** Port on which the server should listen for new client connections */
    readonly serverPort: number;
    /** Set to `true` if server stdout and stderr should be printed in extension host console. Default: `false` */
    readonly logging?: boolean;
    /** Additional arguments that should be passed when starting the server process. */
    readonly additionalArgs?: string[];
}
```

#### SocketGlspVscodeServer
A can component that provides the right interface for the GLSP VSCode integration
to be used as server and which can connect to a default implementation GLSP server.

```ts
interface SocketGlspVscodeServerOptions {
    /** Port of the running server. */
    readonly serverPort: number;
    /** Client ID to register the jsonRPC client with on the server. */
    readonly clientId: string;
    /** Name to register the client with on the server. */
    readonly clientName: string;
}

interface SocketGlspVscodeServer extends GlspVscodeServer, vscode.Disposable {

    constructor(private readonly options: SocketGlspVscodeServerOptions);

    /**
     * Starts up the JSON-RPC client and connects it to a running server.
     */
    async start(): Promise<void>;

    /**
     * Stops the client. It cannot be restarted.
     */
    async stop(): Promise<void>;
}
```

#### GlspEditorProvider
An extensible base class to create a CustomEditorProvider that takes care of diagram
initialization and custom document events.

Webview setup needs to be implemented.

```ts
export abstract class GlspEditorProvider implements vscode.CustomEditorProvider {
    /**
     * The diagram type identifier the diagram server is responsible for.
     */
    abstract diagramType: string;

    constructor(protected readonly glspVscodeConnector: GlspVscodeConnector);

    /**
     * Used to set up the webview within the webview panel.
     */
    abstract setUpWebview(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken,
        clientId: string
    ): void;
}
```

## More information
For more information, please visit the [Eclipse GLSP Umbrella repository](https://github.com/eclipse-glsp/glsp)
and the [Eclipse GLSP Website](https://www.eclipse.org/glsp/). If you have questions,
contact us on our [spectrum chat](https://spectrum.chat/glsp/) and have a look at our
[communication and support options](https://www.eclipse.org/glsp/contact/).
