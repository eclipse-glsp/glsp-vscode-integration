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
import { SprottyDiagramIdentifier } from 'sprotty-vscode-protocol';
import * as vscode from 'vscode';

import { CenterAction, FitToScreenAction, LayoutOperation } from './action';
import { GLSPCommand } from './glsp-commands';
import { GlspDiagramDocument } from './glsp-diagram-document';
import { GlspDiagramEditorContext } from './glsp-diagram-editor-context';
import { GLSPWebView, GLSPWebViewRegistry } from './glsp-webview';
import { disposeAll } from './utils/disposable';

export class GlspDiagramEditorProvider implements vscode.CustomEditorProvider<GlspDiagramDocument> {
    public static VIEW_TYPE = 'glspDiagram';
    protected webviewRegistry: GLSPWebViewRegistry;
    private _onDidChangeCustomDocument: vscode.EventEmitter<vscode.CustomDocumentEditEvent<GlspDiagramDocument>>;

    constructor(protected readonly context: vscode.ExtensionContext,
        protected readonly editorContext: GlspDiagramEditorContext) {
        this.webviewRegistry = new GLSPWebViewRegistry();
        this._onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<GlspDiagramDocument>>();
        this.registerCommands();
    }

    protected registerCommands(): void {
        const options = {
            context: this.context,
            registry: this.webviewRegistry,
            extensionPrefix: this.editorContext.extensionPrefix
        };

        GLSPCommand.registerActionCommand({
            action: new FitToScreenAction([]),
            command: GLSPCommand.FIT_TO_SCREEN,
            ...options
        });

        GLSPCommand.registerActionCommand({
            action: new CenterAction([]),
            command: GLSPCommand.CENTER,
            ...options
        });

        GLSPCommand.registerActionCommand({
            action: new LayoutOperation(),
            command: GLSPCommand.LAYOUT,
            ...options
        });
    }

    get onDidChangeCustomDocument(): vscode.Event<vscode.CustomDocumentEditEvent<GlspDiagramDocument>> {
        return this._onDidChangeCustomDocument.event;
    }

    saveCustomDocument(document: GlspDiagramDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        return document.save(cancellation);
    }

    saveCustomDocumentAs(document: GlspDiagramDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
        return document.saveAs(destination, cancellation);
    }
    revertCustomDocument(document: GlspDiagramDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        return document.revert(cancellation);
    }

    backupCustomDocument(document: GlspDiagramDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken):
        Thenable<vscode.CustomDocumentBackup> {
        return document.backup(context.destination, cancellation);
    }
    async openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): Promise<GlspDiagramDocument> {
        const document = await GlspDiagramDocument.create(uri, openContext.backupId);

        const listeners: vscode.Disposable[] = [];
        listeners.push(document.onDidChange(e => {
            this._onDidChangeCustomDocument.fire({
                document,
                ...e
            });

        }));
        document.onDidDispose(() => disposeAll(listeners));
        return document;
    }
    resolveCustomEditor(document: GlspDiagramDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        const identifier = this.createDiagramIdentifier(document);
        const webview = this.editorContext.createWebview(webviewPanel, identifier);
        this.webviewRegistry.add(document.uri, webview);
        webview.addActionHandler(document);
        document.initialize(identifier, webview);

        return webview.connect();
    }

    protected createDiagramIdentifier(document: GlspDiagramDocument): SprottyDiagramIdentifier {
        const diagramType = this.editorContext.diagramType;
        const clientId = diagramType + '_' + GLSPWebView.viewCount++;
        return {
            diagramType,
            uri: serializeUri(document.uri),
            clientId
        };
    }

}

export function serializeUri(uri: vscode.Uri): string {
    let uriString = uri.toString();
    const match = uriString.match(/file:\/\/\/([a-z])%3A/i);
    if (match) {
        uriString = 'file:///' + match[1] + ':' + uriString.substring(match[0].length);
    }
    return uriString;
}
