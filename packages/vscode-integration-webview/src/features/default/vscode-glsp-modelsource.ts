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
import { Action, ActionMessage, GLSPModelSource, ServerAction } from '@eclipse-glsp/client';
import { injectable } from 'inversify';

/**
 * A helper interface that allows the webview to mark actions that have been received directly from the vscode extension
 * (i.e. they are not forwarded to the GLSP Server).
 */
export interface ExtensionAction extends Action {
    __localDispatch: true;
}

export namespace ExtensionAction {
    export function is(object: unknown): object is ExtensionAction {
        return Action.is(object) && '__localDispatch' in object && object.__localDispatch === true;
    }

    /**
     * Mark the given action as {@link ServerAction} by attaching the "_receivedFromServer" property
     * @param action The action that should be marked as server action
     */
    export function mark(action: Action): void {
        (action as ExtensionAction).__localDispatch = true;
    }
}

/**
 * Customization of the default {@link GLSPModelSource} for the vscode integration.
 * Also takes locally dispatched actions (i.e. actions that are originating from or intended for the host extension) into consideration.
 */
@injectable()
export class VsCodeGLSPModelSource extends GLSPModelSource {
    protected override messageReceived(message: ActionMessage): void {
        if (this.clientId !== message.clientId) {
            return;
        }
        this.checkMessageOrigin(message);
        const action = message.action;
        this.logger.log(this, 'receiving', action);
        this.actionDispatcher.dispatch(action);
    }

    protected checkMessageOrigin(message: ActionMessage): void {
        const isLocalDispatch = (message as any)['__localDispatch'] ?? false;
        if (!isLocalDispatch) {
            ServerAction.mark(message.action);
        }
    }
}
