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
    ActionMessage,
    DisposeClientSessionParameters,
    GLSPClient,
    InitializeClientSessionParameters,
    Operation
} from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';
import { LiveShare, Role, Session, SharedService, SharedServiceProxy, getApi } from 'vsls';
import { GlspVscodeServer } from '../types';
import { INCREMENT_COUNT_NOTIFICATION, SERVICE_NAME } from './constants';

class LiveshareService {
    public session: Session | null;
    public vsls: LiveShare;
    public role: Role = Role.None;
    private _service: SharedService | SharedServiceProxy | null;
    private _glspClient: GLSPClient;
    private _server: GlspVscodeServer;
    protected readonly clients = new Map<string, string[]>(); // relativeDocumentUri, clients

    // TODO DA clientIds are different, confusing
    registerServer(server: GlspVscodeServer): void {
        this._server = server;
    }

    isConnectionOpen(): boolean {
        return !!this._service && this._service.isServiceAvailable;
    }

    isInVslsMode(): boolean {
        return !!this.vsls;
    }

    isHost(): boolean {
        return this.role === Role.Host;
    }

    isGuest(): boolean {
        return this.role === Role.Guest;
    }

    notify(action: Operation): void {
        // only if liveshare is activated
        if (this._service) {
            this._service!.notify(INCREMENT_COUNT_NOTIFICATION, {
                peerNumber: this.vsls.session.peerNumber,
                action
            });
        }
    }

    get guestService(): SharedServiceProxy {
        return this._service as SharedServiceProxy;
    }

    get hostService(): SharedService {
        return this._service as SharedService;
    }

    async liveshare(context: vscode.ExtensionContext): Promise<void> {
        this.vsls = (await getApi())!;
        /* if (!this.vsls) {
            return;
        }

        this.session = this.vsls.session;
        if (!this.session) {
            return;
        }

        this.role = this.session.role;
        if (this.role === Role.Host) {
            this._service = await this.vsls.shareService(SERVICE_NAME);

            this._service!.onRequest('INITIALIZE_SERVER', () => this._server.initializeResult);
        } else if (this.role === Role.Guest) {
            this._service = await this.vsls.shareService(SERVICE_NAME);
        }*/

        /*
        // Register the custom tree provider with Live Share, which
        // allows you to augment it however you'd like to.
        const treeDataProvider = new CountTreeDataProvider(store);
        vsls.registerTreeDataProvider(View.Session, treeDataProvider);

        context.subscriptions.push(
            vscode.commands.registerCommand(INCREMENT_COUNT_COMMAND, () => {
                store.increment();
                service!.notify(INCREMENT_COUNT_NOTIFICATION, {
                    peerNumber: vsls.session.peerNumber
                });
            })
        );
        */
        // This event will fire whenever an end-user joins
        // or leaves a sessionn, either of the host or guest.
        this.vsls.onDidChangeSession(async e => {
            this.role = e.session.role;
            this.session = e.session;
            if (e.session.role === Role.Host) {
                /*
                store.count = 0;
                */

                // Expose a new custom RPC service, that allows
                // guests in a Live Share session to retrieve and
                // synchronize custom state with each other. In the
                // case of this sample, the state being sychronized
                // is simply a count, and the only action that
                // can be taken on it is to increment the count.
                this._service = await this.vsls.shareService(SERVICE_NAME);

                this._service!.onRequest('INITIALIZE_CLIENT_SESSION', async params => {
                    const initializeClientSessionParams = params[1] as InitializeClientSessionParameters;
                    const subclientId = params[2] as string;
                    initializeClientSessionParams.args = {
                        ...initializeClientSessionParams.args,
                        subclientId
                    };
                    await (await this._server.glspClient).initializeClientSession(initializeClientSessionParams);
                });

                this._service!.onRequest('DISPOSE_CLIENT_SESSION', async params => {
                    const disposeClientSessionParams = params[1] as DisposeClientSessionParameters;
                    const subclientId = params[2] as string;
                    disposeClientSessionParams.args = {
                        ...disposeClientSessionParams.args,
                        subclientId
                    };
                    await (await this._server.glspClient).disposeClientSession(disposeClientSessionParams);
                });

                this._service!.onRequest('SEND_ACTION_MESSAGE', async params => {
                    const actionMessage = params[1] as ActionMessage;
                    const subclientId = params[2] as string;
                    (actionMessage.action as any)['subclientId'] = subclientId;
                    (await this._server.glspClient).sendActionMessage(actionMessage);
                });

                // TODO DA here we could expose the file as GModel
                // this._service!.onRequest(GET_COUNT_REQUEST, () => store.count);

                this._service!.onNotify(INCREMENT_COUNT_NOTIFICATION, (ev: any) => {
                    /*
                    store.increment();
                    */
                    const { action } = ev;
                    for (const key of this.clients.keys()) {
                        const message = {
                            clientId: key,
                            action: action,
                            liveshareState: 'broadcasted'
                        };
                        this._glspClient.sendActionMessage(message);
                    }

                    // Re-broadcast the notification to all other guests.
                    this._service!.notify(INCREMENT_COUNT_NOTIFICATION, ev);
                });
            } else if (e.session.role === Role.Guest) {
                // Attempt to grab a proxy reference to the custom
                // counter service on the host. If this doesn't exist,
                // then it means the host doesn't have this extension
                // installed, and therefore, the extension should
                // gracefully degrade.
                this._service = await this.vsls.getSharedService(SERVICE_NAME);
                if (!this._service) {
                    return;
                }

                this._service!.onNotify('ON_ACTION_MESSAGE', (message: any) => {
                    message = message as ActionMessage;
                    // message is for this guest
                    if (e.session.peerNumber === +(message.action as any)['subclientId']) {
                        this._server.onServerSendEmitter.fire(message);
                    }
                });

                // Grab the current count from the host, who is the
                // "source of truth" for the state store.
                // TODO DA here we could expose the file as GModel
                // store.count = await this._service.request(GET_COUNT_REQUEST, []);

                this._service.onNotify(INCREMENT_COUNT_NOTIFICATION, ({ peerNumber, action }: any) => {
                    // Ignore the notification if it originated with this user.
                    if (peerNumber === this.vsls.session.peerNumber) {
                        return;
                    }

                    for (const key of this.clients.keys()) {
                        const message = {
                            clientId: key,
                            action: action,
                            liveshareState: 'broadcasted'
                        };
                        this._glspClient.sendActionMessage(message);
                    }

                    /*
                    store.increment();
                    */
                });
            }
        });
    }
}

export const liveshareService = new LiveshareService();
