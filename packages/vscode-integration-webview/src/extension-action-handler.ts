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
import { Action, ActionHandlerRegistry, IActionHandler, IActionHandlerInitializer, ICommand } from '@eclipse-glsp/client';
import { SprottyDiagramIdentifier } from 'sprotty-vscode-webview';
import { vscodeApi } from 'sprotty-vscode-webview/lib/vscode-api';

/**
 * Delegates actions that should be handled inside of the glsp vscode extension instead
 * of the webview. This enables the implementation of action handlers that require access
 * to the vscode API and/or node backend.
 */
export class GLSPVscodeExtensionActionHandler implements IActionHandler, IActionHandlerInitializer {
    constructor(protected readonly actionKinds: string[], protected readonly diagramIdentifier: SprottyDiagramIdentifier) {}

    initialize(registry: ActionHandlerRegistry): void {
        this.actionKinds.forEach(kind => registry.register(kind, this));
    }

    handle(action: Action): void | Action | ICommand {
        if (this.actionKinds.includes(action.kind)) {
            const message = {
                clientId: this.diagramIdentifier.clientId,
                action,
                __localDispatch: true
            };
            vscodeApi.postMessage(message);
        }
    }
}
