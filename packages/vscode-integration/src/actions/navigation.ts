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

interface Args {
    [key: string]: string | number | boolean;
}

export class NavigateAction implements Action {
    static readonly KIND = 'navigate';
    readonly kind = NavigateAction.KIND;
    constructor(readonly targetTypeId: string, readonly args?: Args) { }

    static is(action?: Action): action is NavigateAction {
        return action !== undefined && action.kind === NavigateAction.KIND && 'targetTypeId' in action;
    }
}

export class FitToScreenAction implements Action {
    static readonly KIND = 'fit';
    constructor(public readonly elementIds: string[],
        public readonly padding?: number,
        public readonly maxZoom?: number,
        public readonly animate: boolean = true,
        public readonly kind = FitToScreenAction.KIND) {
    }

    static is(action?: Action): action is FitToScreenAction {
        return action !== undefined && action.kind === FitToScreenAction.KIND
            && 'elementIds' in action && 'animate' in action;
    }
}

export class CenterAction implements Action {
    static readonly KIND = 'center';
    constructor(public readonly elementIds: string[],
        public readonly animate: boolean = true,
        public readonly retainZoom: boolean = false,
        public readonly kind = CenterAction.KIND) {
    }

    static is(action?: Action): action is CenterAction {
        return action !== undefined && action.kind === CenterAction.KIND
            && 'elementIds' in action && 'animate' in action && 'retainZoom' in action;
    }
}
