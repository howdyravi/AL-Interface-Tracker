const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class InterfaceItem extends vscode.TreeItem {
    constructor(label, collapsibleState, tooltip, icon, command, contextValue, data = {}) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.iconPath = new vscode.ThemeIcon(icon);
        if (command) this.command = command;
        this.contextValue = contextValue;
        this.data = data;
    }
}

class InterfaceTrackerProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.interfaceMap = new Map();
        this.searchQuery = '';
    }

    setSearchQuery(query) {
        this.searchQuery = query.toLowerCase();
        vscode.commands.executeCommand('setContext', 'alInterfaceTracker.hasFilter', !!query);
        this._onDidChangeTreeData.fire();
    }

    clearSearchQuery() {
        this.setSearchQuery('');
    }

    refresh() {
        this.interfaceMap.clear();
        const folders = vscode.workspace.workspaceFolders || [];
        for (const folder of folders) {
            const folderName = folder.name;
            const root = folder.uri.fsPath;
            const files = this.getAllALFiles(root);
            for (const file of files) {
                this.scanFile(file, folderName);
            }
        }
        this._onDidChangeTreeData.fire();
    }

    getAllALFiles(dir, list = []) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                this.getAllALFiles(fullPath, list);
            } else if (fullPath.endsWith('.al')) {
                list.push(fullPath);
            }
        }
        return list;
    }

    scanFile(filePath, folderName) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        let insideMultilineInterface = false;
        let collectedLines = '';
        let interfaceStartLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('//') || line.startsWith('///')) continue;

            if (line.match(/^interface\s|^interface\s*$/i) || insideMultilineInterface) {
                if (!insideMultilineInterface) {
                    interfaceStartLine = i;
                }

                collectedLines += ' ' + line;
                insideMultilineInterface = true;

                if (line.includes('{')) {
                    insideMultilineInterface = false;
                    const interfaceMatch = collectedLines.match(/^.*interface\s+"?(.+?)"?\s*{/i);
                    collectedLines = '';

                    if (interfaceMatch) {
                        const iface = interfaceMatch[1];
                        if (!this.interfaceMap.has(iface)) {
                            this.interfaceMap.set(iface, {});
                        }
                        this.interfaceMap.get(iface).definition = { filePath, line: interfaceStartLine };
                    }
                }

                continue;
            }

            const objectMatch = line.match(/^(table|page|codeunit|report|query|enum)\s+\d+\s+"?(.+?)"?\s+implements\s+(.+)/i);
            if (objectMatch) {
                const [_, type, name, interfaces] = objectMatch;
                const currentObject = { objectType: type, objectName: name, filePath, line: i, folderName };
                interfaces.split(',').map(f => f.trim().replace(/^"|"$/g, '')).forEach(iface => {
                    if (!this.interfaceMap.has(iface)) {
                        this.interfaceMap.set(iface, {});
                    }
                    const entry = this.interfaceMap.get(iface);
                    if (!entry.implementations) {
                        entry.implementations = new Map();
                    }
                    if (!entry.implementations.has(folderName)) {
                        entry.implementations.set(folderName, []);
                    }
                    entry.implementations.get(folderName).push(currentObject);
                });
            }
        }
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (!element) {
            return [new InterfaceItem('Interfaces', vscode.TreeItemCollapsibleState.Expanded, 'All Interfaces', 'library', null, 'interfacesRoot')];
        }

        if (!element) {
            const rootItem = new InterfaceItem(
                'Interfaces',
                vscode.TreeItemCollapsibleState.Expanded,
                'All Interfaces',
                'library',
                null,
                'interfacesRoot'
            );
            if (this.searchQuery) {
                rootItem.command = {
                    command: 'alInterfaceTracker.clearSearchQuery',
                    title: 'Clear Filter'
                };
                rootItem.iconPath = new vscode.ThemeIcon('filter');
            }
            return [rootItem];
        }


        if (element.contextValue === 'interfacesRoot') {
            if (this.interfaceMap.size === 0) {
                return [new vscode.TreeItem("No interfaces found. Refresh to scan your AL files.")];
            }

            return [...this.interfaceMap.keys()]
                .filter(iface => iface.toLowerCase().includes(this.searchQuery))
                .sort()
                .map(iface => {
                    const ifaceData = this.interfaceMap.get(iface);
                    return new InterfaceItem(
                        iface,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        `Interface: ${iface}`,
                        'symbol-interface',
                        null,
                        'interface',
                        { filePath: ifaceData?.definition?.filePath, line: ifaceData?.definition?.line }
                    );
                });
        }

        if (element.contextValue === 'interface') {
            const ifaceData = this.interfaceMap.get(element.label);
            if (!ifaceData?.implementations) return [];

            return [...ifaceData.implementations.keys()].sort().map(folder =>
                new InterfaceItem(folder, vscode.TreeItemCollapsibleState.Collapsed, `App Folder: ${folder}`, 'folder', null, 'folder', {
                    interfaceName: element.label,
                    folder
                })
            );
        }

        if (element.contextValue === 'folder') {
            const ifaceData = this.interfaceMap.get(element.data.interfaceName);
            const impls = ifaceData?.implementations?.get(element.data.folder);
            if (!impls) return [];

            const sorted = [...impls].sort((a, b) => {
                if (a.objectType === 'enum' && b.objectType !== 'enum') return -1;
                if (b.objectType === 'enum' && a.objectType !== 'enum') return 1;
                return a.objectName.localeCompare(b.objectName);
            });

            return sorted.map((impl, idx) => {
                const label = `${idx === sorted.length - 1 ? '└─' : '├─'} ${impl.objectName} (${impl.objectType})`;
                return new InterfaceItem(label, vscode.TreeItemCollapsibleState.None, `${impl.objectType}: ${impl.objectName}`, this.iconForType(impl.objectType), {
                    command: 'vscode.open',
                    title: 'Open AL Object',
                    arguments: [
                        vscode.Uri.file(impl.filePath),
                        { selection: new vscode.Range(impl.line, 0, impl.line, 0) }
                    ]
                });
            });
        }

        return [];
    }

    openInterface(item) {
        const filePath = item?.data?.filePath;
        const line = item?.data?.line || 0;
        if (!filePath || !fs.existsSync(filePath)) {
            vscode.window.showErrorMessage("Interface file not found.");
            return;
        }

        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc, {
                selection: new vscode.Range(line, 0, line, 0)
            });
        });
    }

    iconForType(type) {
        switch (type.toLowerCase()) {
            case 'codeunit': return 'symbol-method';
            case 'table': return 'symbol-structure';
            case 'page': return 'symbol-interface';
            case 'report': return 'symbol-file';
            case 'query': return 'symbol-event';
            case 'enum': return 'symbol-enum';
            default: return 'symbol-class';
        }
    }

    collapseAll() {
        vscode.commands.executeCommand('workbench.actions.treeView.alInterfaceExplorer.collapseAll');
    }
}

module.exports = { InterfaceTrackerProvider };
