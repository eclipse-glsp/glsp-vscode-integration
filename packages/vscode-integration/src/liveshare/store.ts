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
export interface ICountStore {
    count: number;
    onChange(handler: () => void): void;
}

// This is a very basic store, which allows the extension
// to centralize state management. For example, the custom
// tree provider can subscribe to count changes, without
// needing to worry about the various places the count
// can actually change. Instead of writing your
// own store implementation, you could also use a library
// like Redux, MobX, etc.
class CountStore implements ICountStore {
    private _count = 0;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private _handler: () => void = () => {};

    get count(): number {
        return this._count;
    }

    set count(count: number) {
        this._count = count;
        this._handler();
    }

    increment(): void {
        this._count++;
        this._handler();
    }

    onChange(handler: () => void): void {
        this._handler = handler;
    }
}

export const store = new CountStore();
