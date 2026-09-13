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
import type { Locator, Page } from '@playwright/test';

/**
 * Page Object for the extensions view
 * in the [Workbench](https://code.visualstudio.com/api/extension-capabilities/extending-workbench).
 */
export class VSCodeWorkbenchViewExtensions {
    readonly locator;

    constructor(
        protected readonly page: Page,
        protected readonly selector = '[id="workbench.view.extensions"]'
    ) {
        this.locator = this.page.locator(this.selector);
    }

    extension(vsixId: string): Locator {
        return this.locator.locator(`[data-extension-id="${vsixId}"]`);
    }

    async waitForStart(vsixId: string): Promise<void> {
        const extension = this.extension(vsixId);

        await extension.waitFor({
            state: 'visible'
        });
    }
}
