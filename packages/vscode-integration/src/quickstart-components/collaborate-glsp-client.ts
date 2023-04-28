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
    Args,
    ClientState,
    CollaborationAction,
    DisposeClientSessionParameters,
    DisposeSubclientAction,
    GLSPClient,
    InitializeClientSessionParameters,
    InitializeParameters,
    InitializeResult,
    RequestModelAction,
    SetModelAction,
    UpdateModelAction,
} from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';
import { CollaborateGlspClientProvider, SUBCLIENT_HOST_ID } from './collaborate-glsp-client-provider';

export class CollaborateGlspClient implements GLSPClient {
    protected readonly BROADCAST_ACTION_TYPES = [
        SetModelAction.KIND,
        UpdateModelAction.KIND
    ]

    readonly id: string;

    protected glspClient: GLSPClient;

    protected provider: CollaborateGlspClientProvider;

    // Map<relativeDocumentUri, Map<subclientId, local/original clientSessionId> subclientId H = host
    protected registeredSubclientMap = new Map<string, Map<string, string>>();
    // overwritten clientSessionIds for Server: Map<relativeDocumentUri, temp/unique clientSessionId>
    protected serverClientIdMap = new Map<string, string>();

    protected handlers: ActionMessageHandler[] = [];

    constructor(glspClient: GLSPClient, provider: CollaborateGlspClientProvider) {
        this.id = glspClient.id;

        this.glspClient = glspClient;

        this.provider = provider;
    }

    shutdownServer(): void {
        this.glspClient.shutdownServer();
    }

    initializeServer(params: InitializeParameters): Promise<InitializeResult> {
        return this.glspClient.initializeServer(params);
    }

