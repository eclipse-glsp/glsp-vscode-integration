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
import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import { MessageConnection } from 'vscode-jsonrpc';

import { createSocketConnection } from './glsp-diagram-editor-context';
import { ServerConnectionProvider } from './server-connection-provider';

export interface JavaSocketServerLaunchOptions {
    /** Path to the location of the jar file that should be launched as process */
    readonly jarPath: string;
    /** Port on which the server should listen for new client connections */
    serverPort: number;
    /** Indicates wether the server is already running or should be started in an embedded process. */
    isRunning: boolean;
    /** Indicates wether console logging of server process should be disabled*/
    noConsoleLog: boolean;
    /** Additional arguments that should be passed when starting the server process. */
    additionalArgs?: string[];
}

export namespace JavaSocketServerLaunchOptions {
    export function createDefaultOptions(): JavaSocketServerLaunchOptions {
        return {
            jarPath: '',
            serverPort: NaN,
            isRunning: false,
            noConsoleLog: false
        };
    }

    export function createOptions(options?: Partial<JavaSocketServerLaunchOptions>): JavaSocketServerLaunchOptions {
        return options ? {
            ...createDefaultOptions,
            ...options
        } as JavaSocketServerLaunchOptions : createDefaultOptions();
    }

    export const START_UP_COMPLETE_MSG = '[GLSP-Server]:Startup completed';

}
export class JavaSocketServerConnectionProvider implements ServerConnectionProvider {
    protected readonly options: JavaSocketServerLaunchOptions;
    protected resolveReady: (value?: void | PromiseLike<void> | undefined) => void;
    // eslint-disable-next-line no-invalid-this
    onReady: Promise<void> = new Promise(resolve => this.resolveReady = resolve);

    constructor(partialOptions?: Partial<JavaSocketServerLaunchOptions>) {
        this.options = JavaSocketServerLaunchOptions.createOptions(partialOptions);
    }

    public async createConnection(): Promise<MessageConnection> {

        const port = this.options.serverPort;

        if (isNaN(port)) {
            throw new Error(`Could not launch GLSP Server. The given server port is not a number: ${port}`);
        }

        await this.launchServer();

        const socket = new net.Socket();
        const connection = createSocketConnection(socket, socket);
        socket.connect(port);
        return connection;
    }

    protected async launchServer(): Promise<void> {
        if (this.options.isRunning) {
            this.resolveReady();
            return this.onReady;
        }
        const jarPath = this.options.jarPath;
        if (!fs.existsSync(jarPath)) {
            throw Error(`Could not launch GLSP server. The given jar path is not valid: ${jarPath}`);
        }
        let args = ['-jar', this.options.jarPath, '--port', `${this.options.serverPort}`];
        if (this.options.additionalArgs) {
            args = [...args, ...this.options.additionalArgs];
        }
        await this.spawnProcessAsync('java', args);
        return this.onReady;

    }

    protected get processName(): string {
        return 'GLSP-Server';
    }

    protected spawnProcessAsync(command: string, args?: string[], options?: SpawnOptions): Promise<ChildProcess> {
        const rawProcess = spawn(command, args, options);
        rawProcess.stderr.on('data', this.processLogError.bind(this));
        rawProcess.stdout.on('data', this.processLogInfo.bind(this));
        return new Promise<ChildProcess>((resolve, reject) => {
            rawProcess.on('error', error => {
                this.onDidFailSpawnProcess(error);
                if (error.message.includes('ENOENT')) {
                    const guess = command.split(/\s+/).shift();
                    if (guess) {
                        reject(new Error(`Failed to spawn ${guess}\nPerhaps it is not on the PATH.`));
                        return;
                    }
                }
                reject(error);
            });

            process.nextTick(() => resolve(rawProcess));
        });
    }

    protected onDidFailSpawnProcess(error: Error): void {
        if (!this.options.noConsoleLog) {
            console.error(`${this.processName}: ${error}`);
        }
    }

    protected processLogError(data: string | Buffer): void {
        if (data && !this.options.noConsoleLog) {
            console.error(`${this.processName}: ${data}`);
        }
    }

    protected processLogInfo(data: string | Buffer): void {
        if (data) {
            const message = data.toString();
            if (message.startsWith(JavaSocketServerLaunchOptions.START_UP_COMPLETE_MSG)) {
                this.resolveReady();
            }
            if (!this.options.noConsoleLog) {
                console.log(`${this.processName}: ${data}`);
            }
        }
    }

}
