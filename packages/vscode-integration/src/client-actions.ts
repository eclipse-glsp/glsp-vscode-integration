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

import { Action, Args, isActionKind, isString } from '@eclipse-glsp/protocol';

export class RequestExportSvgAction implements Action {
    static readonly KIND = 'requestExportSvg';

    constructor(readonly kind = RequestExportSvgAction.KIND) {}
}

export function isRequestExportSvgAction(action: any): action is RequestExportSvgAction {
    return isActionKind(action, RequestExportSvgAction.KIND);
}

export class NavigateAction implements Action {
    static readonly KIND = 'navigate';
    readonly kind = NavigateAction.KIND;
    constructor(readonly targetTypeId: string, readonly args?: Args) {}
}

export function isNavigateAction(action: any): action is NavigateAction {
    return isActionKind(action, NavigateAction.KIND) && isString(action, 'targetTypeId');
}
