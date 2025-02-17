/********************************************************************************
 * Copyright (c) 2020-2024 EclipseSource and others.
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
import { createWorkflowDiagramContainer } from '@eclipse-glsp-examples/workflow-glsp';
import { ContainerConfiguration, createDiagramOptionsModule, EditMode } from '@eclipse-glsp/client';
import { GLSPDiagramIdentifier, GLSPDiagramWidget, GLSPStarter, WebviewGlspClient } from '@eclipse-glsp/vscode-integration-webview';
import '@eclipse-glsp/vscode-integration-webview/css/glsp-vscode.css';
import '@vscode/codicons/dist/codicon.css';
import { Container, ContainerModule } from 'inversify';
import { compareModule } from './features/compare/compare-module';
import { WorkflowDiagramWidget } from './workflow-diagram-widget';

export interface WorkflowDiagramIdentifier extends GLSPDiagramIdentifier {
    diff?: {
        id: string;
        side: 'left' | 'right';
        content: string;
    };
}

class WorkflowGLSPStarter extends GLSPStarter {
    createContainer(...containerConfiguration: ContainerConfiguration): Container {
        return createWorkflowDiagramContainer(...containerConfiguration, compareModule);
    }

    protected override createDiagramOptionsModule(identifier: WorkflowDiagramIdentifier): ContainerModule {
        const glspClient = new WebviewGlspClient({ id: identifier.diagramType, messenger: this.messenger });
        return createDiagramOptionsModule({
            clientId: identifier.clientId,
            diagramType: identifier.diagramType,
            glspClientProvider: async () => glspClient,
            sourceUri: decodeURIComponent(identifier.uri),
            editMode: identifier.diff ? EditMode.READONLY : EditMode.EDITABLE
        });
    }

    protected override addVscodeBindings(container: Container, diagramIdentifier: GLSPDiagramIdentifier): void {
        container.bind(GLSPDiagramIdentifier).toConstantValue(diagramIdentifier);
        container.rebind(GLSPDiagramWidget).to(WorkflowDiagramWidget).inSingletonScope();
    }
}

export function launch(): void {
    new WorkflowGLSPStarter();
}
