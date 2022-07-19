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
    InitializeResult,
    MaybePromise
} from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';
import { MessageConnection } from 'vscode-jsonrpc';
import { GlspVscodeServer } from '../types';

export interface JsonRpcVscodeServerOptions {
    /** Client ID to register the jsonRPC client with on the server. */
    readonly clientId: string;
}

export abstract class JsonRpcVscodeServer implements GlspVscodeServer, vscode.Disposable {
    readonly onSendToServerEmitter = new vscode.EventEmitter<unknown>();
    readonly onServerMessage: vscode.Event<unknown>;

    protected readonly onServerSendEmitter = new vscode.EventEmitter<unknown>();

    protected readonly _glspClient: GLSPClient;
    protected toDispose: vscode.Disposable[] = [];

    protected readonly onReady: Promise<void>;
    protected setReady: () => void;
    _initializeResult: InitializeResult;

    constructor(protected readonly options: JsonRpcVscodeServerOptions) {
        this.onReady = new Promise(resolve => {
            this.setReady = resolve;
        });

        this.onServerMessage = this.onServerSendEmitter.event;

        const connection = this.createConnection();

        this._glspClient = new BaseJsonrpcGLSPClient({
            id: options.clientId,
            connectionProvider: connection
        });

        this.onSendToServerEmitter.event(message => {
            this.onReady.then(() => {
                if (ActionMessage.is(message)) {
                    this._glspClient.sendActionMessage(message);
                }
            });
        });
    }

    protected abstract createConnection(): MessageConnection;

    protected preStart?(): MaybePromise<void>;

    /**
     * Starts up the JSON-RPC client and connects it to a running server.
     */
    async start(): Promise<void> {
        await this.preStart?.();
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
