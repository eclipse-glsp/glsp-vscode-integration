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
import { ActionMessageHandler, ApplicationIdProvider, BaseJsonrpcGLSPClient, GLSPClient } from '@eclipse-glsp/protocol';
import * as net from 'net';
import * as path from 'path';
import { Action, ActionMessage, SprottyDiagramIdentifier } from 'sprotty-vscode-protocol';
import * as vscode from 'vscode';
import {
    createMessageConnection,
    Emitter,
    MessageConnection,
    SocketMessageReader,
    SocketMessageWriter
} from 'vscode-jsonrpc';

import { CenterAction, FitToScreenAction, LayoutOperation } from './action';
import { GLSPCommand } from './glsp-commands';
import { GlspDiagramEditorProvider } from './glsp-diagram-editor-provider';
import { GLSPWebView } from './glsp-webview';
import { ServerConnectionProvider } from './server-connection-provider';
import { Disposable } from './utils/disposable';

export abstract class GlspDiagramEditorContext extends Disposable {
    protected _glspClient: BaseJsonrpcGLSPClient;
    protected onReady: Promise<void> = Promise.resolve();

    protected onMessageFromGLSPServerEmitter = new Emitter<ActionMessage>();

    public abstract readonly id: string;
    public abstract readonly diagramType: string;
    public abstract readonly extensionPrefix: string;

    private editorProvider: GlspDiagramEditorProvider;

    constructor(readonly context: vscode.ExtensionContext) {
        super();
        this.addDisposable(this.registerEditorProvider());
        this.initializeGLSPClient();
        this.registerCommands();
    }

    protected abstract getConnectionProvider(): ServerConnectionProvider;

    protected registerEditorProvider(): vscode.Disposable {
        this.editorProvider = new GlspDiagramEditorProvider(this.context, this);
        const viewType = `${this.extensionPrefix}.${GlspDiagramEditorProvider.VIEW_TYPE}`;
        return vscode.window.registerCustomEditorProvider(viewType,
            this.editorProvider
            , {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false
            });
    }

    protected initializeGLSPClient(): void {
        this._glspClient = new BaseJsonrpcGLSPClient({
            id: this.id,
            name: this.extensionPrefix,
            connectionProvider: () => this.getConnectionProvider().createConnection()
        });
        this.onReady = this._glspClient.start().then(() => {
            this._glspClient.initializeServer({ applicationId: ApplicationIdProvider.get() });
            this._glspClient.onActionMessage(message => this.onMessageFromGLSPServerEmitter.fire(message));
        });
    }

    abstract createWebview(webviewPanel: vscode.WebviewPanel, identifier: SprottyDiagramIdentifier): GLSPWebView;

    registerActionHandlers(webview: GLSPWebView): void {
        // e.g. webview.addActionHandler(myHandler);
    }

    getExtensionFileUri(...segments: string[]): vscode.Uri {
        return vscode.Uri
            .file(path.join(this.context.extensionPath, ...segments));
    }

    onMessageFromGLSPServer(listener: ActionMessageHandler): vscode.Disposable {
        return this.onMessageFromGLSPServerEmitter.event(listener);
    }

    deactivateGLSPClient(): Thenable<void> {
        this.dispose();
        return Promise.resolve(undefined);
    }

    async glspClient(): Promise<GLSPClient> {
        await this.onReady;
        return this._glspClient;
    }

    protected registerCommands(): void {
        this.registerActionCommand(GLSPCommand.FIT_TO_SCREEN, new FitToScreenAction([]));
        this.registerActionCommand(GLSPCommand.CENTER, new CenterAction([]));
        this.registerActionCommand(GLSPCommand.LAYOUT, new LayoutOperation());
    }
    /**
     * Register a command that dispatches a new action when triggered.
     * @param command Command id without extension prefix.
     * @param action The action that should be dispatched.
     */
    protected registerActionCommand(command: string, action: Action): void {
        GLSPCommand.registerActionCommand({
            command,
            action,
            context: this.context,
            registry: this.editorProvider.webviewRegistry,
            extensionPrefix: this.extensionPrefix
        });
    }

}

export function createSocketConnection(outSocket: net.Socket, inSocket: net.Socket): MessageConnection {
    const reader = new SocketMessageReader(inSocket);
    const writer = new SocketMessageWriter(outSocket);
    return createMessageConnection(reader, writer);
}
