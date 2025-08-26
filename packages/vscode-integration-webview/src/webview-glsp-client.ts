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
    Action,
    ActionMessage,
    ActionMessageHandler,
    ClientState,
    Disposable,
    DisposableCollection,
    DisposeClientSessionParameters,
    Emitter,
    Event,
    GLSPClient,
    InitializeClientSessionParameters,
    InitializeParameters,
    InitializeResult
} from '@eclipse-glsp/client';
import { HOST_EXTENSION, NotificationType, RequestType } from 'vscode-messenger-common';
import { Messenger } from 'vscode-messenger-webview';

export interface WebviewGlspClientOptions extends GLSPClient.Options {
    messenger?: Messenger;
}

export const ActionMessageNotification: NotificationType<ActionMessage> = { method: 'actionMessage' };
export const ClientStateChangeNotification: NotificationType<ClientState> = { method: 'notifyClientStateChange' };
export const StartRequest: RequestType<undefined, void> = { method: 'start' };
export const InitializeServerRequest: RequestType<InitializeParameters, InitializeResult> = { method: 'initializeServer' };
export const InitializeClientSessionRequest: RequestType<InitializeClientSessionParameters, void> = { method: 'initializeClientSession' };
export const DisposeClientSessionRequest: RequestType<DisposeClientSessionParameters, void> = { method: 'disposeClientSession' };
export const ShutdownServerNotification: NotificationType<void> = { method: 'shutdownServer' };
export const StopRequest: RequestType<undefined, void> = { method: 'stop' };
/**
 * GLSP client implementation for the diagram webview. This is proxy implementation
 * that  communicates with the actual GLSP client running in the host extension.
 * via the vscode-messenger protocol
 */
export class WebviewGlspClient implements GLSPClient, Disposable {
    readonly id: string;
    protected messenger: Messenger;
    protected toDispose = new DisposableCollection();
    protected onActionMessageEmitter = new Emitter<ActionMessage>();

    protected onCurrentStateChangedEmitter = new Emitter<ClientState>();
    get onCurrentStateChanged(): Event<ClientState> {
        return this.onCurrentStateChangedEmitter.event;
    }

    protected _currentState: ClientState = ClientState.Initial;

    get currentState(): ClientState {
        return this._currentState;
    }

    protected _initializeResult?: InitializeResult;
    get initializeResult(): InitializeResult | undefined {
        return this._initializeResult;
    }

    protected onServerInitializedEmitter = new Emitter<InitializeResult>();
    get onServerInitialized(): Event<InitializeResult> {
        return this.onServerInitializedEmitter.event;
    }

    constructor(options: WebviewGlspClientOptions) {
        this.id = options.id;
        this.messenger = options.messenger ?? new Messenger();
        this.toDispose.push(this.onActionMessageEmitter, this.onServerInitializedEmitter, this.onCurrentStateChangedEmitter);
        this.messenger.onNotification(ActionMessageNotification, msg => this.onActionMessageEmitter.fire(msg));
        this.messenger.onNotification(ClientStateChangeNotification, state => this.updateState(state));
    }

    protected updateState(state: ClientState): void {
        if (this._currentState !== state) {
            this._currentState = state;
            this.onCurrentStateChangedEmitter.fire(this._currentState);
        }
    }

    async start(): Promise<void> {
        try {
            await this.messenger.sendRequest(StartRequest, HOST_EXTENSION);
        } catch (error) {
            console.error('Failed to start connection to server', error);
            this.updateState(ClientState.StartFailed);
        }
    }

    async initializeServer(params: InitializeParameters): Promise<InitializeResult> {
        if (this.initializeResult) {
            return this.initializeResult;
        }
        const result = await this.messenger.sendRequest(InitializeServerRequest, HOST_EXTENSION, params);
        this._initializeResult = result;
        this.onServerInitializedEmitter.fire(result);
        return result;
    }

    initializeClientSession(params: InitializeClientSessionParameters): Promise<void> {
        return this.messenger.sendRequest(InitializeClientSessionRequest, HOST_EXTENSION, params);
    }

    disposeClientSession(params: DisposeClientSessionParameters): Promise<void> {
        return this.messenger.sendRequest(DisposeClientSessionRequest, HOST_EXTENSION, params);
    }

    shutdownServer(): void {
        this.messenger.sendNotification(ShutdownServerNotification, HOST_EXTENSION);
    }

    async stop(): Promise<void> {
        if (this.currentState === ClientState.Stopped) {
            return;
        }
        await this.messenger.sendRequest(StopRequest, HOST_EXTENSION);
    }

    sendActionMessage(message: ActionMessage<Action>): void {
        this.messenger.sendNotification(ActionMessageNotification, HOST_EXTENSION, message);
    }

    onActionMessage(handler: ActionMessageHandler): Disposable {
        return this.onActionMessageEmitter.event(handler);
    }

    dispose(): void {
        this.toDispose.dispose();
    }
}
