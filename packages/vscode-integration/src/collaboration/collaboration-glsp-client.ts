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
    Action,
    ActionMessage,
    ActionMessageHandler,
    Args,
    ClientState,
    CollaborationAction,
    DisposeClientSessionParameters,
    DisposeSubclientAction,
    GLSPClient,
    hasObjectProp,
    InitializeClientSessionParameters,
    InitializeParameters,
    InitializeResult,
    RequestModelAction,
    SetModelAction,
    UpdateModelAction
} from '@eclipse-glsp/protocol';
import {
    CollaborativeGlspClientProvider,
    CommonCollaborationGlspClientProvider,
    GuestCollaborationGlspClientProvider,
    HostCollaborationGlspClientProvider,
    SUBCLIENT_HOST_ID
} from './collaboration-glsp-client-provider';
import { getFullDocumentUri } from './collaboration-util';

interface CollaborativeGlspClientDistributedConfig {
    commonProvider: CommonCollaborationGlspClientProvider,
    hostProvider: HostCollaborationGlspClientProvider,
    guestProvider: GuestCollaborationGlspClientProvider
}

function isDistributedConfig(config: any): config is CollaborativeGlspClientDistributedConfig {
    return hasObjectProp(config, 'commonProvider') && hasObjectProp(config, 'hostProvider') && hasObjectProp(config, 'guestProvider')
}

export type CollaborativeGlspClientConfig = CollaborativeGlspClientProvider | CollaborativeGlspClientDistributedConfig;

export class CollaborationGlspClient implements GLSPClient {
    protected readonly BROADCAST_ACTION_TYPES = [SetModelAction.KIND, UpdateModelAction.KIND];

    readonly id: string;

    protected commonProvider: CommonCollaborationGlspClientProvider;
    protected hostProvider: HostCollaborationGlspClientProvider;
    protected guestProvider: GuestCollaborationGlspClientProvider;

    // Map<relativeDocumentUri, Map<subclientId, local/original clientSessionId> subclientId H = host
    protected registeredSubclientMap = new Map<string, Map<string, string>>();
    // overwritten clientSessionIds for Server: Map<relativeDocumentUri, temp/unique clientSessionId>
    protected serverClientIdMap = new Map<string, string>();

    protected actionMessageHandlers: ActionMessageHandler[] = [];

    constructor(
        protected glspClient: GLSPClient,
        config: CollaborativeGlspClientConfig
    ) {
        this.id = glspClient.id;

        if (isDistributedConfig(config)) {
            this.commonProvider = config.commonProvider;
            this.hostProvider = config.hostProvider;
            this.guestProvider = config.guestProvider;
        } else {
            this.commonProvider = config;
            this.hostProvider = config;
            this.guestProvider = config;
        }
    }

    shutdownServer(): void {
        this.glspClient.shutdownServer();
    }

    initializeServer(params: InitializeParameters): Promise<InitializeResult> {
        return this.glspClient.initializeServer(params);
    }

    async initializeClientSession(params: InitializeClientSessionParameters): Promise<void> {
        if (!params.args?.subclientId) {
            params.args = {
                ...params.args,
                subclientId: this.commonProvider.getSubclientIdFromSession()
            };
        }

        if (!this.commonProvider.isInCollaborationMode() || this.commonProvider.isHost()) {
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
        } else if (this.commonProvider.isGuest()) {
            return this.guestProvider.initializeClientSessionForGuest(params);
        }
    }

    async disposeClientSession(params: DisposeClientSessionParameters): Promise<void> {
        if (!params.args?.subclientId) {
            params.args = {
                ...params.args,
                subclientId: this.commonProvider.getSubclientIdFromSession()
            };
        }

        if (this.commonProvider.isInCollaborationMode() && this.commonProvider.isHost()) {
            this.handleDisposeSubclientMessage(params);
        }

        if (!this.commonProvider.isInCollaborationMode() || this.commonProvider.isHost()) {
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
        } else if (this.commonProvider.isGuest()) {
            return this.guestProvider.disposeClientSessionForGuest(params);
        }
    }

    onActionMessage(handler: ActionMessageHandler): void {
        this.actionMessageHandlers.push(handler);
    }

