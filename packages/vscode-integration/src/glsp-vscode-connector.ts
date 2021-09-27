/********************************************************************************
 * Copyright (c) 2021 EclipseSource and others.
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

import * as vscode from 'vscode';
import * as fs from 'fs';

import {
    isActionMessage,
    SaveModelAction,
    RequestModelAction,
    SetDirtyStateAction,
    DirtyStateChangeReason,
    UndoOperation,
    RedoOperation,
    SetMarkersAction,
    NavigateToExternalTargetAction,
    SelectAction,
    ExportSvgAction,
    Action,
    ActionMessage
} from './actions';

import { GlspVscodeConnectorOptions, GlspVscodeClient } from './types';

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
                if (isActionMessage(message)) {
                    console.log(`Server (${message.clientId}): ${message.action.kind}`, message.action);
                } else {
                    console.log('Server (no action message):', message);
                }
            }

            // Run message through first user-provided interceptor (pre-receive)
            this.options.onBeforeReceiveMessageFromServer(message, (newMessage, shouldBeProcessedByConnector = true) => {
                const { processedMessage, messageChanged } = shouldBeProcessedByConnector ?
                    this.processMessage(newMessage, MessageOrigin.SERVER) :
                    { processedMessage: message, messageChanged: false };

                // Run message through second user-provided interceptor (pre-send) - processed
                const filteredMessage = this.options.onBeforePropagateMessageToClient(newMessage, processedMessage, messageChanged);
                if (typeof filteredMessage !== 'undefined' && isActionMessage(filteredMessage)) {
                    this.sendMessageToClient(filteredMessage.clientId, filteredMessage);
                }
            });
        });

        this.disposables.push(
            this.diagnostics,
            this.selectionUpdateEmitter,
            serverMessageListener
        );
    }

    /**
     * Register a client on the GLSP-VSCode connector. All communication will subsequently
     * run through the VSCode integration. Clients do not need to be unregistered
     * as they are automatically disposed of when the panel they belong to is closed.
     *
     * @param client The client to register.
     */
    public registerClient(client: GlspVscodeClient<D>): void {
        this.clientMap.set(client.clientId, client);
        this.documentMap.set(client.document, client.clientId);

        // Set up message listener for client
        const clientMessageListener = client.onClientMessage(message => {
            if (this.options.logging) {
                if (isActionMessage(message)) {
                    console.log(`Client (${message.clientId}): ${message.action.kind}`, message.action);
                } else {
                    console.log('Client (no action message):', message);
                }
            }

            // Run message through first user-provided interceptor (pre-receive)
            this.options.onBeforeReceiveMessageFromClient(message, (newMessage, shouldBeProcessedByConnector = true) => {
                const { processedMessage, messageChanged } = shouldBeProcessedByConnector ?
                    this.processMessage(newMessage, MessageOrigin.CLIENT) :
                    { processedMessage: message, messageChanged: false };

                const filteredMessage = this.options.onBeforePropagateMessageToServer(newMessage, processedMessage, messageChanged);

                if (typeof filteredMessage !== 'undefined') {
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
        const panelOnDisposeListener = client.webviewPanel.onDidDispose(() => {
            this.diagnostics.set(client.document.uri, undefined); // this clears the diagnostics for the file
            this.clientMap.delete(client.clientId);
            this.documentMap.delete(client.document);
            this.clientSelectionMap.delete(client.clientId);
            viewStateListener.dispose();
            clientMessageListener.dispose();
            panelOnDisposeListener.dispose();
        });
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
        if (isActionMessage(message)) {
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
            if (reason === DirtyStateChangeReason.SAVE) {
                this.onDocumentSavedEmitter.fire(client.document);
            } else if (reason === DirtyStateChangeReason.OPERATION && message.action.isDirty) {
                this.onDidChangeCustomDocumentEventEmitter.fire({
                    document: client.document,
                    undo: () => {
                        this.sendActionToClient(client.clientId, new UndoOperation());
                    },
                    redo: () => {
                        this.sendActionToClient(client.clientId, new RedoOperation());
                    }
                });
            }
        }

        // Propagate unchanged message
        return { processedMessage: message, messageChanged: false };
    }

    protected handleSetMarkersAction(
        message: ActionMessage<SetMarkersAction>,
        client: GlspVscodeClient<D> | undefined,
        _origin: MessageOrigin
    ): MessageProcessingResult {
        if (client) {
            const SEVERITY_MAP = {
                'info': vscode.DiagnosticSeverity.Information,
                'warning': vscode.DiagnosticSeverity.Warning,
                'error': vscode.DiagnosticSeverity.Error
            };

            const updatedDiagnostics = message.action.markers.map(marker => new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 0), // Must have be defined as such - no workarounds
                marker.description,
                SEVERITY_MAP[marker.kind]
            ));

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

        vscode.window.showTextDocument(vscode.Uri.parse(uri), showOptions)
            .then(
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
        vscode.window.showSaveDialog({
            filters: { 'SVG': ['svg'] },
            saveLabel: 'Export',
            title: 'Export as SVG'
        }).then(
            (uri: vscode.Uri | undefined) => {
                if (uri) {
                    fs.writeFile(uri.fsPath, message.action.svg, { encoding: 'utf-8' }, err => {
                        if (err) {
                            console.error(err);
                        }
                    });
                }
            },
            console.error
        );

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
                this.sendActionToClient(clientId, new SaveModelAction(destination?.path));
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
            this.sendActionToClient(clientId, new RequestModelAction({
                sourceUri: document.uri.toString(),
                diagramType
            }));
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
