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
    private currentSession: vscode.AuthenticationSession | null = null;

    constructor() {
        // No longer need secrets storage - VS Code handles OAuth
    }

    public async loadOctokit() {
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

            console.log('Starting GitHub authentication...');

            // Use VS Code's built-in GitHub authentication
            this.currentSession = await vscode.authentication.getSession('github', ['repo'], { 
                createIfNone: true,
                clearSessionPreference: false
            });

            if (!this.currentSession) {
                console.log('No GitHub session available');
                return false;
            }

            console.log('GitHub authentication successful for user:', this.currentSession.account.label);
            console.log('Session scopes:', this.currentSession.scopes);

            this.octokit = new OctokitClass({
                auth: this.currentSession.accessToken,
            });

            // Verify the token works and get user info
            console.log('Verifying authentication with GitHub API...');
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            console.log('Authenticated GitHub user:', user.login);
            console.log('User type:', user.type);
            console.log('User permissions:', user.permissions);
            
            return true;
        } catch (error) {
            console.error('GitHub authentication failed:', error);

            // Clear session if authentication failed
            if (this.currentSession) {
                try {
                    await vscode.authentication.getSession('github', ['repo'], { 
                        clearSessionPreference: true 
                    });
                } catch (clearError) {
                    console.error('Failed to clear session:', clearError);
                }
            }

            vscode.window.showErrorMessage(
                'GitHub authentication failed. Please try signing in again.'
            );
            return false;
        }
    }

    public async signOut(): Promise<void> {
        if (this.currentSession) {
            try {
                // Clear the session preference to force re-authentication next time
                await vscode.authentication.getSession('github', ['repo'], { 
                    clearSessionPreference: true 
                });
                this.currentSession = null;
                this.octokit = null;
                console.log('GitHub sign out successful');
            } catch (error) {
                console.error('Error during sign out:', error);
            }
        }
    }

    public async ensureAuthenticated(): Promise<boolean> {
        console.log('GitHubService: Ensuring authentication...');
        
        if (this.isAuthenticated()) {
            console.log('GitHubService: Already authenticated, verifying with API...');
            
            // Verify the authentication actually works
            try {
                const { data: user } = await this.octokit.rest.users.getAuthenticated();
                console.log(`GitHubService: Authentication verified for user: ${user.login}`);
                return true;
            } catch (error: any) {
                console.error('GitHubService: Authentication verification failed:', error);
                // Clear the invalid session
                this.currentSession = null;
                this.octokit = null;
            }
        }
        
        console.log('GitHubService: Not authenticated or verification failed, attempting to authenticate...');
        const result = await this.authenticate();
        console.log(`GitHubService: Authentication result: ${result}`);
        
        return result;
    }

    public isAuthenticated(): boolean {
        const hasSession = this.currentSession !== null;
        const hasOctokit = this.octokit !== null;
        const hasValidToken = this.currentSession?.accessToken !== undefined;
        
        console.log(`GitHubService: Authentication check - session: ${hasSession}, octokit: ${hasOctokit}, token: ${hasValidToken}`);
        
        return hasSession && hasOctokit && hasValidToken;
    }

    public getCurrentUser(): string | undefined {
        // For repository operations, we need the GitHub username, not the display name
        // Let's use a synchronous approach that gets the username from the API call
        if (!this.octokit) {
            return undefined;
        }

        // We'll cache the username after authentication
        // The account.label might be the display name, not the username
        return this.currentSession?.account.label;
    }

    public async getCurrentUserLogin(): Promise<string | undefined> {
        if (!this.octokit) {
            return undefined;
        }

        try {
            const { data: user } = await this.octokit.rest.users.getAuthenticated();
            return user.login;
        } catch (error) {
            console.error('Failed to get current user:', error);
            return undefined;
        }
    }

    public async getUserOrganizations(): Promise<Array<{login: string, avatar_url: string}>> {
        if (!this.octokit) {
            throw new Error('GitHub service not authenticated');
        }

        try {
            const { data: orgs } = await this.octokit.rest.orgs.listForAuthenticatedUser({
                per_page: 100
            });
            return orgs.map((org: any) => ({
                login: org.login,
                avatar_url: org.avatar_url
            }));
        } catch (error) {
            console.error('Failed to get user organizations:', error);
            return [];
        }
    }

    public async getUserRepositories(owner?: string): Promise<Array<{name: string, full_name: string, private: boolean, description: string | null}>> {
        if (!this.octokit) {
            throw new Error('GitHub service not authenticated');
        }

        try {
            let repositories;
            
            if (owner) {
                // Get repositories for a specific organization
                const { data: repos } = await this.octokit.rest.repos.listForOrg({
                    org: owner,
                    per_page: 100,
                    sort: 'updated',
                    type: 'all'
                });
                repositories = repos;
            } else {
                // Get user's own repositories
                const { data: repos } = await this.octokit.rest.repos.listForAuthenticatedUser({
                    per_page: 100,
                    sort: 'updated',
                    affiliation: 'owner,collaborator,organization_member'
                });
                repositories = repos;
            }

            return repositories.map((repo: any) => ({
                name: repo.name,
                full_name: repo.full_name,
                private: repo.private,
                description: repo.description
            }));
        } catch (error) {
            console.error('Failed to get repositories:', error);
            return [];
        }
    }

    public async savePromptToRepository(
        owner: string,
        repo: string,
        promptEntry: PromptEntry,
        saveLocation: string = 'prompts'
    ): Promise<boolean> {
        try {
            console.log(`GitHubService: savePromptToRepository called - owner: ${owner}, repo: ${repo}, saveLocation: ${saveLocation}`);
            
            // Ensure we're authenticated before proceeding
            const authResult = await this.ensureAuthenticated();
            if (!authResult) {
                console.error('GitHubService: Failed to authenticate');
                vscode.window.showErrorMessage('GitHub authentication failed. Please try signing in again.');
                return false;
            }

            console.log(`GitHubService: Saving prompt to ${owner}/${repo} in ${saveLocation}`);
            
            // Check if repository exists and user has access
            try {
                const repoInfo = await this.octokit!.rest.repos.get({ owner, repo });
                console.log(`GitHubService: Repository ${owner}/${repo} exists and accessible`);
                console.log(`GitHubService: Repository details - private: ${repoInfo.data.private}, permissions: ${JSON.stringify(repoInfo.data.permissions)}`);
            } catch (repoError: any) {
                console.error(`GitHubService: Repository ${owner}/${repo} not accessible:`, repoError.status, repoError.message);
                
                if (repoError.status === 404) {
                    vscode.window.showErrorMessage(
                        `Repository ${owner}/${repo} does not exist. Please create it first using "Initialize Project Configuration" command.`
                    );
                } else {
                    vscode.window.showErrorMessage(`Cannot access repository ${owner}/${repo}. Please check if it exists and you have permissions.`);
                }
                return false;
            }

            // Check if prompts directory exists, create if it doesn't
            let dirExists = false;
            try {
                await this.octokit!.rest.repos.getContent({
                    owner,
                    repo,
                    path: saveLocation,
                });
                dirExists = true;
                console.log(`GitHubService: Directory ${saveLocation} exists`);
            } catch (dirError: any) {
                if (dirError.status === 404) {
                    console.log(`GitHubService: Directory ${saveLocation} doesn't exist, will create it`);
                    dirExists = false;
                } else {
                    console.error(`GitHubService: Error checking directory:`, dirError);
                    throw dirError;
                }
            }
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
                try {
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
                } catch (dirError: any) {
                    if (dirError.status === 404) {
                        // Save location directory doesn't exist yet - this is expected for new repositories
                        console.log(`GitHubService: Directory '${saveLocation}' doesn't exist in ${owner}/${repo} yet. This is normal for new repositories.`);
                        return [];
                    } else {
                        // Re-throw other errors
                        throw dirError;
                    }
                }
            }

            // Sort by timestamp (newest first)
            prompts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            return prompts;
        } catch (error: any) {
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
        // Clear the GitHub session
        await this.signOut();
    }



    public async createRepository(name: string, description?: string): Promise<boolean> {
        if (!this.octokit) {
            const authenticated = await this.authenticate();
            if (!authenticated) {
                return false;
            }
        }

        // Ask user about repository visibility
        const config = vscode.workspace.getConfiguration('copilotPromptTracker');
        const defaultPrivate = config.get<boolean>('defaultPrivateRepo', true);
        
        const visibilityChoice = await vscode.window.showQuickPick([
            {
                label: '$(lock) Private Repository',
                description: 'Only you can see this repository (Recommended for prompts)',
                detail: 'Your prompts and code context will be kept private',
                picked: defaultPrivate,
                value: true
            },
            {
                label: '$(globe) Public Repository', 
                description: 'Anyone can see this repository',
                detail: 'Consider carefully - prompts may contain sensitive code context',
                picked: !defaultPrivate,
                value: false
            }
        ], {
            placeHolder: 'Choose repository visibility',
            title: 'Repository Privacy Settings'
        });

        if (!visibilityChoice) {
            // User cancelled
            return false;
        }

        const isPrivate = visibilityChoice.value;

        console.log(`Creating repository "${name}" with visibility: ${isPrivate ? 'private' : 'public'}`);

        try {
            console.log('Attempting to create repository with Octokit...');
            const createResult = await this.octokit!.rest.repos.createForAuthenticatedUser({
                name,
                description: description || 'Repository for storing Copilot prompts and AI interactions',
                private: isPrivate,
                auto_init: true,
                gitignore_template: 'Node'
            });

            console.log('Repository created successfully:', createResult.data.full_name);

            // Wait a moment for GitHub to fully initialize the repository
            console.log('Waiting for repository initialization...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check if README already exists (due to auto_init: true)
            console.log('Checking if README already exists...');
            let readmeExists = false;
            try {
                await this.octokit!.rest.repos.getContent({
                    owner: createResult.data.owner.login,
                    repo: name,
                    path: 'README.md'
                });
                readmeExists = true;
                console.log('README already exists, will update it');
            } catch (error: any) {
                if (error.status === 404) {
                    console.log('README does not exist, will create it');
                } else {
                    console.log('Error checking README existence:', error);
                }
            }

            // Create or update README with our content
            console.log(readmeExists ? 'Updating README file...' : 'Creating README file...');
            const currentUser = createResult.data.owner.login; // Use the owner from the creation response
            
            const readmeContent = `# Copilot Prompts Repository

This repository stores Copilot prompts and AI interactions from multiple projects.

## ⚠️ Privacy Notice

This repository contains AI prompts and code context from your development work. Please be mindful of:
- Code snippets and file paths in prompt context
- Project-specific information and architectural details  
- Potential sensitive data in prompts or responses

${isPrivate ? '🔒 This is a **private repository** - only you can access it.' : '🌐 This is a **public repository** - anyone can view your prompts and code context.'}

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

            console.log('Encoding README content...');
            const encodedReadme = Buffer.from(readmeContent).toString('base64');
            
            // Get the existing README SHA if it exists
            let existingSha: string | undefined;
            if (readmeExists) {
                try {
                    const existingReadme = await this.octokit!.rest.repos.getContent({
                        owner: currentUser,
                        repo: name,
                        path: 'README.md'
                    });
                    if ('sha' in existingReadme.data) {
                        existingSha = existingReadme.data.sha;
                    }
                } catch (error) {
                    console.log('Error getting existing README SHA:', error);
                }
            }
            
            await this.octokit!.rest.repos.createOrUpdateFileContents({
                owner: currentUser,
                repo: name,
                path: 'README.md',
                message: readmeExists ? 'Update README with Copilot Prompt Tracker info' : 'Initialize repository with README',
                content: encodedReadme,
                ...(existingSha && { sha: existingSha })
            });

            console.log('Repository setup completed successfully!');

            // Show confirmation with privacy reminder
            const visibilityText = isPrivate ? 'private' : 'public';
            vscode.window.showInformationMessage(
                `✅ Repository "${name}" created successfully as ${visibilityText}!`,
                'View Repository'
            ).then(selection => {
                if (selection === 'View Repository') {
                    const repoUrl = `https://github.com/${currentUser}/${name}`;
                    vscode.env.openExternal(vscode.Uri.parse(repoUrl));
                }
            });

            return true;
        } catch (error: any) {
            console.error('Failed to create repository - Full error:', error);
            console.error('Error status:', error.status);
            console.error('Error message:', error.message);
            console.error('Error response:', error.response?.data);
            
            if (error.status === 422) {
                vscode.window.showErrorMessage(`Repository "${name}" already exists or name is invalid.`);
            } else if (error.status === 401) {
                vscode.window.showErrorMessage('Authentication failed. Please sign out and sign in again.');
            } else if (error.status === 403) {
                vscode.window.showErrorMessage('Insufficient permissions to create repository. Please check your GitHub account permissions.');
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

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.octokit = null;
        this.currentSession = null;
        console.log('GitHubService: Disposed');
    }
}
