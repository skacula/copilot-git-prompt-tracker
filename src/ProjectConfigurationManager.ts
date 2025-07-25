import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitHubService } from './GitHubService';

export interface ProjectConfig {
    enabled: boolean;
    autoTrackOnCommit: boolean;
    githubRepo?: string;
    saveLocation: string;
    includePatterns: string[];
    excludePatterns: string[];
    trackCopilotUsage: boolean;
    trackCommits: boolean;
}

export class ProjectConfigurationManager {
    private static readonly CONFIG_FILE_NAME = 'copilot-prompt-tracker.json';
    private readonly defaultConfig: ProjectConfig = {
        enabled: true,
        autoTrackOnCommit: false,
        saveLocation: 'prompts',
        includePatterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.java', '**/*.md'],
        excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        trackCopilotUsage: true,
        trackCommits: false
    };

    constructor(private readonly githubService?: GitHubService) {}

    public async getProjectConfig(workspaceFolder?: vscode.WorkspaceFolder): Promise<ProjectConfig> {
        if (!workspaceFolder) {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                return this.defaultConfig;
            }
            workspaceFolder = folders[0];
        }

        const configPath = this.getConfigPath(workspaceFolder);
        
        try {
            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const projectConfig = JSON.parse(configContent);
                return { ...this.defaultConfig, ...projectConfig };
            }
        } catch (error) {
            console.error('Error reading project config:', error);
        }

        return this.defaultConfig;
    }

    public async saveProjectConfig(config: ProjectConfig, workspaceFolder?: vscode.WorkspaceFolder): Promise<void> {
        if (!workspaceFolder) {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                throw new Error('No workspace folder available');
            }
            workspaceFolder = folders[0];
        }

        const configPath = this.getConfigPath(workspaceFolder);
        const vscodeDir = path.dirname(configPath);

        // Ensure .vscode directory exists
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        const configContent = JSON.stringify(config, null, 2);
        fs.writeFileSync(configPath, configContent, 'utf8');
    }

    public async initializeProjectConfig(workspaceFolder?: vscode.WorkspaceFolder): Promise<void> {
        console.log('ProjectConfigurationManager: initializeProjectConfig called');
        
        if (!workspaceFolder) {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                console.log('ProjectConfigurationManager: No workspace folder available');
                vscode.window.showErrorMessage('No workspace folder available for project configuration');
                return;
            }
            workspaceFolder = folders[0];
        }

        console.log('ProjectConfigurationManager: Using workspace folder:', workspaceFolder.name);
        const configPath = this.getConfigPath(workspaceFolder);
        console.log('ProjectConfigurationManager: Config path:', configPath);
        
        if (fs.existsSync(configPath)) {
            console.log('ProjectConfigurationManager: Config file already exists');
            const action = await vscode.window.showWarningMessage(
                'Project configuration already exists. Overwrite?',
                'Yes', 'No'
            );
            if (action !== 'Yes') {
                console.log('ProjectConfigurationManager: User chose not to overwrite');
                return;
            }
        }

        console.log('ProjectConfigurationManager: Starting configuration wizard');
        // Show configuration wizard
        const config = await this.showConfigurationWizard();
        if (config) {
            console.log('ProjectConfigurationManager: Saving config:', config);
            await this.saveProjectConfig(config, workspaceFolder);
            vscode.window.showInformationMessage(
                `Project configuration saved to ${path.relative(workspaceFolder.uri.fsPath, configPath)}`
            );
            console.log('ProjectConfigurationManager: Configuration saved successfully');
        } else {
            console.log('ProjectConfigurationManager: Configuration wizard cancelled');
        }
    }

    public async showConfigurationWizard(): Promise<ProjectConfig | undefined> {
        console.log('ProjectConfigurationManager: showConfigurationWizard started');
        
        // Enable tracking
        const enabledChoice = await vscode.window.showQuickPick([
            { label: 'Yes', description: 'Enable Copilot prompt tracking for this project', picked: true },
            { label: 'No', description: 'Disable tracking for this project' }
        ], {
            placeHolder: 'Enable Copilot prompt tracking for this project?'
        });

        console.log('ProjectConfigurationManager: enabledChoice:', enabledChoice?.label);
        
        if (!enabledChoice) {
            console.log('ProjectConfigurationManager: User cancelled at enabled choice');
            return undefined;
        }
        const enabled = enabledChoice.label === 'Yes';

        if (!enabled) {
            console.log('ProjectConfigurationManager: Tracking disabled, returning config');
            return { ...this.defaultConfig, enabled: false };
        }

        // Auto-track on commit
        const autoTrackChoice = await vscode.window.showQuickPick([
            { label: 'Yes', description: 'Automatically save prompts when committing code', picked: false },
            { label: 'No', description: 'Only save prompts manually' }
        ], {
            placeHolder: 'Automatically track prompts on git commits?'
        });

        console.log('ProjectConfigurationManager: autoTrackChoice:', autoTrackChoice?.label);

        if (!autoTrackChoice) {
            console.log('ProjectConfigurationManager: User cancelled at auto-track choice');
            return undefined;
        }
        const autoTrackOnCommit = autoTrackChoice.label === 'Yes';

        // Track commits
        const trackCommitsChoice = await vscode.window.showQuickPick([
            { label: 'Yes', description: 'Monitor git commits and associate with prompts', picked: true },
            { label: 'No', description: 'Only track Copilot usage' }
        ], {
            placeHolder: 'Track git commit information with prompts?'
        });

        console.log('ProjectConfigurationManager: trackCommitsChoice:', trackCommitsChoice?.label);

        if (!trackCommitsChoice) {
            console.log('ProjectConfigurationManager: User cancelled at track commits choice');
            return undefined;
        }
        const trackCommits = trackCommitsChoice.label === 'Yes';

        // GitHub repository selection
        let githubRepo: string | undefined;
        console.log('ProjectConfigurationManager: GitHub service available:', !!this.githubService);
        
        if (this.githubService) {
            try {
                console.log('ProjectConfigurationManager: Attempting GitHub authentication...');
                // Ensure GitHub service is authenticated
                const isAuthenticated = await this.githubService.authenticate();
                console.log('ProjectConfigurationManager: Authentication result:', isAuthenticated);
                
                if (!isAuthenticated) {
                    console.log('ProjectConfigurationManager: Authentication failed, skipping repo selection');
                    vscode.window.showWarningMessage('GitHub authentication failed. Repository setup skipped.');
                } else {
                    console.log('ProjectConfigurationManager: Authentication successful, showing repo options');
                    const repoChoice = await vscode.window.showQuickPick([
                        { label: 'Select existing repository', description: 'Choose from your GitHub repositories' },
                        { label: 'Enter repository manually', description: 'Type owner/repo format' },
                        { label: 'Skip repository setup', description: 'Configure later' }
                    ], {
                        placeHolder: 'How would you like to set up the GitHub repository?'
                    });

                    console.log('ProjectConfigurationManager: repoChoice:', repoChoice?.label);

                    if (repoChoice?.label === 'Select existing repository') {
                        console.log('ProjectConfigurationManager: User chose to select existing repository');
                        githubRepo = await this.selectExistingRepository();
                        console.log('ProjectConfigurationManager: Selected repo result:', githubRepo);
                    } else if (repoChoice?.label === 'Enter repository manually') {
                        console.log('ProjectConfigurationManager: User chose to enter repository manually');
                        githubRepo = await this.enterRepositoryManually();
                    } else {
                        console.log('ProjectConfigurationManager: User skipped repository setup');
                    }
                    // If 'Skip repository setup' or no choice, githubRepo remains undefined
                }
            } catch (error) {
                console.error('Error in repository selection:', error);
                vscode.window.showWarningMessage('Failed to load GitHub repositories. You can configure this later.');
            }
        } else {
            console.log('ProjectConfigurationManager: No GitHub service available');
        }

        const finalConfig = {
            ...this.defaultConfig,
            enabled,
            autoTrackOnCommit,
            trackCommits,
            githubRepo
        };
        
        console.log('ProjectConfigurationManager: Final config created:', finalConfig);
        return finalConfig;
    }

    private getConfigPath(workspaceFolder: vscode.WorkspaceFolder): string {
        return path.join(workspaceFolder.uri.fsPath, '.vscode', ProjectConfigurationManager.CONFIG_FILE_NAME);
    }

    public async getAllProjectConfigs(): Promise<Map<string, ProjectConfig>> {
        const configs = new Map<string, ProjectConfig>();
        const folders = vscode.workspace.workspaceFolders;

        if (folders) {
            for (const folder of folders) {
                const config = await this.getProjectConfig(folder);
                configs.set(folder.uri.fsPath, config);
            }
        }

        return configs;
    }

    public hasProjectConfig(workspaceFolder?: vscode.WorkspaceFolder): boolean {
        if (!workspaceFolder) {
            const folders = vscode.workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                return false;
            }
            workspaceFolder = folders[0];
        }

        const configPath = this.getConfigPath(workspaceFolder);
        return fs.existsSync(configPath);
    }

    private async selectExistingRepository(): Promise<string | undefined> {
        console.log('ProjectConfigurationManager: selectExistingRepository called');
        
        if (!this.githubService) {
            console.log('ProjectConfigurationManager: No GitHub service in selectExistingRepository');
            return undefined;
        }

        try {
            console.log('ProjectConfigurationManager: Getting current user...');
            // First, get the current user for "Personal" repositories
            const currentUser = await this.githubService.getCurrentUserLogin();
            console.log('ProjectConfigurationManager: Current user:', currentUser);
            
            console.log('ProjectConfigurationManager: Getting user organizations...');
            // Get organizations
            const organizations = await this.githubService.getUserOrganizations();
            console.log('ProjectConfigurationManager: Found', organizations.length, 'organizations');
            
            // Create choices for organization/owner selection
            const ownerChoices = [];
            
            if (currentUser) {
                ownerChoices.push({
                    label: `👤 ${currentUser}`,
                    description: 'Personal repositories',
                    owner: currentUser
                });
                console.log('ProjectConfigurationManager: Added personal account choice');
            }
            
            for (const org of organizations) {
                ownerChoices.push({
                    label: `🏢 ${org.login}`,
                    description: 'Organization repositories',
                    owner: org.login
                });
                console.log('ProjectConfigurationManager: Added org choice:', org.login);
            }

            console.log('ProjectConfigurationManager: Total owner choices:', ownerChoices.length);

            if (ownerChoices.length === 0) {
                console.log('ProjectConfigurationManager: No owner choices available');
                vscode.window.showErrorMessage('No GitHub organizations or personal account found.');
                return undefined;
            }

            console.log('ProjectConfigurationManager: Showing owner selection...');
            // Let user select owner/organization
            const ownerChoice = await vscode.window.showQuickPick(ownerChoices, {
                placeHolder: 'Select account or organization',
                matchOnDescription: true
            });

            if (!ownerChoice) {
                console.log('ProjectConfigurationManager: User cancelled owner selection');
                return undefined;
            }

            console.log('ProjectConfigurationManager: Selected owner:', ownerChoice.owner);

            console.log('ProjectConfigurationManager: Getting repositories for owner...');
            // Get repositories for selected owner
            const repositories = await this.githubService.getUserRepositories(
                ownerChoice.owner === currentUser ? undefined : ownerChoice.owner
            );
            
            console.log('ProjectConfigurationManager: Found', repositories.length, 'repositories');

            if (repositories.length === 0) {
                console.log('ProjectConfigurationManager: No repositories found');
                vscode.window.showWarningMessage(`No repositories found for ${ownerChoice.owner}`);
                return undefined;
            }

            // Create repository choices
            const repoChoices = repositories.map(repo => ({
                label: `📁 ${repo.name}`,
                description: `${repo.private ? '🔒' : '🌐'} ${repo.description || 'No description'}`,
                detail: repo.full_name,
                repo: repo.full_name
            }));

            console.log('ProjectConfigurationManager: Showing repository selection...');
            // Let user select repository
            const repoChoice = await vscode.window.showQuickPick(repoChoices, {
                placeHolder: `Select repository from ${ownerChoice.owner}`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!repoChoice) {
                console.log('ProjectConfigurationManager: User cancelled repository selection');
                return undefined;
            }

            console.log('ProjectConfigurationManager: Selected repository:', repoChoice.repo);
            return repoChoice.repo;

        } catch (error) {
            console.error('ProjectConfigurationManager: Error in selectExistingRepository:', error);
            vscode.window.showErrorMessage('Failed to load repositories from GitHub.');
            return undefined;
        }
    }

    private async enterRepositoryManually(): Promise<string | undefined> {
        const repoInput = await vscode.window.showInputBox({
            prompt: 'Enter GitHub repository in format: owner/repository-name',
            placeHolder: 'e.g., username/my-repo or organization/project',
            validateInput: (value) => {
                if (!value) {
                    return 'Repository name is required';
                }
                const parts = value.split('/');
                if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
                    return 'Repository must be in format: owner/repository-name';
                }
                return null;
            }
        });

        return repoInput?.trim();
    }
}
