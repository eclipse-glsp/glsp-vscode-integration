/********************************************************************************
 * Copyright (c) 2021-2024 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
import {
    Action,
    ActionMessage,
    Deferred,
    EndProgressAction,
    ExportSvgAction,
    MessageAction,
    NavigateToExternalTargetAction,
    RedoAction,
    RequestModelAction,
    SaveModelAction,
    SelectAction,
    SetDirtyStateAction,
    SetMarkersAction,
    StartProgressAction,
    UndoAction,
    UpdateProgressAction
} from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';
import { Disposable } from 'vscode-jsonrpc';
import { Messenger } from 'vscode-messenger';
import { GlspVscodeClient, GlspVscodeConnectorOptions } from './types';

// eslint-disable-next-line no-shadow
export enum MessageOrigin {
    CLIENT,
    SERVER
}

export interface MessageProcessingResult {
    processedMessage: unknown;
    messageChanged: boolean;
}

export type SelectionState = Omit<SelectAction, 'kind'>;

interface ProgressReporter {
    deferred: Deferred<void>;
    progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>;
    currentPercentage?: number;
}

/**
 * The `GlspVscodeConnector` acts as the bridge between GLSP-Clients and the GLSP-Server
 * and is at the core of the Glsp-VSCode integration.
 *
 * It works by being providing a server that implements the `GlspVscodeServer`
 * interface and registering clients using the `GlspVscodeConnector.registerClient`
 * function. Messages sent between the clients and the server are then intercepted
 * by the connector to provide functionality based on the content of the messages.
 *
 * Messages can be intercepted using the interceptor properties in the options
 * argument.
 *
 * Selection updates can be listened to using the `onSelectionUpdate` property.
 */
export class GlspVscodeConnector<D extends vscode.CustomDocument = vscode.CustomDocument> implements vscode.Disposable {
    /** Maps clientId to corresponding GlspVscodeClient. */
    protected readonly clientMap = new Map<string, GlspVscodeClient<D>>();
    /** Maps Documents to corresponding clientId. */
    protected readonly documentMap = new Map<D, string>();
    /** Maps clientId to selected elementIDs for that client. */
    protected readonly clientSelectionMap = new Map<string, SelectionState>();

    protected readonly options: Required<GlspVscodeConnectorOptions>;
    protected readonly diagnostics = vscode.languages.createDiagnosticCollection();
    protected readonly selectionUpdateEmitter = new vscode.EventEmitter<SelectionState>();
    protected readonly onDocumentSavedEmitter = new vscode.EventEmitter<D>();
    protected readonly onDidChangeCustomDocumentEventEmitter = new vscode.EventEmitter<
        vscode.CustomDocumentEditEvent<D> | vscode.CustomDocumentContentChangeEvent<D>
    >();
    protected readonly disposables: vscode.Disposable[] = [];
    protected readonly progressReporters: Map<string, ProgressReporter> = new Map();
    readonly messenger = new Messenger();

    /**
     * A subscribable event which fires with an array containing the IDs of all
     * selected  & deselected elements when the selection of the editor changes.
     */
    public onSelectionUpdate: vscode.Event<SelectionState>;

    /**
     * A subscribable event which fires when a document changed. The event body
     * will contain that document. Use this event for the `onDidChangeCustomDocument`
     * on your implementation of the `CustomEditorProvider`.
     */
    get onDidChangeCustomDocument():
        | vscode.Event<vscode.CustomDocumentEditEvent<D>>
        | vscode.Event<vscode.CustomDocumentContentChangeEvent<D>> {
        return this.onDidChangeCustomDocumentEventEmitter.event;
    }

