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
import {
    ActionMessage,
    ApplicationIdProvider,
    Deferred,
    DisposableCollection,
    GLSPClient,
    InitializeParameters,
    InitializeResult,
    MaybePromise
} from '@eclipse-glsp/protocol';
import * as vscode from 'vscode';
import { GlspVscodeServer } from '../types';

export interface GlspVscodeServerOptions {
    /** Client ID to register the jsonRPC client with on the server. */
    readonly clientId: string;
    /** Name to register the client with on the server. */
    readonly clientName: string;
}

/**
 * Reusable base class for {@link GlspVscodeServer} implementations
 */
export abstract class BaseGlspVscodeServer<C extends GLSPClient = GLSPClient> implements GlspVscodeServer, vscode.Disposable {
    readonly onSendToServerEmitter = new vscode.EventEmitter<unknown>();

    protected readonly onServerSendEmitter = new vscode.EventEmitter<unknown>();
    get onServerMessage(): vscode.Event<unknown> {
        return this.onServerSendEmitter.event;
    }

    protected readyDeferred = new Deferred<void>();
    protected _initializeResult: InitializeResult;
    protected _glspClient: C;
    protected toDispose = new DisposableCollection();

    constructor(protected readonly options: GlspVscodeServerOptions) {
        this.onSendToServerEmitter.event(message => {
            this.onReady.then(() => {
                if (ActionMessage.is(message)) {
                    this._glspClient.sendActionMessage(message);
                }
            });
        });
        this.toDispose.push(this.onSendToServerEmitter, this.onServerSendEmitter);
    }

    /**
     * Creates and configues the {@link GLSPClient} instance.
     */
    abstract createGLSPClient(): MaybePromise<C>;

    async start(): Promise<void> {
        try {
            this._glspClient = await this.createGLSPClient();
            await this._glspClient.start();
            const parameters = await this.createInitializeParameters();
            this._initializeResult = await this._glspClient.initializeServer(parameters);

            this._glspClient.onActionMessage(message => {
                this.onServerSendEmitter.fire(message);
            });

            this.readyDeferred.resolve();
        } catch (error) {
            this.readyDeferred.reject(error);
        }
    }

    protected async createInitializeParameters(): Promise<InitializeParameters> {
        return {
            applicationId: ApplicationIdProvider.get(),
            protocolVersion: GLSPClient.protocolVersion
        };
    }

    get onReady(): Promise<void> {
        return this.readyDeferred.promise;
    }

    get initializeResult(): Promise<InitializeResult> {
        return this.onReady.then(() => this._initializeResult);
    }

    get glspClient(): Promise<GLSPClient> {
        return this.onReady.then(() => this._glspClient);
    }

    dispose(): void {
        this.toDispose.dispose();
        if (this._glspClient) {
            this._glspClient.stop();
        }
    }
}
