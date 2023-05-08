import { MouseMoveAction, ViewportBoundsChangeAction, SelectionChangeAction, CollaborationActionKinds } from '@eclipse-glsp/protocol';


export interface ICollaborationFeatureStore {
    getFeature(kind: CollaborationActionKinds): boolean;
    setFeature(kind: CollaborationActionKinds, value: boolean): void;
    toggleFeature(kind: CollaborationActionKinds): boolean;
    onChange(handler: CollaborationFeatureChangeHandler): void;
}

type CollaborationFeatureChangeHandler = (ev: { kind: CollaborationActionKinds, value: boolean }) => void;

class CollaborationFeatureStore implements ICollaborationFeatureStore {

    private handlers: CollaborationFeatureChangeHandler[] = [];
    private featureMap = new Map<CollaborationActionKinds, boolean>();

    constructor() {
        this.featureMap.set(MouseMoveAction.KIND, true);
        this.featureMap.set(ViewportBoundsChangeAction.KIND, true);
        this.featureMap.set(SelectionChangeAction.KIND, true);
    }

    getFeature(kind: CollaborationActionKinds): boolean {
        return this.featureMap.get(kind)!;
    }

    setFeature(kind: CollaborationActionKinds, value: boolean): void {
        this.featureMap.set(kind, value);
        this.handlers.forEach(handler => handler({ kind, value }));
    }

    toggleFeature(kind: CollaborationActionKinds): boolean {
        const newValue = !this.featureMap.get(kind)
        this.setFeature(kind, newValue);
        return newValue;
    }

    onChange(handler: CollaborationFeatureChangeHandler) {
        this.handlers.push(handler);
    }
}

export const collaborationFeatureStore = new CollaborationFeatureStore();
