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
import shared from '@eclipse-glsp/oxfmt-config' with { type: 'json' };
import { defineConfig, type OxfmtConfig } from 'oxfmt';

export default defineConfig({
    // JSON imports widen string literals (e.g. `arrowParens: string`), so the shared options are cast to the config type.
    ...(shared as OxfmtConfig),
    // Repository-specific ignores. Version control ignores (`.gitignore`) are honoured automatically and
    // `node_modules` is skipped by default, so only generated and vendored content is listed here.
    ignorePatterns: [
        // Build outputs
        'lib/',
        'dist/',
        'coverage/',
        // Generated files
        '*.min.js',
        '*.min.css',
        // Lock files
        'package-lock.json',
        'pnpm-lock.yaml',
        // E2E run artifacts, including the downloaded VS Code installation
        '**/.vscode-test/',
        'playwright-report/',
        'test-results/',
        // Logs
        '*.log',
        'logs/',
        // Agent-specific files
        '.claude/',
        '.reviews/',
        '.worktrees/'
    ]
});
