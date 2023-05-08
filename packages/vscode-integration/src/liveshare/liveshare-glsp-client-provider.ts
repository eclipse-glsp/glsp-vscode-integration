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

import {
    Action,
    ActionMessage,
    DisposeClientSessionParameters,
    InitializeClientSessionParameters,
    SubclientInfo
} from '@eclipse-glsp/protocol';
import { LiveShare, Peer, Role, Session, SharedService, SharedServiceProxy, getApi, View } from 'vsls';
import {
    CommonCollaborationGlspClientProvider,
    GuestCollaborationGlspClientProvider,
    GuestsChangeHandler,
    HostCollaborationGlspClientProvider,
    SUBCLIENT_HOST_ID
} from '../collaboration/Collaboration-glsp-client-provider';
import { GlspVscodeServer } from '../types';
import { ToggleFeatureTreeDataProvider } from './toggle-feature-tree-data-provider';

export const INITIALIZE_CLIENT_SESSION = 'INITIALIZE_CLIENT_SESSION';
export const DISPOSE_CLIENT_SESSION = 'DISPOSE_CLIENT_SESSION';
export const SEND_ACTION_MESSAGE = 'SEND_ACTION_MESSAGE';
export const ON_ACTION_MESSAGE = 'ON_ACTION_MESSAGE';
export const ON_MULTIPLE_ACTION_MESSAGES = 'ON_MULTIPLE_ACTION_MESSAGES';
export const SERVICE_NAME = 'GLSP-LIVESHARE-SERVICE';

const COLORS = ['#FFF100', '#5C2D91', '#E3008C', '#FF8C00', '#B4009E', '#107C10', '#FFB900', '#B4A0FF'];
const FALLBACK_COLOR = '#ABABAB';

export class LiveshareGlspClientProvider
    implements CommonCollaborationGlspClientProvider, HostCollaborationGlspClientProvider, GuestCollaborationGlspClientProvider
{
    protected session: Session | null;
    protected vsls: LiveShare | null;
    protected role: Role = Role.None;
    protected service: SharedService | SharedServiceProxy | null;
    protected server: GlspVscodeServer;
    protected subclientId: string | null;
    protected subclientInfo: SubclientInfo | null;
    protected guestsChangeHandler: GuestsChangeHandler[] = [];

    protected get guestService(): SharedServiceProxy {
        return this.service as SharedServiceProxy;
    }

    protected get hostService(): SharedService {
        return this.service as SharedService;
    }

    async initialize(server: GlspVscodeServer): Promise<void> {
        this.server = server;
        this.vsls = await getApi();

        if (!this.vsls) {
            return;
        }

        // Register the custom tree provider with Live Share
        const treeDataProvider = new ToggleFeatureTreeDataProvider();
        this.vsls.registerTreeDataProvider(View.Session, treeDataProvider);

        this.vsls.onDidChangeSession(async e => {
            this.role = e.session.role;
            this.session = e.session;
            this.subclientId = this.createSubclientIdFromSession(e.session);
            this.subclientInfo = {
                subclientId: this.subclientId,
                name: this.createNameFromSession(e.session),
                color: this.createColorFromSession(e.session)
            };
            if (e.session.role === Role.Host) {
                this.service = await this.vsls!.shareService(SERVICE_NAME);
                if (!this.service) {
                    return;
                }

                this.service.onRequest(INITIALIZE_CLIENT_SESSION, async params => {
                    await (await this.server.glspClient).initializeClientSession(params[1] as InitializeClientSessionParameters);
                });

                this.service.onRequest(DISPOSE_CLIENT_SESSION, async params => {
                    await (await this.server.glspClient).disposeClientSession(params[1] as DisposeClientSessionParameters);
                });

                this.service.onRequest(SEND_ACTION_MESSAGE, async params => {
                    (await this.server.glspClient).sendActionMessage(params[1] as ActionMessage);
                });
            } else if (e.session.role === Role.Guest) {
                this.service = await this.vsls!.getSharedService(SERVICE_NAME);
                if (!this.service) {
                    return;
                }

                this.service.onNotify(ON_ACTION_MESSAGE, (message: any) => {
                    this.checkActionMessageAndSendToClient(message);
                });

                this.service.onNotify(ON_MULTIPLE_ACTION_MESSAGES, (ev: any) => {
                    const typedMessages = ev.messages as ActionMessage[];
                    typedMessages.forEach(typedMessage => {
                        this.checkActionMessageAndSendToClient(typedMessage);
                    });
                });
            }
        });

        this.vsls.onDidChangePeers(e => {
            if (this.isInCollaborationMode() && this.isHost()) {
                this.guestsChangeHandler.forEach(handler => handler(this.vsls!.peers.map(p => this.createSubclientIdFromPeer(p))));
            }
        });
    }

    isInCollaborationMode(): boolean {
        return !!this.service && this.service.isServiceAvailable;
    }

    isHost(): boolean {
        return this.role === Role.Host;
    }

    isGuest(): boolean {
        return this.role === Role.Guest;
    }

    initializeClientSessionForGuest(params: InitializeClientSessionParameters): Promise<void> {
        return this.guestService.request(INITIALIZE_CLIENT_SESSION, [params]);
    }

    disposeClientSessionForGuest(params: DisposeClientSessionParameters): Promise<void> {
        return this.guestService.request(DISPOSE_CLIENT_SESSION, [params]);
    }

    sendActionMessageForGuest(message: ActionMessage): void {
        this.guestService.request(SEND_ACTION_MESSAGE, [message]);
    }

    handleActionMessageForHost(message: ActionMessage): void {
        this.hostService.notify(ON_ACTION_MESSAGE, message);
    }

    handleMultipleActionMessagesForHost(messages: ActionMessage<Action>[]): void {
        this.hostService.notify(ON_MULTIPLE_ACTION_MESSAGES, { messages }); // sending arrays is not allowed
    }

    getSubclientIdFromSession(): string {
        return this.subclientId || '';
    }

    getSubclientInfoFromSession(): SubclientInfo {
        return (
            this.subclientInfo || {
                subclientId: '',
                name: '',
                color: ''
            }
        );
    }

    onGuestsChangeForHost(handler: GuestsChangeHandler): void {
        this.guestsChangeHandler.push(handler);
    }

    private checkActionMessageAndSendToClient(message: ActionMessage): void {
        const subclientId = message.action.subclientId;
        // check if message is adrseeed to this guest
        if (this.getSubclientIdFromSession() === subclientId) {
            this.server.onServerSendEmitter.fire(message);
        }
    }

    private createSubclientIdFromSession(session: Session): string {
        return session.role === Role.Host ? SUBCLIENT_HOST_ID : `${session.peerNumber}`;
    }

    private createSubclientIdFromPeer(peer: Peer): string {
        return peer.role === Role.Host ? SUBCLIENT_HOST_ID : `${peer.peerNumber}`;
    }

    private createColorFromSession(session: Session): string {
        const colorId = session.role === Role.Host ? 0 : session.peerNumber - 1;
        return COLORS[colorId % 8] || FALLBACK_COLOR;
    }

    private createNameFromSession(session: Session): string {
        return session.user!.emailAddress || session.user!.displayName;
    }
}
