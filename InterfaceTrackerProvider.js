const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class InterfaceItem extends vscode.TreeItem {
    constructor(label, collapsibleState, tooltip, icon, command, contextValue, data = {}) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.iconPath = new vscode.ThemeIcon(icon);
        this.command = command;
        this.contextValue = contextValue;
        this.data = data;
        if (data.description) this.description = data.description;
    }
}

class InterfaceTrackerProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.interfaceMap = new Map(); // Stores interface definitions and implementations
        this.searchQuery = '';
        this.treeView = null;
    }

    // External method to link the tree view
    setTreeView(treeView) {
        this.treeView = treeView;
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
            const root = folder.uri.fsPath;
            const files = this.getAllALFiles(root);
            for (const file of files) {
                this.scanFile(file, folder.name);
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

    // Parses an AL file to extract interface definitions and implementations
    scanFile(filePath, folderName) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);

        let insideMultilineInterface = false;
        let collectedLines = '';
        let interfaceStartLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i].trim();

            if (!rawLine || rawLine.startsWith('//') || rawLine.startsWith('///') || rawLine.startsWith('#pragma'))
                continue;

            if (!insideMultilineInterface && rawLine.match(/^interface\s/i)) {
                collectedLines = rawLine;
                interfaceStartLine = i;
                insideMultilineInterface = !rawLine.includes('{');
                if (!insideMultilineInterface) i--;
                continue;
            }

            if (insideMultilineInterface) {
                collectedLines += ' ' + rawLine;
                if (rawLine.includes('{')) {
                    insideMultilineInterface = false;
                    i--;
                }
                continue;
            }

            if (collectedLines) {
                const match = collectedLines.match(/^.*interface\s+"?(.+?)"?\s*{/i);
                collectedLines = '';
                if (match) {
                    const iface = match[1].trim();
                    if (!this.interfaceMap.has(iface)) this.interfaceMap.set(iface, {});
                    this.interfaceMap.get(iface).definition = { filePath, line: interfaceStartLine };
                }
            }

            const objectMatch = rawLine.match(/^(table|page|codeunit|report|query|enum)\s+\d+\s+"?(.+?)"?\s+implements\s+(.+)/i);
            if (objectMatch) {
                const [_, type, name, interfaces] = objectMatch;
                const objectData = { objectType: type, objectName: name, filePath, line: i, folderName };
                interfaces.split(',').map(f => f.trim().replace(/^"|"$/g, '')).forEach(iface => {
                    if (!this.interfaceMap.has(iface)) this.interfaceMap.set(iface, {});
                    const entry = this.interfaceMap.get(iface);
                    if (!entry.implementations) entry.implementations = new Map();
                    if (!entry.implementations.has(folderName)) entry.implementations.set(folderName, []);
                    entry.implementations.get(folderName).push(objectData);
                });
            }
        }
    }

    getTreeItem(element) {
        return element;
    }

    async getChildren(element) {
        if (!element) {
            return [new InterfaceItem('Interfaces', vscode.TreeItemCollapsibleState.Expanded, 'All interfaces', 'library', null, 'interfacesRoot')];
        }

        if (element.contextValue === 'interfacesRoot') {
            const filtered = [...this.interfaceMap.keys()]
                .filter(k => k.toLowerCase().includes(this.searchQuery))
                .sort();

            return filtered.map(iface => {
                const ifaceData = this.interfaceMap.get(iface);
                const hasImpl = ifaceData?.implementations?.size > 0;

                return new InterfaceItem(
                    hasImpl ? iface : iface + ' ❗',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    `Interface: ${iface}${hasImpl ? '' : ' (Unimplemented)'}`,
                    'symbol-interface',
                    {
                        command: 'alInterfaceTracker.openInterface',
                        title: 'Open Interface Definition',
                        arguments: [{
                            data: ifaceData.definition
                        }]
                    },
                    'interface',
                    ifaceData.definition
                );
            });
        }

        if (element.contextValue === 'interface') {
            const ifaceData = this.interfaceMap.get(element.label.replace(' ❗', ''));
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

            // ✅ Enum-first sorting
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
        const { filePath, line } = item?.data || {};
        if (!filePath || !fs.existsSync(filePath)) {
            vscode.window.showErrorMessage("Interface file not found.");
            return;
        }

        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc, { selection: new vscode.Range(line || 0, 0, line || 0, 0) });
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

    // Reveal and expand all levels down to a specific interface
    async expandToInterface(interfaceName) {
        const rootItems = await this.getChildren();
        const root = rootItems[0];
        const ifaceItem = (await this.getChildren(root)).find(i => i.label.startsWith(interfaceName));
        if (!ifaceItem) return;

        try {
            await this.treeView.reveal(ifaceItem, { expand: true });
        } catch { }
    }
}

module.exports = { InterfaceTrackerProvider };
