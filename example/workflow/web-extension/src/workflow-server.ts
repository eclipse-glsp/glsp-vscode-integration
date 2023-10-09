/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
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
import { WorkflowDiagramModule, WorkflowServerModule } from '@eclipse-glsp-examples/workflow-server/browser';
import {
    GLSPServerError,
    GModelSerializer,
    LogLevel,
    Logger,
    ModelState,
    SOURCE_URI_ARG,
    SourceModelStorage,
    createAppModule
} from '@eclipse-glsp/server/browser';
import {
    MaybePromise,
    RequestModelAction,
    SaveModelAction,
    TypeGuard,
    isGModelElementSchema
} from '@eclipse-glsp/vscode-integration/browser';
import { ContainerModule, inject, injectable } from 'inversify';
import * as vscode from 'vscode';

export function createServerModules(): ContainerModule[] {
    const appModule = createAppModule({ logLevel: LogLevel.info, consoleLog: true });
    const mainModule = new WorkflowServerModule().configureDiagramModule(new WorkflowDiagramModule(() => GModelVSCodeStorage));
    return [appModule, mainModule];
}

@injectable()
export class GModelVSCodeStorage implements SourceModelStorage {
    @inject(Logger)
    protected logger: Logger;

    @inject(GModelSerializer)
    protected modelSerializer: GModelSerializer;

    @inject(ModelState)
    protected modelState: ModelState;

    async loadSourceModel(action: RequestModelAction): Promise<void> {
        const sourceUri = this.getSourceUri(action);
        const rootSchema = await this.loadFromFile(sourceUri, isGModelElementSchema);
        const root = this.modelSerializer.createRoot(rootSchema);
        this.modelState.updateRoot(root);
    }

    saveSourceModel(action: SaveModelAction): MaybePromise<void> {
        const fileUri = this.getFileUri(action);
        const schema = this.modelSerializer.createSchema(this.modelState.root);
        this.writeFile(fileUri, schema);
    }

    protected getSourceUri(action: RequestModelAction): vscode.Uri {
        const sourceUri = action.options?.[SOURCE_URI_ARG];
        if (typeof sourceUri !== 'string') {
            throw new GLSPServerError(`Invalid RequestModelAction! Missing argument with key '${SOURCE_URI_ARG}'`);
        }
        return vscode.Uri.parse(sourceUri);
    }

    protected loadFromFile(sourceUri: vscode.Uri): Promise<unknown>;
    protected loadFromFile<T>(sourceUri: vscode.Uri, guard: TypeGuard<T>): Promise<T>;
    protected async loadFromFile<T>(sourceUri: vscode.Uri, guard?: TypeGuard<T>): Promise<T | unknown> {
        try {
            const fileContent = await this.readFile(sourceUri);
            if (!fileContent) {
                throw new GLSPServerError(`Could not load the source model. The file '${sourceUri}' is empty!.`);
            }

            if (guard && !guard(fileContent)) {
                throw new Error('The loaded root object is not of the expected type!');
            }
            return fileContent;
        } catch (error) {
            throw new GLSPServerError(`Could not load model from file: ${sourceUri}`, error);
        }
    }

    protected async readFile(uri: vscode.Uri): Promise<unknown | undefined> {
        try {
            const data = await vscode.workspace.fs.readFile(uri);
            return this.toJson(data);
        } catch (error) {
            throw new GLSPServerError(`Could not read & parse file contents of '${uri}' as json`, error);
        }
    }

    protected toJson(fileContent: Uint8Array): unknown {
        const jsonString = new TextDecoder().decode(fileContent);
        return JSON.parse(jsonString);
    }

    protected getFileUri(action: SaveModelAction): vscode.Uri {
        const uri = action.fileUri ?? this.modelState.get(SOURCE_URI_ARG);
        if (!uri) {
            throw new GLSPServerError('Could not derive fileUri for saving the current source model');
        }
        return vscode.Uri.parse(uri);
    }

    protected fromJson(jsonObject: unknown): Uint8Array {
        const jsonString = JSON.stringify(jsonObject);
        return new TextEncoder().encode(jsonString);
    }

    protected async writeFile(fileUri: vscode.Uri, model: unknown): Promise<void> {
        const content = this.fromJson(model);
        await vscode.workspace.fs.writeFile(fileUri, content);
    }
}
