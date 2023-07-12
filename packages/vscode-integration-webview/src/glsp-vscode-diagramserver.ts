/********************************************************************************
 * Copyright (c) 2018 TypeFox and others.
 * Modifications: (c) 2020-2023 EclipseSource and others.
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
// based on https://github.com/eclipse-sprotty/sprotty-vscode/blob/v0.3.0/sprotty-vscode-webview/src/vscode-diagram-server.ts
import {
    Action,
    ActionHandlerRegistry,
    ActionMessage,
    ComputedBoundsAction,
    DeleteElementOperation,
    DiagramServerProxy,
    registerDefaultGLSPServerActions,
    SelectionService,
    ServerStatusAction,
    SetEditModeAction
} from '@eclipse-glsp/client';
import { inject } from 'inversify';
import { CopyPasteHandlerProvider } from './copy-paste-handler-provider';
import { GLSPDiagramWidgetFactory } from './glsp-diagram-widget';
import { VsCodeApi } from './services';
export const receivedFromServerProperty = '__receivedFromServer';
export const localDispatchProperty = '__localDispatch';

export class GLSPVscodeDiagramServer extends DiagramServerProxy {
    @inject(SelectionService)
    protected selectionService: SelectionService;

    @inject(VsCodeApi)
    protected vscodeApi: VsCodeApi;

    @inject(GLSPDiagramWidgetFactory)
    protected diagramWidgetFactory: GLSPDiagramWidgetFactory;

    @inject(CopyPasteHandlerProvider)
    protected copyPasteHandlerProvider: CopyPasteHandlerProvider;

    override initialize(registry: ActionHandlerRegistry): void {
        registerDefaultGLSPServerActions(registry, this);
        this.clientId = this.viewerOptions.baseDiv;

        window.addEventListener('message', message => {
            if ('data' in message && ActionMessage.is(message.data)) {
                this.messageReceived(message.data);
            }
        });

        this.copyPasteHandlerProvider().then(copyPasteHandler => {
            document.addEventListener('copy', (e: ClipboardEvent) => {
                copyPasteHandler.handleCopy(e);
            });

            document.addEventListener('cut', (e: ClipboardEvent) => {
                copyPasteHandler.handleCut(e);
            });

            document.addEventListener('paste', (e: ClipboardEvent) => {
                copyPasteHandler.handlePaste(e);
            });
        });
    }

    protected sendMessage(message: ActionMessage): void {
        this.vscodeApi.postMessage(message);
    }

    override handleLocally(action: Action): boolean {
        if (SetEditModeAction.is(action)) {
            return this.handleSetEditModeAction(action);
        }
        if (DeleteElementOperation.is(action)) {
            return this.handleDeleteElementOperation(action);
        }
        return super.handleLocally(action);
    }

    protected override handleServerStateAction(status: ServerStatusAction): boolean {
        this.diagramWidgetFactory().setStatus(status);
        return false;
    }

    protected override messageReceived(data: any): void {
        const object = typeof data === 'string' ? JSON.parse(data) : data;
        if (ActionMessage.is(object) && object.action) {
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

    protected override handleComputedBounds(action: ComputedBoundsAction): boolean {
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