    constructor(options: GlspVscodeConnectorOptions) {
        // Create default options
        this.options = {
            logging: false,
            onBeforeReceiveMessageFromClient: (message, callback) => {
                callback(message, true);
            },
            onBeforeReceiveMessageFromServer: (message, callback) => {
                callback(message, true);
            },
            onBeforePropagateMessageToClient: (_originalMessage, processedMessage) => processedMessage,
            onBeforePropagateMessageToServer: (_originalMessage, processedMessage) => processedMessage,
            ...options
        };

        this.onSelectionUpdate = this.selectionUpdateEmitter.event;

        // Set up message listener for server
        const serverMessageListener = this.options.server.onServerMessage(message => {
            if (this.options.logging) {
                if (ActionMessage.is(message)) {
                    console.log(`Server (${message.clientId}): ${message.action.kind}`, message.action);
                } else {
                    console.log('Server (no action message):', message);
                }
            }

            // Run message through first user-provided interceptor (pre-receive)
            this.options.onBeforeReceiveMessageFromServer(message, (newMessage, shouldBeProcessedByConnector = true) => {
                const { processedMessage, messageChanged } = shouldBeProcessedByConnector
                    ? this.processMessage(newMessage, MessageOrigin.SERVER)
                    : { processedMessage: message, messageChanged: false };

                // Run message through second user-provided interceptor (pre-send) - processed
                const filteredMessage = this.options.onBeforePropagateMessageToClient(newMessage, processedMessage, messageChanged);
                if (typeof filteredMessage !== 'undefined' && ActionMessage.is(filteredMessage)) {
                    this.sendMessageToClient(filteredMessage.clientId, filteredMessage);
                }
            });
        });

        this.disposables.push(this.diagnostics, this.selectionUpdateEmitter, serverMessageListener);
    }

    /**
     * Register a client on the GLSP-VSCode connector. All communication will subsequently
     * run through the VSCode integration. Clients do not need to be unregistered
     * as they are automatically disposed of when the panel they belong to is closed.
     *
     * @param client The client to register.
     *
     */
    public async registerClient(client: GlspVscodeClient<D>): Promise<void> {
        const toDispose: Disposable[] = [
            Disposable.create(() => {
                this.diagnostics.set(client.document.uri, undefined); // this clears the diagnostics for the file
                this.clientMap.delete(client.clientId);
                this.documentMap.delete(client.document);
                this.clientSelectionMap.delete(client.clientId);
            })
        ];
        // Cleanup when client panel is closed
        const panelOnDisposeListener = client.webviewEndpoint.webviewPanel.onDidDispose(async () => {
            toDispose.forEach(disposable => disposable.dispose());
            panelOnDisposeListener.dispose();
        });

        this.clientMap.set(client.clientId, client);
        this.documentMap.set(client.document, client.clientId);

        toDispose.push(
            client.webviewEndpoint.onActionMessage(message => {
                if (this.options.logging) {
                    if (ActionMessage.is(message)) {
                        console.log(`Client (${message.clientId}): ${message.action.kind}`, message.action);
                    } else {
                        console.log('Client (no action message):', message);
                    }
                }

                // Run message through first user-provided interceptor (pre-receive)
                this.options.onBeforeReceiveMessageFromClient(message, (newMessage, shouldBeProcessedByConnector = true) => {
                    const { processedMessage, messageChanged } = shouldBeProcessedByConnector
                        ? this.processMessage(newMessage, MessageOrigin.CLIENT)
                        : { processedMessage: message, messageChanged: false };

                    const filteredMessage = this.options.onBeforePropagateMessageToServer(newMessage, processedMessage, messageChanged);

                    if (typeof filteredMessage !== 'undefined') {
                        this.options.server.onSendToServerEmitter.fire(filteredMessage);
                    }
                });
            })
        );

        toDispose.push(
            client.webviewEndpoint.webviewPanel.onDidChangeViewState(e => {
                if (e.webviewPanel.active) {
                    this.selectionUpdateEmitter.fire(
                        this.clientSelectionMap.get(client.clientId) || { selectedElementsIDs: [], deselectedElementsIDs: [] }
                    );
                }
            })
        );

        // Initialize glsp client
        const glspClient = await this.options.server.glspClient;
        toDispose.push(client.webviewEndpoint.initialize(glspClient));
        toDispose.unshift(Disposable.create(() => glspClient.disposeClientSession({ clientSessionId: client.clientId })));
    }

    /**
     * Send message to registered client by id.
     * Note that this method does not consider server-handled actions.
     * If you want to send an action that is potentially handled by both sides, use {@link dispatchAction} instead.
     *
     * @param clientId Id of client.
     * @param message Message to send.
     */
    protected sendMessageToClient(clientId: string, message: unknown): void {
        const client = this.clientMap.get(clientId);
        if (client && ActionMessage.is(message)) {
            client.webviewEndpoint.sendMessage(message);
        }
    }

    /**
     * Send action to registered client by id.
     *
     * @param clientId Id of client.
     * @param action Action to send.
     *
     * @deprecated Use  {@link dispatchAction} instead.
     */
    protected sendActionToClient(clientId: string, action: Action): void {
        this.dispatchAction(action, clientId);
    }

    /**
     * Send an action to the client/panel that is currently focused. If no registered
     * panel is focused, the message will not be sent.
     *
     * @param action The action to send to the active client.
     * @deprecated Use {@link dispatchAction} instead.
     */
    public sendActionToActiveClient(action: Action): void {
        this.dispatchAction(action);
    }

