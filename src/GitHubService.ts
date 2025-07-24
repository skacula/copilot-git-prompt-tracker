import * as vscode from 'vscode';

// Dynamic import for Octokit to handle ES module compatibility
let Octokit: any = null;

export interface PromptEntry {
    timestamp: string;
    prompt: string;
    response?: string;
    gitInfo: {
        commitHash: string;
        branch: string;
        author: string;
        repository: string;
        changedFiles: string[];
    };
    metadata: {
        vscodeVersion: string;
        extensionVersion: string;
    };
}

export class GitHubService {
    private octokit: any = null;
    private readonly secretsStorage: vscode.SecretStorage;

    constructor(secretsStorage: vscode.SecretStorage) {
        this.secretsStorage = secretsStorage;
    }

    private async loadOctokit() {
        if (!Octokit) {
            try {
                const octokitModule = await import('@octokit/rest');
                Octokit = octokitModule.Octokit;
            } catch (error) {
                console.error('Failed to load Octokit:', error);
                throw new Error('Failed to load GitHub API client');
            }
        }
        return Octokit;
    }

    public async authenticate(): Promise<boolean> {
        try {
            const OctokitClass = await this.loadOctokit();

            let token = await this.secretsStorage.get('github.token');

            if (!token) {
                token = await this.promptForToken();
                if (!token) {
                    return false;
                }
                await this.secretsStorage.store('github.token', token);
            }

            this.octokit = new OctokitClass({
                auth: token,
            });

            // Verify the token works
            await this.octokit.rest.users.getAuthenticated();
            return true;
        } catch (error) {
            console.error('GitHub authentication failed:', error);

            // Clear invalid token
            await this.secretsStorage.delete('github.token');

            vscode.window.showErrorMessage(
                'GitHub authentication failed. Please check your token and try again.'
            );
            return false;
        }
    }

    private async promptForToken(): Promise<string | undefined> {
        const instruction = 'Create a Personal Access Token';
        const createToken = 'Create Token';

        const action = await vscode.window.showInformationMessage(
            'A GitHub Personal Access Token is required to save prompts to your repository.',
            createToken,
            'Cancel'
        );

        if (action === createToken) {
            await vscode.env.openExternal(
                vscode.Uri.parse('https://github.com/settings/tokens/new?scopes=repo&description=VSCode%20Copilot%20Prompt%20Tracker')
            );
        }

        const token = await vscode.window.showInputBox({
            prompt: 'Enter your GitHub Personal Access Token',
            placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            password: true,
            validateInput: (value: string) => {
                if (!value.trim()) {
                    return 'Token cannot be empty';
                }
                if (!value.trim().startsWith('ghp_') && !value.trim().startsWith('github_pat_')) {
                    return 'Invalid token format';
                }
                return null;
            }
        });

        return token?.trim();
    }

