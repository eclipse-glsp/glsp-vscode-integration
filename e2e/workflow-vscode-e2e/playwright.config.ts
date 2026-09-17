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
import { applyEnvDefaults, baseConfig, getPort, loadEnv } from '@eclipse-glsp-examples/workflow-e2e/configs';
import type { GLSPPlaywrightOptions } from '@eclipse-glsp/playwright';
import { supportsDisplayIsolation } from '@eclipse-glsp/playwright-vscode';
import { type PlaywrightTestConfig, type ReporterDescription } from '@playwright/test';
import * as os from 'os';
import * as path from 'path';
import { GLSP_WEBSOCKET_PATH } from './configs/env';
import { buildProjects, getActiveProjects } from './configs/project.config';
import { buildWebServers } from './configs/webserver.config';

// The `.env` is shared by every e2e package in this repository, so it lives one level up.
loadEnv(path.resolve(__dirname, '..'));
applyEnvDefaults();

// Read by the extension under test, which runs in the VS Code instance this process launches and
// therefore inherits our environment: attach to the server Playwright started (or the caller's)
// instead of spawning one, and speak WebSocket on the path and port that server listens on.
// All three have to be exported, not just resolved — the extension reads `process.env` directly and
// silently falls back to port 0 when `GLSP_SERVER_PORT` is unset.
process.env.GLSP_SERVER_DEBUG = 'true';
process.env.GLSP_WEBSOCKET_PATH ??= GLSP_WEBSOCKET_PATH;
process.env.GLSP_SERVER_PORT = String(getPort('GLSP_SERVER_PORT'));

/**
 * Workers for a run with isolated displays.
 *
 * Each worker costs a VS Code instance plus an X server, so this stays below Playwright's default:
 * half the cores, and at most four even on a large machine. A two-core CI runner ends up with one
 * worker, which is the serial behaviour it would have had anyway.
 */
function isolatedWorkers(): number {
    return Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig<GLSPPlaywrightOptions> = {
    ...baseConfig,
    // Every worker launches a VS Code window of its own. Sharing one display between them makes the
    // hover-driven tests flaky: the enter and leave events of a window that opens or closes cancel a
    // hover another worker is waiting on, and the popup never appears. Parallel workers on one
    // display made `The popup > should be closed on > new hover` fail in two of three runs.
    // With a display per worker the windows no longer interfere, so a run is only parallel where
    // that isolation is available; everywhere else it is serial and correct.
    workers: supportsDisplayIsolation() ? isolatedWorkers() : 1,
    // Summarize the run in the GitHub Actions job overview. Added here rather than in `baseConfig`,
    // so that consumers of the shared config do not need this CI-only reporter installed.
    reporter: process.env.CI
        ? [...(baseConfig.reporter as ReporterDescription[]), ['@estruyf/github-actions-reporter']]
        : baseConfig.reporter,
    testDir: 'lib/tests',
    // VS Code launches Electron itself, so only the GLSP server is needed.
    webServer: buildWebServers(),
    projects: buildProjects(__dirname, getActiveProjects())
};

export default config;
