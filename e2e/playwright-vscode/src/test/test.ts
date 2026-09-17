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
import { test as base } from '@eclipse-glsp/playwright';
import { VSCodeIntegrationOptions } from '../integration/vscode.options';
import { VSCodeSetup, VSCodeSetupOptions } from '../integration/vscode.setup';

/**
 * VS Code specific options
 */
export interface VSCodePlaywrightOptions {
    /**
     * Options handed to the {@link VSCodeSetup} created by the `vscodeSetup` fixture.
     */
    vscodeSetupOptions?: VSCodeSetupOptions;
}

/**
 * VS Code specific fixtures
 */
export interface VSCodePlaywrightFixtures {
    /**
     * Prepares the VS Code environment: downloads VS Code and installs the extension
     * under test.
     *
     * Requires `integrationOptions` created with `defineVSCodeIntegration()`.
     */
    vscodeSetup: VSCodeSetup;
}

/**
 * The `test` object of the VS Code integration.
 *
 * It extends the core `test` with the `vscodeSetup` fixture. Tests that are not specific to
 * VS Code should keep importing `test` from the package root, so that they stay runnable under
 * every integration.
 *
 */
export const test = base.extend<VSCodePlaywrightOptions & VSCodePlaywrightFixtures>({
    vscodeSetupOptions: [{ enableLogging: true }, { option: true }],

    vscodeSetup: ({ integrationOptions, vscodeSetupOptions }, use) => {
        // Fixtures are lazy, so this only rejects tests that actually ask for `vscodeSetup`.
        VSCodeIntegrationOptions.assert(integrationOptions);
        return use(new VSCodeSetup(integrationOptions, vscodeSetupOptions));
    }
});

export { expect } from '@eclipse-glsp/playwright';
export { test as setup };
