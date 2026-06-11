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

async function main() {
    // Start from a clean dist to avoid shipping stale artifacts (e.g. sourcemaps from a previous dev build).
    fs.rmSync(distDir, { recursive: true, force: true });

    const ctx = await esbuild.context({
        entryPoints: [path.resolve(__dirname, 'src/index.ts')],
        bundle: true,
        format: 'iife',
        platform: 'browser',
        outfile: path.join(distDir, 'webview.js'),
        loader: {
            '.ttf': 'file',
            '.woff': 'file',
            '.woff2': 'file',
            '.eot': 'file',
            '.svg': 'file',
            '.png': 'file'
        },
        minify: production,
        sourcemap: production ? false : 'inline',
        sourcesContent: !production,
        logLevel: 'silent',
        plugins: [esbuildProblemMatcherPlugin]
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
