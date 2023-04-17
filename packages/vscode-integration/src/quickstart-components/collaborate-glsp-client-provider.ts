import { ActionMessage, DisposeClientSessionParameters, InitializeClientSessionParameters } from '@eclipse-glsp/protocol';

export interface CollaborateGlspClientProvider {
    isInCollaborateMode(): boolean;
    isHost(): boolean;
    isGuest(): boolean;
    initializeClientSession(params: InitializeClientSessionParameters): Promise<void>;
    disposeClientSession(params: DisposeClientSessionParameters): Promise<void>;
    sendActionMessage(message: ActionMessage): void;
    handleActionMessage(message: ActionMessage): void;
    createSubclientIdFromSession(): string;
}
