import * as vscode from 'vscode';

export function getRelativeDocumentUri(path: string): string {
    let workspacePath = vscode.workspace.workspaceFolders?.[0].uri.path;
    // FIXME test on microsoft / windows
    workspacePath = workspacePath?.endsWith('/') ? workspacePath : `${workspacePath}/`
    return path.replace(workspacePath, '');
}

export function getFullDocumentUri(relativeDocumentUri: string): string {
    let workspacePath = vscode.workspace.workspaceFolders?.[0].uri.path || '';
    // FIXME test on microsoft / windows
    workspacePath = workspacePath.endsWith('/') ? workspacePath : `${workspacePath}/`;
    workspacePath = workspacePath.startsWith('file://') ? workspacePath : `file://${workspacePath}`;
    return workspacePath + relativeDocumentUri;
}
