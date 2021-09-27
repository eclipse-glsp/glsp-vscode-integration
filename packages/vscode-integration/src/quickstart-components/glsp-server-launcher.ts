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

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';

const START_UP_COMPLETE_MSG = '[GLSP-Server]:Startup completed';

interface JavaSocketServerLauncherOptions {
    /** Path to the location of the jar file that should be launched as process */
    readonly jarPath: string;
    /** Port on which the server should listen for new client connections */
    readonly serverPort: number;
    /** Set to `true` if server stdout and stderr should be printed in extension host console. Default: `false` */
    readonly logging?: boolean;
    /** Additional arguments that should be passed when starting the server process. */
    readonly additionalArgs?: string[];
}

/**
 * This component can be used to bootstrap your extension when using the default
 * GLSP server implementation, which you can find here:
 * https://github.com/eclipse-glsp/glsp-server
 *
 * It simply starts up a server JAR located at a specified path on a specified port.
 * You can pass additional launch arguments through the options.
 *
 * If you need a component to quickly connect your default GLSP server to the GLSP-VSCode
 * integration, take a look at the `SocketGlspVscodeServer` quickstart component.
 */
export class GlspServerLauncher implements vscode.Disposable {
    protected readonly options: Required<JavaSocketServerLauncherOptions>;
    protected serverProcess?: childProcess.ChildProcess;

    constructor(options: JavaSocketServerLauncherOptions) {
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
        return new Promise(resolve => {
            const jarPath = this.options.jarPath;

            if (!fs.existsSync(jarPath)) {
                throw Error(`Could not launch GLSP server. The given jar path is not valid: ${jarPath}`);
            }

            const args = [
                '-jar', this.options.jarPath,
                '--port', `${this.options.serverPort}`,
                ...this.options.additionalArgs
            ];

            const process = childProcess.spawn('java', args);
            this.serverProcess = process;

            process.stdout.on('data', data => {
                if (data.toString().includes(START_UP_COMPLETE_MSG)) {
                    resolve();
                }

                this.handleStdoutData(data);
            });

            process.stderr.on('data', this.handleStderrData);
            process.on('error', this.handleProcessError);
        });
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
