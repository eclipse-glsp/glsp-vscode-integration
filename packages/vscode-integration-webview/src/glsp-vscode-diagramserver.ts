/********************************************************************************
 * Copyright (c) 2020-2021 EclipseSource and others.
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
    ActionMessage,
    ComputedBoundsAction,
    DeleteElementOperation,
    GLSP_TYPES,
    isDeleteElementOperation,
    isSetEditModeAction,
    registerDefaultGLSPServerActions,
    SetEditModeAction,
    ICopyPasteHandler
} from '@eclipse-glsp/client';
import { SelectionService } from '@eclipse-glsp/client/lib/features/select/selection-service';
import { inject } from 'inversify';
import { isActionMessage, VscodeDiagramServer } from 'sprotty-vscode-webview';

export const receivedFromServerProperty = '__receivedFromServer';
export const localDispatchProperty = '__localDispatch';

export class GLSPVscodeDiagramServer extends VscodeDiagramServer {
    @inject(GLSP_TYPES.SelectionService) protected selectionService: SelectionService;
    @inject(GLSP_TYPES.ICopyPasteHandler) protected copyPasteHandler: ICopyPasteHandler;

    initialize(registry: ActionHandlerRegistry): void {
        registerDefaultGLSPServerActions(registry, this);
        this.clientId = this.viewerOptions.baseDiv;
        window.addEventListener('message', message => {
            if ('data' in message && isActionMessage(message.data)) {
                this.messageReceived(message.data);
            }
        });

        window.addEventListener('copy', (e: ClipboardEvent) => {
            this.copyPasteHandler.handleCopy(e);
        });

        window.addEventListener('cut', (e: ClipboardEvent) => {
            this.copyPasteHandler.handleCut(e);
        });

        window.addEventListener('paste', (e: ClipboardEvent) => {
            this.copyPasteHandler.handlePaste(e);
        });
    }

    handleLocally(action: Action): boolean {
        if (isSetEditModeAction(action)) {
            return this.handleSetEditModeAction(action);
        }
        if (isDeleteElementOperation(action)) {
            return this.handleDeleteElementOperation(action);
        }
        return super.handleLocally(action);
    }

    protected messageReceived(data: any): void {
        const object = typeof (data) === 'string' ? JSON.parse(data) : data;
        if (isActionMessage(object) && object.action) {
            if (!object.clientId || object.clientId === this.clientId) {
                this.checkMessageOrigin(object);
                this.logger.log(this, 'receiving', object);
                this.actionDispatcher.dispatch(object.action).then(() => {
                    this.storeNewModel(object.action);
                });
            }
        } else {
            this.logger.error(this, 'received data is not an action message', object);
        }
    }

    protected checkMessageOrigin(message: ActionMessage): void {
        const isLocalDispatch = (message as any)[localDispatchProperty] || false;
        if (!isLocalDispatch) {
            (message.action as any)[receivedFromServerProperty] = true;
        }
    }

    protected handleComputedBounds(action: ComputedBoundsAction): boolean {
        return true;
    }

    protected handleDeleteElementOperation(operation: DeleteElementOperation): boolean {
        if (operation.elementIds.length === 0) {
            operation.elementIds.push(...this.selectionService.getSelectedElementIDs());
        }
        return true;
    }

    protected handleSetEditModeAction(action: SetEditModeAction): boolean {
        return (action as any)[receivedFromServerProperty] !== true;
    }

}
