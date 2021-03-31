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
import {
    GlspDiagramEditorContext,
    GLSPEnvVariable,
    GLSPJavaServerArgs,
    GLSPWebView,
    JavaSocketServerConnectionProvider
} from '@eclipse-glsp/vscode-integration';
import { ServerConnectionProvider } from '@eclipse-glsp/vscode-integration/lib/server-connection-provider';
import { join, resolve } from 'path';
import { SprottyDiagramIdentifier } from 'sprotty-vscode-protocol';
import * as vscode from 'vscode';

export const DEFAULT_PORT = 5007;
export const PORT_ARG_KEY = 'WF_GLSP';
export const SERVER_DIR = join(__dirname, '..', 'server');
export const JAR_FILE = resolve(join(SERVER_DIR, 'org.eclipse.glsp.example.workflow-0.9.0-SNAPSHOT-glsp.jar'));

export class WorkflowGlspDiagramEditorContext extends GlspDiagramEditorContext {

    readonly id = 'glsp.workflow';
    readonly diagramType = 'workflow-diagram';
    static EXTENSION_PREFIX = 'workflow';

    constructor(context: vscode.ExtensionContext) {
        super(WorkflowGlspDiagramEditorContext.EXTENSION_PREFIX, context);
    }

    protected getConnectionProvider(): ServerConnectionProvider {
        const launchOptions = {
            jarPath: JAR_FILE,
            serverPort: GLSPEnvVariable.getServerPort() || DEFAULT_PORT,
            isRunning: GLSPEnvVariable.isServerDebug(),
            noConsoleLog: true,
            additionalArgs: GLSPJavaServerArgs.enableFileLogging(SERVER_DIR)
        };
        return new JavaSocketServerConnectionProvider(launchOptions);
    }

    createWebview(webviewPanel: vscode.WebviewPanel, identifier: SprottyDiagramIdentifier): GLSPWebView {
        const webview = new GLSPWebView({
            editorContext: this,
            identifier,
            localResourceRoots: [
                this.getExtensionFileUri('pack')
            ],
            scriptUri: this.getExtensionFileUri('pack', 'webview.js'),
            webviewPanel
        });
        return webview;
    }
}
