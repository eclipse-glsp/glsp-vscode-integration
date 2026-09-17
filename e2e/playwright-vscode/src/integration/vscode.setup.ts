/********************************************************************************
 * Copyright (c) 2023-2026 EclipseSource and others.
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
import { downloadAndUnzipVSCode, makeConsoleReporter, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import * as cp from 'child_process';
import { constants } from 'fs';
import * as fs from 'fs/promises';
import { VSCodeIntegrationUtils } from './vscode.integration';
import { VSCodeIntegrationOptions } from './vscode.options';

export interface VSCodeExtensionFile {
    identifier: {
        id: string;
    };
    version: string;
    metadata: {
        installedTimestamp: number;
    };
}

export interface VSCodeSetupOptions {
    enableLogging: boolean;
}

/**
 * The {@link VSCodeSetup} prepares the environment to run VSCode tests.
 *
 * It provides functionality to:
 *
 * - download the newest VSCode instance with unpacking it in the folder `.vscode-test`
 * - install extensions
 */
export class VSCodeSetup {
    protected readonly vscodeDownloadReporter = makeConsoleReporter();

    constructor(
        protected readonly integrationOptions: VSCodeIntegrationOptions,
        protected readonly setupOptions: VSCodeSetupOptions = {
            enableLogging: false
        }
    ) {}

    async downloadVSCode(version: string): Promise<string> {
        const downloadReporter = await makeConsoleReporter();
        return downloadAndUnzipVSCode(version, undefined, {
            report: report => {
                if (this.setupOptions.enableLogging) {
                    downloadReporter.report(report);
                }
            },
            error: error => {
                downloadReporter.error(error);
            }
        });
    }

    /**
     * If the extension will be installed depends on different factors:
     *
     * - If the extension is not installed, it will install it.
     * - If the extension is already installed, then the installation will be skipped.
     *
     * Moreover, the following checks are done:
     *
     * - If the create timestamp of the vsix file is newer than the installation time of the extension,
     * then it will be reinstalled.
     * - If any error occurs, it will proceed with a clean install.
     */
    async install(options: { vscodeExecutablePath: string }): Promise<void> {
        const [cli] = resolveCliArgsFromVSCodeExecutablePath(options.vscodeExecutablePath);
        // Resolved here rather than when the options were built: only the variant that runs needs a
        // packaged extension.
        const vsixPath = VSCodeIntegrationOptions.resolveVsixPath(this.integrationOptions);

        // Must match the directory the integration launches VS Code against, so that what is
        // installed here is what the tests actually run.
        const extensionDir = VSCodeIntegrationUtils.resolveExtensionsDir(this.integrationOptions, options.vscodeExecutablePath);
        const extensionArg = [`--extensions-dir=${extensionDir}`];
        let status: number | undefined;

        try {
            const extensionsFile = `${extensionDir}/extensions.json`;
            await fs.access(extensionsFile, constants.R_OK);

            const installedExtensions = JSON.parse(await fs.readFile(extensionsFile, 'utf8')) as VSCodeExtensionFile[];
            const entry = installedExtensions.find(e => e.identifier.id === this.integrationOptions.vsixId);

            if (entry === undefined) {
                const spawn = this.installExtension(cli, extensionArg, vsixPath);
                status = spawn.status ?? -1;
            } else {
                const stat = await fs.stat(vsixPath);
                if (entry.metadata.installedTimestamp < stat.birthtimeMs) {
                    this.log(
                        '[Extension] Older installation detected.',
                        new Date(entry.metadata.installedTimestamp).toISOString(),
                        new Date(stat.birthtimeMs).toISOString()
                    );
                    this.deleteExtension(cli, extensionArg, this.integrationOptions.vsixId);
                    const spawn = this.installExtension(cli, extensionArg, vsixPath);
                    status = spawn.status ?? -1;
                } else {
                    this.log('[Extension] Extension is already installed. Skipping install.');
                }
            }
        } catch (ex) {
            this.log('[Extension] Proceed with clean install.');
            this.deleteExtension(cli, extensionArg, this.integrationOptions.vsixId);
            const spawn = this.installExtension(cli, extensionArg, vsixPath);
            status = spawn.status ?? -1;
        }

        if (status) {
            if (status === 0) {
                this.log('[Extension] Extension installed');
            } else {
                throw new Error('[Extension] Extension install failed - Check logs');
            }
        }
    }

    protected log(message: string, ...params: any[]): void {
        if (this.setupOptions.enableLogging) {
            console.log(message, ...params);
        }
    }

    protected deleteExtension(cli: string, args: string[], vsixId: string): cp.SpawnSyncReturns<string> {
        this.log('[Extension] Delete:', vsixId);
        return cp.spawnSync(cli, [...args, '--uninstall-extension', vsixId], {
            encoding: 'utf-8',
            stdio: 'inherit'
        });
    }

    protected installExtension(cli: string, args: string[], vsixPath: string): cp.SpawnSyncReturns<string> {
        this.log('[Extension] Install:', vsixPath);
        return cp.spawnSync(cli, [...args, '--install-extension', vsixPath], {
            encoding: 'utf-8',
            stdio: 'inherit'
        });
    }
}