    async initializeClientSession(params: InitializeClientSessionParameters): Promise<void> {
        if (!this.provider.isInCollaborateMode() || this.provider.isHost()) {
            const relativeDocumentUri = this.getRelativeDocumentUriByArgs(params.args);
            const subclientId = params.args?.subclientId as string;
            const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri) || new Map<string, string>();
            const initialized = subclientMap.size > 0;
            subclientMap.set(subclientId, params.clientSessionId); // set local clientId
            this.registeredSubclientMap.set(relativeDocumentUri, subclientMap);
            if (initialized) {
                return;
            }
            params.clientSessionId += `_${subclientId}`; // new unique clientSessionId for server
            this.serverClientIdMap.set(relativeDocumentUri, params.clientSessionId);
            return this.glspClient.initializeClientSession(params);
        } else if (this.provider.isGuest()) {
            params.args = {
                ...params.args,
                subclientId: this.provider.getSubclientIdFromSession()
            };
            return this.provider.initializeClientSession(params);
        }
    }

    async disposeClientSession(params: DisposeClientSessionParameters): Promise<void> {
        if (this.provider.isInCollaborateMode() && this.provider.isHost()) {
            const relativeDocumentUri = this.getRelativeDocumentUriByArgs(params.args);
            const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri);
            const subclientId = params.args?.subclientId as string;
            const disposeSubclientMessage: ActionMessage<DisposeSubclientAction> = {
                clientId: '',
                action: DisposeSubclientAction.create()
            };
            disposeSubclientMessage.action.initialSubclientInfo = {
                name: '',
                color: '',
                subclientId
            };
            for (const [id, localClientId] of subclientMap?.entries() || []) {
                // only handle to other subclients
                if (subclientId !== id) {
                    this.handleMessage(id, disposeSubclientMessage, localClientId);
                }
            }
        }

        if (!this.provider.isInCollaborateMode() || this.provider.isHost()) {
            const relativeDocumentUri = this.getRelativeDocumentUriByArgs(params.args);
            const subclientId = params.args?.subclientId as string;
            const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri) || new Map<string, string>();
            subclientMap.delete(subclientId);
            this.registeredSubclientMap.set(relativeDocumentUri, subclientMap);
            if (subclientMap.size > 0) {
                return;
            }
            this.serverClientIdMap.delete(relativeDocumentUri);
            return this.glspClient.disposeClientSession(params);
        } else if (this.provider.isGuest()) {
            params.args = {
                ...params.args,
                subclientId: this.provider.getSubclientIdFromSession()
            };
            return this.provider.disposeClientSession(params);
        }
    }

    onActionMessage(handler: ActionMessageHandler): void {
        this.handlers.push(handler);
    }

    private handleMessage(subclientId: string, originalMessage: ActionMessage, clientId: string): void {
        // clone message so at broadcasting original message won't be overwritten (would lead to problems at host since we use this message there)
        const clonedMessage: ActionMessage = {
            ...originalMessage,
            action: {
                ...originalMessage.action,
                subclientId
            },
            clientId
        }
        if (subclientId === SUBCLIENT_HOST_ID) {
            this.handlers.forEach(handler => handler(clonedMessage)); // notify host
        } else {
            this.provider.handleActionMessage(clonedMessage); // notify subclientId
        }
    }

    sendActionMessage(message: ActionMessage): void {
        // send to all other subclients
        if (CollaborationAction.is(message.action) && this.provider.isInCollaborateMode()) {
            if (this.provider.isHost()) {
                const relativeDocumentUri = this.getRelativeDocumentUriByArgs(message.args);
                const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri);
                const subclientId = message.action.subclientId;
                // set initialSubclientInfo if host dispatches actions (not set yet)
                if (!message.action.initialSubclientInfo) {
                    message.action.initialSubclientInfo = this.provider.getSubclientInfoFromSession();
                }
                for (const [id, localClientId] of subclientMap?.entries() || []) {
                    // only handle to other subclients
                    if (subclientId !== id) {
                        this.handleMessage(id, message, localClientId);
                    }
                }
            } else if (this.provider.isGuest()) {
                message.action.subclientId = this.provider.getSubclientIdFromSession();
                message.action.initialSubclientInfo = this.provider.getSubclientInfoFromSession();
                this.provider.sendActionMessage(message);
            }
        } else if (!this.provider.isInCollaborateMode() || this.provider.isHost()) {
            const relativeDocumentUri = this.getRelativeDocumentUriByArgs(message.args);
            message.clientId = this.serverClientIdMap.get(relativeDocumentUri) || '';
            // if requestModel action => add disableReload and if originClient not host => change sourceUri
            if (message.action.kind === RequestModelAction.KIND) {
                const requestModelAction = message.action as RequestModelAction;
                requestModelAction.options = {
                    ...requestModelAction.options,
                    disableReload: true
                };
                if (message.action.subclientId !== SUBCLIENT_HOST_ID) {
                    requestModelAction.options = {
                        ...requestModelAction.options,
                        sourceUri: getFullDocumentUri(relativeDocumentUri),
                    };
                }
            }
            this.glspClient.sendActionMessage(message);
        } else if (this.provider.isGuest()) {
            message.action.subclientId = this.provider.getSubclientIdFromSession();
            this.provider.sendActionMessage(message);
        }
    }

    async start(): Promise<void> {
        await this.glspClient.start();

        this.glspClient.onActionMessage((message: ActionMessage) => {
            const relativeDocumentUri = this.getRelativeDocumentUriByServerClientId(message.clientId);
            const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri);
            if (!this.provider.isInCollaborateMode()) {
                // send only to host
                const localClientId = subclientMap?.get(SUBCLIENT_HOST_ID) || '';
                this.handleMessage(SUBCLIENT_HOST_ID, message, localClientId);
            } else if (this.provider.isHost()) {
                const subclientId = message.action.subclientId;
                if (subclientId == null || this.BROADCAST_ACTION_TYPES.includes(message.action.kind)) {
                    // braodcast to all subclients if subclientId is null or listed in BROADCAST_ACTION_TYPES
                    for (const [id, localClientId] of subclientMap?.entries() || []) {
                        this.handleMessage(id, message, localClientId);
                    }
                } else {
                    // send to adressed subclient
                    const localClientId = subclientMap?.get(subclientId) || '';
                    this.handleMessage(subclientId, message, localClientId);
                }
            }
        });
    }

    stop(): Promise<void> {
        return this.glspClient.stop();
    }

    get currentState(): ClientState {
        return this.glspClient.currentState;
    }

    private getRelativeDocumentUriByServerClientId(serverClientId: string): string {
        for (const [key, value] of this.serverClientIdMap.entries()) {
            if (value === serverClientId) {
                return key;
            }
        }
        return '';
    }

    private getRelativeDocumentUriByArgs(args: Args | undefined): string {
        return (args?.relativeDocumentUri || '') as string;
    }
}

function getFullDocumentUri(relativeDocumentUri: string): string {
    let workspacePath = vscode.workspace.workspaceFolders?.[0].uri.path || '';
    // FIXME test on microsoft
    workspacePath = workspacePath.endsWith('/') ? workspacePath : `${workspacePath}/`;
    workspacePath = workspacePath.startsWith('file://') ? workspacePath : `file://${workspacePath}`;
    return workspacePath + relativeDocumentUri;
}
