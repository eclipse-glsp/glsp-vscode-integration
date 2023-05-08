import {
    Command,
    commands,
    ExtensionContext
} from 'vscode';
import { MouseMoveAction, ViewportBoundsChangeAction, SelectionChangeAction, ToggleCollaborationFeatureAction, CollaborationActionKinds } from '@eclipse-glsp/protocol';
import { GlspVscodeConnector } from '../glsp-vscode-connector';
import { collaborationFeatureStore } from './collaboration-feature-store';


export const TOGGLE_MOUSE_POINTERS_COMMAND: Command = {
    command: 'TOGGLE_MOUSE_POINTERS_COMMAND',
    title: 'Mouse Pointers',
    tooltip: 'Enable or disable other mouse pointers.',
    arguments: [
        MouseMoveAction.KIND
    ]
};

export const TOGGLE_VIEWPORTS_COMMAND: Command = {
    command: 'TOGGLE_VIEWPORTS_COMMAND',
    title: 'Viewports',
    tooltip: 'Enable or disable other viewports.',
    arguments: [
        ViewportBoundsChangeAction.KIND
    ]
};

export const TOGGLE_SELECTIONS_COMMAND: Command = {
    command: 'TOGGLE_SELECTIONS_COMMAND',
    title: 'Selections',
    tooltip: 'Enable or disable other selections.',
    arguments: [
        SelectionChangeAction.KIND
    ]
};

/**
 * The `CommandContext` provides the necessary information to
 * setup the default commands for a GLSP diagram extension.
 */
export interface CollaborationCommandContext {
    /**
     * The {@link vscode.ExtensionContext} of the GLSP diagram extension
     */
    extensionContext: ExtensionContext;

    /**
     * The {@link GlspVscodeConnector} of the GLSP diagram extension.
     */
    connector: GlspVscodeConnector;
}

export function configureCollaborationCommands(context: CollaborationCommandContext): void {
    // keep track of diagram specific element selection.
    const {extensionContext} = context;

    extensionContext.subscriptions.push(
        commands.registerCommand(TOGGLE_MOUSE_POINTERS_COMMAND.command, (actionKind) => {
            executeCollaborationCommand(context, actionKind);
        }),
        commands.registerCommand(TOGGLE_VIEWPORTS_COMMAND.command, (actionKind) => {
            executeCollaborationCommand(context, actionKind);
        }),
        commands.registerCommand(TOGGLE_SELECTIONS_COMMAND.command, (actionKind) => {
            executeCollaborationCommand(context, actionKind);
        })
    );
}

function executeCollaborationCommand(context: CollaborationCommandContext, actionKind: CollaborationActionKinds): void {
    collaborationFeatureStore.toggleFeature(actionKind);
    context.connector.sendActionToAllClients(ToggleCollaborationFeatureAction.create({ actionKind }))
}
