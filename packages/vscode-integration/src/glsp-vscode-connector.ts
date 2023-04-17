/********************************************************************************
 * Copyright (c) 2021-2022 EclipseSource and others.
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
    ExportSvgAction,
    InitializeClientSessionParameters,
    InitializeResult,
    NavigateToExternalTargetAction,
    RedoAction,
    RequestModelAction,
    SaveModelAction,
    SelectAction,
    SetDirtyStateAction,
    SetMarkersAction,
    UndoAction
} from '@eclipse-glsp/protocol';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { GlspVscodeClient, GlspVscodeConnectorOptions } from './types';
import { isActionMessage, SUBCLIENT_HOST_ID } from './action-types';

// eslint-disable-next-line no-shadow
export enum MessageOrigin {
    CLIENT,
    SERVER
}

export interface MessageProcessingResult {
    processedMessage: unknown;
    messageChanged: boolean;
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
    /** Can be returned as processedMessage of {@link MessageProcessingResult} to indicate that the message
     * should not be propagated to the webview GLSP client
     */
    static NO_PROPAGATION_MESSAGE = 'NO_PROPAGATION_MESSAGE';
    /** Maps clientId to corresponding GlspVscodeClient. */
    protected readonly clientMap = new Map<string, GlspVscodeClient<D>>();
    /** Maps Documents to corresponding clientId. */
    protected readonly documentMap = new Map<D, string>();
    /** Maps clientId to selected elementIDs for that client. */
    protected readonly clientSelectionMap = new Map<string, string[]>();

    protected readonly options: Required<GlspVscodeConnectorOptions>;
    protected readonly diagnostics = vscode.languages.createDiagnosticCollection();
    protected readonly selectionUpdateEmitter = new vscode.EventEmitter<string[]>();
    protected readonly onDocumentSavedEmitter = new vscode.EventEmitter<D>();
    protected readonly onDidChangeCustomDocumentEventEmitter = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<D>>();
    protected readonly disposables: vscode.Disposable[] = [];

    /**
     * A subscribable event which fires with an array containing the IDs of all
     * selected elements when the selection of the editor changes.
     */
    public onSelectionUpdate: vscode.Event<string[]>;

    /**
     * A subscribable event which fires when a document changed. The event body
     * will contain that document. Use this event for the onDidChangeCustomDocument
     * on your implementation of the `CustomEditorProvider`.
     */
    public onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentEditEvent<D>>;

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
        this.onDidChangeCustomDocument = this.onDidChangeCustomDocumentEventEmitter.event;

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
     * @returns the {@link InitializeResult} of the server to enable further configuration.
     */
    public async registerClient(client: GlspVscodeClient<D>): Promise<InitializeResult> {
        this.clientMap.set(client.clientId, client);
        this.documentMap.set(client.document, client.clientId);

        const relativeDocumentUri = getRelativeDocumentUri(client);

        // Set up message listener for client
        const clientMessageListener = client.onClientMessage(message => {
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
                    if (isActionMessage(filteredMessage)) {
                        filteredMessage.args = {
                            ...filteredMessage.args,
                            relativeDocumentUri
                        }
                        filteredMessage.action.subclientId = SUBCLIENT_HOST_ID;
                    }
                    this.options.server.onSendToServerEmitter.fire(filteredMessage);
                }
            });
        });

        const viewStateListener = client.webviewPanel.onDidChangeViewState(e => {
            if (e.webviewPanel.active) {
                this.selectionUpdateEmitter.fire(this.clientSelectionMap.get(client.clientId) || []);
            }
        });



        // Cleanup when client panel is closed
        const panelOnDisposeListener = client.webviewPanel.onDidDispose(async () => {
            this.diagnostics.set(client.document.uri, undefined); // this clears the diagnostics for the file
            this.clientMap.delete(client.clientId);
            this.documentMap.delete(client.document);
            this.clientSelectionMap.delete(client.clientId);
            viewStateListener.dispose();
            clientMessageListener.dispose();
            panelOnDisposeListener.dispose();
            await glspClient.disposeClientSession({
                clientSessionId: client.clientId,
                args: {
                    relativeDocumentUri,
                    subclientId: SUBCLIENT_HOST_ID
                }
            });
        });

        // Initialize client session
        const glspClient = await this.options.server.glspClient;
        const initializeParams = await this.createInitializeClientSessionParams(client, SUBCLIENT_HOST_ID, relativeDocumentUri);
        await glspClient.initializeClientSession(initializeParams);
        return this.options.server.initializeResult;
    }

    protected async createInitializeClientSessionParams(
        client: GlspVscodeClient<D>,
        subclientId: string,
        relativeDocumentUri: string
    ): Promise<InitializeClientSessionParameters> {
        return {
            clientSessionId: client.clientId,
            diagramType: client.diagramType,
            args: {
                relativeDocumentUri,
                subclientId
            }
        };
    }

    /**
     * Send an action to the client/panel that is currently focused. If no registered
     * panel is focused, the message will not be sent.
     *
     * @param action The action to send to the active client.
     */
    public sendActionToActiveClient(action: Action): void {
        this.clientMap.forEach(client => {
            if (client.webviewPanel.active) {
                client.onSendToClientEmitter.fire({
                    clientId: client.clientId,
                    action: action,
                    __localDispatch: true
                });
            }
        });
    }

    /**
     * Send message to registered client by id.
     *
     * @param clientId Id of client.
     * @param message Message to send.
     */
    protected sendMessageToClient(clientId: string, message: unknown): void {
        const client = this.clientMap.get(clientId);
        if (client) {
            client.onSendToClientEmitter.fire(message);
        }
    }

    /**
     * Send action to registered client by id.
     *
     * @param clientId Id of client.
     * @param action Action to send.
     */
    protected sendActionToClient(clientId: string, action: Action): void {
        this.sendMessageToClient(clientId, {
            clientId: clientId,
            action: action,
            __localDispatch: true
        });
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

    protected handleSetDirtyStateAction(
        message: ActionMessage<SetDirtyStateAction>,
        client: GlspVscodeClient<D> | undefined,
        _origin: MessageOrigin
    ): MessageProcessingResult {
        if (client) {
            const reason = message.action.reason || '';
            if (reason === 'save') {
                this.onDocumentSavedEmitter.fire(client.document);
            } else if (reason === 'operation' && message.action.isDirty) {
                this.onDidChangeCustomDocumentEventEmitter.fire({
                    document: client.document,
                    undo: () => {
                        this.sendActionToClient(client.clientId, UndoAction.create());
                    },
                    redo: () => {
                        this.sendActionToClient(client.clientId, RedoAction.create());
                    }
                });
            }
        }

        // The webview client cannot handle `SetDirtyStateAction`s. Avoid propagation
        return { processedMessage: GlspVscodeConnector.NO_PROPAGATION_MESSAGE, messageChanged: true };
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
            this.clientSelectionMap.set(client.clientId, message.action.selectedElementsIDs);
            this.selectionUpdateEmitter.fire(message.action.selectedElementsIDs);
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
                    fs.writeFile(uri.fsPath, message.action.svg, { encoding: 'utf-8' }, err => {
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
                this.sendActionToClient(clientId, SaveModelAction.create({ fileUri: destination?.path }));
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
            this.sendActionToClient(
                clientId,
                RequestModelAction.create({
                    options: {
                        sourceUri: document.uri.toString(),
                        diagramType
                    }
                })
            );
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

function getRelativeDocumentUri(client: GlspVscodeClient): string {
    let workspacePath = vscode.workspace.workspaceFolders?.[0].uri.path;
    workspacePath = workspacePath?.endsWith('/') ? workspacePath : `${workspacePath}/`
    return client.document.uri.path.replace(workspacePath, '');
}

