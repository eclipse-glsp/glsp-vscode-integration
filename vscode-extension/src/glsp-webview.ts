/********************************************************************************
 * Copyright (c) 2020 EclipseSource and others.
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
import { GLSPClient } from '@eclipse-glsp/protocol';
import { isActionMessage, SprottyWebview, SprottyWebviewOptions } from 'sprotty-vscode';

import { GLSPVscodeExtension } from './glsp-vscode-extension';

export class GLSPWebView extends SprottyWebview {
    static viewCount = 0;

    readonly extension: GLSPVscodeExtension;

    constructor(protected options: SprottyWebviewOptions) {
        super(options);
        if (!(options.extension instanceof GLSPVscodeExtension)) {
            throw new Error('GLSPWebView must be initialized with a GLSPVscodeExtension');
        }
    }

    protected glspClient(): Promise<GLSPClient> {
        return this.extension.glspClient();
    }

    protected async connect(): Promise<void> {
        super.connect();
        this.disposables.push(this.extension.onMessageFromGLSPServer(message => this.sendToWebview(message)));
        super.sendDiagramIdentifier();
    }

    protected async sendDiagramIdentifier(): Promise<void> {
        // defer first message until glsp client is ready
    }

    protected async receiveFromWebview(message: any): Promise<boolean> {
        const shouldPropagate = await super.receiveFromWebview(message);
        if (shouldPropagate) {
            if (isActionMessage(message)) {
                console.log('Send to the client:', message);
                this.glspClient().then(client => client.sendActionMessage(message));
            }
        }
        return false;
    }
}
