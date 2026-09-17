/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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
import type { ChildProcess } from 'child_process';
import { spawn, spawnSync } from 'child_process';

/**
 * Environment variable that opts a run into one virtual display per Playwright worker.
 *
 * Off by default: without it the launched VS Code windows appear on the caller's display, which is
 * what a developer watching a run wants. The `test:headless` script turns it on.
 */
export const DISPLAY_ISOLATION_ENV = 'GLSP_VSCODE_ISOLATED_DISPLAYS';

/** Screen geometry of a worker's virtual display, matching the `xvfb-run` default. */
const SCREEN_GEOMETRY = '1280x1024x24';

/** How long `Xvfb` gets to report the display it picked before the run falls back to the inherited one. */
const STARTUP_TIMEOUT_MS = 10_000;

let displayPromise: Promise<string | undefined> | undefined;
let xvfb: ChildProcess | undefined;

/**
 * Whether this run isolates each Playwright worker on a virtual display of its own.
 *
 * VS Code windows of concurrent workers otherwise share one display and one pointer, and the enter
 * and leave events of a window that opens or closes cancel a hover that another worker is waiting
 * on. Isolation therefore decides how many workers a run can use — {@link supportsDisplayIsolation}
 * is what the Playwright configuration asks before setting `workers`.
 *
 * Requires Linux and an `Xvfb` binary; macOS and Windows have no equivalent and run single-worker.
 */
export function supportsDisplayIsolation(): boolean {
    if (process.env[DISPLAY_ISOLATION_ENV] !== 'true') {
        return false;
    }
    return process.platform === 'linux' && hasXvfb();
}

function hasXvfb(): boolean {
    return spawnSync('which', ['Xvfb'], { stdio: 'ignore' }).status === 0;
}

/**
 * The display the VS Code instances of this worker run on, starting one `Xvfb` per worker process.
 *
 * Playwright runs every worker in a process of its own, so the server started here is shared by the
 * tests of that worker and by nothing else. It is terminated when the worker exits.
 *
 * @returns The display to hand to VS Code, or `undefined` to keep the inherited one
 */
export async function acquireIsolatedDisplay(): Promise<string | undefined> {
    if (!supportsDisplayIsolation()) {
        return undefined;
    }
    displayPromise ??= startXvfb();
    return displayPromise;
}

/**
 * Starts an `Xvfb` that picks a free display itself and reports it on stdout.
 *
 * Letting the server choose avoids races: workers start at the same time, and a display number
 * derived from the worker index would collide with servers left behind by other runs.
 */
function startXvfb(): Promise<string | undefined> {
    return new Promise(resolve => {
        const server = spawn('Xvfb', ['-displayfd', '1', '-screen', '0', SCREEN_GEOMETRY, '-nolisten', 'tcp'], {
            stdio: ['ignore', 'pipe', 'ignore']
        });
        xvfb = server;

        const settle = (display: string | undefined): void => {
            clearTimeout(timeout);
            resolve(display);
        };
        const timeout = setTimeout(() => {
            stopXvfb();
            settle(undefined);
        }, STARTUP_TIMEOUT_MS);

        server.stdout?.once('data', chunk => {
            const displayNumber = chunk.toString().trim();
            settle(displayNumber ? `:${displayNumber}` : undefined);
        });
        // A missing binary surfaces here rather than as a throw, so a run without `Xvfb` degrades to
        // the inherited display instead of failing.
        server.once('error', () => settle(undefined));
        server.once('exit', () => settle(undefined));
    });
}

function stopXvfb(): void {
    xvfb?.kill('SIGTERM');
    xvfb = undefined;
}

// The worker process owns its display for its whole lifetime; nothing outside it uses the server.
process.once('exit', stopXvfb);
