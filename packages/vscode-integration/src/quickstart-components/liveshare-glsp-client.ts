/********************************************************************************
 * Copyright (c) 2019-2022 EclipseSource and others.
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
    ActionMessageHandler,
    ClientState,
    DisposeClientSessionParameters,
    GLSPClient,
    InitializeClientSessionParameters,
    InitializeParameters,
    InitializeResult,
    RequestModelAction
} from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';

import { liveshareService } from '../liveshare';

export class LiveshareGlspClient implements GLSPClient {
    readonly id: string;

    protected jsonrpcClient: GLSPClient;
    // Map<relativeDocumentUri, Map<subclientId, local/original clientSessionId> subclientId H = host
    protected registeredSubclientMap = new Map<string, Map<string, string>>();
    // overwritten clientSessionIds for Server: Map<relativeDocumentUri, temp/unique clientSessionId>
    protected serverClientIdMap = new Map<string, string>();

    protected nextUniqueRequestId = 10000;

    constructor(id: string, existingClient: GLSPClient) {
        this.id = id;

        this.jsonrpcClient = existingClient;
    }

    shutdownServer(): void {
        this.jsonrpcClient.shutdownServer();
    }

    initializeServer(params: InitializeParameters): Promise<InitializeResult> {
        return this.jsonrpcClient.initializeServer(params);
    }

    async initializeClientSession(params: InitializeClientSessionParameters): Promise<void> {
        const relativeDocumentUri = params.args?.relativeDocumentUri as string;
        const subclientId = params.args?.subclientId as string;
        if (!liveshareService.isConnectionOpen() || liveshareService.isHost()) {
            const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri) || new Map<string, string>();
            const initialized = subclientMap.size > 0;
            subclientMap.set(subclientId, params.clientSessionId);
            this.registeredSubclientMap.set(relativeDocumentUri, subclientMap);
            if (initialized) {
                return;
            }
            // if a guest is initiating document firstly
            params.clientSessionId += '_' + subclientId;
            this.serverClientIdMap.set(relativeDocumentUri, params.clientSessionId);
            return this.jsonrpcClient.initializeClientSession(params);
        } else if (liveshareService.isGuest()) {
            return liveshareService.guestService.request('INITIALIZE_CLIENT_SESSION', [
                params,
                '' + liveshareService.session?.peerNumber,
                this.id
            ]);
        }
    }

    async disposeClientSession(params: DisposeClientSessionParameters): Promise<void> {
        const relativeDocumentUri = params.args?.relativeDocumentUri as string;
        const subclientId = params.args?.subclientId as string;
        if (!liveshareService.isConnectionOpen() || liveshareService.isHost()) {
            const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri) || new Map<string, string>();
            subclientMap.delete(subclientId);
            this.registeredSubclientMap.set(relativeDocumentUri, subclientMap);
            if (subclientMap.size > 0) {
                return;
            }
            this.serverClientIdMap.delete(relativeDocumentUri);
            return this.jsonrpcClient.disposeClientSession(params);
        } else if (liveshareService.isGuest()) {
            return liveshareService.guestService.request('DISPOSE_CLIENT_SESSION', [
                params,
                '' + liveshareService.session?.peerNumber,
                this.id
            ]);
        }
    }

    onActionMessage(handler: ActionMessageHandler): void {
        this.jsonrpcClient.onActionMessage(message => {
            if (!liveshareService.isConnectionOpen()) {
                const relativeDocumentUri = this.getRelativeDocumentUriByServerClientId(message.clientId) || '';
                const subclientId = (message.action as any)['subclientId'] || 'H';
                message.clientId = this.registeredSubclientMap?.get(relativeDocumentUri)?.get(subclientId) || '';
                handler(message); // only to host
            } else if (liveshareService.isHost()) {
                const subclientId2 = (message.action as any)['subclientId'];
                if (subclientId2 == null || message.action.kind === 'setModel' || message.action.kind === 'updateModel') {
                    const relativeDocumentUri = this.getRelativeDocumentUriByServerClientId(message.clientId) || '';
                    const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri);
                    if (subclientMap) {
                        for (const [subclientId, clientId] of subclientMap.entries()) {
                            const newMessage = JSON.parse(JSON.stringify(message));
                            (newMessage.action as any)['subclientId'] = subclientId;
                            newMessage.clientId = clientId;
                            if (subclientId === 'H') {
                                handler(newMessage); // host over handler
                            } else {
                                liveshareService.hostService.notify('ON_ACTION_MESSAGE', newMessage);
                            }
                        }
                    }
                } else {
                    const relativeDocumentUri = this.getRelativeDocumentUriByServerClientId(message.clientId) || '';
                    message.clientId = this.registeredSubclientMap?.get(relativeDocumentUri)?.get(subclientId2) || '';
                    if (subclientId2 === 'H') {
                        handler(message); // notify host
                    } else {
                        liveshareService.hostService.notify('ON_ACTION_MESSAGE', message); // notify subclientId
                    }
                }
            }
        });
    }

    sendActionMessage(message: ActionMessage): void {
        const relativeDocumentUri = (message as any)['relativeDocumentUri'] as string;
        if (!liveshareService.isConnectionOpen() || liveshareService.isHost()) {
            message.clientId = this.serverClientIdMap.get(relativeDocumentUri) || '';
            // if requestModel action and originClient not host => change sourceUri
            if (message.action.kind === 'requestModel' && (message.action as any)['subclientId'] !== 'H') {
                const requestModelAction = message.action as RequestModelAction;
                requestModelAction.options = {
                    ...requestModelAction.options,
                    sourceUri: this.getFullDocumentUri(relativeDocumentUri)
                };
            }
            this.jsonrpcClient.sendActionMessage(message);
        } else if (liveshareService.isGuest()) {
            liveshareService.guestService
                .request('SEND_ACTION_MESSAGE', [message, '' + liveshareService.session?.peerNumber, this.id])
                .then(res => {
                    console.log('SEND_ACTION_MESSAGE', res);
                });
        }
    }

    start(): Promise<void> {
        return this.jsonrpcClient.start();
    }

    stop(): Promise<void> {
        return this.jsonrpcClient.stop();
    }

    get currentState(): ClientState {
        return this.jsonrpcClient.currentState;
    }

    private getRelativeDocumentUriByServerClientId(serverClientId: string): string | undefined {
        for (const [key, value] of this.serverClientIdMap.entries()) {
            if (value === serverClientId) {
                return key;
            }
        }
        return undefined;
    }

    protected getFullDocumentUri(relativeDocumentUri: string): string {
        let workspacePath = vscode.workspace.workspaceFolders?.[0].uri.toString();
        workspacePath = workspacePath?.endsWith('/') ? workspacePath : workspacePath + '/';
        return workspacePath + relativeDocumentUri;
    }
}
