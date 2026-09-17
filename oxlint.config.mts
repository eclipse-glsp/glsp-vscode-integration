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
import glspConfig from '@eclipse-glsp/oxlint-config';
import { defineConfig } from 'oxlint';

// Relative index and src imports restricted by the shared @eclipse-glsp/oxlint-config.
// Must be included in every `no-restricted-imports` override since an override replaces the entire rule value.
const restrictedBaseImports = ['..', '../index', '../..', '../../index', 'src'];

/**
 * Import specifiers that resolve to the importing module's own directory barrel or to one of its
 * parent barrels, up to `depth` levels: `'.'`, `'..'`, `'../..'`, ...
 */
function ownAndParentBarrels(depth: number): string[] {
    return [
        '.',
        ...Array.from({ length: depth }, (_, level) =>
            Array(level + 1)
                .fill('..')
                .join('/')
        )
    ];
}

export default defineConfig({
    extends: [glspConfig],
    options: {
        // `typeAware` enables the type-aware rules of the shared config and the `no-floating-promises`
        // check of the e2e packages via `oxlint-tsgolint`. `typeCheck` additionally reports the
        // TypeScript compiler diagnostics of the same program, so `pnpm lint` is a complete static
        // check without a prior build.
        typeAware: true,
        typeCheck: true
    },
    // Ignore JS/MJS/CJS config/build files, generated output, the e2e run artifacts and local git
    // worktrees. `.vscode-test` holds a full VS Code installation, including bundled extensions that
    // ship lint configs of their own.
    ignorePatterns: [
        '**/{node_modules,lib,dist}',
        '**/*.d.ts',
        '**/*.map',
        '**/*.js',
        '**/*.mjs',
        '**/*.cjs',
        '.worktrees/',
        '**/.vscode-test/',
        'playwright-report/',
        'test-results/'
    ],
    overrides: [
        /* ----------------------------------------------------------------------------------------
         * Client packages and examples
         * ---------------------------------------------------------------------------------------- */
        // The sprotty defaults are customized and re-exported by GLSP.
        {
            files: ['packages/**/*.{ts,tsx}', 'example/**/*.{ts,tsx}'],
            rules: {
                'no-restricted-imports': [
                    'warn',
                    ...restrictedBaseImports,
                    {
                        name: 'sprotty',
                        message:
                            "The sprotty default exports are customized and reexported by GLSP. Please use '@eclipse-glsp/client' instead"
                    },
                    {
                        name: 'sprotty-protocol',
                        message:
                            "The sprotty-protocol default exports are customized and reexported by GLSP. Please use '@eclipse-glsp/protocol' or '@eclipse-glsp/client' instead"
                    }
                ]
            }
        },

        /* ----------------------------------------------------------------------------------------
         * E2E packages
         * ---------------------------------------------------------------------------------------- */
        {
            files: ['e2e/**/*.{ts,tsx}'],
            rules: {
                // A dangling promise in a page object silently drops the Playwright action it wraps.
                'typescript/no-floating-promises': 'error',
                'no-restricted-imports': [
                    'error',
                    {
                        paths: [
                            // `'.'`, `'..'`, `'../..'`, ... resolve to an own or parent barrel, which
                            // re-exports the importing module itself. Type-only is fine, because the
                            // import erases; a value import closes a runtime cycle and yields a
                            // partially initialized module.
                            //
                            // Listed as exact paths rather than a pattern, because
                            // `no-restricted-imports` matches patterns gitignore-style and `'..'` would
                            // then match every relative import. Generated well past the deepest source
                            // directory so that adding a nesting level cannot silently uncover a barrel.
                            ...ownAndParentBarrels(10).map(name => ({
                                name,
                                allowTypeImports: true,
                                message:
                                    'Importing an own or parent barrel closes a runtime import cycle. Import the defining ' +
                                    'module directly, or keep the import type-only with `import type`.'
                            })),
                            { name: 'src' }
                        ],
                        patterns: [
                            { group: ['**/../index'] },
                            {
                                group: [
                                    // Matches the core package and the integration packages built on it.
                                    '@eclipse-glsp/playwright*/src/**',
                                    '@eclipse-glsp/playwright*/lib/**',
                                    '@eclipse-glsp-examples/workflow-e2e*/src/**',
                                    '@eclipse-glsp-examples/workflow-e2e*/lib/**'
                                ],
                                message:
                                    'Import from the package root instead. Deep imports are resolved by the Playwright require hook ' +
                                    'and load a second copy of the module graph. If a symbol is unreachable, export it from the barrel.'
                            }
                        ]
                    }
                ]
            }
        },

        /* ----------------------------------------------------------------------------------------
         * Framework packages
         * ---------------------------------------------------------------------------------------- */
        // `typescript/no-deprecated` is checker-exact and also reports the in-package uses of members
        // that are intentionally kept for backwards compatibility. Keep it on for consumers of the
        // packages (examples, e2e), and off inside the packages that define them.
        {
            files: ['packages/**/*.{ts,tsx}'],
            rules: {
                'typescript/no-deprecated': 'off'
            }
        }
    ]
});
