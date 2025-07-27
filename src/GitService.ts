import * as vscode from 'vscode';
import simpleGit, { SimpleGit } from 'simple-git';
import * as path from 'path';

export interface GitInfo {
    commitHash: string;
    branch: string;
    author: string;
    message: string;
    timestamp: string;
    repository: string;
    workspaceRoot: string;
}

export class GitService {
    private git: SimpleGit | null = null;
    private gitExtension: vscode.Extension<any> | undefined;
    private gitAPI: any;
    private disposables: vscode.Disposable[] = [];
    private commitListeners: Array<(commitInfo: GitInfo & { changedFiles: string[] }) => void> = [];
    private lastKnownCommitHash: string | null = null;
    private gitWatcher: vscode.FileSystemWatcher | null = null;

    public async initialize(workspaceRoot?: string): Promise<boolean> {
        try {
            const root = workspaceRoot || this.getWorkspaceRoot();
            if (!root) {
                return false;
            }

            this.git = simpleGit(root);

            // Check if this is a git repository
            const isRepo = await this.git.checkIsRepo();
            if (!isRepo) {
                return false;
            }

            // Initialize VS Code Git extension integration
            await this.initializeGitExtensionIntegration();

            // Set up automatic commit monitoring
            await this.setupCommitMonitoring();

            // Store initial commit hash
            const currentInfo = await this.getCurrentGitInfo();
            if (currentInfo) {
                this.lastKnownCommitHash = currentInfo.commitHash;
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize Git service:', error);
            return false;
        }
    }

    public async getCurrentGitInfo(): Promise<GitInfo | null> {
        if (!this.git) {
            const initialized = await this.initialize();
            if (!initialized) {
                return null;
            }
        }

        try {
            const status = await this.git!.status();
            const log = await this.git!.log({ maxCount: 1 });
            const remotes = await this.git!.getRemotes(true);

            if (log.latest) {
                const commit = log.latest;
                const repository = this.extractRepositoryName(remotes);

                return {
                    commitHash: commit.hash,
                    branch: status.current || 'unknown',
                    author: commit.author_name,
                    message: commit.message,
                    timestamp: commit.date,
                    repository: repository || 'unknown',
                    workspaceRoot: this.getWorkspaceRoot() || ''
                };
            }
        } catch (error) {
            console.error('Failed to get Git info:', error);
        }

        return null;
    }

    public async getChangedFiles(): Promise<string[]> {
        if (!this.git) {
            const initialized = await this.initialize();
            if (!initialized) {
                return [];
            }
        }

        try {
            const status = await this.git!.status();
            return [
                ...status.modified,
                ...status.created,
                ...status.staged
            ];
        } catch (error) {
            console.error('Failed to get changed files:', error);
            return [];
        }
    }

    public async getDiff(filePath?: string): Promise<string> {
        if (!this.git) {
            const initialized = await this.initialize();
            if (!initialized) {
                return '';
            }
        }

        try {
            if (filePath) {
                return await this.git!.diff(['--', filePath]);
            } else {
                return await this.git!.diff();
            }
        } catch (error) {
            console.error('Failed to get diff:', error);
            return '';
        }
    }

    public isGitRepository(): boolean {
        return this.git !== null;
    }

    private getWorkspaceRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        return undefined;
    }

    private isTestEnvironment(): boolean {
        // Detect if running in test environment
        return process.env.NODE_ENV === 'test' || 
               process.env.VSCODE_TEST === 'true' ||
               typeof global !== 'undefined' && (global as any).suite !== undefined;
    }

    private extractRepositoryName(remotes: any[]): string | null {
        for (const remote of remotes) {
            if (remote.name === 'origin' && remote.refs.fetch) {
                const url = remote.refs.fetch;
                // Extract repo name from various Git URL formats
                const match = url.match(/[\/:]([^\/]+\/[^\/]+?)(?:\.git)?$/);
                if (match) {
                    return match[1];
                }
            }
        }
        return null;
    }

    public async createCommitContext(): Promise<{ files: string[], diff: string }> {
        const files = await this.getChangedFiles();
        const diff = await this.getDiff();

        return { files, diff };
    }

    /**
     * Initialize integration with VS Code's built-in Git extension
     */
    private async initializeGitExtensionIntegration(): Promise<void> {
        try {
            this.gitExtension = vscode.extensions.getExtension('vscode.git');
            if (this.gitExtension) {
                if (!this.gitExtension.isActive) {
                    await this.gitExtension.activate();
                }
                this.gitAPI = this.gitExtension.exports.getAPI(1);
                console.log('GitService: Successfully integrated with VS Code Git extension');
            }
        } catch (error) {
            console.error('GitService: Failed to integrate with VS Code Git extension:', error);
        }
    }

