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
import { ConnectionProvider, getPort } from '@eclipse-glsp/protocol';
import { createSocketConnection, GLSPVscodeExtension, GLSPWebView } from '@eclipse-glsp/vscode-extension';
import * as net from 'net';
import { SprottyDiagramIdentifier, SprottyWebview } from 'sprotty-vscode';
import * as vscode from 'vscode';

export const DEFAULT_SERVER_PORT = 5007;
export class WorkflowGLSPExtension extends GLSPVscodeExtension {
    readonly id = 'glsp.workflow';
    static EXTENSION_PREFIX = 'workflow';

    constructor(context: vscode.ExtensionContext) {
        super(WorkflowGLSPExtension.EXTENSION_PREFIX, context);
    }

    protected createWebView(identifier: SprottyDiagramIdentifier): SprottyWebview {
        const webview = new GLSPWebView({
            extension: this,
            identifier,
            localResourceRoots: [
                this.getExtensionFileUri('pack')
            ],
            scriptUri: this.getExtensionFileUri('pack', 'webview.js')
        });
        return webview;
    }

    protected getConnectionProvider(): ConnectionProvider {
        let port = getPort('WF_PORT');
        if (isNaN(port)) {
            port = DEFAULT_SERVER_PORT;
        }
        const socket = new net.Socket();
        const connection = createSocketConnection(socket, socket);
        socket.connect(port);
        return connection;
    }

    protected getDiagramType(): string {
        return 'workflow-diagram';
    }
}
