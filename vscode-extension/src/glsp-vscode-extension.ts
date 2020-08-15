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
import { ActionMessage, SprottyVscodeExtension } from 'sprotty-vscode';
import * as vscode from 'vscode';
import { Emitter } from 'vscode-jsonrpc';

import { GLSPClient } from './glsp-client/glsp-client';
import { ConnectionProvider, JsonRpcGLSPClient } from './glsp-client/glsp-jsonrpc-client';
import { ActionMessageHandler } from './glsp-client/types';

export abstract class GLSPVscodeExtension extends SprottyVscodeExtension {
    protected _glspClient: JsonRpcGLSPClient;

    protected onMessageFromGLSPServerEmmiter = new Emitter<ActionMessage>();

    constructor(extensionPrefix: string, context: vscode.ExtensionContext) {
        super(extensionPrefix, context);
        this.initalizeGLSPClient();
    }

    public abstract readonly id: string;
    protected abstract getConnectionProvider(): ConnectionProvider;

    initalizeGLSPClient(): void {
        this._glspClient = new JsonRpcGLSPClient({
            id: this.id,
            name: this.extensionPrefix,
            connectionProvider: this.getConnectionProvider()
        });
        this._glspClient.start();
        this._glspClient.onReady().then(() => {
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

    get glspClient(): GLSPClient {
        return this._glspClient;
    }
}

export function getPort(argKey: string): number {
    argKey = `${argKey.replace('=', '')}=`;
    const portArg = process.argv.filter(arg => arg.startsWith(argKey))[0];
    if (!portArg) {
        return NaN;
    } else {
        return Number.parseInt(portArg.substring('--WORKFLOW_LSP='.length), 10);
    }
}

