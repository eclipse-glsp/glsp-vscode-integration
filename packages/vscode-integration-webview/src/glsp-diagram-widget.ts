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
// based on https://github.com/eclipse-sprotty/sprotty-vscode/blob/v0.3.0/sprotty-vscode-webview/src/vscode-diagram-widget.ts
import {
    DiagramLoader,
    DiagramLoadingOptions,
    IActionDispatcher,
    IDiagramOptions,
    ModelSource,
    TYPES,
    ViewerOptions
} from '@eclipse-glsp/client';
import { inject, injectable, postConstruct } from 'inversify';

export const GLSPDiagramWidgetFactory = Symbol('GLSPDiagramWidgetFactory');
export type GLSPDiagramWidgetFactory = () => GLSPDiagramWidget;

@injectable()
export abstract class GLSPDiagramWidget {
    @inject(TYPES.IActionDispatcher)
    protected actionDispatcher: IActionDispatcher;

    @inject(TYPES.ModelSource)
    protected modelSource: ModelSource;

    @inject(TYPES.IDiagramOptions)
    protected diagramOptions: IDiagramOptions;

    @inject(TYPES.ViewerOptions)
    protected viewerOptions: ViewerOptions;

    @inject(DiagramLoader)
    protected diagramLoader: DiagramLoader;

    get clientId(): string {
        return this.diagramOptions.clientId;
    }

    protected containerDiv: HTMLDivElement | undefined;

    @postConstruct()
    initialize(): void {
        this.initializeHtml();
        this.loadDiagram();
    }

    protected initializeHtml(): void {
        const containerDiv = document.getElementById(this.clientId + '_container') as HTMLDivElement;
        if (containerDiv) {
            const svgContainer = document.createElement('div');
            svgContainer.id = this.viewerOptions.baseDiv;
            containerDiv.appendChild(svgContainer);

            const hiddenContainer = document.createElement('div');
            hiddenContainer.id = this.viewerOptions.hiddenDiv;
            document.body.appendChild(hiddenContainer);
            this.containerDiv = containerDiv;
            containerDiv.addEventListener('mouseenter', e => this.handleMouseEnter(e));
            containerDiv.addEventListener('mouseleave', e => this.handleMouseLeave(e));
        }
    }

    handleMouseEnter(e: MouseEvent): void {
        this.containerDiv?.classList.add('mouse-enter');
        this.containerDiv?.classList.remove('mouse-leave');
    }

    handleMouseLeave(e: MouseEvent): void {
        this.containerDiv?.classList.add('mouse-leave');
        this.containerDiv?.classList.remove('mouse-enter');
    }

    protected createDiagramLoadingOptions(): DiagramLoadingOptions | undefined {
        return undefined;
    }

    loadDiagram(): Promise<void> {
        return this.diagramLoader.load(this.createDiagramLoadingOptions());
    }
}
