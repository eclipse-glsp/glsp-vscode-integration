/********************************************************************************
 * Copyright (c) 2021-2024 EclipseSource and others.
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
import { BaseGLSPClient, GLSPClientProxy, GLSPServer } from '@eclipse-glsp/protocol';
import { ContainerConfiguration, initializeContainer } from '@eclipse-glsp/protocol/lib/di';
import { Container, ContainerModule } from 'inversify';
import { BaseGlspVscodeServer, GlspVscodeServerOptions } from '../../common/quickstart-components/base-glsp-vscode-server';

export interface BrowserGlspVscodeServerOptions extends GlspVscodeServerOptions {
    /** The server DI modules*/
    readonly serverModules: ContainerModule[];
}

/**
 * This component can be used to bootstrap your extension when using the typescript
 * GLSP server implementation directly in a web extension without a dedicated webworker, which you can find here:
 * https://github.com/eclipse-glsp/glsp-server-node
 *
 * It sets up a a server running directly in the extension context and
 * provides an interface, ready to be used by the `GlspVscodeConnector` for the
 * GLSP-VSCode integration.
 */
export class BrowserGlspVscodeServer extends BaseGlspVscodeServer<BaseGLSPClient> {
    protected serverContainer: Container;

    constructor(protected override readonly options: BrowserGlspVscodeServerOptions) {
        super(options);
    }

    override createGLSPClient(): BaseGLSPClient {
        const client = new BaseGLSPClient({
            id: this.options.clientId
        });
        const proxyModule = new ContainerModule(bind => {
            bind(GLSPClientProxy).toConstantValue(client.proxy);
        });
        this.serverContainer = this.createContainer(proxyModule);
        const server = this.serverContainer.get<GLSPServer>(GLSPServer);
        client.configureServer(server);
        return client;
    }

    protected createContainer(...additionalConfiguration: ContainerConfiguration): Container {
        const container = new Container();
        return initializeContainer(container, ...this.options.serverModules, ...additionalConfiguration);
    }
}
