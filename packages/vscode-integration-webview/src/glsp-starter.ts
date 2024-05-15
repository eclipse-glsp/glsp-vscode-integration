/********************************************************************************
 * Copyright (c) 2018-2024 TypeFox and others.
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
import { ContainerConfiguration, createDiagramOptionsModule } from '@eclipse-glsp/client';
import { Container, ContainerModule } from 'inversify';
import { HOST_EXTENSION, NotificationType } from 'vscode-messenger-common';
import { Messenger, VsCodeApi } from 'vscode-messenger-webview';
import { VSCODE_DEFAULT_MODULE_CONFIG } from './default-modules';
import { GLSPDiagramIdentifier } from './diagram-identifier';
import { GLSPDiagramWidget } from './glsp-diagram-widget';
import { WebviewGlspClient } from './webview-glsp-client';
export const WebviewReadyNotification: NotificationType<void> = { method: 'ready' };
export const InitializeNotification: NotificationType<GLSPDiagramIdentifier> = { method: 'initialize' };

declare function acquireVsCodeApi(): VsCodeApi;

export abstract class GLSPStarter {
    protected container?: Container;
    protected messenger: Messenger;

    constructor() {
        this.messenger = new Messenger(acquireVsCodeApi());
        this.messenger.onNotification<GLSPDiagramIdentifier>(InitializeNotification, identifier =>
            this.acceptDiagramIdentifier(identifier)
        );
        this.messenger.start();
        this.sendReadyMessage();
    }

    protected sendReadyMessage(): void {
        this.messenger.sendNotification(WebviewReadyNotification, HOST_EXTENSION);
    }

    protected acceptDiagramIdentifier(identifier: GLSPDiagramIdentifier): void {
        if (this.container) {
            const oldIdentifier = this.container.get<GLSPDiagramIdentifier>(GLSPDiagramIdentifier);
            oldIdentifier.diagramType = identifier.diagramType;
            oldIdentifier.uri = identifier.uri;
            const diagramWidget = this.container.get(GLSPDiagramWidget);
            diagramWidget.loadDiagram();
        } else {
            const diagramModule = this.createDiagramOptionsModule(identifier);
            this.container = this.createContainer(diagramModule, ...this.getContainerConfiguration());
            this.addVscodeBindings?.(this.container, identifier);
            this.container.get(GLSPDiagramWidget);
        }
    }

    protected createDiagramOptionsModule(identifier: GLSPDiagramIdentifier): ContainerModule {
        const glspClient = new WebviewGlspClient({ id: identifier.diagramType, messenger: this.messenger });
        return createDiagramOptionsModule({
            clientId: identifier.clientId,
            diagramType: identifier.diagramType,
            glspClientProvider: async () => glspClient,
            sourceUri: decodeURIComponent(identifier.uri)
        });
    }

    /**
     * Retrieves additional {@link ContainerConfiguration} for the diagram container.
     * Typically this composes a set of vscode specific customization modules.
     * @returns the container configuration
     */
    protected getContainerConfiguration(): ContainerConfiguration {
        return [VSCODE_DEFAULT_MODULE_CONFIG];
    }

    protected abstract createContainer(...containerConfiguration: ContainerConfiguration): Container;

    /**
     * Optional hook that can be implemented to customize diagram container bindings before it's used
     * to instantiate the diagram services
     * @param container The diagram container
     * @param diagramIdentifier The diagram identfier
     */
    protected addVscodeBindings?(container: Container, diagramIdentifier: GLSPDiagramIdentifier): void;
}

export function decodeURI(uri: string): string {
    return decodeURIComponent(uri.replace(/\+/g, ' '));
}
