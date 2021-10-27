/********************************************************************************
 * Copyright (c) 2020-2021 EclipseSource and others.
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
import {
    configureServerActions,
    DiagramServer,
    ExportSvgAction,
    NavigateToExternalTargetAction,
    RequestClipboardDataAction,
    SelectAction,
    SetClipboardDataAction,
    TYPES
} from '@eclipse-glsp/client';
import { Container } from 'inversify';
import {
    SprottyDiagramIdentifier,
    SprottyStarter,
    VscodeDiagramServer,
    VscodeDiagramWidget,
    VscodeDiagramWidgetFactory
} from 'sprotty-vscode-webview';
import { GLSPDiagramIdentifier, isDiagramIdentifier } from './diagram-identifer';
import { GLSPVscodeExtensionActionHandler } from './extension-action-handler';
import { GLSPVscodeDiagramWidget } from './glsp-vscode-diagram-widget';
import { GLSPVscodeDiagramServer } from './glsp-vscode-diagramserver';

export abstract class GLSPStarter extends SprottyStarter {
    protected acceptDiagramIdentifier(): void {
        console.log('Waiting for diagram identifier...');
        const eventListener = (message: any): void => {
            if (isDiagramIdentifier(message.data)) {
                console.log(message);
                if (this.container) {
                    const oldIdentifier = this.container.get<GLSPDiagramIdentifier>(GLSPDiagramIdentifier);
                    const newIdentifier = message.data as GLSPDiagramIdentifier;
                    oldIdentifier.diagramType = newIdentifier.diagramType;
                    oldIdentifier.uri = newIdentifier.uri;
                    const diagramWidget = this.container.get(VscodeDiagramWidget);
                    diagramWidget.requestModel();
                } else {
                    console.log('...received...', message);
                    const diagramIdentifier = message.data as GLSPDiagramIdentifier;
                    this.container = this.createContainer(diagramIdentifier);
                    this.addVscodeBindings(this.container, diagramIdentifier);
                    if (diagramIdentifier.initializeResult) {
                        configureServerActions(diagramIdentifier.initializeResult, diagramIdentifier.diagramType, this.container);
                    }
                    this.container.get(VscodeDiagramWidget);
                }
            }
        };
        window.addEventListener('message', eventListener);
    }

    protected addVscodeBindings(container: Container, diagramIdentifier: GLSPDiagramIdentifier): void {
        container.bind(GLSPVscodeDiagramWidget).toSelf().inSingletonScope();
        container.bind(VscodeDiagramWidget).toService(GLSPVscodeDiagramWidget);
        container
            .bind(VscodeDiagramWidgetFactory)
            .toFactory(context => () => context.container.get<GLSPVscodeDiagramWidget>(GLSPVscodeDiagramWidget));
        container.bind(GLSPDiagramIdentifier).toConstantValue(diagramIdentifier);
        container.bind(SprottyDiagramIdentifier).toConstantValue(diagramIdentifier);
        container.bind(GLSPVscodeDiagramServer).toSelf().inSingletonScope();
        container.bind(VscodeDiagramServer).toService(GLSPVscodeDiagramServer);
        container.bind(TYPES.ModelSource).toService(GLSPVscodeDiagramServer);
        container.bind(DiagramServer).toService(GLSPVscodeDiagramServer);

        this.configureExtensionActionHandler(container, diagramIdentifier);
    }

    protected configureExtensionActionHandler(container: Container, diagramIdentifier: SprottyDiagramIdentifier): void {
        const extensionActionHandler = new GLSPVscodeExtensionActionHandler(this.extensionActionKinds, diagramIdentifier);
        container.bind(GLSPVscodeExtensionActionHandler).toConstantValue(extensionActionHandler);
        container.bind(TYPES.IActionHandlerInitializer).toService(GLSPVscodeExtensionActionHandler);
    }

    /**
     *  All kinds of actions that should (also) be delegated to and handled by the vscode extension
     */
    protected get extensionActionKinds(): string[] {
        return [
            NavigateToExternalTargetAction.KIND,
            RequestClipboardDataAction.KIND,
            SetClipboardDataAction.KIND,
            SelectAction.KIND,
            ExportSvgAction.KIND
        ];
    }
}
