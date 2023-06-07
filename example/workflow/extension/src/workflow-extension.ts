/********************************************************************************
 * Copyright (c) 2021-2022 EclipseSource and others.
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

import { WorkflowDiagramModule, WorkflowLayoutConfigurator, WorkflowServerModule } from '@eclipse-glsp-examples/workflow-server/node';
import { configureELKLayoutModule } from '@eclipse-glsp/layout-elk';
import { GModelStorage, LogLevel, createAppModule } from '@eclipse-glsp/server/node';
import {
    GlspSocketServerLauncher,
    GlspVscodeConnector,
    NavigateAction,
    NodeGlspVscodeServer,
    SocketGlspVscodeServer,
    configureDefaultCommands
} from '@eclipse-glsp/vscode-integration/node';
import { ContainerModule } from 'inversify';
import * as path from 'path';
import * as process from 'process';
import * as vscode from 'vscode';
import WorkflowEditorProvider from './workflow-editor-provider';

const DEFAULT_SERVER_PORT = '0';
const LOG_DIR = path.join(__dirname, '..', '..', '..', '..', 'logs');
const NODE_EXECUTABLE = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'node_modules',
    '@eclipse-glsp-examples',
    'workflow-server-bundled',
    'wf-glsp-server-node.js'
);

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Start server process using quickstart component
    let serverProcess: GlspSocketServerLauncher | undefined;
    const useIntegratedServer = JSON.parse(process.env.GLSP_INTEGRATED_SERVER ?? 'false');
    if (!useIntegratedServer && process.env.GLSP_SERVER_DEBUG !== 'true') {
        const additionalArgs = ['--fileLog', 'true', '--logDir', LOG_DIR];
        if (process.env.GLSP_WEBSOCKET_PATH) {
            additionalArgs.push('--webSocket');
        }
        serverProcess = new GlspSocketServerLauncher({
            executable: NODE_EXECUTABLE,
            socketConnectionOptions: { port: JSON.parse(process.env.GLSP_SERVER_PORT || DEFAULT_SERVER_PORT) },
            additionalArgs,
            logging: true
        });

        context.subscriptions.push(serverProcess);
        await serverProcess.start();
    }
    // Wrap server with quickstart component
    const workflowServer = useIntegratedServer
        ? new NodeGlspVscodeServer({
              clientId: 'glsp.workflow',
              clientName: 'workflow',
              serverModules: createServerModules()
          })
        : new SocketGlspVscodeServer({
              clientId: 'glsp.workflow',
              clientName: 'workflow',
              connectionOptions: {
                  port: serverProcess?.getPort() || JSON.parse(process.env.GLSP_SERVER_PORT || DEFAULT_SERVER_PORT),
                  path: process.env.GLSP_WEBSOCKET_PATH
              }
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
            glspVscodeConnector.sendActionToActiveClient(NavigateAction.create('next'));
        }),
        vscode.commands.registerCommand('workflow.goToPreviousNode', () => {
            glspVscodeConnector.sendActionToActiveClient(NavigateAction.create('previous'));
        }),
        vscode.commands.registerCommand('workflow.showDocumentation', () => {
            glspVscodeConnector.sendActionToActiveClient(NavigateAction.create('documentation'));
        })
    );
}

function createServerModules(): ContainerModule[] {
    const appModule = createAppModule({ logLevel: LogLevel.info, logDir: LOG_DIR, fileLog: true, consoleLog: false });
    const elkLayoutModule = configureELKLayoutModule({ algorithms: ['layered'], layoutConfigurator: WorkflowLayoutConfigurator });
    const mainModule = new WorkflowServerModule().configureDiagramModule(new WorkflowDiagramModule(() => GModelStorage), elkLayoutModule);
    return [appModule, mainModule];
}
