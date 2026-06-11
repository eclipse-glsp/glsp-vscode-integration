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
// @ts-check
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const nodeModules = path.resolve(__dirname, '../../../node_modules');
const distDir = path.resolve(__dirname, 'dist');

/**
 * Reports the build progress and surfaces errors/warnings in a format that
 * VS Code's `$esbuild-watch` problem matcher can pick up.
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log(`${watch ? '[watch] ' : ''}build started`);
        });
        build.onEnd(result => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                if (location) {
                    console.error(`    ${location.file}:${location.line}:${location.column}:`);
                }
            });
            console.log(`${watch ? '[watch] ' : ''}build finished`);
        });
    }
};

/**
 * Copies static assets (the bundled GLSP server and the webview bundle) into the
 * extension's `dist` folder after each (re)build. Replaces `copy-webpack-plugin`.
 * @type {import('esbuild').Plugin}
 */
const copyAssetsPlugin = {
    name: 'copy-assets',
    setup(build) {
        build.onEnd(() => {
            fs.mkdirSync(distDir, { recursive: true });
            fs.copyFileSync(
                path.resolve(nodeModules, '@eclipse-glsp-examples/workflow-server-bundled/wf-glsp-server-node.js'),
                path.join(distDir, 'wf-glsp-server-node.js')
            );
            fs.cpSync(path.resolve(__dirname, '..', 'webview', 'dist'), distDir, { recursive: true });
        });
    }
};

async function main() {
    // Start from a clean dist to avoid shipping stale artifacts (e.g. sourcemaps from a previous dev build).
    fs.rmSync(distDir, { recursive: true, force: true });

    const ctx = await esbuild.context({
        entryPoints: [path.resolve(__dirname, 'src/workflow-extension.ts')],
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'node22',
        outfile: path.join(distDir, 'workflow-extension.js'),
        external: ['vscode', 'bufferutil', 'utf-8-validate'],
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        logLevel: 'silent',
        plugins: [copyAssetsPlugin, esbuildProblemMatcherPlugin]
    });
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
