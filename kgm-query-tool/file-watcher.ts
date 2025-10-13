// File Watcher for Knowledge Graph Updates
// Uses VS Code API to detect rule file changes and trigger incremental updates

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseMarkdownFile } from './knowledge-graph-crawler';
import { populateKnowledgeGraph } from './mcp-integration';

export class KnowledgeGraphWatcher {
  private watcher: vscode.FileSystemWatcher;
  private ruleFiles: Set<string>;

  constructor() {
    this.ruleFiles = new Set();
    this.initializeRuleFiles();

    // Watch for changes in rule directories
    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], '{.kilocode/rules/**,.kilocode/rules/memory-bank/**,6-Docs/**}')
    );

    this.watcher.onDidCreate(this.handleFileCreate.bind(this));
    this.watcher.onDidChange(this.handleFileChange.bind(this));
    this.watcher.onDidDelete(this.handleFileDelete.bind(this));
  }

  private initializeRuleFiles() {
    const dirs = [
      '.kilocode/rules',
      '.kilocode/rules/memory-bank',
      '6-Docs'
    ];

    for (const dir of dirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
        files.forEach(file => this.ruleFiles.add(path.join(dir, file)));
      }
    }
  }

  private async handleFileCreate(uri: vscode.Uri) {
    const filePath = vscode.workspace.asRelativePath(uri);
    if (this.isRuleFile(filePath)) {
      console.log(`New rule file detected: ${filePath}`);
      this.ruleFiles.add(filePath);
      await this.updateKnowledgeGraph(filePath, 'create');
    }
  }

  private async handleFileChange(uri: vscode.Uri) {
    const filePath = vscode.workspace.asRelativePath(uri);
    if (this.isRuleFile(filePath)) {
      console.log(`Rule file changed: ${filePath}`);
      await this.updateKnowledgeGraph(filePath, 'update');
    }
  }

  private async handleFileDelete(uri: vscode.Uri) {
    const filePath = vscode.workspace.asRelativePath(uri);
    if (this.ruleFiles.has(filePath)) {
      console.log(`Rule file deleted: ${filePath}`);
      this.ruleFiles.delete(filePath);
      await this.updateKnowledgeGraph(filePath, 'delete');
    }
  }

  private isRuleFile(filePath: string): boolean {
    return filePath.endsWith('.md') && (
      filePath.startsWith('.kilocode/rules') ||
      filePath.startsWith('6-Docs')
    );
  }

  private async updateKnowledgeGraph(filePath: string, action: 'create' | 'update' | 'delete') {
    try {
      if (action === 'delete') {
        // For deletions, we would need to remove entities from the graph
        // This is more complex and would require tracking entity IDs
        console.log(`Note: Deletion of ${filePath} detected. Full graph refresh recommended.`);
        return;
      }

      // Parse the updated file
      const { rules, sections, directives, patterns } = parseMarkdownFile(filePath);

      // Convert to entities and relations
      const entities = [];
      const relations = [];

      // Create entities (same logic as crawler)
      rules.forEach(rule => {
        entities.push({
          name: `kg:Rule|${filePath}`,
          entityType: 'Rule',
          observations: [
            `Name: ${rule.name}`,
            `Description: ${rule.description || 'No description'}`,
            `When to apply: ${rule.whenToApply || 'Not specified'}`,
            `Authoritative for: ${rule.authoritativeFor?.join(', ') || 'None'}`,
            `Layer tags: ${rule.layerTags?.join(', ') || 'None'}`,
            `Topics: ${rule.topics?.join(', ') || 'None'}`,
            `Content: ${rule.content?.substring(0, 500) || 'No content'}`
          ]
        });
      });

      // Add sections, directives, patterns...

      // For updates, we might want to delete existing entities first
      // This is simplified - in practice, you'd track entity IDs for proper updates

      await populateKnowledgeGraph(entities, relations);

      vscode.window.showInformationMessage(`Knowledge graph updated for ${path.basename(filePath)}`);

    } catch (error) {
      console.error(`Error updating knowledge graph for ${filePath}:`, error);
      vscode.window.showErrorMessage(`Failed to update knowledge graph for ${path.basename(filePath)}`);
    }
  }

  public dispose() {
    this.watcher.dispose();
  }
}

// Activation function for VS Code extension
export function activate(context: vscode.ExtensionContext) {
  const watcher = new KnowledgeGraphWatcher();
  context.subscriptions.push(watcher);

  // Register command to manually refresh knowledge graph
  const refreshCommand = vscode.commands.registerCommand('knowledgeGraph.refresh', async () => {
    vscode.window.showInformationMessage('Refreshing knowledge graph...');
    // Implement full refresh logic here
  });

  context.subscriptions.push(refreshCommand);
}

export function deactivate() {
  // Cleanup
}