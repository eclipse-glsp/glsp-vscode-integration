/********************************************************************************
 * Copyright (c) 2022 EclipseSource and others.
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

import { ICopyPasteHandler } from '@eclipse-glsp/client/lib/features/copy-paste/copy-paste-handler';

export const CopyPasteHandlerProvider = Symbol('CopyPasteHandlerProvider');
/**
 * Service identifier and type definition to bind the {@link ICopyPasteHandler} to an provider.
 * This enables asynchronous injections and can be used to bypass circular dependency issues.
 */
export type CopyPasteHandlerProvider = () => Promise<ICopyPasteHandler>;
