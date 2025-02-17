/********************************************************************************
 * Copyright (c) 2025 EclipseSource and others.
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
import { TypeGuard } from '@eclipse-glsp/vscode-integration';
import * as vscode from 'vscode';

export function getQueryParams<T extends Record<string, string>>(uri: vscode.Uri, guard: TypeGuard<T>): T | undefined;
export function getQueryParams<T extends Record<string, string>>(uri: vscode.Uri): T;
export function getQueryParams<T extends Record<string, string>>(uri: vscode.Uri, guard?: TypeGuard<T>): T | undefined {
    const params = new URLSearchParams(uri.query);
    const result: Record<string, string> = {};

    params.forEach((value, key) => {
        result[key] = value;
    });

    if (guard && !guard(result)) {
        return undefined;
    }

    return result as T;
}

export function asQueryString<T extends Record<string, string>>(params: T): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, value);
    });

    return searchParams.toString();
}

export interface DiffParams {
    mode: 'diff';
    side: 'right' | 'left';
    diffId: string;
}

export namespace DiffParams {
    export function is(value: Record<string, string>): value is DiffParams {
        return value.mode === 'diff' && (value.side === 'right' || value.side === 'left') && typeof value.diffId === 'string';
    }
}
