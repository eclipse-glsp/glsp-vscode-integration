/********************************************************************************
 * Copyright (c) 2023-2024 EclipseSource and others.
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
    ActionMessage,
    Deferred,
    Disposable,
    DisposableCollection,
    DisposeClientSessionParameters,
    GLSPClient,
    InitializeClientSessionParameters,
    InitializeParameters,
    InitializeResult
} from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';
import { Messenger } from 'vscode-messenger';
import { MessageParticipant, NotificationType, RequestType } from 'vscode-messenger-common';
import { GLSPDiagramIdentifier } from '../types';

export interface WebviewEndpointOptions {
    webviewPanel: vscode.WebviewPanel;
    messenger?: Messenger;
    diagramIdentifier: GLSPDiagramIdentifier;
}

export const WebviewReadyNotification: NotificationType<void> = { method: 'ready' };
export const InitializeNotification: NotificationType<GLSPDiagramIdentifier> = { method: 'initialize' };

export const ActionMessageNotification: NotificationType<ActionMessage> = { method: 'actionMessage' };
export const StartRequest: RequestType<undefined, void> = { method: 'start' };
export const InitializeServerRequest: RequestType<InitializeParameters, InitializeResult> = { method: 'initializeServer' };
export const InitializeClientSessionRequest: RequestType<InitializeClientSessionParameters, void> = { method: 'initializeClientSession' };
export const DisposeClientSessionRequest: RequestType<DisposeClientSessionParameters, void> = { method: 'disposeClientSession' };
export const ShutdownServerNotification: NotificationType<void> = { method: 'shutdownServer' };
export const StopRequest: RequestType<undefined, void> = { method: 'stop' };

/**
 * Wrapper  class around a {@link vscode.WebviewPanel}. Takes care
 * of the communication between the webview and the host extension.
 * It's main responsibility is sending {@link ActionMessages} to the webview
 * and handling of action messages received from the webview.
 */
export class WebviewEndpoint implements Disposable {
    readonly webviewPanel: vscode.WebviewPanel;
    readonly messenger: Messenger;
    readonly messageParticipant: MessageParticipant;
    readonly diagramIdentifier: GLSPDiagramIdentifier;

    protected _readyDeferred = new Deferred<void>();
    protected toDispose = new DisposableCollection();

    protected onActionMessageEmitter = new vscode.EventEmitter<ActionMessage>();
    get onActionMessage(): vscode.Event<ActionMessage> {
        return this.onActionMessageEmitter.event;
    }

    protected _serverActions?: string[];
    get serverActions(): string[] | undefined {
        return this._serverActions;
    }

    protected _clientActions?: string[];
    get clientActions(): string[] | undefined {
        return this._clientActions;
    }

    constructor(options: WebviewEndpointOptions) {
        this.webviewPanel = options.webviewPanel;
        this.messenger = options.messenger ?? new Messenger();
        this.diagramIdentifier = options.diagramIdentifier;
        this.messageParticipant = this.messenger.registerWebviewPanel(this.webviewPanel);

        this.toDispose.push(
            this.webviewPanel.onDidDispose(() => {
                this.dispose();
            }),
            this.messenger.onNotification(
                WebviewReadyNotification,
                () => {
                    this._readyDeferred.resolve();
                },
                {
                    sender: this.messageParticipant
                }
            ),
            this.onActionMessageEmitter
        );
    }

    protected async sendDiagramIdentifier(): Promise<void> {
        await this.ready;
        if (this.diagramIdentifier) {
            this.messenger.sendNotification(InitializeNotification, this.messageParticipant, this.diagramIdentifier);
        }
    }

    /**
     * Hooks up a {@link GLSPClient} with the underlying webview and send the `initialize` message to the webview
     * (once its ready)
     * The GLSP client is called remotely from the webview context via the `vscode-messenger` RPC
     * protocol.
     * @param glspClient The client that should be connected
     * @returns A {@link Disposable} to dispose the remote connection and all attached listeners
     */
    initialize(glspClient: GLSPClient): Disposable {
        const toDispose = new DisposableCollection();
        toDispose.push(
            this.messenger.onNotification(
                ActionMessageNotification,
                msg => {
                    this.onActionMessageEmitter.fire(msg);
                },
                {
                    sender: this.messageParticipant
                }
            ),
            this.messenger.onRequest(StartRequest, () => glspClient.start(), { sender: this.messageParticipant }),
            this.messenger.onRequest(
                InitializeServerRequest,
                async params => {
                    const result = await glspClient.initializeServer(params);
                    if (!this._serverActions) {
                        this._serverActions = result.serverActions[this.diagramIdentifier.diagramType];
                    }
                    return result;
                },
                {
                    sender: this.messageParticipant
                }
            ),
            this.messenger.onRequest(
                InitializeClientSessionRequest,
                params => {
                    if (!this._clientActions) {
                        this._clientActions = params.clientActionKinds;
                    }
                    glspClient.initializeClientSession(params);
                },
                {
                    sender: this.messageParticipant
                }
            ),
            this.messenger.onRequest(DisposeClientSessionRequest, params => glspClient.disposeClientSession(params), {
                sender: this.messageParticipant
            }),
            this.messenger.onRequest(ShutdownServerNotification, () => glspClient.shutdownServer(), {
                sender: this.messageParticipant
            }),
            this.messenger.onRequest(StopRequest, () => glspClient.stop(), {
                sender: this.messageParticipant
            })
        );
        this.toDispose.push(toDispose);
        this.sendDiagramIdentifier();
        return toDispose;
    }

    sendMessage(actionMessage: ActionMessage): void {
        this.messenger.sendNotification(ActionMessageNotification, this.messageParticipant, actionMessage);
    }

    get ready(): Promise<void> {
        return this._readyDeferred.promise;
    }

    dispose(): void {
        this.toDispose.dispose();
    }
}
