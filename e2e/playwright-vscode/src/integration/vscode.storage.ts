/********************************************************************************
 * Copyright (c) 2023-2026 EclipseSource and others.
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
import { promises as fsp } from 'fs';

/**
 * Util namespace for managing the shared storage for the VSCode environment.
 */
export namespace VSCodeStorage {
    export interface Storage {
        vscodeExecutablePath: string;
    }

    export function write(path: string, storage: Storage): Promise<void> {
        return fsp.writeFile(path, JSON.stringify(storage, null, 2));
    }

    export async function read(path: string): Promise<Storage> {
        const content = await fsp.readFile(path, 'utf8');
        return JSON.parse(content);
    }

    export function is(data: any): data is Storage {
        return existsKey(data, 'vscodeExecutablePath');
    }
}

function existsKey(data: any, key: keyof VSCodeStorage.Storage): boolean {
    return data[key] !== undefined;
}
