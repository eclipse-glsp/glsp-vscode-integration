/********************************************************************************
 * Copyright (c) 2020-2021 TypeFox and others.
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
// Implementation is based on https://github.com/eclipse/sprotty-vscode/blob/master/sprotty-vscode-extension/src/sprotty-webview.ts
import { GLSPClient } from '@eclipse-glsp/protocol';
import {
    Action,
    ActionMessage,
    isActionMessage,
    isDiagramIdentifier,
    isWebviewReadyMessage,
    SprottyDiagramIdentifier
} from 'sprotty-vscode-protocol';
import * as vscode from 'vscode';
import { isResponseMessage, ResponseMessage } from 'vscode-jsonrpc/lib/messages';

import { ExtensionActionDispatcher } from './action';
import { ExtensionActionHandler } from './action/action-handler';
import { GlspDiagramEditorContext } from './glsp-diagram-editor-context';
import { Disposable } from './utils/disposable';

export class GLSPWebViewRegistry {
    private registry: Map<string, GLSPWebView[]> = new Map();

    get(uri: vscode.Uri): GLSPWebView[] {
        return this.registry.get(uri.toString()) || [];
    }

    add(uri: vscode.Uri, webview: GLSPWebView): void {
        const key = uri.toString();
        const webviews = this.registry.get(key) || [];
        webviews.push(webview);
        this.registry.set(key, webviews);

        webview.onDidDispose(() => this.delete(uri, webview));

    }

    delete(uri: vscode.Uri, webview: GLSPWebView): void {
        const key = uri.toString();
        const webviews = this.registry.get(key) || [];
        const index = webviews.indexOf(webview);
        if (index > -1) {
            webviews.splice(index, 1);
            this.registry.set(key, webviews);
        }
    }

    getActiveWebview(): GLSPWebView | undefined {
        let activeWebview: GLSPWebView | undefined;
        this.registry.forEach((webviews: GLSPWebView[], key: string) => {
            const activeViews = webviews.filter(webview => webview.diagramPanel.active);
            if (activeViews.length === 1) {
                activeWebview = activeViews[0];
                return;
            }
        });
        return activeWebview;
    }
}

export interface GLSPWebviewOptions {
    editorContext: GlspDiagramEditorContext;
    identifier: SprottyDiagramIdentifier;
    localResourceRoots: vscode.Uri[];
    scriptUri: vscode.Uri;
    webviewPanel: vscode.WebviewPanel;
}
export class GLSPWebView extends Disposable implements ExtensionActionDispatcher {
    static viewCount = 0;

    protected readonly editorContext: GlspDiagramEditorContext;
    protected readonly scriptUri: vscode.Uri;
    protected readonly diagramIdentifier: SprottyDiagramIdentifier;
    readonly diagramPanel: vscode.WebviewPanel;
    protected readonly actionHandlers = new Map<string, ExtensionActionHandler>();

    protected messageQueue: (ActionMessage | SprottyDiagramIdentifier | ResponseMessage)[] = [];
    private resolveWebviewReady: () => void;
    // eslint-disable-next-line no-invalid-this
    private readonly webviewReady = new Promise<void>(resolve => this.resolveWebviewReady = resolve);

    constructor(options: GLSPWebviewOptions) {
        super();
        this.editorContext = options.editorContext;
        this.diagramIdentifier = options.identifier;
        this.scriptUri = options.scriptUri;
        this.diagramPanel = this.initializeDiagramPanel(options.webviewPanel, options.localResourceRoots);
    }

    protected ready(): Promise<void> {
        return this.webviewReady;
    }

    protected glspClient(): Promise<GLSPClient> {
        return this.editorContext.glspClient();
    }

    protected initializeDiagramPanel(webViewPanel: vscode.WebviewPanel, localResourceRoots: vscode.Uri[]): vscode.WebviewPanel {
        webViewPanel.webview.options = {
            localResourceRoots,
            enableScripts: true
        };
        this.initializeWebview(webViewPanel.webview);
        webViewPanel.onDidDispose(() => this.dispose());
        return webViewPanel;
    }

    protected initializeWebview(webview: vscode.Webview): void {
        webview.html = `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, height=device-height">
                    <link
                        rel="stylesheet" href="https://use.fontawesome.com/releases/v5.6.3/css/all.css"
                        integrity="sha384-UHRtZLI+pbxtHCWp1t77Bi1L4ZtiqrqD80Kn4Z8NTSRyMA2Fd33n5dQ8lWUE00s/"
                        crossorigin="anonymous">
                </head>
                <body>
                    <div id="${this.diagramIdentifier.clientId}_container" style="height: 100%;"></div>
                    <script src="${webview.asWebviewUri(this.scriptUri).toString()}"></script>
                </body>
            </html>`;
    }

    public async connect(): Promise<void> {
        this.addDisposable(this.diagramPanel.onDidChangeViewState(event => {
            if (event.webviewPanel.visible) {
                this.messageQueue.forEach(message => this.sendToWebview(message));
                this.messageQueue = [];
            }
            this.setWebviewActiveContext(event.webviewPanel.active);
        }));
        this.setWebviewActiveContext(this.diagramPanel.active);

        this.addDisposable(this.diagramPanel.webview.onDidReceiveMessage(message => this.receiveFromWebview(message)));

        this.addDisposable(this.editorContext.onMessageFromGLSPServer(message => this.sendToWebview(message)));
        this.sendDiagramIdentifier();
    }

    protected setWebviewActiveContext(isActive: boolean): void {
        vscode.commands.executeCommand('setContext', 'glsp-' + this.diagramIdentifier.diagramType + '-focused', isActive);
    }

    protected async sendToWebview(message: any): Promise<void> {
        if (isActionMessage(message) || isDiagramIdentifier(message) || isResponseMessage(message)) {
            if (this.diagramPanel.visible) {
                if (isActionMessage(message)) {
                    const shouldForwardToWebview = await this.handleLocally(message.action);
                    if (shouldForwardToWebview) {
                        this.diagramPanel.webview.postMessage(message);
                    }
                } else {
                    this.diagramPanel.webview.postMessage(message);
                }
            } else {
                this.messageQueue.push(message);
            }
        }
    }

    protected async sendDiagramIdentifier(): Promise<void> {
        await this.ready();
        this.sendToWebview(this.diagramIdentifier);
    }

    protected async receiveFromWebview(message: any): Promise<void> {
        if (isWebviewReadyMessage(message)) {
            this.resolveWebviewReady();
        } else if (isActionMessage(message)) {
            const shouldForwardToServer = await this.handleLocally(message.action);
            if (shouldForwardToServer) {
                this.forwardToGlspServer(message);
            }
        }
    }

    protected async forwardToGlspServer(message: ActionMessage): Promise<void> {
        const glspClient = await this.glspClient();
        glspClient.sendActionMessage(message);
    }

    dispatch(action: Action): void {
        this.sendToWebview({
            clientId: this.diagramIdentifier.clientId,
            action,
            _localDispatch: true
        });
    }

    /**
     * Handle the action locally if a local action handler is present.
     * @param action The action that should be handled.
     * @returns true if the action should be further propagated
     * (either the glspServer ot the webview), false otherwise.
     */
    protected handleLocally(action: Action): Thenable<boolean> {
        const actionHandler = this.actionHandlers.get(action.kind);
        if (actionHandler) {
            return actionHandler.handleAction(action);
        }
        return Promise.resolve(true);
    }

    addActionHandler(actionHandler: ExtensionActionHandler): void {
        actionHandler.kinds.forEach(kind => this.actionHandlers.set(kind, actionHandler));
    }
}
