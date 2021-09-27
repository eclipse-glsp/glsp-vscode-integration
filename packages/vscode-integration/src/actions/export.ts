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

export class ExportSvgAction implements Action {
    static readonly KIND = 'exportSvg';
    constructor(public readonly svg: string, public readonly kind = ExportSvgAction.KIND) { }

    static is(action?: Action): action is ExportSvgAction {
        return action !== undefined && action.kind === ExportSvgAction.KIND && 'svg' in action;
    }
}

export class RequestExportSvgAction implements Action {
    static readonly KIND = 'requestExportSvg';
    constructor(public readonly kind = RequestExportSvgAction.KIND) { }

    static is(action?: Action): action is RequestExportSvgAction {
        return action !== undefined && action.kind === RequestExportSvgAction.KIND;
    }
}