    /**
     * Dispatches an action associated with the given client id. If no id is provided,
     * the action will be dispatched associated with the client of the active webview panel.
     * If no client id is passed and no registered panel is focused, the action will not be dispatched.
     * Dispatching an action will send the action to the client and/or server if
     * they can handle the action.
     * @param action The action to dispatch.
     * @param clientId The id of the client/session associated with the action.
     */
    dispatchAction(action: Action, clientId?: string): void {
        const client = clientId ? this.clientMap.get(clientId) : this.getActiveClient();
        if (!client) {
            console.warn('Could not dispatch action: No client found for clientId or no active client found.', action);
            return;
        }
        const message = { clientId: client.clientId, action };
        if (client.webviewEndpoint.clientActions?.includes(action.kind)) {
            client.webviewEndpoint.sendMessage(message);
        }
        if (client.webviewEndpoint.serverActions?.includes(action.kind)) {
            this.options.server.onSendToServerEmitter.fire(message);
        }
    }

    /**
     * Returns the currently active {@link GlspVscodeClient} i.e. the client whose webview panel is currently focused.
     * If no registered panel is focused, the method will return `undefined`.
     * @returns The active client or `undefined` if no client is active.
     */
    protected getActiveClient(): GlspVscodeClient<D> | undefined {
        for (const client of this.clientMap.values()) {
            if (client.webviewEndpoint.webviewPanel.active) {
                return client;
            }
        }
        return undefined;
    }

    /**
     * Provides the functionality of the VSCode integration.
     *
     * Incoming messages (unless intercepted) will run through this function and
     * be acted upon by providing default functionality for VSCode.
     *
     * @param message The original received message.
     * @param origin The origin of the received message.
     * @returns An object containing the processed message and an indicator wether
     * the message was modified.
     */
    protected processMessage(message: unknown, origin: MessageOrigin): MessageProcessingResult {
        if (ActionMessage.is(message)) {
            const client = this.clientMap.get(message.clientId);

            // server message
            if (MessageAction.is(message.action)) {
                return this.handleMessageAction(message as ActionMessage<MessageAction>, client, origin);
            }

            // progress reporting
            if (StartProgressAction.is(message.action)) {
                return this.handleStartProgressAction(message as ActionMessage<StartProgressAction>, client, origin);
            }
            if (UpdateProgressAction.is(message.action)) {
                return this.handleUpdateProgressAction(message as ActionMessage<UpdateProgressAction>, client, origin);
            }
            if (EndProgressAction.is(message.action)) {
                return this.handleEndProgressAction(message as ActionMessage<EndProgressAction>, client, origin);
            }

            // Dirty state & save actions
            if (SetDirtyStateAction.is(message.action)) {
                return this.handleSetDirtyStateAction(message as ActionMessage<SetDirtyStateAction>, client, origin);
            }

            // Diagnostic actions
            if (SetMarkersAction.is(message.action)) {
                return this.handleSetMarkersAction(message as ActionMessage<SetMarkersAction>, client, origin);
            }

            // External targets action
            if (NavigateToExternalTargetAction.is(message.action)) {
                return this.handleNavigateToExternalTargetAction(message as ActionMessage<NavigateToExternalTargetAction>, client, origin);
            }

            // Selection action
            if (SelectAction.is(message.action)) {
                return this.handleSelectAction(message as ActionMessage<SelectAction>, client, origin);
            }

            // Export SVG action
            if (ExportSvgAction.is(message.action)) {
                return this.handleExportSvgAction(message as ActionMessage<ExportSvgAction>, client, origin);
            }
        }

        // Propagate unchanged message
        return { processedMessage: message, messageChanged: false };
    }

    protected handleMessageAction(
        message: ActionMessage<MessageAction>,
        _client: GlspVscodeClient<D> | undefined,
        _origin: MessageOrigin
    ): MessageProcessingResult {
        if (message.action.severity === 'ERROR') {
            vscode.window.showErrorMessage(message.action.message);
        } else if (message.action.severity === 'WARNING') {
            vscode.window.showWarningMessage(message.action.message);
        } else if (message.action.severity === 'INFO') {
            vscode.window.showInformationMessage(message.action.message);
        }

        // Do not propagate action
        return { processedMessage: undefined, messageChanged: true };
    }

