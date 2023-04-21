/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
import { Action, ActionMessage, Args } from '@eclipse-glsp/protocol';
import { hasOwnProperty } from 'sprotty-protocol';
import * as sprotty from 'sprotty-protocol/lib/actions';

export function isActionMessage(message: unknown): message is ActionMessage {
    return hasOwnProperty(message, 'action');
}
export interface _Action extends sprotty.Action {
    /**
     * Unique identifier specifying the kind of action to process.
     */
    kind: string;

    /**
     * Unique identifier specifying the subclient of the process.
     */
    subclientId: string;
}

export interface _ActionMessage<A extends Action = Action> extends sprotty.ActionMessage {
    /**
     * The unique client id
     *  */
    clientId: string;

    /**
     * The action to execute.
     */
    action: A;

    /**
     * Additional custom arguments e.g. application specific parameters.
     */
    args?: Args;
}

export const SUBCLIENT_HOST_ID = 'H';
