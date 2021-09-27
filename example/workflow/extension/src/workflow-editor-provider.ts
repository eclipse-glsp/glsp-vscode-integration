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
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.01
 ********************************************************************************/

import * as vscode from 'vscode';
import * as path from 'path';

import { GlspVscodeConnector } from '@eclipse-glsp/vscode-integration';
import { GlspEditorProvider } from '@eclipse-glsp/vscode-integration/lib/quickstart-components';

export default class WorkflowEditorProvider extends GlspEditorProvider {
    diagramType = 'workflow-diagram';

    constructor(
        protected readonly extensionContext: vscode.ExtensionContext,
        protected readonly glspVscodeConnector: GlspVscodeConnector
    ) {
        super(glspVscodeConnector);
    }

    setUpWebview(_document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken, clientId: string): void {
        const localResourceRootsUri = vscode.Uri.file(
            path.join(this.extensionContext.extensionPath, './pack')
        );

        const webviewScriptSourceUri = vscode.Uri.file(
            path.join(this.extensionContext.extensionPath, './pack/webview.js')
        );

        webviewPanel.webview.options = {
            localResourceRoots: [localResourceRootsUri],
            enableScripts: true
        };

        webviewPanel.webview.html = `
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
                    <div id="${clientId}_container" style="height: 100%;"></div>
                    <script src="${webviewPanel.webview.asWebviewUri(webviewScriptSourceUri).toString()}"></script>
                </body>
            </html>`;
    }
}