    protected handleStartProgressAction(
        actionMessage: ActionMessage<StartProgressAction>,
        client: GlspVscodeClient<D> | undefined,
        origin: MessageOrigin
    ): MessageProcessingResult {
        if (client) {
            const { progressId, title, message, percentage } = actionMessage.action;
            const initialPercentage = (percentage ?? -1) >= 0 ? percentage : undefined;
            const deferred = new Deferred<void>();
            const location = vscode.ProgressLocation.Notification;
            vscode.window.withProgress({ title, location }, progress => {
                const reporterId = this.progressReporterId(client, progressId);
                this.progressReporters.set(reporterId, { deferred, progress, currentPercentage: initialPercentage });
                progress.report({ message, increment: percentage });
                return deferred.promise;
            });
        }

        // Do not propagate action
        return { processedMessage: undefined, messageChanged: true };
    }

    protected handleUpdateProgressAction(
        actionMessage: ActionMessage<UpdateProgressAction>,
        client: GlspVscodeClient<D> | undefined,
        origin: MessageOrigin
    ): MessageProcessingResult {
        if (client) {
            const { progressId, message, percentage } = actionMessage.action;
            const reporterId = this.progressReporterId(client, progressId);
            const reporter = this.progressReporters.get(reporterId);
            if (reporter) {
                const currentPercentage = reporter.currentPercentage ?? 0;
                const newPercentage = (percentage ?? -1) >= 0 ? percentage : undefined;
                const increment = newPercentage ? newPercentage - currentPercentage : undefined;
                reporter.progress.report({ message, increment });
                if (newPercentage) {
                    reporter.currentPercentage = newPercentage;
                }
            }
        }

        // Do not propagate action
        return { processedMessage: undefined, messageChanged: true };
    }

    protected handleEndProgressAction(
        actionMessage: ActionMessage<EndProgressAction>,
        client: GlspVscodeClient<D> | undefined,
        origin: MessageOrigin
    ): MessageProcessingResult {
        if (client) {
            const { progressId } = actionMessage.action;
            const reporterId = this.progressReporterId(client, progressId);
            const reporter = this.progressReporters.get(reporterId);
            if (reporter) {
                reporter.deferred.resolve();
                this.progressReporters.delete(reporterId);
            }
        }

        // Do not propagate action
        return { processedMessage: undefined, messageChanged: true };
    }

    protected progressReporterId(client: GlspVscodeClient<D>, progressId: string): string {
        return `${client.clientId}_${progressId}`;
    }

    protected handleSetDirtyStateAction(
        message: ActionMessage<SetDirtyStateAction>,
        client: GlspVscodeClient<D> | undefined,
        _origin: MessageOrigin
    ): MessageProcessingResult {
        // The webview client cannot handle `SetDirtyStateAction`s. Avoid propagation
        const result = { processedMessage: message, messageChanged: false };

        if (client) {
            const reason = message.action.reason;
            if (reason === 'undo' || reason === 'redo') {
                return result;
            }
            if (reason === 'save') {
                this.onDocumentSavedEmitter.fire(client.document);
            } else if (reason === 'operation' && message.action.isDirty) {
                this.onDidChangeCustomDocumentEventEmitter.fire({
                    document: client.document,
                    undo: () => {
                        this.dispatchAction(UndoAction.create(), client.clientId);
                    },
                    redo: () => {
                        this.dispatchAction(RedoAction.create(), client.clientId);
                    }
                });
            } else if (message.action.isDirty) {
                this.onDidChangeCustomDocumentEventEmitter.fire({ document: client.document });
            }
        }

        return result;
    }

    protected handleSetMarkersAction(
        message: ActionMessage<SetMarkersAction>,
        client: GlspVscodeClient<D> | undefined,
        _origin: MessageOrigin
    ): MessageProcessingResult {
        if (client) {
            const severityMap = new Map<string, vscode.DiagnosticSeverity>();
            severityMap.set('info', vscode.DiagnosticSeverity.Information);
            severityMap.set('warning', vscode.DiagnosticSeverity.Warning);
            severityMap.set('error', vscode.DiagnosticSeverity.Error);

            const updatedDiagnostics = message.action.markers.map(
                marker =>
                    new vscode.Diagnostic(
                        new vscode.Range(0, 0, 0, 0), // Must have be defined as such - no workarounds
                        marker.description,
                        severityMap.get(marker.kind)
                    )
            );

            this.diagnostics.set(client.document.uri, updatedDiagnostics);
        }

        // Propagate unchanged message
        return { processedMessage: message, messageChanged: false };
    }

