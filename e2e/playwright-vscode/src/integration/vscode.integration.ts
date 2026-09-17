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
import type { ElectronApplication, Locator, Page } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import { resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as platformPath from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { DiagramShortcutIntegration, DiagramShortcuts, IntegrationArgs } from '@eclipse-glsp/playwright';
import { hostDiagramShortcuts, Integration, SVGMetadataUtils } from '@eclipse-glsp/playwright';
import { acquireIsolatedDisplay } from './vscode.display';
import { VSCodeWorkbenchActivitybar } from './po/workbench-activitybar.po';
import type { VSCodeIntegrationConfig, VSCodeIntegrationOptions } from './vscode.options';
import { VSCodeStorage } from './vscode.storage';

export interface VSCodeRunConfig {
    runId: string;
    runFolder: string;
    paths: RunPaths;
}

interface RunPaths {
    extensionDir: string;
    userDataDir: string;
}

/**
 * The {@link VSCodeIntegration} provides the glue code for working
 * with the VSCode version of the GLSP-Client.
 *
 * The integration will:
 *
 * - prefix the root selector to the correct frame, as webviews are used in VSCode
 * - start the VSCode instance (i.e., Electron) with different run configurations
 * - check if the extension is already installed
 * - wait for the GLSP-Client
 *
 * **Note**
 *
 * Run configurations allow starting multiple Electron instances in parallel
 * and the configuration will be saved in the temp folder.
 */
export class VSCodeIntegration extends Integration implements DiagramShortcutIntegration {
    protected _page: Page;
    workbenchActivitybar: VSCodeWorkbenchActivitybar;

    readonly diagramShortcuts: DiagramShortcuts = hostDiagramShortcuts;

    protected runConfig: VSCodeRunConfig;
    protected electronApp: ElectronApplication;
    protected storage: VSCodeStorage.Storage;

    constructor(
        args: IntegrationArgs,
        protected readonly options: VSCodeIntegrationOptions
    ) {
        super(args, 'VSCode');
    }

    override async initialize(): Promise<void> {
        const storagePath = this.options.storagePath;
        const storage = await VSCodeStorage.read(storagePath);
        if (VSCodeStorage.is(storage)) {
            this.storage = storage;
        } else {
            throw Error(`Provided storage in "${storagePath}" was not a valid vscode storage. ${JSON.stringify(storage, null, 2)}`);
        }
    }

    override get page(): Page {
        return this._page;
    }

    override prefixRootSelector(selector: string): Locator {
        // The webview is nested two frames deep. The outer frame is matched by class rather than by
        // tag: a web extension is hosted in an additional, hidden worker-host iframe, so a bare
        // `iframe` is ambiguous in the workbench.
        return this.page.frameLocator('iframe.webview').frameLocator('iframe').locator(selector);
    }

    override async close(): Promise<void> {
        await this.electronApp.close();
        await fs.rm(this.runConfig.runFolder, { recursive: true, force: true });
    }

    protected override async beforeLaunch(): Promise<void> {
        this.runConfig = await this.createRunConfiguration(this.options, this.storage);
    }

    protected override async launch(): Promise<void> {
        // Concurrent workers each get a display of their own; without isolation this is `undefined`
        // and VS Code inherits the caller's.
        const display = await acquireIsolatedDisplay();

        this.electronApp = await electron.launch({
            executablePath: this.storage.vscodeExecutablePath,
            env: display ? { ...VSCodeIntegrationUtils.definedEnv(), DISPLAY: display } : undefined,
            args: [
                ...VSCodeIntegrationUtils.pathArgs(this.runConfig),
                '--new-window',
                '--inspect',
                '--skip-release-notes',
                '--skip-welcome',
                '--disable-telemetry',
                '--no-cached-data',
                '--disable-updates',
                '--disable-keytar',
                '--disable-crash-reporter',
                '--disable-workspace-trust',
                '--disable-gpu',
                '--no-sandbox',
                this.options.workspace
            ]
        });
    }

    protected override async afterLaunch(): Promise<void> {
        this._page = await this.electronApp.firstWindow();
        await this.page.waitForLoadState('domcontentloaded');

        this.workbenchActivitybar = new VSCodeWorkbenchActivitybar(this.page);

        await this.waitForReady();

        if (this.options.file) {
            await this.navigateToFile(this.options.file);
        }
    }

    protected async createRunConfiguration(options: VSCodeIntegrationOptions, storage: VSCodeStorage.Storage): Promise<VSCodeRunConfig> {
        const runId = uuidv4();
        const runFolder = await fs.mkdtemp(platformPath.join(os.tmpdir(), 'glsp-playwright-run-'));

        return {
            runId,
            runFolder,
            paths: {
                extensionDir: VSCodeIntegrationUtils.resolveExtensionsDir(options, storage.vscodeExecutablePath),
                userDataDir: 'user-data'
            }
        };
    }

    protected async waitForReady(): Promise<void> {
        const extensionsView = await this.workbenchActivitybar.openExtensions();
        await extensionsView.waitForStart(this.options.vsixId);
        await this.workbenchActivitybar.openExplorer();
    }

    protected async navigateToFile(file: string): Promise<void> {
        const explorerView = await this.workbenchActivitybar.openExplorer();
        await explorerView.openFile(file);
        await this.assertMetadataAPI();
        await this.prefixRootSelector(`${SVGMetadataUtils.typeAttrOf('graph')} svg.sprotty-graph > g`).waitFor({ state: 'visible' });
    }
}

export namespace VSCodeIntegrationUtils {
    /**
     * The directory the extension under test is installed into.
     *
     * Falls back to the directory VS Code resolves from the downloaded executable, which is shared
     * by every run and therefore cannot hold two variants of the same extension at once.
     *
     * @param options Options of the integration under test
     * @param vscodeExecutablePath Path to the downloaded VS Code executable
     */
    export function resolveExtensionsDir(options: Pick<VSCodeIntegrationOptions, 'extensionsDir'>, vscodeExecutablePath: string): string {
        if (options.extensionsDir) {
            return platformPath.resolve(options.extensionsDir);
        }
        const [, ...defaultArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
        return defaultArgs[0].split(/=(.*)/s)[1];
    }

    /**
     * The current environment without the unset entries.
     *
     * Playwright replaces the whole environment when `env` is given, so the variables the extension
     * under test reads — the GLSP server port and the debug flag among them — have to be carried
     * over explicitly.
     */
    export function definedEnv(): Record<string, string> {
        return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    }

    export function fullPath(config: VSCodeRunConfig, path: keyof RunPaths): string {
        const configPath = config.paths[path];

        if (configPath.startsWith('/')) {
            return configPath;
        }

        return `${config.runFolder}/${configPath}`;
    }

    export function pathArgs(config: VSCodeRunConfig): string[] {
        return [`--extensions-dir=${fullPath(config, 'extensionDir')}`, `--user-data-dir=${fullPath(config, 'userDataDir')}`];
    }
}

/**
 * Creates {@link VSCodeIntegrationOptions} for use as the `integrationOptions` test option.
 *
 * The returned options carry the factory that the `integration` fixture uses to instantiate
 * the {@link VSCodeIntegration}, which is how this integration plugs in without the core
 * framework having to import it.
 *
 * @param config VS Code specific configuration
 * @returns Options carrying the factory for the {@link VSCodeIntegration}
 */
export function defineVSCodeIntegration(config: VSCodeIntegrationConfig): VSCodeIntegrationOptions {
    return {
        ...config,
        type: 'VSCode',
        integrationFactory: (args, options) => new VSCodeIntegration(args, options)
    };
}
