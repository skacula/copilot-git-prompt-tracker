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

    public async initialize(workspaceRoot?: string): Promise<boolean> {
        try {
            const root = workspaceRoot || this.getWorkspaceRoot();
            if (!root) {
                return false;
            }

            this.git = simpleGit(root);

            // Check if this is a git repository
            const isRepo = await this.git.checkIsRepo();
            return isRepo;
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
}
