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

export interface Marker {
    readonly label: string;
    readonly description: string;
    readonly elementId: string;
    readonly kind: 'info' | 'warning' | 'error';
}

export class SetMarkersAction implements Action {
    static readonly KIND = 'setMarkers';
    constructor(public readonly markers: Marker[], public readonly kind = SetMarkersAction.KIND) { }

    static is(action?: Action): action is SetMarkersAction {
        return action !== undefined && action.kind === SetMarkersAction.KIND && 'markers' in action;
    }
}
