/********************************************************************************
 * Copyright (c) 2025 EclipseSource and others.
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
import { Args, DiagramLoadingOptions } from '@eclipse-glsp/client';
import { GLSPDiagramIdentifier, GLSPDiagramWidget } from '@eclipse-glsp/vscode-integration-webview';
import { inject, injectable } from 'inversify';
import { WorkflowDiagramIdentifier } from './app';
@injectable()
export class WorkflowDiagramWidget extends GLSPDiagramWidget {
    @inject(GLSPDiagramIdentifier)
    protected diagramIdentifier: WorkflowDiagramIdentifier;

    protected override createDiagramLoadingOptions(): DiagramLoadingOptions | undefined {
        const requestModelOptions: Args = {};
        if (this.diagramIdentifier.diff) {
            requestModelOptions.diffId = this.diagramIdentifier.diff.id;
            requestModelOptions.diffSide = this.diagramIdentifier.diff.side;
            requestModelOptions.diffContent = this.diagramIdentifier.diff.content;
        }
        return {
            requestModelOptions
        };
    }
}
