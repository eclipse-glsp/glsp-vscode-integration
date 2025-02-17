/********************************************************************************
 * Copyright (c) 2025 EclipseSource and others.
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
import { v4 as uuid } from 'uuid';
import * as vscode from 'vscode';
export interface DiffEditorTracker extends vscode.Disposable {
    isDiffEditorActive: boolean;
    clear(): void;
    addDiffUri(uri: vscode.Uri): { diffId: string; side: 'left' | 'right' };
}

let instance: DiffEditorTracker | undefined;
export namespace DiffEditorTracker {
    export function get(): DiffEditorTracker {
        if (!instance) {
            instance = new DiffEditorTrackerImpl();
        }
        return instance;
    }
}

/**   Currently the vscode API does provide a way to identify wether a editor is opened with the built-in diff editor.
/* @see https://github.com/microsoft/vscode/issues/97683
/* @see https://github.com/microsoft/vscode/issues/138525
/* As a workaround we can track the opening and closing of tabs in the tab groups. When opened in a diff editor the active tab
/* does not have a direct input. Since the diff editor is the only (known) tab with undefined input we can use this to track the diff
* editor state. This is a temporary workaround that might not work in all cases or break in the future. Hopefully the vscode API will
/* provide a better way to identify the diff editor in the future.
**/

class DiffEditorTrackerImpl implements DiffEditorTracker {
    private toDispose: vscode.Disposable[] = [];
    private currentDiffEditorTab?: vscode.Tab;
    private activeDiff?: DiffData;

    get isDiffEditorActive(): boolean {
        return this.currentDiffEditorTab?.isActive ?? false;
    }

    addDiffUri(uri: vscode.Uri): { diffId: string; side: 'left' | 'right' } {
        if (this.activeDiff?.right) {
            throw new Error('Diff already has two sides');
        }
        if (!this.activeDiff) {
            this.activeDiff = { id: uuid(), left: uri };
            return { diffId: this.activeDiff.id, side: 'left' };
        }
        this.activeDiff.right = uri;
        return { diffId: this.activeDiff.id, side: 'right' };
    }

    constructor() {
        this.toDispose.push(
            vscode.window.tabGroups.onDidChangeTabs(e => {
                if (e.closed.length > 0) {
                    if (e.closed.find(tab => this.isWorkflowDiffEditorTab(tab))) {
                        this.clear();
                    }
                }

                if (e.opened.length > 0) {
                    const diffTab = e.opened.find(tab => this.isWorkflowDiffEditorTab(tab));
                    this.clear();
                    this.currentDiffEditorTab = diffTab;
                }

                if (e.changed.length > 0) {
                    const diffTab = e.changed.find(tab => this.isWorkflowDiffEditorTab(tab));
                    if (diffTab && !diffTab.isActive) {
                        this.clear();
                    }
                }
                console.log('Diff tracker state: ', { activeDiff: this.activeDiff, currentDiffEditorTab: this.currentDiffEditorTab });
            })
        );
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        if (this.isWorkflowDiffEditorTab(activeTab)) {
            this.currentDiffEditorTab = activeTab;
        }
    }
    protected isWorkflowDiffEditorTab(tab?: vscode.Tab): boolean {
        if (!tab) {
            return false;
        }
        return tab.input === undefined && tab.label.includes('.wf');
    }

    clear(): void {
        this.currentDiffEditorTab = undefined;
        this.activeDiff = undefined;
    }

    dispose(): void {
        this.toDispose.forEach(d => d.dispose());
        this.clear();
    }
}

export interface DiffData {
    id: string;
    left: vscode.Uri;
    right?: vscode.Uri;
}
