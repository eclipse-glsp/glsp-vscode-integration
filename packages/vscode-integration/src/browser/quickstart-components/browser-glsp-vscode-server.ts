/********************************************************************************
 * Copyright (c) 2022 EclipseSource and others.
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

import { MessageConnection } from 'vscode-jsonrpc';
import { BrowserMessageReader, BrowserMessageWriter, createMessageConnection } from 'vscode-jsonrpc/browser';
import { JsonRpcVscodeServer, JsonRpcVscodeServerOptions } from '../../common/quickstart-components/jsonrpc-vscode-server';

export interface BrowserVscodeServerOptions extends JsonRpcVscodeServerOptions {
    serverWorker: Worker;
}
export class BrowserVscodeServer extends JsonRpcVscodeServer {
    constructor(protected override options: BrowserVscodeServerOptions) {
        super(options);
    }

    protected createConnection(): MessageConnection {
        const reader = new BrowserMessageReader(this.options.serverWorker);
        const writer = new BrowserMessageWriter(this.options.serverWorker);
        return createMessageConnection(reader, writer);
    }
}
