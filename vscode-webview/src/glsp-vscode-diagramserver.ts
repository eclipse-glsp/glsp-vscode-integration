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
import {
    Action,
    ActionHandlerRegistry,
    ComputedBoundsAction,
    isSetEditModeAction,
    registerDefaultGLSPServerActions,
    SetEditModeAction
} from '@eclipse-glsp/client';
import { isActionMessage, VscodeDiagramServer } from 'sprotty-vscode-webview';

const receivedFromServerProperty = '__receivedFromServer';

export class GLSPVscodeDiagramServer extends VscodeDiagramServer {
    initialize(registry: ActionHandlerRegistry): void {
        registerDefaultGLSPServerActions(registry, this);
        this.clientId = this.viewerOptions.baseDiv;
        window.addEventListener('message', message => {
            if ('data' in message && isActionMessage(message.data)) {
                this.messageReceived(message.data);
            }
        });
    }

    handleLocally(action: Action): boolean {
        if (isSetEditModeAction(action)) {
            return this.handleSetEditModeAction(action);
        }
        return super.handleLocally(action);
    }

    protected handleComputedBounds(action: ComputedBoundsAction): boolean {
        return true;
    }

    protected handleSetEditModeAction(action: SetEditModeAction): boolean {
        return (action as any)[receivedFromServerProperty] !== true;
    }

}
