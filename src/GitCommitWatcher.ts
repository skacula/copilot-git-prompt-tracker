import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectConfigurationManager, ProjectConfig } from './ProjectConfigurationManager';
import { GitService } from './GitService';
import { GitHubService } from './GitHubService';
import { ConfigurationManager } from './ConfigurationManager';

export class GitCommitWatcher implements vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly watchers = new Map<string, vscode.FileSystemWatcher>();
    private readonly projectConfigManager: ProjectConfigurationManager;
    private lastCommitHashes = new Map<string, string>();

    constructor(
        private readonly gitService: GitService,
        private readonly githubService: GitHubService,
        private readonly configManager: ConfigurationManager
    ) {
        this.projectConfigManager = new ProjectConfigurationManager(githubService);
        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Watch for workspace changes
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                await this.setupWatcherForWorkspace(folder);
            }
        }

        // Listen for workspace folder changes
        this.disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(event => {
                // Add watchers for new folders
                event.added.forEach(folder => this.setupWatcherForWorkspace(folder));
                
                // Remove watchers for removed folders
                event.removed.forEach(folder => this.removeWatcherForWorkspace(folder));
            })
        );
    }

    private async setupWatcherForWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        const projectConfig = await this.projectConfigManager.getProjectConfig(workspaceFolder);
        
        if (!projectConfig.enabled || !projectConfig.trackCommits) {
            return;
        }

        const gitDir = path.join(workspaceFolder.uri.fsPath, '.git');
        const headFile = path.join(gitDir, 'HEAD');
        const refsDir = path.join(gitDir, 'refs');

        // Watch for changes to HEAD and refs (indicates commits)
        const pattern = new vscode.RelativePattern(workspaceFolder, '.git/{HEAD,refs/**,logs/**}');
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        watcher.onDidChange(async (uri) => {
            await this.handleGitChange(workspaceFolder, uri);
        });

        watcher.onDidCreate(async (uri) => {
            await this.handleGitChange(workspaceFolder, uri);
        });

        this.watchers.set(workspaceFolder.uri.fsPath, watcher);
        this.disposables.push(watcher);

        // Initialize with current commit
        try {
            await this.gitService.initialize(workspaceFolder.uri.fsPath);
            const gitInfo = await this.gitService.getCurrentGitInfo();
            if (gitInfo) {
                this.lastCommitHashes.set(workspaceFolder.uri.fsPath, gitInfo.commitHash);
            }
        } catch (error) {
            console.log('No git info available for workspace:', workspaceFolder.uri.fsPath);
        }
    }

    private removeWatcherForWorkspace(workspaceFolder: vscode.WorkspaceFolder): void {
        const watcher = this.watchers.get(workspaceFolder.uri.fsPath);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(workspaceFolder.uri.fsPath);
        }
        this.lastCommitHashes.delete(workspaceFolder.uri.fsPath);
    }

    private async handleGitChange(workspaceFolder: vscode.WorkspaceFolder, uri: vscode.Uri): Promise<void> {
        const fileName = path.basename(uri.fsPath);
        
        // Only react to changes that indicate new commits
        if (!fileName.includes('HEAD') && !uri.fsPath.includes('logs')) {
            return;
        }

        // Small delay to ensure git operations are complete
        setTimeout(async () => {
            await this.checkForNewCommit(workspaceFolder);
        }, 1000);
    }

    private async checkForNewCommit(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        try {
            const projectConfig = await this.projectConfigManager.getProjectConfig(workspaceFolder);
            
            if (!projectConfig.enabled || !projectConfig.autoTrackOnCommit) {
                return;
            }

            await this.gitService.initialize(workspaceFolder.uri.fsPath);
            const gitInfo = await this.gitService.getCurrentGitInfo();
            if (!gitInfo) {
                return;
            }

            const lastCommitHash = this.lastCommitHashes.get(workspaceFolder.uri.fsPath);
            
            // Check if this is a new commit
            if (lastCommitHash && lastCommitHash === gitInfo.commitHash) {
                return; // No new commit
            }

            this.lastCommitHashes.set(workspaceFolder.uri.fsPath, gitInfo.commitHash);

            // Only track if this is actually a new commit (not the initial load)
            if (lastCommitHash) {
                await this.autoSaveCommitContext(workspaceFolder, gitInfo, projectConfig);
            }

        } catch (error) {
            console.error('Error checking for new commit:', error);
        }
    }

    private async autoSaveCommitContext(
        workspaceFolder: vscode.WorkspaceFolder, 
        gitInfo: any, 
        projectConfig: ProjectConfig
    ): Promise<void> {
        try {
            const globalConfig = this.configManager.getConfiguration();
            
            // Use project-specific repo or fall back to global
            const repoString = projectConfig.githubRepo || globalConfig.githubRepo;
            if (!repoString) {
                console.log('No GitHub repository configured for auto-save');
                return;
            }

            const [owner, repo] = repoString.split('/');
            if (!owner || !repo) {
                console.log('Invalid repository format:', repoString);
                return;
            }

            // Create a commit-based prompt entry
            const commitContext = await this.gitService.createCommitContext();
            const promptText = this.generateCommitPrompt(gitInfo, commitContext);

            const promptEntry = {
                timestamp: new Date().toISOString(),
                prompt: promptText,
                gitInfo: {
                    commitHash: gitInfo.commitHash,
                    branch: gitInfo.branch,
                    author: gitInfo.author,
                    repository: gitInfo.repository,
                    changedFiles: commitContext.files
                },
                metadata: {
                    vscodeVersion: vscode.version,
                    extensionVersion: '0.0.1',
                    autoGenerated: true,
                    triggerType: 'commit'
                }
            };

            const saved = await this.githubService.savePromptToRepository(
                owner,
                repo,
                promptEntry,
                projectConfig.saveLocation
            );

            if (saved) {
                vscode.window.showInformationMessage(
                    `📝 Commit context auto-saved: ${gitInfo.commitHash.substring(0, 7)}`,
                    'View'
                ).then(action => {
                    if (action === 'View') {
                        vscode.commands.executeCommand('copilotPromptTracker.promptsView.focus');
                    }
                });
            }

        } catch (error) {
            console.error('Error auto-saving commit context:', error);
        }
    }

    private generateCommitPrompt(gitInfo: any, commitContext: { files: string[], diff: string }): string {
        return `# Auto-generated Commit Context

**Commit:** ${gitInfo.commitHash}
**Author:** ${gitInfo.author}
**Branch:** ${gitInfo.branch}
**Message:** ${gitInfo.message || 'No commit message'}
**Timestamp:** ${gitInfo.timestamp}

## Changed Files
${commitContext.files.map(file => `- ${file}`).join('\n')}

## Summary
This commit context was automatically captured when changes were committed to the repository. 

**Repository:** ${gitInfo.repository}
**Files Changed:** ${commitContext.files.length}

## Diff Preview
\`\`\`diff
${commitContext.diff.split('\n').slice(0, 50).join('\n')}${commitContext.diff.split('\n').length > 50 ? '\n... (truncated)' : ''}
\`\`\`

---
*Auto-generated by Copilot Prompt Tracker on commit*`;
    }

    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.watchers.forEach(watcher => watcher.dispose());
        this.watchers.clear();
        this.lastCommitHashes.clear();
    }
}
