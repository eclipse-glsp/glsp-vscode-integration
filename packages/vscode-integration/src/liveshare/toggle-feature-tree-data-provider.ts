import { collaborationFeatureStore } from '../collaboration/collaboration-feature-store';
import {
    Command,
    Event,
    EventEmitter,
    ProviderResult,
    TreeDataProvider,
    TreeItem
} from 'vscode';
import { TOGGLE_MOUSE_POINTERS_COMMAND, TOGGLE_VIEWPORTS_COMMAND, TOGGLE_SELECTIONS_COMMAND} from '../collaboration/collaboration-commands';

export class ToggleFeatureTreeDataProvider implements TreeDataProvider<Command> {

    private static readonly TOGGLE_FEATURE_COMMANDS = [TOGGLE_MOUSE_POINTERS_COMMAND, TOGGLE_VIEWPORTS_COMMAND, TOGGLE_SELECTIONS_COMMAND];

    private onDidChangeTreeDataEmitter = new EventEmitter<Command>();
    public readonly onDidChangeTreeData: Event<Command> = this.onDidChangeTreeDataEmitter.event;

    constructor() {
        collaborationFeatureStore.onChange(({ kind, value }) => {
            const command = ToggleFeatureTreeDataProvider.TOGGLE_FEATURE_COMMANDS.find(command => command.arguments![0] === kind);
            if (command) {
                this.onDidChangeTreeDataEmitter.fire(command);
            }
        });
    }

    getChildren(element?: Command): ProviderResult<Command[]> {
        return Promise.resolve(ToggleFeatureTreeDataProvider.TOGGLE_FEATURE_COMMANDS);
    }

    getTreeItem(command: Command): TreeItem {
        const enabled = collaborationFeatureStore.getFeature(command.arguments![0]);
        const treeItem = new TreeItem((enabled ? 'Disable ' : 'Enable ' ) + command.title);
        treeItem.tooltip = command.tooltip;
        treeItem.command = command;
        return treeItem;
    }
}
