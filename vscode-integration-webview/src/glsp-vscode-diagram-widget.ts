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
    DiagramServer,
    EnableToolPaletteAction,
    InitializeClientSessionAction,
    RequestModelAction,
    RequestTypeHintsAction
} from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { VscodeDiagramWidget } from 'sprotty-vscode-webview';

@injectable()
export abstract class GLSPVscodeDiagramWidget extends VscodeDiagramWidget {
    protected initializeSprotty(): void {
        if (this.modelSource instanceof DiagramServer) {
            this.modelSource.clientId = this.diagramIdentifier.clientId;
        }
        this.actionDispatcher.dispatch(new InitializeClientSessionAction(this.diagramIdentifier.clientId));
        this.actionDispatcher.dispatch(new RequestModelAction({
            sourceUri: decodeURI(this.diagramIdentifier.uri),
            diagramType: this.diagramIdentifier.diagramType
        }));

        this.actionDispatcher.dispatch(new RequestTypeHintsAction(this.diagramIdentifier.diagramType));
        this.actionDispatcher.dispatch(new EnableToolPaletteAction());
    }
}

export function decodeURI(uri: string): string {
    return decodeURIComponent(uri.replace(/\+/g, ' '));
}
