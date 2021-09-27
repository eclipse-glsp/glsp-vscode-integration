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

import * as vscode from 'vscode';
import * as process from 'process';
import * as path from 'path';

import {
    GlspVscodeConnector,
    NavigateAction,
    LayoutOperation,
    FitToScreenAction,
    CenterAction,
    RequestExportSvgAction
} from '@eclipse-glsp/vscode-integration';

import {
    GlspServerLauncher,
    SocketGlspVscodeServer
} from '@eclipse-glsp/vscode-integration/lib/quickstart-components';

import WorkflowEditorProvider from './workflow-editor-provider';

const DEFAULT_SERVER_PORT = '5007';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Start server process using quickstart component
    if (process.env.GLSP_SERVER_DEBUG !== 'true') {
        const serverProcess = new GlspServerLauncher({
            jarPath: path.join(__dirname, '../server/org.eclipse.glsp.example.workflow-0.9.0-SNAPSHOT-glsp.jar'),
            serverPort: JSON.parse(process.env.GLSP_SERVER_PORT || DEFAULT_SERVER_PORT),
            additionalArgs: ['--fileLog', 'true', '--logDir', path.join(__dirname, '../server')],
            logging: true
        });
        context.subscriptions.push(serverProcess);
        await serverProcess.start();
    }

    // Wrap server with quickstart component
    const workflowServer = new SocketGlspVscodeServer({
        clientId: 'glsp.workflow',
        clientName: 'workflow',
        serverPort: JSON.parse(process.env.GLSP_SERVER_PORT || DEFAULT_SERVER_PORT)
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

    // Keep track of selected elements
    let selectedElements: string[] = [];
    context.subscriptions.push(
        glspVscodeConnector.onSelectionUpdate(n => {
            selectedElements = n;
            vscode.commands.executeCommand('setContext', 'workflow.editorSelectedElementsAmount', n.length);
        })
    );

    // Register various commands
    context.subscriptions.push(
        vscode.commands.registerCommand('workflow.fit', () => {
            glspVscodeConnector.sendActionToActiveClient(new FitToScreenAction(selectedElements));
        }),
        vscode.commands.registerCommand('workflow.center', () => {
            glspVscodeConnector.sendActionToActiveClient(new CenterAction(selectedElements));
        }),
        vscode.commands.registerCommand('workflow.layout', () => {
            glspVscodeConnector.sendActionToActiveClient(new LayoutOperation());
        }),
        vscode.commands.registerCommand('workflow.goToNextNode', () => {
            glspVscodeConnector.sendActionToActiveClient(new NavigateAction('next'));
        }),
        vscode.commands.registerCommand('workflow.goToPreviousNode', () => {
            glspVscodeConnector.sendActionToActiveClient(new NavigateAction('previous'));
        }),
        vscode.commands.registerCommand('workflow.showDocumentation', () => {
            glspVscodeConnector.sendActionToActiveClient(new NavigateAction('documentation'));
        }),
        vscode.commands.registerCommand('workflow.exportAsSVG', () => {
            glspVscodeConnector.sendActionToActiveClient(new RequestExportSvgAction());
        })
    );
}

