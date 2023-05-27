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
import { BaseJsonrpcGLSPClient, listen } from '@eclipse-glsp/protocol';
import { MessageConnection } from 'vscode-jsonrpc';
import { BaseGlspVscodeServer, GlspVscodeServerOptions } from '../../common';

export interface WebsocketGlspVscodeServerOptions extends GlspVscodeServerOptions {
    /** (Web)socket connection options of the running server. */
    readonly connectionOptions: WebSocketConnectionOptions;
}

export type WebSocketConnectionOptions =
    /* Socket connection options*/
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
 * This component can be used to bootstrap your extension when using an external
 * GLSP server implementation that communicates via WebSocket connection
 *
 * It sets up a JSON-RPC connection to a server running on a specified port and
 * provides an interface, ready to be used by the `GlspVscodeConnector` for the
 * GLSP-VSCode integration.
 */
export class WebSocketGlspVscodeServer extends BaseGlspVscodeServer<BaseJsonrpcGLSPClient> {
    constructor(protected override readonly options: WebsocketGlspVscodeServerOptions) {
        super(options);
    }

    protected getWebSocketAddress(): string | undefined {
        const opts = this.options.connectionOptions;
        if ('webSocketAddress' in opts) {
            return opts.webSocketAddress;
        }
        const protocol = opts.protocol ?? 'ws';
        const host = opts.host ?? 'localhost';
        return `${protocol}://${host}:${opts.port}/${opts.path}`;
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
        if (!webSocketAddress || !isValidWebSocketAddress(webSocketAddress)) {
            throw new Error(`Could not connect to to GLSP Server. The WebSocket address is invalid: '${webSocketAddress}'`);
        }

        return this.createWebSocketConnection(webSocketAddress);
    }

    protected createWebSocketConnection(address: string): Promise<MessageConnection> {
        const webSocket = new WebSocket(address);
        return listen(webSocket);
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
