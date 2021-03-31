/********************************************************************************
 * Copyright (c) 2021 EclipseSource and others.
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
import { GlspDiagramEditorContext } from '@eclipse-glsp/vscode-integration';
import { join, resolve } from 'path';
import * as vscode from 'vscode';

import { WorkflowGlspDiagramEditorContext } from './workflow-glsp-diagram-editor-context';

export const SERVER_DIR = join(__dirname, '..', 'server');
export const JAR_FILE = resolve(join(SERVER_DIR, 'org.eclipse.glsp.example.workflow-0.9.0-SNAPSHOT-glsp.jar'));

let editorContext: GlspDiagramEditorContext;

export function activate(context: vscode.ExtensionContext): void {
    editorContext = new WorkflowGlspDiagramEditorContext(context);
}

export function deactivate(): Thenable<void> {
    if (!editorContext) {
        return Promise.resolve(undefined);
    }
    return editorContext.deactiveGLSPCLient();
}

