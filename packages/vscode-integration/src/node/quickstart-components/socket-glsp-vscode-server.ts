/********************************************************************************
 * Copyright (c) 2021-2023 EclipseSource and others.
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
import { BaseJsonrpcGLSPClient, WebSocketWrapper, createWebSocketConnection } from '@eclipse-glsp/protocol';
import * as net from 'net';
import { MessageConnection, createMessageConnection } from 'vscode-jsonrpc';
import { SocketMessageReader, SocketMessageWriter } from 'vscode-jsonrpc/node';
import { WebSocket } from 'ws';
import { BaseGlspVscodeServer, GlspVscodeServerOptions } from '../../common/quickstart-components/base-glsp-vscode-server';

export interface SocketGlspVscodeServerOptions extends GlspVscodeServerOptions {
    /** (Web)socket connection options of the running server. */
    readonly connectionOptions: SocketConnectionOptions;
}

export type SocketConnectionOptions =
    /* Socket connection options*/
    | net.TcpSocketConnectOpts
    | {
          /** Address of the server websocket endpoint */
          webSocketAddress: string;
      }
    | {
          /** Server websocket port */
          port: number;
          /** Server hostname. Default is 'localhost' */
          host?: string;
          /** Websocket endpoint path*/
          path: string;
          /** The websocket protocol used by the server. Default is 'ws' */
          protocol?: 'ws' | 'wss';
      };

/**
 * This component can be used to bootstrap your extension when using the default
 * GLSP server implementation via (Web)socket connection
 *
 * It sets up a JSON-RPC connection to a server running on a specified port and
 * provides an interface, ready to be used by the `GlspVscodeConnector` for the
 * GLSP-VSCode integration.
 *
 * If you need a component to quickly start your default GLSP server, take a look
 * at the `GlspServerStarter` quickstart component.
 */
export class SocketGlspVscodeServer extends BaseGlspVscodeServer<BaseJsonrpcGLSPClient> {
    constructor(protected override readonly options: SocketGlspVscodeServerOptions) {
        super(options);
    }

    protected getWebSocketAddress(): string | undefined {
        const opts = this.options.connectionOptions;
        if ('webSocketAddress' in opts) {
            return opts.webSocketAddress;
        }
        if ('path' in opts && opts.path !== undefined) {
            const protocol = opts.protocol ?? 'ws';
            const host = opts.host ?? '127.0.0.1';
            return `${protocol}://${host}:${opts.port}/${opts.path}`;
        }

        return undefined;
    }

    override async createGLSPClient(): Promise<BaseJsonrpcGLSPClient> {
        const connection = await this.createConnection();
        this.toDispose.push(connection);
        return new BaseJsonrpcGLSPClient({
            id: this.options.clientId,
            connectionProvider: connection
        });
    }

    protected async createConnection(): Promise<MessageConnection> {
        const webSocketAddress = this.getWebSocketAddress();
        if (webSocketAddress && !isValidWebSocketAddress(webSocketAddress)) {
            throw new Error(`Could not connect to to GLSP Server. The WebSocket address is invalid: '${webSocketAddress}'`);
        }
        if (webSocketAddress) {
            return this.createWebSocketConnection(webSocketAddress);
        }

        if (!('port' in this.options.connectionOptions)) {
            throw new Error('Could not connect to to GLSP Server. The given server port is not defined');
        }
        if (isNaN(this.options.connectionOptions.port)) {
            throw new Error(
                `Could not connect to to GLSP Server. The given server port is not a number: ${this.options.connectionOptions.port}`
            );
        }
        return this.createSocketConnection(this.options.connectionOptions);
    }

    protected createSocketConnection(opts: net.TcpSocketConnectOpts): MessageConnection {
        const socket = new net.Socket();
        const reader = new SocketMessageReader(socket);
        const writer = new SocketMessageWriter(socket);
        const connection = createMessageConnection(reader, writer);
        socket.connect(opts);
        return connection;
    }

    protected createWebSocketConnection(address: string): Promise<MessageConnection> {
        const webSocket = new WebSocket(address);
        return new Promise(resolve => {
            webSocket.onopen = () => {
                const socket = wrapNodeWs(webSocket);
                resolve(createWebSocketConnection(socket));
            };
        });
    }
}

export function isValidWebSocketAddress(address: string): boolean {
    try {
        const { protocol } = new URL(address);
        return protocol === 'ws:' || protocol === 'wss:';
    } catch (error) {
        return false;
    }
}

export function wrapNodeWs(socket: WebSocket): WebSocketWrapper {
    return {
        send: content => socket.send(content),
        onMessage: cb => (socket.onmessage = event => cb(event.data)),
        onClose: cb => (socket.onclose = event => cb(event.code, event.reason)),
        onError: cb =>
            (socket.onerror = event => {
                if ('error' in event) {
                    cb(event.error);
                }
            }),
        dispose: () => socket.close()
    };
}