    public async savePromptToRepository(
        owner: string,
        repo: string,
        promptEntry: PromptEntry,
        saveLocation: string = 'prompts'
    ): Promise<boolean> {
        if (!this.octokit) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return false;
            }
        }

        try {
            // Create project-specific directory structure
            const projectName = this.sanitizeProjectName(promptEntry.gitInfo.repository);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `prompt-${timestamp}.json`;
            const filePath = `${saveLocation}/${projectName}/${fileName}`;

            // Prepare file content
            const content = JSON.stringify(promptEntry, null, 2);
            const encodedContent = Buffer.from(content).toString('base64');

            // Check if file already exists (unlikely but possible)
            let sha: string | undefined;
            try {
                const existingFile = await this.octokit!.rest.repos.getContent({
                    owner,
                    repo,
                    path: filePath,
                });

                if ('sha' in existingFile.data) {
                    sha = existingFile.data.sha;
                }
            } catch (error: any) {
                // File doesn't exist, which is expected
                if (error.status !== 404) {
                    throw error;
                }
            }

            // Create or update the file
            await this.octokit!.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: filePath,
                message: `Add Copilot prompt from ${promptEntry.gitInfo.commitHash.substring(0, 7)}`,
                content: encodedContent,
                sha,
            });

            return true;
        } catch (error: any) {
            console.error('Failed to save prompt to repository:', error);

            if (error.status === 404) {
                vscode.window.showErrorMessage(
                    `Repository ${owner}/${repo} not found or no access. Please check the repository name and your permissions.`
                );
            } else if (error.status === 403) {
                vscode.window.showErrorMessage(
                    'Insufficient permissions to write to repository. Please check your token permissions.'
                );
            } else {
                vscode.window.showErrorMessage(
                    `Failed to save prompt: ${error.message}`
                );
            }

            return false;
        }
    }

    public async listPrompts(
        owner: string,
        repo: string,
        saveLocation: string = 'prompts',
        projectName?: string
    ): Promise<PromptEntry[]> {
        if (!this.octokit) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return [];
            }
        }

        try {
            const prompts: PromptEntry[] = [];

            if (projectName) {
                // List prompts for specific project
                const projectPath = `${saveLocation}/${projectName}`;
                const projectPrompts = await this.getPromptsFromDirectory(owner, repo, projectPath);
                prompts.push(...projectPrompts);
            } else {
                // List prompts from all projects
                const { data: contents } = await this.octokit!.rest.repos.getContent({
                    owner,
                    repo,
                    path: saveLocation,
                });

                if (Array.isArray(contents)) {
                    for (const item of contents) {
                        if (item.type === 'dir') {
                            // This is a project directory
                            const projectPrompts = await this.getPromptsFromDirectory(owner, repo, item.path);
                            prompts.push(...projectPrompts);
                        } else if (item.type === 'file' && item.name.endsWith('.json')) {
                            // Legacy format - prompts directly in root
                            const promptEntry = await this.getPromptFromFile(owner, repo, item.path);
                            if (promptEntry) {
                                prompts.push(promptEntry);
                            }
                        }
                    }
                }
            }

            // Sort by timestamp (newest first)
            prompts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return prompts;
        } catch (error: any) {
            if (error.status === 404) {
                // Directory doesn't exist yet, which is fine
                return [];
            }
            console.error('Failed to list prompts:', error);
            return [];
        }
    }

    private async getPromptsFromDirectory(owner: string, repo: string, directoryPath: string): Promise<PromptEntry[]> {
        try {
            const { data: contents } = await this.octokit!.rest.repos.getContent({
                owner,
                repo,
                path: directoryPath,
            });

            if (!Array.isArray(contents)) {
                return [];
            }

            const prompts: PromptEntry[] = [];
            for (const file of contents) {
                if (file.type === 'file' && file.name.endsWith('.json')) {
                    const promptEntry = await this.getPromptFromFile(owner, repo, file.path);
                    if (promptEntry) {
                        prompts.push(promptEntry);
                    }
                }
            }

            return prompts;
        } catch (error: any) {
            if (error.status === 404) {
                return [];
            }
            console.error(`Failed to get prompts from directory ${directoryPath}:`, error);
            return [];
        }
    }

    private async getPromptFromFile(owner: string, repo: string, filePath: string): Promise<PromptEntry | null> {
        try {
            const fileContent = await this.octokit!.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
            });

            if ('content' in fileContent.data) {
                const content = Buffer.from(fileContent.data.content, 'base64').toString();
                const promptEntry: PromptEntry = JSON.parse(content);
                return promptEntry;
            }
            return null;
        } catch (error) {
            console.error(`Failed to parse prompt file ${filePath}:`, error);
            return null;
        }
    }

    public async getProjectList(owner: string, repo: string, saveLocation: string = 'prompts'): Promise<string[]> {
        if (!this.octokit) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return [];
            }
        }

        try {
            const { data: contents } = await this.octokit!.rest.repos.getContent({
                owner,
                repo,
                path: saveLocation,
            });

            if (!Array.isArray(contents)) {
                return [];
            }

            const projects: string[] = [];
            for (const item of contents) {
                if (item.type === 'dir') {
                    projects.push(item.name);
                }
            }

            return projects.sort();
        } catch (error: any) {
            if (error.status === 404) {
                return [];
            }
            console.error('Failed to get project list:', error);
            return [];
        }
    }

    public async clearAuthentication(): Promise<void> {
        await this.secretsStorage.delete('github.token');
        this.octokit = null;
    }

    public isAuthenticated(): boolean {
        return this.octokit !== null;
    }

    public async createRepository(name: string, description?: string): Promise<boolean> {
        if (!this.octokit) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return false;
            }
        }

        try {
            await this.octokit!.rest.repos.createForAuthenticatedUser({
                name,
                description: description || 'Repository for storing Copilot prompts and AI interactions',
                private: false,
                auto_init: true,
                gitignore_template: 'Node'
            });

            // Create initial README
            const readmeContent = `# Copilot Prompts Repository

This repository stores Copilot prompts and AI interactions from multiple projects.

## Structure

\`\`\`
prompts/
├── project-1/
│   ├── prompt-2025-07-23T10-30-00-000Z.json
│   └── prompt-2025-07-23T11-15-30-000Z.json
├── project-2/
│   └── prompt-2025-07-23T14-45-00-000Z.json
└── README.md
\`\`\`

Each prompt file contains:
- Original prompt text
- Git context (commit, branch, changed files)
- Timestamp and metadata
- Associated project information

Generated by VS Code Copilot Git Prompt Tracker extension.
`;

            const encodedReadme = Buffer.from(readmeContent).toString('base64');
            await this.octokit!.rest.repos.createOrUpdateFileContents({
                owner: await this.getCurrentUser(),
                repo: name,
                path: 'README.md',
                message: 'Initialize repository with README',
                content: encodedReadme
            });

            return true;
        } catch (error: any) {
            console.error('Failed to create repository:', error);
            if (error.status === 422) {
                vscode.window.showErrorMessage(`Repository "${name}" already exists or name is invalid.`);
            } else {
                vscode.window.showErrorMessage(`Failed to create repository: ${error.message}`);
            }
            return false;
        }
    }

    public async repositoryExists(owner: string, repo: string): Promise<boolean> {
        if (!this.octokit) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return false;
            }
        }

        try {
            await this.octokit!.rest.repos.get({ owner, repo });
            return true;
        } catch (error: any) {
            if (error.status === 404) {
                return false;
            }
            throw error;
        }
    }

    public async getCurrentUser(): Promise<string> {
        if (!this.octokit) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                throw new Error('Not authenticated');
            }
        }

        const { data: user } = await this.octokit!.rest.users.getAuthenticated();
        return user.login;
    }

    private sanitizeProjectName(repositoryName: string): string {
        // Extract project name from various repository formats
        let projectName = repositoryName;

        // Remove common prefixes and suffixes
        projectName = projectName.replace(/^(https?:\/\/)?(github\.com\/)?/, '');
        projectName = projectName.replace(/\.git$/, '');

        // Extract just the repo name if it's in owner/repo format
        if (projectName.includes('/')) {
            projectName = projectName.split('/').pop() || projectName;
        }

        // Sanitize for file system
        projectName = projectName.replace(/[^a-zA-Z0-9._-]/g, '-');
        projectName = projectName.replace(/--+/g, '-');
        projectName = projectName.replace(/^-+|-+$/g, '');

        return projectName || 'unknown-project';
    }
}
