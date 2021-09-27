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
/* eslint-disable no-null/no-null */

export interface Action {
    readonly kind: string;
}

export interface ActionMessage<A extends Action = Action> {
    clientId: string;
    action: A;
}

export function isAction(object: any): object is Action {
    return typeof object === 'object' && object !== null && 'kind' in object && typeof object['kind'] === 'string';
}

export function isActionMessage(object: any): object is ActionMessage {
    return typeof object === 'object' && object !== null &&
        'clientId' in object && typeof object['clientId'] === 'string' &&
        'action' in object && isAction(object.action);
}
