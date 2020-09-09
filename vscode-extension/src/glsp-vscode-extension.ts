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
import {
    ActionMessageHandler,
    ApplicationIdProvider,
    BaseJsonrpcGLSPClient,
    ConnectionProvider,
    GLSPClient
} from '@eclipse-glsp/protocol';
import * as net from 'net';
import { ActionMessage, SprottyVscodeExtension } from 'sprotty-vscode';
import * as vscode from 'vscode';
import {
    createMessageConnection,
    Emitter,
    MessageConnection,
    SocketMessageReader,
    SocketMessageWriter
} from 'vscode-jsonrpc';

export abstract class GLSPVscodeExtension extends SprottyVscodeExtension {
    protected _glspClient: BaseJsonrpcGLSPClient;
    protected onReady: Promise<void> = Promise.resolve();

    protected onMessageFromGLSPServerEmmiter = new Emitter<ActionMessage>();

    constructor(extensionPrefix: string, context: vscode.ExtensionContext) {
        super(extensionPrefix, context);
        this.initalizeGLSPClient();
    }

    public abstract readonly id: string;
    protected abstract getConnectionProvider(): ConnectionProvider;

    initalizeGLSPClient(): void {
        this._glspClient = new BaseJsonrpcGLSPClient({
            id: this.id,
            name: this.extensionPrefix,
            connectionProvider: this.getConnectionProvider()
        });
        this.onReady = this._glspClient.start().then(() => {
            this._glspClient.initializeServer({ applicationId: ApplicationIdProvider.get() });
            this._glspClient.onActionMessage(message => this.onMessageFromGLSPServerEmmiter.fire(message));
        });
    }

    onMessageFromGLSPServer(listener: ActionMessageHandler): vscode.Disposable {
        return this.onMessageFromGLSPServerEmmiter.event(listener);
    }
    deactiveGLSPCLient(): Thenable<void> {
        return Promise.resolve(undefined);
        // if (!this.glspClient) {
        //     return Promise.resolve(undefined);
        // }
        // return this.glspClient.stop();
    }

    async glspClient(): Promise<GLSPClient> {
        await this.onReady;
        return this._glspClient;
    }
}

export function createSocketConnection(outSocket: net.Socket, inSocket: net.Socket): MessageConnection {
    const reader = new SocketMessageReader(inSocket);
    const writer = new SocketMessageWriter(outSocket);
    return createMessageConnection(reader, writer);
}
