/********************************************************************************
 * Copyright (c) 2021-2026 EclipseSource and others.
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
    WorkflowDiagramModule,
    WorkflowLayoutConfigurator,
    WorkflowMcpDiagramModule,
    WorkflowMcpServerModule,
    WorkflowServerModule
} from '@eclipse-glsp-examples/workflow-server/node';
import { ElkLayoutModule } from '@eclipse-glsp/layout-elk';
import { GModelStorage, LogLevel, createAppModule } from '@eclipse-glsp/server/node';
import {
    GlspMcpServerProvider,
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
const NODE_EXECUTABLE = path.join(__dirname, '..', 'dist', 'wf-glsp-server-node.js');
const LOG_DIR = process.env.GLSP_LOG_DIR;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Start server process using quickstart component
    let serverProcess: GlspSocketServerLauncher | undefined;
    const useIntegratedServer = JSON.parse(process.env.GLSP_INTEGRATED_SERVER ?? 'false');
    if (!useIntegratedServer && process.env.GLSP_SERVER_DEBUG !== 'true') {
        const additionalArgs = [];
        if (LOG_DIR) {
            additionalArgs.push('--fileLog', 'true', '--logDir', LOG_DIR);
        }
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
    // Presence of `mcpServer` (even an empty `{}`) opts the GLSP server into starting an
    // embedded MCP HTTP server. The custom `name` groups multiple GLSP-based MCP servers
    // in the IDE's MCP server list and matches the `mcpServerDefinitionProviders` id below.
    const mcpServer = { name: 'glsp-workflow' };
    // Wrap server with quickstart component
    const workflowServer = useIntegratedServer
        ? new NodeGlspVscodeServer({
              clientId: 'glsp.workflow',
              clientName: 'workflow',
              serverModules: createServerModules(),
              mcpServer
          })
        : new SocketGlspVscodeServer({
              clientId: 'glsp.workflow',
              clientName: 'workflow',
              connectionOptions: {
                  port: serverProcess?.getPort() || JSON.parse(process.env.GLSP_SERVER_PORT || DEFAULT_SERVER_PORT),
                  path: process.env.GLSP_WEBSOCKET_PATH
              },
              mcpServer
          });

    // Bridge the embedded MCP server's announced URL into VS Code's built-in MCP host. The
    // `glsp-workflow` provider id matches the `mcpServerDefinitionProviders` contribution in
    // this extension's `package.json` and the `mcpServer.name` above.
    const mcpProvider = new GlspMcpServerProvider();
    context.subscriptions.push(mcpProvider, vscode.lm.registerMcpServerDefinitionProvider(mcpServer.name, mcpProvider));
    workflowServer.initializeResult.then(
        result => {
            const server = mcpProvider.addServer(result);
            if (server) {
                notifyMcpConnected(server.name, server.url);
            }
        },
        () => {
            /* GLSP startup error already surfaced by the connector; no MCP server to register. */
        }
    );
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

/** Info notification with a `Copy URL` action; stays until the user dismisses it. */
function notifyMcpConnected(name: string, url: string): void {
    const COPY_URL_ACTION = 'Copy URL';
    vscode.window.showInformationMessage(`MCP server '${name}' auto-registered at ${url}`, COPY_URL_ACTION).then(action => {
        if (action === COPY_URL_ACTION) {
            vscode.env.clipboard.writeText(url);
        }
    });
}

function createServerModules(): ContainerModule[] {
    const appModule = createAppModule({ logLevel: LogLevel.info, logDir: LOG_DIR, fileLog: true, consoleLog: false });
    const elkLayoutModule = new ElkLayoutModule({ algorithms: ['layered'], layoutConfigurator: WorkflowLayoutConfigurator });
    const mainModule = new WorkflowServerModule().configureDiagramModule(
        new WorkflowDiagramModule(() => GModelStorage),
        elkLayoutModule,
        new WorkflowMcpDiagramModule()
    );
    return [appModule, mainModule, new WorkflowMcpServerModule()];
}
