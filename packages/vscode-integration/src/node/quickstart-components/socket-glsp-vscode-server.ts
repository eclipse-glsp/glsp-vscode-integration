/********************************************************************************
 * Copyright (c) 2021-2022 EclipseSource and others.
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
import * as net from 'net';
import { MessageConnection } from 'vscode-jsonrpc';
import { createMessageConnection, SocketMessageReader, SocketMessageWriter } from 'vscode-jsonrpc/node';
import { JsonRpcVscodeServer } from '../../common/quickstart-components/jsonrpc-vscode-server';

interface SocketGlspVscodeServerOptions {
    /** Port of the running server. */
    readonly serverPort: number;
    /** Client ID to register the jsonRPC client with on the server. */
    readonly clientId: string;
}

/**
 * This component can be used to bootstrap your extension when using the default
 * GLSP server implementation, which you can find here:
 * https://github.com/eclipse-glsp/glsp-server
 *
 * It sets up a JSON-RPC connection to a server running on a specified port and
 * provides an interface, ready to be used by the `GlspVscodeConnector` for the
 * GLSP-VSCode integration.
 *
 * If you need a component to quickly start your default GLSP server, take a look
 * at the `GlspServerStarter` quickstart component.
 */
export class SocketGlspVscodeServer extends JsonRpcVscodeServer {
    protected socket: net.Socket;

    constructor(protected override options: SocketGlspVscodeServerOptions) {
        super(options);
    }

    protected createConnection(): MessageConnection {
        // eslint-disable-next-line no-useless-catch
        try {
            this.socket = new net.Socket();
            const reader = new SocketMessageReader(this.socket);
            const writer = new SocketMessageWriter(this.socket);
            return createMessageConnection(reader, writer);
        } catch (error) {
            throw error;
        }
    }

    override preStart(): void {
        this.socket.connect(this.options.serverPort);
    }
}
