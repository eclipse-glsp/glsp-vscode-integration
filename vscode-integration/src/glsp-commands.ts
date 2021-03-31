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
import { Action } from 'sprotty-vscode-protocol';
import * as vscode from 'vscode';

import { ExtensionActionDispatcher } from './action';
import { GLSPWebViewRegistry } from './glsp-webview';

export interface GLSPCommandOptions {
    readonly command: string;
    readonly extensionPrefix: string;
    readonly registry: GLSPWebViewRegistry;
    readonly action: Action;
    readonly context: vscode.ExtensionContext;
}
export namespace GLSPCommand {
    export const GLSP_DIAGRAM_COMMAND_IDENTIFER = 'glsp.diagram';
    export const FIT_TO_SCREEN = 'fit';
    export const CENTER = 'center';
    export const DELETE = 'delete';
    export const LAYOUT = 'layout';

    export function commandId(extensionPrefix: string, commandKey: string): string {
        return `${extensionPrefix}.${GLSP_DIAGRAM_COMMAND_IDENTIFER}.${commandKey}`;
    }

    export function registerActionCommand(options: GLSPCommandOptions): void {
        options.context.subscriptions.push(
            vscode.commands.registerCommand(commandId(options.extensionPrefix, options.command),
                () => ExtensionActionDispatcher.dispatch(options.registry, options.action))
        );
    }

}

