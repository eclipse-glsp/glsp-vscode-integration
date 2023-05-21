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
// based on https://github.com/eclipse-sprotty/sprotty-vscode/blob/v0.3.0/sprotty-vscode-webview/src/vscode-diagram-widget.ts
import {
    DiagramServerProxy,
    EnableToolPaletteAction,
    IActionDispatcher,
    ModelSource,
    RequestModelAction,
    RequestTypeHintsAction,
    ServerStatusAction,
    TYPES,
    ViewerOptions
} from '@eclipse-glsp/client';
import { inject, injectable, postConstruct } from 'inversify';
import { GLSPDiagramIdentifier } from './diagram-identifier';

export const GLSPDiagramWidgetFactory = Symbol('GLSPDiagramWidgetFactory');
export type GLSPDiagramWidgetFactory = () => GLSPDiagramWidget;

@injectable()
export abstract class GLSPDiagramWidget {
    @inject(GLSPDiagramIdentifier)
    protected diagramIdentifier: GLSPDiagramIdentifier;
    @inject(TYPES.IActionDispatcher)
    readonly actionDispatcher: IActionDispatcher;
    @inject(TYPES.ModelSource)
    readonly modelSource: ModelSource;
    @inject(TYPES.ViewerOptions)
    protected viewerOptions: ViewerOptions;

    protected statusIconDiv: HTMLDivElement;
    protected statusMessageDiv: HTMLDivElement;

    @postConstruct()
    initialize(): void {
        this.initializeHtml();
        this.dispatchInitialActions();
    }

    protected initializeHtml(): void {
        const containerDiv = document.getElementById(this.diagramIdentifier.clientId + '_container');
        if (containerDiv) {
            const svgContainer = document.createElement('div');
            svgContainer.id = this.viewerOptions.baseDiv;
            containerDiv.appendChild(svgContainer);

            const hiddenContainer = document.createElement('div');
            hiddenContainer.id = this.viewerOptions.hiddenDiv;
            document.body.appendChild(hiddenContainer);

            const statusDiv = document.createElement('div');
            statusDiv.setAttribute('class', 'sprotty-status');
            containerDiv.appendChild(statusDiv);

            this.statusIconDiv = document.createElement('div');
            statusDiv.appendChild(this.statusIconDiv);

            this.statusMessageDiv = document.createElement('div');
            this.statusMessageDiv.setAttribute('class', 'sprotty-status-message');
            statusDiv.appendChild(this.statusMessageDiv);
        }
    }

    dispatchInitialActions(): void {
        if (this.modelSource instanceof DiagramServerProxy) {
            this.modelSource.clientId = this.diagramIdentifier.clientId;
        }
        this.actionDispatcher.dispatch(
            RequestModelAction.create({
                options: {
                    sourceUri: decodeURI(this.diagramIdentifier.uri),
                    diagramType: this.diagramIdentifier.diagramType
                }
            })
        );

        this.actionDispatcher.dispatch(RequestTypeHintsAction.create());
        this.actionDispatcher.dispatch(EnableToolPaletteAction.create());
    }

    setStatus(status: ServerStatusAction): void {
        this.statusMessageDiv.textContent = status.message;
        this.removeClasses(this.statusMessageDiv, 1);
        this.statusMessageDiv.classList.add(status.severity.toLowerCase());
        this.removeClasses(this.statusIconDiv, 0);
        const classes = this.statusIconDiv.classList;
        classes.add(status.severity.toLowerCase());
        switch (status.severity) {
            case 'FATAL':
                classes.add('fa');
                classes.add('fa-times-circle');
                break;
            case 'ERROR':
                classes.add('fa');
                classes.add('fa-exclamation-circle');
                break;
            case 'WARNING':
                classes.add('fa');
                classes.add('fa-exclamation-circle');
                break;
            case 'INFO':
                classes.add('fa');
                classes.add('fa-info-circle');
                break;
        }
    }

    protected removeClasses(element: Element, keep: number): void {
        const classes = element.classList;
        while (classes.length > keep) {
            const item = classes.item(classes.length - 1);
            if (item) {
                classes.remove(item);
            }
        }
    }
}

export function decodeURI(uri: string): string {
    return decodeURIComponent(uri.replace(/\+/g, ' '));
}
