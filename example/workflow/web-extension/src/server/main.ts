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
import 'reflect-metadata';

import { WorkflowDiagramModule, WorkflowServerModule } from '@eclipse-glsp-examples/workflow-server/browser';
import { LogLevel, createAppModule } from '@eclipse-glsp/server/browser';
import { ContainerModule } from 'inversify';
import { GModelVSCodeStorage } from './gmodel-vscode-model-storage';

export function createServerModules(): ContainerModule[] {
    const appModule = createAppModule({ logLevel: LogLevel.info, consoleLog: true });
    const mainModule = new WorkflowServerModule().configureDiagramModule(new WorkflowDiagramModule(() => GModelVSCodeStorage));
    return [appModule, mainModule];
}
