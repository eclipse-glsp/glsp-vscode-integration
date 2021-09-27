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

import { Action } from './action';

export type JsonPrimitive = string | number | boolean;

export class RequestModelAction implements Action {
    static readonly KIND = 'requestModel';
    readonly kind = RequestModelAction.KIND;

    constructor(public readonly options?: { [key: string]: JsonPrimitive },
        public readonly requestId = '') { }
}

export class SaveModelAction implements Action {
    static readonly KIND = 'saveModel';
    constructor(public readonly fileUri?: string, public readonly kind: string = SaveModelAction.KIND) { }

    static is(action?: Action): action is SaveModelAction {
        return action !== undefined && action.kind === SaveModelAction.KIND;
    }
}

export class SetDirtyStateAction implements Action {
    static readonly KIND = 'setDirtyState';
    constructor(public readonly isDirty: boolean, public readonly reason?: string,
        public readonly kind = SetDirtyStateAction.KIND) { }

    static is(action?: Action): action is SetDirtyStateAction {
        return action !== undefined && action.kind === SetDirtyStateAction.KIND && 'isDirty' in action
            && typeof action['isDirty'] === 'boolean';
    }
}

export namespace DirtyStateChangeReason {
    export const OPERATION = 'operation';
    export const UNDO = 'undo';
    export const REDO = 'redo';
    export const SAVE = 'save';
    export const EXTERNAL = 'external';
}