    protected handleNavigateToExternalTargetAction(
        message: ActionMessage<NavigateToExternalTargetAction>,
        _client: GlspVscodeClient<D> | undefined,
        _origin: MessageOrigin
    ): MessageProcessingResult {
        const SHOW_OPTIONS = 'jsonOpenerOptions';
        const { uri, args } = message.action.target;
        let showOptions = { ...args };

        // Give server the possibility to provide options through the `showOptions` field by providing a
        // stringified version of the `TextDocumentShowOptions`
        // See: https://code.visualstudio.com/api/references/vscode-api#TextDocumentShowOptions
        const showOptionsField = args?.[SHOW_OPTIONS];
        if (showOptionsField) {
            showOptions = { ...args, ...JSON.parse(showOptionsField.toString()) };
        }

        vscode.window.showTextDocument(vscode.Uri.parse(uri), showOptions).then(
            () => undefined, // onFulfilled: Do nothing.
            () => undefined // onRejected: Do nothing - This is needed as error handling in case the navigationTarget does not exist.
        );

        // Do not propagate action
        return { processedMessage: undefined, messageChanged: true };
    }

    protected handleSelectAction(
        message: ActionMessage<SelectAction>,
        client: GlspVscodeClient<D> | undefined,
        origin: MessageOrigin
    ): MessageProcessingResult {
        if (client) {
            this.clientSelectionMap.set(client.clientId, message.action);
            this.selectionUpdateEmitter.fire(message.action);
        }

        if (origin === MessageOrigin.CLIENT) {
            // eslint-disable-next-line max-len
            // Do not propagate action if it comes from client to avoid an infinite loop, as both, client and server will mirror the Selection action
            return { processedMessage: undefined, messageChanged: true };
        } else {
            // Propagate unchanged message
            return { processedMessage: message, messageChanged: false };
        }
    }

    protected handleExportSvgAction(
        message: ActionMessage<ExportSvgAction>,
        _client: GlspVscodeClient<D> | undefined,
        _origin: MessageOrigin
    ): MessageProcessingResult {
        vscode.window
            .showSaveDialog({
                filters: { SVG: ['svg'] },
                saveLabel: 'Export',
                title: 'Export as SVG'
            })
            .then((uri: vscode.Uri | undefined) => {
                if (uri) {
                    const content = new TextEncoder().encode(message.action.svg);
                    vscode.workspace.fs.writeFile(uri, content).then(undefined, err => {
                        if (err) {
                            console.error(err);
                        }
                    });
                }
            }, console.error);

        // Do not propagate action to avoid an infinite loop, as both, client and server will mirror the Export SVG action
        return { processedMessage: undefined, messageChanged: true };
    }

    /**
     * Saves a document. Make sure to call this function in the `saveCustomDocument`
     * and `saveCustomDocumentAs` functions of your `CustomEditorProvider` implementation.
     *
     * @param document The document to save.
     * @param destination Optional parameter. When this parameter is provided the
     * file will instead be saved at this location.
     * @returns A promise that resolves when the file has been successfully saved.
     */
    public async saveDocument(document: D, destination?: vscode.Uri): Promise<void> {
        const clientId = this.documentMap.get(document);
        if (clientId) {
            return new Promise<void>(resolve => {
                const listener = this.onDocumentSavedEmitter.event(savedDocument => {
                    if (document === savedDocument) {
                        listener.dispose();
                        resolve();
                    }
                });
                this.dispatchAction(SaveModelAction.create({ fileUri: destination?.path }), clientId);
            });
        } else {
            if (this.options.logging) {
                console.error('Saving failed: Document not registered');
            }
            throw new Error('Saving failed.');
        }
    }

    /**
     * Reverts a document. Make sure to call this function in the `revertCustomDocument`
     * functions of your `CustomEditorProvider` implementation.
     *
     * @param document Document to revert.
     * @param diagramType Diagram type as it is configured on the server.
     * @returns A promise that resolves when the file has been successfully reverted.
     */
    public async revertDocument(document: D, diagramType: string): Promise<void> {
        const clientId = this.documentMap.get(document);
        if (clientId) {
            const client = this.clientMap.get(clientId);
            if (client?.webviewEndpoint.webviewPanel.active) {
                this.dispatchAction(
                    RequestModelAction.create({
                        options: {
                            sourceUri: document.uri.toString(),
                            diagramType
                        }
                    }),
                    clientId
                );
            }
        } else {
            if (this.options.logging) {
                console.error('Backup failed: Document not registered');
            }
            throw new Error('Backup failed.');
        }
    }

    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
    }
}
