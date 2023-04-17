import { ActionMessage, Args, Action } from "@eclipse-glsp/protocol";
import { hasOwnProperty } from 'sprotty-protocol';
import * as sprotty from 'sprotty-protocol/lib/actions';

export function isActionMessage(message: unknown): message is ActionMessage {
    return hasOwnProperty(message, 'action');
};
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
