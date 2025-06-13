const vscode = require('vscode');
const { InterfaceTrackerProvider } = require('./InterfaceTrackerProvider');

let trackerProvider;

function activate(context) {
    showReleaseNotesIfUpdated(context);
    
    trackerProvider = new InterfaceTrackerProvider();

    const treeView = vscode.window.createTreeView('alInterfaceExplorer', {
        treeDataProvider: trackerProvider,
        showCollapseAll: true
    });

    trackerProvider.setTreeView(treeView);

    context.subscriptions.push(
        vscode.commands.registerCommand('alInterfaceTracker.openInterface', (item) => {
            trackerProvider.openInterface(item);
        }),

        vscode.commands.registerCommand('alInterfaceTracker.refresh', () => {
            trackerProvider.refresh();
        }),

        vscode.commands.registerCommand('alInterfaceTracker.setSearchQuery', async () => {
            const query = await vscode.window.showInputBox({
                placeHolder: 'Search for an interface...'
            });
            trackerProvider.setSearchQuery(query || '');
            vscode.commands.executeCommand('workbench.view.extension.alInterfaceTracker');
        }),

        vscode.commands.registerCommand('alInterfaceTracker.clearSearchQuery', () => {
            trackerProvider.clearSearchQuery();
        }),

        // Clean, reliable reveal for interface in tree
        vscode.commands.registerCommand('alInterfaceTracker.revealInterfaceInTree', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const position = editor.selection.active;
            const wordRange = editor.document.getWordRangeAtPosition(position, /"[^"]+"|\w+/);
            if (!wordRange) return;

            const word = editor.document.getText(wordRange).replace(/^"|"$/g, '');
            if (!trackerProvider.interfaceMap.has(word)) {
                vscode.window.showInformationMessage(`'${word}' is not a recognized interface.`);
                return;
            }

            trackerProvider.setSearchQuery(word);

            await vscode.commands.executeCommand('workbench.view.extension.alInterfaceTracker');

            // Reveal interface node only (no deep expand)
            setTimeout(async () => {
                const rootNodes = await trackerProvider.getChildren();
                const root = rootNodes[0];
                const children = await trackerProvider.getChildren(root);

                const match = children.find(item => item.label.startsWith(word));
                if (match) {
                    await trackerProvider.treeView?.reveal(match, { expand: false });
                }
            }, 300);
        })
    );

    trackerProvider.refresh();
    vscode.commands.executeCommand('setContext', 'alInterfaceTracker.hasFilter', false);

    console.log('✅ AL Interface Tracker activated');
}

const CURRENT_VERSION = '1.2.0';

async function showReleaseNotesIfUpdated(context) {
    const previousVersion = context.globalState.get('alInterfaceTrackerVersion');
    if (previousVersion !== CURRENT_VERSION) {
        context.globalState.update('alInterfaceTrackerVersion', CURRENT_VERSION);

        // Option 1: Open CHANGELOG.md in VS Code
        const changelogUri = vscode.Uri.joinPath(context.extensionUri, 'CHANGELOG.md');
        vscode.commands.executeCommand('vscode.open', changelogUri);

        // Option 2 (optional): Show a notification
        vscode.window.showInformationMessage(`AL Interface Tracker updated to v${CURRENT_VERSION}. See what's new.`, 'Show Release Notes')
            .then(selection => {
                if (selection === 'Show Release Notes') {
                    vscode.commands.executeCommand('vscode.open', changelogUri);
                }
            });
    }
}


function deactivate() { }

module.exports = { activate, deactivate };
