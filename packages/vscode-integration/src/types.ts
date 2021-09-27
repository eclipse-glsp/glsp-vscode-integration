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

import * as vscode from 'vscode';

/**
 * Any clients registered on the GLSP VSCode integration need to implement this
 * interface.
 */
export interface GlspVscodeClient<D extends vscode.CustomDocument = vscode.CustomDocument> {

    /**
     * A unique identifier for the client/panel with which the client will be registered
     * on the server.
     */
    readonly clientId: string;

    /**
     * The webview belonging to the client.
     */
    readonly webviewPanel: vscode.WebviewPanel;

    /**
     * The document object belonging to the client;
     */
    readonly document: D;

    /**
     * This event emitter is used by the VSCode integration to pass messages/actions
     * to the client. These messages can come from the server or the VSCode integration
     * itself.
     *
     * You should subscribe to the attached event and pass contents of the event
     * to the webview.
     *
     * Use the properties `onBeforeReceiveMessageFromServer` and `onBeforePropagateMessageToClient`
     * of the GlspVscodeConnector in order to control what messages are propagated
     * and processed.
     */
    readonly onSendToClientEmitter: vscode.EventEmitter<unknown>;

    /**
     * The VSCode integration will subscribe to this event to listen to messages
     * from the client.
     *
     * Fire this event with the message the client wants to send to the server.
     *
     * Use the properties `onBeforeReceiveMessageFromClient` and `onBeforePropagateMessageToServer`
     * of the GlspVscodeConnector in order to control what messages are propagated
     * and processed.
     */
    readonly onClientMessage: vscode.Event<unknown>;
}

/**
 * The server or server wrapper used by the VSCode integration needs to implement
 * this interface.
 */
export interface GlspVscodeServer {

    /**
     * An event emitter used by the VSCode extension to send messages to the server.
     *
     * You should subscribe to the event attached to this emitter to receive messages
     * from the client/VSCode integration and pass them to the server.
     *
     * Use the properties `onBeforeReceiveMessageFromClient` and `onBeforePropagateMessageToServer`
     * of the GlspVscodeConnector in order to control what messages are propagated
     * and processed.
     */
    readonly onSendToServerEmitter: vscode.EventEmitter<unknown>;

    /**
     * An event the VSCode integration uses to receive messages from the server.
     * The messages are then propagated to the client or processed by the VSCode
     * integration to provide functionality.
     *
     * Fire this event with the message the server wants to send to the client.
     *
     * Use the properties `onBeforeReceiveMessageFromServer` and `onBeforePropagateMessageToClient`
     * of the GlspVscodeConnector in order to control what messages are propagated
     * and processed.
     */
    readonly onServerMessage: vscode.Event<unknown>;
}

interface InterceptorCallback {
    /**
     * This callback controls what message should be propagated to the VSCode integration
     * and whether the VSCode integration should process it (ie. provide functionality
     * based on the message).
     *
     * @param newMessage The message to be propagated. This value can be anything,
     * however if it is `undefined` the message will not be propagated further.
     * @param shouldBeProcessedByConnector Optional parameter indicating whether the
     * VSCode integration should process the message. That usually means providing
     * functionality based on the message but also modifying it or blocking it from
     * being propagated further.
     */
    (newMessage: unknown | undefined, shouldBeProcessedByConnector?: boolean): void;
}

export interface GlspVscodeConnectorOptions {

    /**
     * The GLSP server (or its wrapper) that the VSCode integration should use.
     */
    server: GlspVscodeServer;

    /**
     * Wether the GLSP-VSCode integration should log various events. This is useful
     * if you want to find out what events the VSCode integration is receiving from
     * and sending to the server and clients.
     *
     * Defaults to `false`.
     */
    logging?: boolean;

    /**
     * Optional property to intercept (and/or modify) messages sent from the client
     * to the VSCode integration via `GlspVscodeClient.onClientSend`.
     *
     * @param message Contains the original message sent by the client.
     * @param callback A callback to control how messages are handled further.
     */
    onBeforeReceiveMessageFromClient?: (message: unknown, callback: InterceptorCallback) => void;

    /**
     * Optional property to intercept (and/or modify) messages sent from the server
     * to the VSCode integration via `GlspVscodeServer.onServerSend`.
     *
     * @param message Contains the original message sent by the client.
     * @param callback A callback to control how messages are handled further.
     */
    onBeforeReceiveMessageFromServer?(message: unknown, callback: InterceptorCallback): void;

    /**
     * Optional property to intercept (and/or modify) messages sent from the VSCode
     * integration to the server via the `GlspVscodeServer.onServerReceiveEmitter`.
     *
     * The returned value from this function is the message that will be propagated
     * to the server. It can be modified to anything. Returning `undefined` will
     * cancel the propagation.
     *
     * @param originalMessage The original message received by the VSCode integration
     * from the client.
     * @param processedMessage If the VSCode integration modified the received message
     * in any way, this parameter will contain the modified message. If the VSCode
     * integration did not modify the message, this parameter will be identical to
     * `originalMessage`.
     * @param messageChanged This parameter will indicate wether the VSCode integration
     * modified the incoming message. In other words: Whether `originalMessage`
     * and `processedMessage` are different.
     * @returns A message that will be propagated to the server. If the message
     * is `undefined` the propagation will be cancelled.
     */
    onBeforePropagateMessageToServer?(
        originalMessage: unknown, processedMessage: unknown, messageChanged: boolean
    ): unknown | undefined;

    /**
     * Optional property to intercept (and/or modify) messages sent from the VSCode
     * integration to a client via the `GlspVscodeClient.onClientReceiveEmitter`.
     *
     * The returned value from this function is the message that will be propagated
     * to the client. It can be modified to anything. Returning `undefined` will
     * cancel the propagation.
     *
     * @param originalMessage The original message received by the VSCode integration
     * from the server.
     * @param processedMessage If the VSCode integration modified the received message
     * in any way, this parameter will contain the modified message. If the VSCode
     * integration did not modify the message, this parameter will be identical to
     * `originalMessage`.
     * @param messageChanged This parameter will indicate wether the VSCode integration
     * modified the incoming message. In other words: Whether `originalMessage`
     * and `processedMessage` are different.
     * @returns A message that will be propagated to the client. If the message
     * is `undefined` the propagation will be cancelled.
     */
    onBeforePropagateMessageToClient?(
        originalMessage: unknown, processedMessage: unknown, messageChanged: boolean
    ): unknown | undefined;
}
