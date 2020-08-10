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
import * as cp from 'child_process';
import * as net from 'net';
import * as stream from 'stream';
import {
    createMessageConnection,
    MessageConnection,
    SocketMessageReader,
    SocketMessageWriter,
    StreamMessageReader,
    StreamMessageWriter
} from 'vscode-jsonrpc';

export function createSocketConnection(outSocket: net.Socket, inSocket: net.Socket): MessageConnection {
    const reader = new SocketMessageReader(outSocket);
    const writer = new SocketMessageWriter(inSocket);
    return createMessageConnection(reader, writer);
}

export function createStreamConnection(outStream: stream.Readable, inStream: stream.Writable): MessageConnection {
    const reader = new StreamMessageReader(outStream);
    const writer = new StreamMessageWriter(inStream);
    return createMessageConnection(reader, writer);
}

export function createProcessStreamConnection(process: cp.ChildProcess): MessageConnection {
    return createStreamConnection(process.stdout, process.stdin);
}
