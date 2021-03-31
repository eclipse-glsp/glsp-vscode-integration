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

export function disposeAll(toDispose: vscode.Disposable[]): void {
    while (toDispose.length) {
        const disposable = toDispose.pop();
        if (disposable) {
            disposable.dispose();
        }
    }
}

export abstract class Disposable implements vscode.Disposable {

    private _isDisposed = false;

    protected disposables: vscode.Disposable[] = [];

    protected _onDidDispose: vscode.EventEmitter<void>;

    constructor() {
        this._onDidDispose = this.addDisposable(new vscode.EventEmitter<void>());
    }

    get onDidDispose(): vscode.Event<void> {
        return this._onDidDispose.event;
    }
    protected addDisposable<T extends vscode.Disposable>(disposable: T): T {
        if (this._isDisposed) {
            disposable.dispose();
        } else {
            this.disposables.push(disposable);
        }
        return disposable;
    }

    dispose(): any {
        if (!this._isDisposed) {
            this._onDidDispose.fire();
            this._isDisposed = true;
            disposeAll(this.disposables);
        }
    }
}
