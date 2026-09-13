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
import type { GLSPPlaywrightOptions } from '@eclipse-glsp/playwright';
import { defineVSCodeIntegration, VSCodeIntegrationOptions } from '@eclipse-glsp/playwright-vscode';
import { PlaywrightTestOptions, PlaywrightWorkerOptions, Project } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/** Name of a test project, i.e. one packaged variant of the Workflow example extension. */
export type ProjectName = 'vscode' | 'vscode-web';

interface Variant {
    /** Directory of the extension package, relative to the repository root. */
    extensionDir: string;
    /** Extension identifier, i.e. `<publisher>.<name>` lowercased, as VS Code reports it. */
    vsixId: string;
    /** `package` script of the extension, for the error message when the VSIX is missing. */
    packageScript: string;
}

const VARIANTS: Record<ProjectName, Variant> = {
    vscode: {
        extensionDir: 'example/workflow/extension',
        vsixId: 'eclipse-glsp.workflow-vscode-example',
        packageScript: 'pnpm workflow package'
    },
    'vscode-web': {
        extensionDir: 'example/workflow/web-extension',
        vsixId: 'eclipse-glsp.workflow-vscode-example-web',
        packageScript: 'pnpm workflow:web package'
    }
};

/** Whether Playwright is discovering tests without executing them. */
function isPlaywrightTestListing(): boolean {
    return process.argv.includes('--list');
}

/**
 * The VSIX of a variant, packaged by its own `package` script into the extension directory.
 *
 * Resolved from this repository rather than through the GLSP CLI: the extensions under test are
 * built here, so their output location is known.
 */
function findVsixPath(configDir: string, variant: Variant): string {
    const vsixDir = path.resolve(configDir, '..', '..', variant.extensionDir);
    const candidates = fs
        .readdirSync(vsixDir)
        .filter(file => file.endsWith('.vsix'))
        .map(file => path.join(vsixDir, file));

    if (candidates.length === 0) {
        throw new Error(`No .vsix file found in ${vsixDir}. Run \`${variant.packageScript}\` first.`);
    }
    return candidates.reduce((newest, file) => (fs.statSync(file).mtimeMs > fs.statSync(newest).mtimeMs ? file : newest));
}

function buildIntegrationOptions(configDir: string, project: ProjectName): VSCodeIntegrationOptions {
    const variant = VARIANTS[project];

    return defineVSCodeIntegration({
        workspace: '../../example/workflow/workspace',
        file: 'example1.wf',
        vsixId: variant.vsixId,
        // Discovery must not require a packaged extension. The setup project consumes this path
        // only when tests actually execute.
        vsixPath: isPlaywrightTestListing() ? '' : findVsixPath(configDir, variant),
        // Both variants contribute the same custom editor, so they cannot share an extensions
        // directory: whichever VS Code picked would decide what the tests actually exercise.
        extensionsDir: path.join(configDir, '.vscode-test', project, 'extensions'),
        storagePath: path.join(configDir, 'playwright/.storage', `${project}.setup.json`)
    });
}

/**
 * The VS Code projects, one `<name>-setup` plus one `<name>` pair per variant.
 *
 * Takes the project list as a parameter so that a further variant is a new entry rather than a
 * restructuring of this function.
 *
 * @param configDir Directory of the calling `playwright.config.ts`, i.e. `__dirname`
 * @param activeProjects Variants the run was started for
 */
export function buildProjects(
    configDir: string,
    activeProjects: ProjectName[] = ['vscode', 'vscode-web']
): Project<PlaywrightTestOptions & GLSPPlaywrightOptions, PlaywrightWorkerOptions>[] {
    return activeProjects.flatMap(project => {
        const integrationOptions = buildIntegrationOptions(configDir, project);
        const setupName = `${project}-setup`;

        return [
            // Downloads VS Code and installs the extension under test. The test project depends on
            // it, so it always runs first; the two form one unit.
            {
                name: setupName,
                timeout: 5 * 60 * 1000,
                testDir: 'lib/tests',
                testMatch: ['setup/vscode.setup.js'],
                use: { integrationOptions }
            },
            {
                name: project,
                timeout: 60 * 1000,
                testDir: 'lib/tests',
                testMatch: ['**/*.spec.js'],
                dependencies: [setupName],
                use: { integrationOptions }
            }
        ];
    });
}

/**
 * Projects requested on the command line, or every variant when none was given.
 *
 * A `--project` naming a test project implies its setup project, which Playwright pulls in through
 * the declared dependency.
 */
export function getActiveProjects(): ProjectName[] {
    const all = Object.keys(VARIANTS) as ProjectName[];
    const requested = parseRequestedProjects().filter((name): name is ProjectName => all.includes(name as ProjectName));
    return requested.length > 0 ? [...new Set(requested)] : all;
}

function parseRequestedProjects(): string[] {
    const args = process.argv;
    const projects: string[] = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--project' && i + 1 < args.length) {
            projects.push(args[i + 1]);
        } else if (args[i].startsWith('--project=')) {
            projects.push(args[i].slice('--project='.length));
        }
    }
    // A requested setup project keeps its own variant active.
    return projects.map(name => name.replace(/-setup$/, ''));
}
