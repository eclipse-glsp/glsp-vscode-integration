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

export function waitForEventWithTimeout<E>(event: vscode.Event<E>, timeout: number, eventName?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
            listener.dispose();
            reject(new Error('Timeout waiting for ' + eventName || event.toString()));
        }, timeout);

        const listener = event((e: E) => {
            clearTimeout(timer);
            listener.dispose();
            resolve();
        });
    });
}
