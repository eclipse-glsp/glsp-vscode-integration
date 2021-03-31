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
import { Action, SprottyDiagramIdentifier } from 'sprotty-vscode-protocol';
import * as vscode from 'vscode';

import {
    DirtyStateChangeReason,
    ExtensionActionDispatcher,
    RedoOperation,
    RequestModelAction,
    SaveModelAction,
    SetDirtyStateAction,
    UndoOperation
} from './action';
import { ExtensionActionHandler } from './action/action-handler';
import { waitForEventWithTimeout } from './utils';
import { Disposable } from './utils/disposable';

export interface DiagramEditEvent {
    undo(): void;
    redo(): void;
}
export class GlspDiagramDocument extends Disposable implements vscode.CustomDocument, ExtensionActionHandler {
    static async create(uri: vscode.Uri, _backupId?: string): Promise<GlspDiagramDocument> {
        return new GlspDiagramDocument(uri);
    }

    protected readonly _onDidChange: vscode.EventEmitter<DiagramEditEvent>;
    protected readonly _onDidSave: vscode.EventEmitter<void>;
    protected actionDispatcher?: ExtensionActionDispatcher;
    protected diagramIdentifier: SprottyDiagramIdentifier;

    private constructor(readonly uri: vscode.Uri) {
        super();
        this._onDidChange = this.addDisposable(new vscode.EventEmitter<DiagramEditEvent>());
        this._onDidSave = this.addDisposable(new vscode.EventEmitter<void>());

    }

    initialize(diagramIdentifier: SprottyDiagramIdentifier, actionDispatcher: ExtensionActionDispatcher): void {
        this.diagramIdentifier = diagramIdentifier;
        this.actionDispatcher = actionDispatcher;
    }

    get onDidChange(): vscode.Event<DiagramEditEvent> {
        return this._onDidChange.event;
    }

    get onDidSave(): vscode.Event<void> {
        return this._onDidSave.event;
    }

    protected dispatchAction(action: Action): void {
        if (!this.actionDispatcher) {
            throw new Error(`Cannot dispatch action "${action.kind}" for GlspDocument with uri: "${this.uri}".
          No action dispatcher has been set`);
        }
        this.actionDispatcher.dispatch(action);
    }
    kinds = [SetDirtyStateAction.KIND];

    async backup(destination: vscode.Uri, _cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        // No need to implement a custom backup. The server holds the current model state anyways.
        return {
            id: destination.toString(),
            delete: () => {/** */ }
        };
    }

    async save(_cancellation: vscode.CancellationToken): Promise<void> {
        return this.dispatchAction(new SaveModelAction());
    }

    async saveAs(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
        this.dispatchAction(new SaveModelAction(destination.path));
        return waitForEventWithTimeout(this.onDidSave, 2000, 'onDidSave');
    }

    async revert(cancellation: vscode.CancellationToken): Promise<void> {
        this.dispatchAction(new RequestModelAction({
            sourceUri: this.uri.toString(),
            diagramType: this.diagramIdentifier.diagramType
        }));
    }

    async handleAction(action: Action): Promise<boolean> {
        if (SetDirtyStateAction.is(action)) {
            const reason = action.reason || '';
            if (reason === DirtyStateChangeReason.SAVE) {
                this._onDidSave.fire();
            } else if (reason === DirtyStateChangeReason.OPERATION && action.isDirty) {
                this._onDidChange.fire({
                    undo: () => {
                        this.dispatchAction(new UndoOperation());
                    },
                    redo: () => {
                        this.dispatchAction(new RedoOperation());
                    }
                });
            }
        }
        return false;
    }
}

