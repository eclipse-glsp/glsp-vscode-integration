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
import { WorkflowEdgeView } from '@eclipse-glsp-examples/workflow-glsp';
import {
    FeatureModule,
    GEdge,
    RectangularNode,
    RoundedCornerNodeView,
    configureModelElement,
    deletableFeature,
    hoverFeedbackFeature,
    moveFeature
} from '@eclipse-glsp/client';
import '../../../css/diff.css';

export const compareModule = new FeatureModule(
    (bind, unbind, isBound, rebind) => {
        const context = { bind, unbind, isBound, rebind };
        configureModelElement(context, 'node:compare', RectangularNode, RoundedCornerNodeView, {
            disable: [moveFeature, hoverFeedbackFeature, deletableFeature]
        });
        configureModelElement(context, 'edge:compare', GEdge, WorkflowEdgeView, {
            disable: [moveFeature, hoverFeedbackFeature, deletableFeature]
        });
    },
    { featureId: Symbol('compare') }
);
