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
import type { Page } from '@playwright/test';
import { VSCodeWorkbenchViewExplorer } from './workbench-view-explorer.po';
import { VSCodeWorkbenchViewExtensions } from './workbench-view-extensions.po';

/**
 * Page Object for the [Workbench](https://code.visualstudio.com/api/extension-capabilities/extending-workbench).
 */
export class VSCodeWorkbenchActivitybar {
    readonly locator;
    readonly extensionsItemLocator;
    readonly explorerItemLocator;

    constructor(
        protected readonly page: Page,
        protected readonly selector = '[id="workbench.parts.activitybar"]'
    ) {
        this.locator = this.page.locator(this.selector);
        this.explorerItemLocator = this.locator.locator('.codicon-explorer-view-icon');
        this.extensionsItemLocator = this.locator.locator('.codicon-extensions-view-icon');
    }

    async openExplorer(): Promise<VSCodeWorkbenchViewExplorer> {
        const view = new VSCodeWorkbenchViewExplorer(this.page);

        if (await view.locator.isHidden()) {
            await this.explorerItemLocator.click();
        }

        return view;
    }

    async openExtensions(): Promise<VSCodeWorkbenchViewExtensions> {
        const view = new VSCodeWorkbenchViewExtensions(this.page);

        if (await view.locator.isHidden()) {
            await this.extensionsItemLocator.click();
        }

        return view;
    }
}
