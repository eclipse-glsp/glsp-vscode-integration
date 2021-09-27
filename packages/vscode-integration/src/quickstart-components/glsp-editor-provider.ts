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
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.01
 ********************************************************************************/

import * as vscode from 'vscode';

import { isActionMessage, isWebviewReadyMessage } from 'sprotty-vscode-protocol';
import { GlspVscodeConnector } from '../glsp-vscode-connector';

/**
 * An extensible base class to create a CustomEditorProvider that takes care of
 * diagram initialization and custom document events.
 *
 * Webview setup needs to be implemented.
 */
export abstract class GlspEditorProvider implements vscode.CustomEditorProvider {

    /** The diagram type identifier the diagram server is responsible for. */
    abstract diagramType: string;

    /** Used to generate continuous and unique clientIds - TODO: consider replacing this with uuid. */
    private viewCount = 0;

    onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentContentChangeEvent<vscode.CustomDocument>>;

    constructor(
        protected readonly glspVscodeConnector: GlspVscodeConnector
    ) {
        this.onDidChangeCustomDocument = glspVscodeConnector.onDidChangeCustomDocument;
    }

    saveCustomDocument(document: vscode.CustomDocument, _cancellation: vscode.CancellationToken): Thenable<void> {
        return this.glspVscodeConnector.saveDocument(document);
    }

    saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, _cancellation: vscode.CancellationToken): Thenable<void> {
        return this.glspVscodeConnector.saveDocument(document, destination);
    }

    revertCustomDocument(document: vscode.CustomDocument, _cancellation: vscode.CancellationToken): Thenable<void> {
        return this.glspVscodeConnector.revertDocument(document, this.diagramType);
    }

    backupCustomDocument(
        _document: vscode.CustomDocument,
        context: vscode.CustomDocumentBackupContext,
        _cancellation: vscode.CancellationToken
    ): Thenable<vscode.CustomDocumentBackup> {
        // Basically do the bare minimum - which is nothing
        return Promise.resolve({ id: context.destination.toString(), delete: () => undefined });
    }

    openCustomDocument(uri: vscode.Uri, _openContext: vscode.CustomDocumentOpenContext, _token: vscode.CancellationToken): vscode.CustomDocument | Thenable<vscode.CustomDocument> {
        // Return the most basic implementation possible.
        return { uri, dispose: () => undefined };
    }

    resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        // This is used to initialize sprotty for our diagram
        const sprottyDiagramIdentifier = {
            diagramType: this.diagramType,
            uri: serializeUri(document.uri),
            clientId: `${this.diagramType}_${this.viewCount++}`
        };

        // Promise that resolves when sprotty sends its ready-message
        const webviewReadyPromise = new Promise<void>(resolve => {
            const messageListener = webviewPanel.webview.onDidReceiveMessage((message: unknown) => {
                if (isWebviewReadyMessage(message)) {
                    resolve();
                    messageListener.dispose();
                }
            });
        });

        const sendMessageToWebview = async (message: unknown): Promise<void> => {
            webviewReadyPromise.then(() => {
                if (webviewPanel.active) {
                    webviewPanel.webview.postMessage(message);
                } else {
                    console.log('Message stalled for webview:', document.uri.path, message);
                    const viewStateListener = webviewPanel.onDidChangeViewState(() => {
                        viewStateListener.dispose();
                        sendMessageToWebview(message);
                    });
                }
            });
        };

        const receiveMessageFromServerEmitter = new vscode.EventEmitter<unknown>();
        const sendMessageToServerEmitter = new vscode.EventEmitter<unknown>();

        webviewPanel.onDidDispose(() => {
            receiveMessageFromServerEmitter.dispose();
            sendMessageToServerEmitter.dispose();
        });

        // Listen for Messages from webview (only after ready-message has been received)
        webviewReadyPromise.then(() => {
            webviewPanel.webview.onDidReceiveMessage((message: unknown) => {
                if (isActionMessage(message)) {
                    sendMessageToServerEmitter.fire(message);
                }
            });
        });

        // Listen for Messages from server
        receiveMessageFromServerEmitter.event(message => {
            if (isActionMessage(message)) {
                sendMessageToWebview(message);
            }
        });

        // Register document/diagram panel/model in vscode connector
        this.glspVscodeConnector.registerClient({
            clientId: sprottyDiagramIdentifier.clientId,
            document: document,
            webviewPanel: webviewPanel,
            onClientMessage: sendMessageToServerEmitter.event,
            onSendToClientEmitter: receiveMessageFromServerEmitter
        });

        // Initialize diagram
        sendMessageToWebview(sprottyDiagramIdentifier);

        this.setUpWebview(document, webviewPanel, token, sprottyDiagramIdentifier.clientId);
    }

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

function serializeUri(uri: vscode.Uri): string {
    let uriString = uri.toString();
    const match = uriString.match(/file:\/\/\/([a-z])%3A/i);
    if (match) {
        uriString = 'file:///' + match[1] + ':' + uriString.substring(match[0].length);
    }
    return uriString;
}
