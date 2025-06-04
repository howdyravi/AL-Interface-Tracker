const vscode = require('vscode');
const { InterfaceTrackerProvider } = require('./InterfaceTrackerProvider');

let trackerProvider;

function activate(context) {
    trackerProvider = new InterfaceTrackerProvider();

    vscode.window.registerTreeDataProvider('alInterfaceExplorer', trackerProvider);

    context.subscriptions.push(
         vscode.commands.registerCommand('alInterfaceTracker.openInterface', (item) => {
            trackerProvider.openInterface(item);
        }),
        vscode.commands.registerCommand('alInterfaceTracker.refresh', () => trackerProvider.refresh()),
        vscode.commands.registerCommand('alInterfaceTracker.collapseAll', () => trackerProvider.collapseAll()),
        vscode.commands.registerCommand('alInterfaceTracker.setSearchQuery', async () => {
            const query = await vscode.window.showInputBox({
                placeHolder: 'Search for an interface...'
            });
            trackerProvider.setSearchQuery(query || '');
            vscode.commands.executeCommand('workbench.view.extension.alInterfaceTracker'); // auto-reveal
        }),
        vscode.commands.registerCommand('alInterfaceTracker.clearSearchQuery', () => {
            trackerProvider.clearSearchQuery();
        })
    );

    trackerProvider.refresh();
    vscode.commands.executeCommand('setContext', 'alInterfaceTracker.hasFilter', false);
    console.log('✅ AL Interface Tracker activated');
}

function deactivate() {}

module.exports = { activate, deactivate };
