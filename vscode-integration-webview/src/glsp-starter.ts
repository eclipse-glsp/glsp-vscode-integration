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
import { DiagramServer, TYPES } from '@eclipse-glsp/client';
import { Container } from 'inversify';
import {
    SprottyDiagramIdentifier,
    SprottyStarter,
    VscodeDiagramServer,
    VscodeDiagramWidget,
    VscodeDiagramWidgetFactory
} from 'sprotty-vscode-webview';

import { GLSPVscodeDiagramWidget } from './glsp-vscode-diagram-widget';
import { GLSPVscodeDiagramServer } from './glsp-vscode-diagramserver';

export abstract class GLSPStarter extends SprottyStarter {
    protected addVscodeBindings(container: Container, diagramIdentifier: SprottyDiagramIdentifier): void {
        container.bind(GLSPVscodeDiagramWidget).toSelf().inSingletonScope();
        container.bind(VscodeDiagramWidget).toService(GLSPVscodeDiagramWidget);
        container.bind(VscodeDiagramWidgetFactory).toFactory(
            context => () => context.container.get<GLSPVscodeDiagramWidget>(GLSPVscodeDiagramWidget));
        container.bind(SprottyDiagramIdentifier).toConstantValue(diagramIdentifier);
        container.bind(GLSPVscodeDiagramServer).toSelf().inSingletonScope();
        container.bind(VscodeDiagramServer).toService(GLSPVscodeDiagramServer);
        container.bind(TYPES.ModelSource).toService(GLSPVscodeDiagramServer);
        container.bind(DiagramServer).toService(GLSPVscodeDiagramServer);
    }
}
