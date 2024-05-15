/********************************************************************************
 * Copyright (c) 2022-2024 EclipseSource and others.
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
import { CenterAction, FitToScreenAction, LayoutOperation, RequestExportSvgAction, SelectAllAction } from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';
import { GlspVscodeConnector, SelectionState } from '../glsp-vscode-connector';

/**
 * The `CommandContext` provides the necessary information to
 * setup the default commands for a GLSP diagram extension.
 */
export interface CommandContext {
    /**
     * The {@link vscode.ExtensionContext} of the GLSP diagram extension
     */
    extensionContext: vscode.ExtensionContext;
    /**
     * The diagram specific identifier that should be used to prefix command ids.
     */
    diagramPrefix: string;
    /**
     * The {@link GlspVscodeConnector} of the GLSP diagram extension.
     */
    connector: GlspVscodeConnector;
}
export function configureDefaultCommands(context: CommandContext): void {
    // keep track of diagram specific element selection.
    const { extensionContext, diagramPrefix, connector } = context;

    let selectionState: SelectionState | undefined;

    extensionContext.subscriptions.push(connector.onSelectionUpdate(_selectionState => (selectionState = _selectionState)));

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand(`${diagramPrefix}.fit`, () => {
            connector.dispatchAction(FitToScreenAction.create(selectionState?.selectedElementsIDs ?? []));
        }),
        vscode.commands.registerCommand(`${diagramPrefix}.center`, () => {
            connector.dispatchAction(CenterAction.create(selectionState?.selectedElementsIDs ?? []));
        }),
        vscode.commands.registerCommand(`${diagramPrefix}.layout`, () => {
            connector.dispatchAction(LayoutOperation.create([]));
        }),
        vscode.commands.registerCommand(`${diagramPrefix}.selectAll`, () => {
            connector.dispatchAction(SelectAllAction.create());
        }),
        vscode.commands.registerCommand(`${diagramPrefix}.exportAsSVG`, () => {
            connector.dispatchAction(RequestExportSvgAction.create());
        })
    );

    extensionContext.subscriptions.push(
        connector.onSelectionUpdate(state => {
            vscode.commands.executeCommand('setContext', `${diagramPrefix}.editorSelectedElementsAmount`, state.selectedElementsIDs.length);
        })
    );
}
