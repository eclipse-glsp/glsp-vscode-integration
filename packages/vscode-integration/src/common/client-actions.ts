/********************************************************************************
 * Copyright (c) 2021-2022 EclipseSource and others.
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

import { Action, Args, hasStringProp } from '@eclipse-glsp/protocol';

export interface NavigateAction extends Action {
    kind: typeof NavigateAction.KIND;
    readonly targetTypeId: string;
    readonly args?: Args;
}

export namespace NavigateAction {
    export const KIND = 'navigate';

    export function is(object: any): object is NavigateAction {
        return Action.hasKind(object, KIND) && hasStringProp(object, 'targetTypeId');
    }

    export function create(targetTypeId: string, options: { args?: Args } = {}): NavigateAction {
        return {
            kind: KIND,
            targetTypeId,
            ...options
        };
    }
}
