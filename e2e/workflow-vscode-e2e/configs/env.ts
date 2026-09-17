/********************************************************************************
 * Copyright (c) 2026 EclipseSource and others.
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

/**
 * VS Code release the tests run against. Pinned so that a workbench change upstream cannot turn a
 * green suite red overnight; bump deliberately, in its own commit.
 */
export const VSCODE_VERSION = process.env.VSCODE_VERSION ?? '1.101.0';

/**
 * WebSocket path the Workflow GLSP server listens on. Handed to the extension via
 * `GLSP_WEBSOCKET_PATH` so it connects to the same endpoint.
 */
export const GLSP_WEBSOCKET_PATH = 'workflow';
