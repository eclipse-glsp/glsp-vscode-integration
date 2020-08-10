/********************************************************************************
 * Copyright (c) 2020 EclipseSource and others.
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
import { ActionMessage } from 'sprotty-vscode-protocol';
import { Disposable, Message, MessageConnection, NotificationType } from 'vscode-jsonrpc';

import { GLSPClient } from './glsp-client';
import { ActionMessageHandler, MaybePromise } from './types';

export type ConnectionProvider = MessageConnection | (() => MaybePromise<MessageConnection>);

enum ClientState {
    Initial,
    Starting,
    StartFailed,
    Running,
    Stopping,
    Stopped
}

export const ActionMessageNotification = new NotificationType<ActionMessage, void>('process');

export interface JsonRpcGLSPClientOptions {
    id: string;
    name: string;
    onReady?: Promise<void>;
    connectionProvider: ConnectionProvider;
}

export namespace JsonRpcGLSPClientOptions {
    export function is(object: any): object is JsonRpcGLSPClientOptions {
        return 'id' in object && typeof object['id'] === 'string'
            && 'name' in object && typeof object['name'] === 'string'
            && 'connectionProvider' in object;
    }
}

export class JsonRpcGLSPClient implements GLSPClient {
    readonly name: string;
    readonly id: string;
    protected readonly connectionProvider: ConnectionProvider;
    protected connectionPromise?: Thenable<MessageConnection>;
    protected resolvedConnection?: MessageConnection;
    protected state: ClientState;
    protected onStop?: Thenable<void>;
    protected _onReady: Promise<void>;

    constructor(options: JsonRpcGLSPClientOptions) {
        Object.assign(this, options);
        if (!this._onReady) {
            this._onReady = Promise.resolve();
        }
    }
    onActionMessage(handler: ActionMessageHandler): void {
        if (!this.isConnectionActive()) {
            throw new Error('GlspJsonRpcClient is not ready yet');
        }
        this.resolvedConnection!.onNotification(ActionMessageNotification, handler);
    }

    sendActionMessage(message: ActionMessage): void {
        if (!this.isConnectionActive()) {
            throw new Error('GlspJsonRpcClient is not ready yet');
        }
        this.resolvedConnection!.sendNotification(ActionMessageNotification, message);
    }

    onReady(): Promise<void> {
        return this._onReady;
    }

    start(): Disposable {
        this.state = ClientState.Starting;
        this.resolveConnection().then(connection => {
            connection.listen();
            this.resolvedConnection = connection;
            this.state = ClientState.Running;
        }).then(undefined, error => {
            this.error('Failed to start connection to server', error);
            this.state = ClientState.StartFailed;
        });
        return {
            dispose: () => this.stop()
        };

    }

    stop(): Thenable<void> {
        if (!this.connectionPromise) {
            this.state = ClientState.Stopped;
            return Promise.resolve();
        }
        if (this.state === ClientState.Stopping && this.onStop) {
            return this.onStop;
        }
        this.state = ClientState.Stopping;
        return this.onStop = this.resolveConnection().then(connection => {
            // TODO: Send shutdown request to server
            // TODO :Send Exit notification to server;
            connection.dispose();
            this.state = ClientState.Stopped;
            this.onStop = undefined;
            this.connectionPromise = undefined;
            this.resolvedConnection = undefined;
        });
    }

    private resolveConnection(): Thenable<MessageConnection> {
        if (!this.connectionPromise) {
            this.connectionPromise = this.doCreateConnection();
        }
        return this.connectionPromise;
    }

    protected async doCreateConnection(): Promise<MessageConnection> {
        const connection = typeof this.connectionProvider === 'function' ? await this.connectionProvider() : this.connectionProvider;
        connection.onError((data: [Error, Message, number]) => this.handleConnectionError(data[0], data[1], data[2]));
        connection.onClose(this.handleConnectionClosed);
        return connection;
    }

    protected handleConnectionError(error: Error, _message: Message, _count: number): void {
        this.error('Connection to server is erroring. Shutting down server.', error);
        this.stop();
    }

    protected handleConnectionClosed(): void {
        if (this.state === ClientState.Stopping || this.state === ClientState.Stopped) {
            return;
        }
    }

    protected error(message: string, ...optionalParams: any[]): void {
        console.error(`[GlspJsonRpcClient] ${message}`, optionalParams);
    }

    protected isConnectionActive(): boolean {
        return this.state === ClientState.Running && !!this.resolvedConnection;
    }
}
