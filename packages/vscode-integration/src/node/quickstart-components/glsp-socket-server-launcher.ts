/********************************************************************************
 * Copyright (c) 2021-2023 EclipseSource and others.
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
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as vscode from 'vscode';

const START_UP_COMPLETE_MSG = '[GLSP-Server]:Startup completed';

export interface SocketServerLauncherOptions {
    /** Path to the location of the server executable (JAR or node module) that should be launched as process */
    readonly executable: string;
    /** Socket connection on which the server should listen for new client connections */
    socketConnectionOptions: net.TcpSocketConnectOpts;
    /** Set to `true` if server stdout and stderr should be printed in extension host console. Default: `false` */
    readonly logging?: boolean;
    /** Additional arguments that should be passed when starting the server process. */
    readonly additionalArgs?: string[];
}

/**
 * This component can be used to bootstrap your extension when using the default
 * GLSP server implementations, which you can find here:
 * https://github.com/eclipse-glsp/glsp-server
 * https://github.com/eclipse-glsp/glsp-server-node
 *
 * It simply starts up a server executable (JAR or node module) located at a specified path on a specified port.
 * You can pass additional launch arguments through the options.
 *
 * If you need a component to quickly connect your default GLSP server to the GLSP-VSCode
 * integration, take a look at the `SocketGlspVscodeServer` quickstart component.
 */
export class GlspSocketServerLauncher implements vscode.Disposable {
    protected readonly options: Required<SocketServerLauncherOptions>;
    protected serverProcess?: childProcess.ChildProcess;

    constructor(options: SocketServerLauncherOptions) {
        // Create default options
        this.options = {
            logging: false,
            additionalArgs: [],
            ...options
        };
    }

    /**
     * Starts up the server.
     */
    async start(): Promise<void> {
        const executable = this.options.executable;

        if (!executable) {
            throw new Error('Could not launch GLSP server. No executable path is provided via the launch options');
        }

        if (!fs.existsSync(executable)) {
            throw Error(`Could not launch GLSP server. The given server executable path is not valid: ${executable}`);
        }

        if (isNaN(this.options.socketConnectionOptions.port)) {
            throw new Error(
                `Could not launch GLSP Server. The given server port is not a number: ${this.options.socketConnectionOptions.port}`
            );
        }

        const process = this.startProcess();
        this.serverProcess = process;
        return this.configureProcess(process);
    }

    protected configureProcess(process: childProcess.ChildProcessWithoutNullStreams): Promise<void> {
        return new Promise(resolve => {
            process.stdout.on('data', data => {
                if (data.toString().includes(START_UP_COMPLETE_MSG)) {
                    const port = this.getPortFromStartupMessage(data.toString());
                    if (port) {
                        if (this.options.socketConnectionOptions.port === 0) {
                            this.options.socketConnectionOptions.port = port;
                        } else {
                            if (this.options.socketConnectionOptions.port !== port) {
                                throw new Error(
                                    // eslint-disable-next-line max-len
                                    `The configured port ${this.options.socketConnectionOptions.port} does not match the port in the startup message: ${data}`
                                );
                            }
                        }
                    } else {
                        throw new Error('Could not find listening port in startup message of GLSP server!');
                    }
                    resolve();
                }

                this.handleStdoutData(data);
            });

            process.stderr.on('data', error => this.handleStderrData(error));
            process.on('error', error => this.handleProcessError(error));
        });
    }

    protected startProcess(): childProcess.ChildProcessWithoutNullStreams {
        if (this.options.executable.endsWith('.jar')) {
            return this.startJavaProcess();
        } else if (this.options.executable.endsWith('.js')) {
            return this.startNodeProcess();
        } else {
            throw new Error(`Could not launch GLSP Server. Invalid executable path ${this.options.executable}`);
        }
    }

    protected startJavaProcess(): childProcess.ChildProcessWithoutNullStreams {
        if (!this.options.executable.endsWith('jar')) {
            throw new Error(`Could not launch Java GLSP server. The given executable is no JAR: ${this.options.executable}`);
        }
        const args = [
            '-jar',
            this.options.executable,
            '--port',
            `${this.options.socketConnectionOptions.port}`,
            '--host',
            `${this.options.socketConnectionOptions.host ?? '127.0.0.1'}`,
            ...this.options.additionalArgs
        ];

        if (this.options.socketConnectionOptions.host) {
            args.push('--host', `${this.options.socketConnectionOptions.host}`);
        }
        return childProcess.spawn('java', args);
    }

    protected startNodeProcess(): childProcess.ChildProcessWithoutNullStreams {
        if (!this.options.executable.endsWith('.js')) {
            throw new Error(`Could not launch Node GLSP server. The given executable is no node module: ${this.options.executable}`);
        }
        const args = [
            this.options.executable,
            '--port',
            `${this.options.socketConnectionOptions.port}`,
            '--host',
            `${this.options.socketConnectionOptions.host ?? '127.0.0.1'}`,
            ...this.options.additionalArgs
        ];

        return childProcess.spawn('node', args);
    }

    protected getPortFromStartupMessage(message: string): number | undefined {
        if (message.includes(START_UP_COMPLETE_MSG)) {
            const port = message.substring(message.lastIndexOf(':') + 1);
            return parseInt(port, 10);
        }
        return undefined;
    }

    protected handleStdoutData(data: string | Buffer): void {
        if (this.options.logging) {
            console.log('GLSP-Server:', data.toString());
        }
    }

    protected handleStderrData(data: string | Buffer): void {
        if (data && this.options.logging) {
            console.error('GLSP-Server:', data.toString());
        }
    }

    protected handleProcessError(error: Error): never {
        if (this.options.logging) {
            console.error('GLSP-Server:', error);
        }

        throw error;
    }

    getPort(): number {
        return this.options.socketConnectionOptions.port;
    }

    /**
     * Stops the server.
     */
    stop(): void {
        if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill('SIGINT');
            // TODO: Think of a process that does this elegantly with the same consistency.
        }
    }

    dispose(): void {
        this.stop();
    }
}
