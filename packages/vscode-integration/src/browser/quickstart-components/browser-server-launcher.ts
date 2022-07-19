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

import * as vscode from 'vscode';
import { GlspServerLauncher, GlspServerLauncherOptions } from '../../common';
const START_UP_COMPLETE_MSG = '[GLSP-Server]:Startup completed';

export interface BrowserServerLaunchOptions extends GlspServerLauncherOptions {
    /**
     * URL to the location of the GLSP server script that should be launched
     * in a webworker.
     */
    readonly serverScriptUrl: URL | string;
    /**
     * Restrict the server type to node as we currently don't support
     * java servers in web workers.
     */
    readonly serverType: 'node';
}

export class BrowserServerLauncher implements GlspServerLauncher<BrowserServerLaunchOptions>, vscode.Disposable {
    protected serverWorker: Worker;

    start(options: BrowserServerLaunchOptions): Promise<Worker> {
        try {
            this.serverWorker = new Worker(options.serverScriptUrl);
        } catch (error) {
            throw new Error(`Could not launch GLSP server worker. The given script URL is not valid: ${options.serverScriptUrl}`);
        }
        return new Promise((resolve, reject) => {
            this.serverWorker.addEventListener(
                'message',
                message => {
                    if (message.data === START_UP_COMPLETE_MSG) {
                        resolve(this.serverWorker);
                    } else {
                        reject(`Unexpected message received: ${message.data}`);
                    }
                },
                { once: true }
            );
        });
    }

    stop(): void {
        this.serverWorker.terminate();
    }

    dispose(): void {
        this.stop();
    }
}
