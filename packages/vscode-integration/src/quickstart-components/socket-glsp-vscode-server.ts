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
import {
    ActionMessage,
    ApplicationIdProvider,
    BaseJsonrpcGLSPClient,
    GLSPClient,
    InitializeParameters,
    InitializeResult
} from '@eclipse-glsp/protocol';
import * as net from 'net';
import { LiveshareGlspClientProvider } from '../liveshare';
import * as vscode from 'vscode';
import { createMessageConnection } from 'vscode-jsonrpc';
import { SocketMessageReader, SocketMessageWriter } from 'vscode-jsonrpc/node';
import { GlspVscodeServer } from '../types';
import { CollaborationGlspClient } from '../collaboration/collaboration-glsp-client';

interface SocketGlspVscodeServerOptions {
    /** Port of the running server. */
    readonly serverPort: number;
    /** Client ID to register the jsonRPC client with on the server. */
    readonly clientId: string;
    /** Name to register the client with on the server. */
    readonly clientName: string;
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
export class SocketGlspVscodeServer implements GlspVscodeServer, vscode.Disposable {
    readonly onSendToServerEmitter = new vscode.EventEmitter<unknown>();
    readonly onServerMessage: vscode.Event<unknown>;

    readonly onServerSendEmitter = new vscode.EventEmitter<unknown>();

    protected readonly socket = new net.Socket();
    protected _glspClient: GLSPClient;

    protected readonly onReady: Promise<void>;
    protected setReady: () => void;
    protected liveshareGlspClientProvider: LiveshareGlspClientProvider;
    _initializeResult: InitializeResult;

    constructor(protected readonly options: SocketGlspVscodeServerOptions) {
        this.onReady = new Promise(resolve => {
            this.setReady = resolve;
        });

        this.onServerMessage = this.onServerSendEmitter.event;

        const reader = new SocketMessageReader(this.socket);
        const writer = new SocketMessageWriter(this.socket);
        const connection = createMessageConnection(reader, writer);

        this.liveshareGlspClientProvider = new LiveshareGlspClientProvider();

        this._glspClient = new CollaborationGlspClient(new BaseJsonrpcGLSPClient({
            id: options.clientId,
            connectionProvider: connection
        }), this.liveshareGlspClientProvider, this.liveshareGlspClientProvider, this.liveshareGlspClientProvider);

        this.onSendToServerEmitter.event(message => {
            this.onReady.then(() => {
                if (ActionMessage.is(message)) {
                    this._glspClient.sendActionMessage(message);
                }
            });
        });
    }

    /**
     * Starts up the JSON-RPC client, initializes liveshare, and connects it to a running server.
     */
    async start(): Promise<void> {
        this.socket.connect(this.options.serverPort);

        await this.liveshareGlspClientProvider.initialize(this);

        await this._glspClient.start();
        const parameters = await this.createInitializeParameters();
        this._initializeResult = await this._glspClient.initializeServer(parameters);

        // The listener cant be registered before `glspClient.start()` because the
        // glspClient will reject the listener if it has not connected to the server yet.
        this._glspClient.onActionMessage(message => {
            this.onServerSendEmitter.fire(message);
        });

        this.setReady();
    }

    protected async createInitializeParameters(): Promise<InitializeParameters> {
        return {
            applicationId: ApplicationIdProvider.get(),
            protocolVersion: GLSPClient.protocolVersion
        };
    }

    /**
     * Stops the client. It cannot be restarted.
     */
    async stop(): Promise<void> {
        return this._glspClient.stop();
    }

    dispose(): void {
        this.onSendToServerEmitter.dispose();
        this.onServerSendEmitter.dispose();
        this.stop();
    }

    get initializeResult(): Promise<InitializeResult> {
        return this.onReady.then(() => this._initializeResult);
    }

    get glspClient(): Promise<GLSPClient> {
        return this.onReady.then(() => this._glspClient);
    }
}
