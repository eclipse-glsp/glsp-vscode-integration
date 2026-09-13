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
import type { BaseIntegrationOptions, IntegrationFactory, IntegrationOptions } from '@eclipse-glsp/playwright';

export interface VSCodeIntegrationOptions extends BaseIntegrationOptions {
    type: 'VSCode';
    /**
     * Required, so that a hand-written options literal is a compile error.
     * Use {@link defineVSCodeIntegration} to create the options.
     */
    integrationFactory: IntegrationFactory<VSCodeIntegrationOptions>;
    workspace: string;
    vsixId: string;
    vsixPath: string;
    storagePath: string;
    file?: string;
    /**
     * Directory the extension under test is installed into, and that the launched VS Code instance
     * reads its extensions from. Defaults to the directory VS Code resolves from the downloaded
     * executable, which is shared by every run.
     *
     * Set this when more than one variant of the same extension is under test: two extensions that
     * contribute the same custom editor cannot be installed side by side, so each variant needs a
     * directory of its own.
     */
    extensionsDir?: string;
}

/**
 * The hand-written part of {@link VSCodeIntegrationOptions}, i.e. everything except the
 * discriminator and the factory that {@link defineVSCodeIntegration} fills in.
 */
export type VSCodeIntegrationConfig = Omit<VSCodeIntegrationOptions, 'type' | 'integrationFactory'>;

declare global {
    namespace GLSPPlaywright {
        interface IntegrationOptionsMap {
            VSCode: VSCodeIntegrationOptions;
        }
    }
}

export namespace VSCodeIntegrationOptions {
    export function is(options?: IntegrationOptions): options is VSCodeIntegrationOptions {
        return options?.type === 'VSCode';
    }

    /**
     * Asserts that the given options belong to the VS Code integration.
     *
     * @throws If the options are missing or belong to another integration
     */
    export function assert(options?: IntegrationOptions): asserts options is VSCodeIntegrationOptions {
        if (!is(options)) {
            throw new Error(`Expected VS Code integration options but got type "${options?.type ?? 'undefined'}".`);
        }
    }
}