    /**
     * Set up automatic commit monitoring using multiple approaches
     */
    private async setupCommitMonitoring(): Promise<void> {
        // Approach 1: Use VS Code Git extension API events (if available)
        this.setupGitExtensionEvents();

        // Approach 2: Monitor .git/logs/HEAD for commit changes
        this.setupGitFileWatcher();

        // Approach 3: Periodic polling as fallback
        this.setupPeriodicCommitCheck();
    }

    /**
     * Set up Git extension events for commit detection
     */
    private setupGitExtensionEvents(): void {
        if (!this.gitAPI?.repositories) {
            return;
        }

        try {
            // Monitor all repositories in the workspace
            this.gitAPI.repositories.forEach((repository: any) => {
                if (repository.onDidCommit) {
                    const commitListener = repository.onDidCommit(() => {
                        this.handleCommitDetected('git-extension-event');
                    });
                    this.disposables.push(commitListener);
                    console.log('GitService: Set up Git extension commit listener');
                }

                // Also listen for repository state changes
                if (repository.state && repository.state.onDidChange) {
                    const stateListener = repository.state.onDidChange(() => {
                        this.checkForNewCommits('git-state-change');
                    });
                    this.disposables.push(stateListener);
                }
            });
        } catch (error) {
            console.error('GitService: Error setting up Git extension events:', error);
        }
    }

    /**
     * Set up file system watcher for .git folder changes
     */
    private setupGitFileWatcher(): void {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            return;
        }

        try {
            // Use VS Code's file system watcher for .git/logs/HEAD (commit log)
            this.gitWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(workspaceRoot, '.git/logs/HEAD')
            );

            const onHeadChange = () => {
                this.handleCommitDetected('git-file-watcher');
            };

            this.gitWatcher.onDidChange(onHeadChange);
            this.gitWatcher.onDidCreate(onHeadChange);

            this.disposables.push(this.gitWatcher);
            console.log('GitService: Set up Git file system watcher');
        } catch (error) {
            console.error('GitService: Error setting up Git file watcher:', error);
        }
    }

    /**
     * Set up periodic polling for commit detection as fallback
     */
    private setupPeriodicCommitCheck(): void {
        // Skip periodic checking in test environment to prevent extension host issues
        if (this.isTestEnvironment()) {
            console.log('GitService: Test environment detected, skipping periodic commit checking');
            return;
        }

        const checkInterval = setInterval(async () => {
            await this.checkForNewCommits('periodic-check');
        }, 5000); // Check every 5 seconds

        this.disposables.push({
            dispose: () => clearInterval(checkInterval)
        });
        console.log('GitService: Set up periodic commit checking');
    }

    /**
     * Handle when a commit is detected
     */
    private async handleCommitDetected(source: string): Promise<void> {
        console.log(`GitService: Commit detected via ${source}`);
        
        // Small delay to ensure commit is fully processed
        setTimeout(async () => {
            await this.checkForNewCommits(source);
        }, 500);
    }

    /**
     * Check for new commits and notify listeners
     */
    private async checkForNewCommits(source: string): Promise<void> {
        try {
            const currentInfo = await this.getCurrentGitInfo();
            if (!currentInfo) {
                return;
            }

            // Check if this is a new commit
            if (this.lastKnownCommitHash && currentInfo.commitHash !== this.lastKnownCommitHash) {
                console.log(`GitService: New commit detected (${source}): ${currentInfo.commitHash}`);
                
                // Get changed files for this commit
                const changedFiles = await this.getCommitChangedFiles(currentInfo.commitHash);
                
                // Notify all listeners
                const commitInfoWithFiles = {
                    ...currentInfo,
                    changedFiles
                };
                
                this.commitListeners.forEach(listener => {
                    try {
                        listener(commitInfoWithFiles);
                    } catch (error) {
                        console.error('GitService: Error in commit listener:', error);
                    }
                });
            }

            // Update last known commit hash
            this.lastKnownCommitHash = currentInfo.commitHash;
        } catch (error) {
            console.error('GitService: Error checking for new commits:', error);
        }
    }

    /**
     * Get changed files for a specific commit
     */
    private async getCommitChangedFiles(commitHash: string): Promise<string[]> {
        if (!this.git) {
            return [];
        }

        try {
            const diffSummary = await this.git.diffSummary([`${commitHash}~1`, commitHash]);
            return diffSummary.files.map(file => file.file);
        } catch (error) {
            console.error('GitService: Error getting commit changed files:', error);
            // Fallback to current changed files
            return await this.getChangedFiles();
        }
    }

    /**
     * Register a listener for commit events
     */
    public onCommit(listener: (commitInfo: GitInfo & { changedFiles: string[] }) => void): vscode.Disposable {
        this.commitListeners.push(listener);
        
        return {
            dispose: () => {
                const index = this.commitListeners.indexOf(listener);
                if (index > -1) {
                    this.commitListeners.splice(index, 1);
                }
            }
        };
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.commitListeners = [];
        
        if (this.gitWatcher) {
            this.gitWatcher.dispose();
            this.gitWatcher = null;
        }
    }
}
