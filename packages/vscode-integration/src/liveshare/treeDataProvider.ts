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
import { Command, Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem } from 'vscode';
import { INCREMENT_COUNT_COMMAND } from './constants';
import { ICountStore } from './store';

export class CountTreeDataProvider implements TreeDataProvider<Command> {
    private _command: Command = {
        command: INCREMENT_COUNT_COMMAND,
        title: 'Increment Count'
    };

    private _onDidChangeTreeData = new EventEmitter<Command>();
    public readonly onDidChangeTreeData: Event<Command> = this._onDidChangeTreeData.event;

    constructor(private store: ICountStore) {
        store.onChange(() => {
            this._onDidChangeTreeData.fire(this._command);
        });
    }

    getChildren(element?: Command): ProviderResult<Command[]> {
        return Promise.resolve([this._command]);
    }

    getTreeItem(element: Command): TreeItem {
        const treeItem = new TreeItem(`Count: ${this.store.count}`);
        treeItem.command = element;
        return treeItem;
    }
}