    sendActionMessage(message: ActionMessage): void {
        if (!message.action.subclientId) {
            message.action.subclientId = this.commonProvider.getSubclientIdFromSession();
        }

        if (CollaborationAction.is(message.action)) {
            this.handleCollaborationAction(message as ActionMessage<CollaborationAction>);
        } else if (!this.commonProvider.isInCollaborationMode() || this.commonProvider.isHost()) {
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
                        sourceUri: getFullDocumentUri(relativeDocumentUri)
                    };
                }
            }
            this.glspClient.sendActionMessage(message);
        } else if (this.commonProvider.isGuest()) {
            this.guestProvider.sendActionMessageForGuest(message);
        }
    }

    async start(): Promise<void> {
        await this.commonProvider.initialize({ collaborationGlspClient: this });

        await this.glspClient.start();

        this.glspClient.onActionMessage((message: ActionMessage) => {
            const relativeDocumentUri = this.getRelativeDocumentUriByServerClientId(message.clientId);
            const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri);
            if (!subclientMap) {
                return;
            }
            if (!this.commonProvider.isInCollaborationMode()) {
                // send only to host
                const localClientId = subclientMap.get(SUBCLIENT_HOST_ID) || '';
                this.handleMessage(SUBCLIENT_HOST_ID, message, localClientId);
            } else if (this.commonProvider.isHost()) {
                const subclientId = message.action.subclientId;
                if (subclientId == null || this.BROADCAST_ACTION_TYPES.includes(message.action.kind)) {
                    // braodcast to all subclients if subclientId is null or listed in BROADCAST_ACTION_TYPES
                    this.handleMultipleMessages(subclientMap, message);
                } else {
                    // send to adressed subclient
                    const localClientId = subclientMap.get(subclientId) || '';
                    this.handleMessage(subclientId, message, localClientId);
                }
            }
        });

        this.hostProvider.onGuestsChangeForHost((subclientIds: string[]) => {
            for (const [relativeDocumentUri, subclientMap] of this.registeredSubclientMap.entries()) {
                for (const [id, localClientId] of subclientMap.entries()) {
                    if (id !== SUBCLIENT_HOST_ID && !subclientIds.includes(id)) {
                        this.disposeClientSession({
                            clientSessionId: localClientId,
                            args: {
                                relativeDocumentUri,
                                subclientId: id
                            }
                        });
                    }
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

    handleActionOnAllLocalHandlers(message: ActionMessage<Action>): void {
        this.actionMessageHandlers.forEach(handler => handler(message));
    }

    private handleCollaborationAction(message: ActionMessage<CollaborationAction>): void {
        // handle collabofration action without sending to glsp-server
        if (!this.commonProvider.isInCollaborationMode()) {
            return;
        }

        // set initialSubclientInfo if not set yet
        if (!message.action.initialSubclientInfo) {
            message.action.initialSubclientInfo = this.commonProvider.getSubclientInfoFromSession();
        }

        if (this.commonProvider.isHost()) {
            const relativeDocumentUri = this.getRelativeDocumentUriByArgs(message.args);
            const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri);
            if (!subclientMap) {
                return;
            }
            const subclientId = message.action.subclientId;
            this.handleMultipleMessages(subclientMap, message, actualSubclientId => actualSubclientId !== subclientId);
        } else if (this.commonProvider.isGuest()) {
            this.guestProvider.sendActionMessageForGuest(message);
        }
    }

    private handleDisposeSubclientMessage(params: DisposeClientSessionParameters): void {
        const relativeDocumentUri = this.getRelativeDocumentUriByArgs(params.args);
        const subclientMap = this.registeredSubclientMap.get(relativeDocumentUri);
        if (!subclientMap) {
            return;
        }
        const subclientId = params.args?.subclientId as string;
        const disposeSubclientMessage: ActionMessage<DisposeSubclientAction> = {
            clientId: '',
            action: DisposeSubclientAction.create({ initialSubclientId: subclientId})
        };
        this.handleMultipleMessages(subclientMap, disposeSubclientMessage, actualSubclientId => actualSubclientId !== subclientId);
    }

    private handleMessage(subclientId: string, originalMessage: ActionMessage, clientId: string): void {
        // clone message so at broadcasting original message won't be overwritten
        // (would lead to problems at host since we use this message there)
        const clonedMessage: ActionMessage = {
            ...originalMessage,
            action: {
                ...originalMessage.action,
                subclientId
            },
            clientId
        };
        if (subclientId === SUBCLIENT_HOST_ID) {
            this.handleActionOnAllLocalHandlers(clonedMessage); // notify host
        } else {
            this.hostProvider.handleActionMessageForHost(clonedMessage); // notify subclientId
        }
    }

    private handleMultipleMessages(
        subclientMap: Map<string, string>,
        originalMessage: ActionMessage,
        validate: (subclientId: string, localClientId: string) => boolean = () => true
    ): void {
        const messages: ActionMessage[] = [];
        for (const [subclientId, localClientId] of subclientMap.entries()) {
            if (validate(subclientId, localClientId)) {
                const clonedMessage: ActionMessage = {
                    ...originalMessage,
                    action: {
                        ...originalMessage.action,
                        subclientId
                    },
                    clientId: localClientId
                };
                if (subclientId === SUBCLIENT_HOST_ID) {
                    this.handleActionOnAllLocalHandlers(clonedMessage); // notify host
                } else {
                    messages.push(clonedMessage);
                }
            }
        }
        if (messages.length > 0) {
            this.hostProvider.handleMultipleActionMessagesForHost(messages); // notify all subclientIds
        }
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
