/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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

import { ModuleConfiguration } from '@eclipse-glsp/client';
import { vscodeCopyPasteModule } from './features/copyPaste/copy-paste-module';
import { vscodeDefaultModule } from './features/default/default-module';
import { vscodeExportModule } from './features/export/export-module';
import { vscodeNavigationModule } from './features/navigation/navigation-module';

export const VSCODE_DEFAULT_MODULES = [vscodeDefaultModule, vscodeCopyPasteModule, vscodeExportModule, vscodeNavigationModule] as const;

export const VSCODE_DEFAULT_MODULE_CONFIG: ModuleConfiguration = {
    add: [...VSCODE_DEFAULT_MODULES]
};
