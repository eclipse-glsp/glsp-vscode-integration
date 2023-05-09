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
import { CollaborationGlspClient } from './collaboration-glsp-client';

export const SUBCLIENT_HOST_ID = 'H';

export type GuestsChangeHandler = (subclientIds: string[]) => void;

export interface CollaborationGlspClientProviderInitializeConfig {
    collaborationGlspClient: CollaborationGlspClient;
}

export type CollaborativeGlspClientProvider =
    CommonCollaborationGlspClientProvider
    & HostCollaborationGlspClientProvider
    & GuestCollaborationGlspClientProvider;

export interface CommonCollaborationGlspClientProvider {
    initialize(config: CollaborationGlspClientProviderInitializeConfig): Promise<void>;
    isInCollaborationMode(): boolean;
    isHost(): boolean;
    isGuest(): boolean;
    getSubclientIdFromSession(): string;
    getSubclientInfoFromSession(): SubclientInfo;
}

export interface HostCollaborationGlspClientProvider {
    handleActionMessageForHost(message: ActionMessage): void;
    handleMultipleActionMessagesForHost(messages: ActionMessage[]): void;
    onGuestsChangeForHost(handler: GuestsChangeHandler): void;
}

export interface GuestCollaborationGlspClientProvider {
    initializeClientSessionForGuest(params: InitializeClientSessionParameters): Promise<void>;
    disposeClientSessionForGuest(params: DisposeClientSessionParameters): Promise<void>;
    sendActionMessageForGuest(message: ActionMessage): void;
}
