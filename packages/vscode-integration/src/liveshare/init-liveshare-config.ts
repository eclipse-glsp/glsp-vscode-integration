import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';

const fileNotFoundCode = 'ENOENT';
const liveshareConfigFileName = '.vs-liveshare-settings.json';
const homedir = os.homedir() + '/';
const liveshareConfigPath = homedir + liveshareConfigFileName;

function showError(publisher: string, err: Error) {
    const publisherKey = createPublisherKey(publisher);

    console.error(err);

    console.log('Writing liveshare config was not possible. Please do on your own. Create a file with filename "' + liveshareConfigFileName + '" in your home directory (' + homedir + '). And add following content:');
    console.log({
        extensionPermissions: {
            [publisherKey]: '*'
        }
    });
}

function createPublisherKey(publisher: string) {
    return publisher + '.*';
}

export function writeExtensionPermissionsForLiveshare(publisher: string) {
    const publisherKey = createPublisherKey(publisher);
    try {
        let data: string | null = null;
        try {
            data = fs.readFileSync(liveshareConfigPath, 'utf-8');
        } catch (readErr: any) {
            if (readErr.code !== fileNotFoundCode) {
                throw readErr;
            }
        }

        const jsonData = data == null ? {} : JSON.parse(data);

        if (!jsonData.extensionPermissions) {
            jsonData.extensionPermissions = {};
        }

        if (jsonData.extensionPermissions[publisherKey] === '*') {
            return;
        }

        jsonData.extensionPermissions[publisherKey] = '*';

        fs.writeFileSync(liveshareConfigPath, JSON.stringify(jsonData));

        console.log('File: ' + liveshareConfigPath);
        console.log('Content:');
        console.log(jsonData);
        console.log('Please restart VS Code, so Liveshare can re-load content of config file.');
        vscode.window.showInformationMessage('Please restart VS Code, so Liveshare can re-load content of config file.');
    } catch(err: any) {
        showError(publisher, err);
    }
}


