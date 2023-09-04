/********************************************************************************
 * Copyright (c) 2021-2023 EclipseSource and others.
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
    Action,
    ActionHandlerRegistry,
    GLSPClient,
    IActionHandler,
    IActionHandlerInitializer,
    ICommand,
    IDiagramOptions,
    TYPES
} from '@eclipse-glsp/client';
import { inject, injectable, multiInject, optional, postConstruct } from 'inversify';

/**
 * Service identifier to define action kinds that should be delegated to the vscode extension.
 *
 * Usage:
 * ```ts
 * bind(ExtensionActionKind).toConstantValue(SomeAction.KIND)
 * ```
 */
export const ExtensionActionKind = Symbol('ExtensionActionKind');

/**
 * Delegates actions that should be handled inside of the glsp host extension instead
 * of the webview. This enables the implementation of action handlers that require access
 * to the vscode API and/or node backend.
 */
@injectable()
export class HostExtensionActionHandler implements IActionHandler, IActionHandlerInitializer {
    @multiInject(ExtensionActionKind)
    @optional()
    protected actionKinds: string[] = [];

    @inject(TYPES.IDiagramOptions)
    protected diagramOptions: IDiagramOptions;

    protected glspClient?: GLSPClient;

    @postConstruct()
    protected postConstruct(): void {
        this.diagramOptions.glspClientProvider().then(glspClient => (this.glspClient = glspClient));
    }

    initialize(registry: ActionHandlerRegistry): void {
        this.actionKinds.forEach(kind => registry.register(kind, this));
    }

    handle(action: Action): void | Action | ICommand {
        if (this.actionKinds.includes(action.kind)) {
            const message = {
                clientId: this.diagramOptions.clientId,
                action,
                __localDispatch: true
            };
            this.glspClient?.sendActionMessage(message);
        }
    }
}
