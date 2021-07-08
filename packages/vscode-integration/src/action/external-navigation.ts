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

import * as vscode from 'vscode';
import { ExtensionActionHandler } from './action-handler';
import { Action } from 'sprotty-vscode-protocol';

interface Args { [key: string]: string | number | boolean }

interface NavigationTarget {
    uri: string;
    label?: string;
    args?: Args;
}

export class NavigateToExternalTargetAction implements Action {
    static readonly KIND = 'navigateToExternalTarget';
    readonly kind = NavigateToExternalTargetAction.KIND;
    constructor(readonly target: NavigationTarget) { }
    static is(action?: Action): action is NavigateToExternalTargetAction {
        return action !== undefined && (action.kind === NavigateToExternalTargetAction.KIND)
            && (action as NavigateToExternalTargetAction).target !== undefined;
    }
}

export class NavigateToExternalTargetHandler implements ExtensionActionHandler {
    static SHOW_OPTIONS = 'jsonOpenerOptions';

    kinds = [NavigateToExternalTargetAction.KIND];

    async handleAction(action: Action): Promise<boolean> {
        if (NavigateToExternalTargetAction.is(action)) {
            const { uri, args } = action.target;
            let showOptions = { ...args };

            // Give server the possibility to provide options through the `showOptions` field by providing a
            // stringified version of the `TextDocumentShowOptions`
            // See: https://code.visualstudio.com/api/references/vscode-api#TextDocumentShowOptions
            const showOptionsField = args?.[NavigateToExternalTargetHandler.SHOW_OPTIONS];
            if (showOptionsField) {
                showOptions = { ...args, ...(JSON.parse(showOptionsField.toString())) };
            }

            vscode.window.showTextDocument(vscode.Uri.parse(uri), showOptions);
        }

        return false;
    }
}
