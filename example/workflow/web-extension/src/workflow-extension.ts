/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
import 'reflect-metadata';

import {
    BrowserGlspVscodeServer,
    GlspVscodeConnector,
    NavigateAction,
    WebSocketGlspVscodeServer,
    configureDefaultCommands
} from '@eclipse-glsp/vscode-integration/browser';
import * as vscode from 'vscode';
import WorkflowEditorProvider from './workflow-editor-provider';
import { createServerModules } from './workflow-server';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Env variables are no available in the web extension context. So we have to check wether
    // the websocket address for the external usecase is reachable to decide which server variant should be used

    const webSocketAddress = 'ws://localhost:8081/workflow';
    const useWebSocket = await isAvailable(webSocketAddress);

    const workflowServer = useWebSocket
        ? new WebSocketGlspVscodeServer({
              clientId: 'glsp.workflow',
              clientName: 'workflow',
              connectionOptions: { webSocketAddress }
          })
        : new BrowserGlspVscodeServer({
              clientId: 'glsp.workflow',
              clientName: 'workflow',
              serverModules: createServerModules()
          });

    // Initialize GLSP-VSCode connector with server wrapper
    const glspVscodeConnector = new GlspVscodeConnector({
        server: workflowServer,
        logging: true
    });

    const customEditorProvider = vscode.window.registerCustomEditorProvider(
        'workflow.glspDiagram',
        new WorkflowEditorProvider(context, glspVscodeConnector),
        {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false
        }
    );

    context.subscriptions.push(workflowServer, glspVscodeConnector, customEditorProvider);
    workflowServer.start();

    configureDefaultCommands({ extensionContext: context, connector: glspVscodeConnector, diagramPrefix: 'workflow' });

    context.subscriptions.push(
        vscode.commands.registerCommand('workflow.goToNextNode', () => {
            glspVscodeConnector.dispatchAction(NavigateAction.create('next'));
        }),
        vscode.commands.registerCommand('workflow.goToPreviousNode', () => {
            glspVscodeConnector.dispatchAction(NavigateAction.create('previous'));
        }),
        vscode.commands.registerCommand('workflow.showDocumentation', () => {
            glspVscodeConnector.dispatchAction(NavigateAction.create('documentation'));
        })
    );
}

function isAvailable(webSocketAddress: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const webSocket = new WebSocket(webSocketAddress);
        webSocket.onopen = () => {
            webSocket.close();
            resolve(true);
        };
        webSocket.onerror = () => resolve(false);
    });
}
