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
import { ActionMessage, DisposeClientSessionParameters, InitializeClientSessionParameters, SubclientInfo } from '@eclipse-glsp/protocol';

export const SUBCLIENT_HOST_ID = 'H';

export interface CollaborateGlspClientProvider {
    isInCollaborateMode(): boolean;
    isHost(): boolean;
    isGuest(): boolean;
    initializeClientSession(params: InitializeClientSessionParameters): Promise<void>;
    disposeClientSession(params: DisposeClientSessionParameters): Promise<void>;
    sendActionMessage(message: ActionMessage): void;
    handleActionMessage(message: ActionMessage): void;
    getSubclientIdFromSession(): string;
    getSubclientInfoFromSession(): SubclientInfo;
}
