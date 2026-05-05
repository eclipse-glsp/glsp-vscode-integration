/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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
import { InitializeResult, McpInitializeResult, McpServerResult } from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';

/**
 * Bridges the embedded GLSP MCP server's announced URL into VS Code's built-in MCP host
 * via {@link vscode.lm.registerMcpServerDefinitionProvider}. Adopters create one provider
 * per extension and feed it the {@link InitializeResult} they get back from the GLSP server's
 * `initialize` call (or an explicit {@link McpServerResult}); each entry then surfaces as a
 * dynamic MCP server definition in VS Code.
 *
 * Companion contribution point in the consuming extension's `package.json`:
 * ```json
 * "contributes": {
 *   "mcpServerDefinitionProviders": [
 *     { "id": "glsp", "label": "GLSP" }
 *   ]
 * }
 * ```
 *
 * @example
 * ```ts
 * const provider = new GlspMcpServerProvider();
 * context.subscriptions.push(vscode.lm.registerMcpServerDefinitionProvider('glsp', provider));
 * const initializeResult = await glspVscodeServer.initializeResult;
 * provider.addServer(initializeResult);
 * ```
 */
export class GlspMcpServerProvider implements vscode.McpServerDefinitionProvider, vscode.Disposable {
    protected readonly servers = new Map<string, McpServerResult>();
    protected readonly didChangeEmitter = new vscode.EventEmitter<void>();

    readonly onDidChangeMcpServerDefinitions: vscode.Event<void> = this.didChangeEmitter.event;

    /**
     * Adds (or replaces by `name`) an MCP server entry. Accepts either the raw
     * {@link InitializeResult} from a GLSP `initialize` call (a no-op if the response carries no
     * `mcpServer` field) or an explicit {@link McpServerResult}. Returns the entry that was
     * registered, or `undefined` if nothing was added.
     */
    addServer(serverOrResult: InitializeResult | McpServerResult): McpServerResult | undefined {
        const server = McpServerResult.is(serverOrResult) ? serverOrResult : McpInitializeResult.getServer(serverOrResult);
        if (!server) {
            return undefined;
        }
        this.servers.set(server.name, server);
        this.didChangeEmitter.fire();
        return server;
    }

    /** Removes a previously-added entry by `name`. No-op if the entry is unknown. */
    removeServer(name: string): void {
        if (this.servers.delete(name)) {
            this.didChangeEmitter.fire();
        }
    }

    provideMcpServerDefinitions(): vscode.McpServerDefinition[] {
        return [...this.servers.values()].map(
            server => new vscode.McpHttpServerDefinition(server.name, vscode.Uri.parse(server.url), server.headers)
        );
    }

    dispose(): void {
        this.servers.clear();
        this.didChangeEmitter.dispose();
    }
}

