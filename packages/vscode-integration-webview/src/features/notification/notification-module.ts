/********************************************************************************
 * Copyright (c) 2023-2024 EclipseSource and others.
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

import { EndProgressAction, FeatureModule, MessageAction, StartProgressAction, UpdateProgressAction } from '@eclipse-glsp/client';
import { ExtensionActionKind } from '../default/extension-action-handler';

export const vscodeNotificationModule = new FeatureModule(
    bind => {
        bind(ExtensionActionKind).toConstantValue(MessageAction.KIND);
        bind(ExtensionActionKind).toConstantValue(StartProgressAction.KIND);
        bind(ExtensionActionKind).toConstantValue(EndProgressAction.KIND);
        bind(ExtensionActionKind).toConstantValue(UpdateProgressAction.KIND);
    },
    { featureId: Symbol('vscodeNotification') }
);
