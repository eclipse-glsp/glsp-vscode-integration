/********************************************************************************
 * Copyright (c) 2018 TypeFox and others.
 * Modifications: (c) 2020-2023 EclipseSource and others.
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
// based on https://github.com/eclipse-sprotty/sprotty-vscode/blob/v0.3.0/sprotty-vscode-webview/src/sprotty-starter.ts
import {
    configureServerActions,
    DiagramServerProxy,
    ExportSvgAction,
    ICopyPasteHandler,
    NavigateToExternalTargetAction,
    RequestClipboardDataAction,
    SelectAction,
    SetClipboardDataAction,
    TYPES
} from '@eclipse-glsp/client';
import { Container } from 'inversify';
import { CopyPasteHandlerProvider } from './copy-paste-handler-provider';
import { GLSPDiagramIdentifier, isDiagramIdentifier, WebviewReadyMessage } from './diagram-identifier';
import { GLSPVscodeExtensionActionHandler } from './extension-action-handler';
import { GLSPDiagramWidget, GLSPDiagramWidgetFactory } from './glsp-diagram-widget';
import { GLSPVscodeDiagramServer } from './glsp-vscode-diagramserver';
import { GLSPStarterServices, VsCodeApi } from './services';

declare function acquireVsCodeApi(): VsCodeApi;

export abstract class GLSPStarter {
    protected container?: Container;
    protected vscodeApi: VsCodeApi;

    constructor(services: GLSPStarterServices = {}) {
        this.vscodeApi = services.vscodeApi ?? acquireVsCodeApi();
        this.sendReadyMessage();
        this.acceptDiagramIdentifier();
    }

    protected sendReadyMessage(): void {
        this.vscodeApi.postMessage({ readyMessage: 'Sprotty Webview ready' } as WebviewReadyMessage);
    }
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
                    const diagramWidget = this.container.get(GLSPDiagramWidget);
                    diagramWidget.dispatchInitialActions();
                } else {
                    console.log('...received...', message);
                    const diagramIdentifier = message.data as GLSPDiagramIdentifier;
                    this.container = this.createContainer(diagramIdentifier);
                    this.addVscodeBindings(this.container, diagramIdentifier);
                    if (diagramIdentifier.initializeResult) {
                        configureServerActions(diagramIdentifier.initializeResult, diagramIdentifier.diagramType, this.container);
                    }
                    this.container.get(GLSPDiagramWidget);
                }
            }
        };
        window.addEventListener('message', eventListener);
    }

    protected abstract createContainer(diagramIdentifier: GLSPDiagramIdentifier): Container;

    protected addVscodeBindings(container: Container, diagramIdentifier: GLSPDiagramIdentifier): void {
        container.bind(VsCodeApi).toConstantValue(this.vscodeApi);
        container.bind(GLSPDiagramWidget).toSelf().inSingletonScope();
        container.bind(GLSPDiagramWidgetFactory).toFactory(context => () => context.container.get<GLSPDiagramWidget>(GLSPDiagramWidget));
        container.bind(GLSPDiagramIdentifier).toConstantValue(diagramIdentifier);
        container
            .bind(CopyPasteHandlerProvider)
            .toProvider(
                ctx => () =>
                    new Promise<ICopyPasteHandler>(resolve => resolve(ctx.container.get<ICopyPasteHandler>(TYPES.ICopyPasteHandler)))
            );
        container.bind(GLSPVscodeDiagramServer).toSelf().inSingletonScope();
        container.bind(TYPES.ModelSource).toService(GLSPVscodeDiagramServer);
        container.bind(DiagramServerProxy).toService(GLSPVscodeDiagramServer);

        this.configureExtensionActionHandler(container, diagramIdentifier);
    }

    protected configureExtensionActionHandler(container: Container, diagramIdentifier: GLSPDiagramIdentifier): void {
        const extensionActionHandler = new GLSPVscodeExtensionActionHandler(this.extensionActionKinds, diagramIdentifier, this.vscodeApi);
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
