const vscode = require('vscode');
const { InterfaceTrackerProvider } = require('./InterfaceTrackerProvider');

let trackerProvider;

function activate(context) {
    trackerProvider = new InterfaceTrackerProvider();

    vscode.window.registerTreeDataProvider('alInterfaceExplorer', trackerProvider);

    // Register the openInterface command
    context.subscriptions.push(
        vscode.commands.registerCommand('alInterfaceTracker.openInterface', (item) => {
            trackerProvider.openInterface(item);  // Open the interface definition file
        }),

        vscode.commands.registerCommand('alInterfaceTracker.refresh', () => trackerProvider.refresh()),
        vscode.commands.registerCommand('alInterfaceTracker.manualRefresh', () => trackerProvider.refresh()),
        vscode.commands.registerCommand('alInterfaceTracker.collapseAll', () => trackerProvider.collapseAll())
    );

    trackerProvider.refresh();
    console.log('✅ AL Interface Tracker activated');
}



function deactivate() {}

module.exports = { activate, deactivate };
