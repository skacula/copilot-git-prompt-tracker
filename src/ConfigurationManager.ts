import * as vscode from 'vscode';

export interface ExtensionConfig {
    githubRepo: string;
    enabled: boolean;
    autoSave: boolean;
    saveLocation: string;
}

export interface NewRepositoryConfig {
    name: string;
    description?: string;
}

export class ConfigurationManager {
    private static readonly EXTENSION_ID = 'copilotPromptTracker';

    public getConfiguration(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.EXTENSION_ID);

        return {
            githubRepo: config.get<string>('githubRepo', ''),
            enabled: config.get<boolean>('enabled', true),
            autoSave: config.get<boolean>('autoSave', false),
            saveLocation: config.get<string>('saveLocation', 'prompts')
        };
    }

    public async updateConfiguration(key: keyof ExtensionConfig, value: any): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigurationManager.EXTENSION_ID);
        await config.update(key, value, vscode.ConfigurationTarget.Global);
    }

    public isConfigured(): boolean {
        const config = this.getConfiguration();
        return config.githubRepo.length > 0 && this.isValidRepoFormat(config.githubRepo);
    }

    public isValidRepoFormat(repo: string): boolean {
        // Validate format: owner/repo
        const repoPattern = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
        return repoPattern.test(repo);
    }

    public onConfigurationChanged(callback: (e: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(callback);
    }

    public async promptForGitHubRepo(): Promise<string | NewRepositoryConfig | undefined> {
        const options = [
            { label: 'Use Existing Repository', description: 'Enter the name of an existing GitHub repository' },
            { label: 'Create New Repository', description: 'Create a new repository for storing prompts' }
        ];

        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: 'How would you like to set up your prompts repository?'
        });

        if (!choice) {
            return undefined;
        }

        if (choice.label === 'Create New Repository') {
            return await this.promptForNewRepository();
        } else {
            return await this.promptForExistingRepository();
        }
    }

    private async promptForExistingRepository(): Promise<string | undefined> {
        const repo = await vscode.window.showInputBox({
            prompt: 'Enter GitHub repository (format: owner/repo)',
            placeHolder: 'username/my-copilot-prompts',
            validateInput: (value: string) => {
                if (!value.trim()) {
                    return 'Repository cannot be empty';
                }
                if (!this.isValidRepoFormat(value.trim())) {
                    return 'Invalid format. Use: owner/repo (e.g., username/my-repo)';
                }
                return null;
            }
        });

        if (repo && this.isValidRepoFormat(repo.trim())) {
            await this.updateConfiguration('githubRepo', repo.trim());
            return repo.trim();
        }

        return undefined;
    }

    private async promptForNewRepository(): Promise<NewRepositoryConfig | undefined> {
        const repoName = await vscode.window.showInputBox({
            prompt: 'Enter repository name for your prompts',
            placeHolder: 'copilot-prompts',
            validateInput: (value: string) => {
                if (!value.trim()) {
                    return 'Repository name cannot be empty';
                }
                if (!/^[a-zA-Z0-9._-]+$/.test(value.trim())) {
                    return 'Repository name can only contain letters, numbers, dots, hyphens, and underscores';
                }
                return null;
            }
        });

        if (repoName) {
            const description = await vscode.window.showInputBox({
                prompt: 'Enter repository description (optional)',
                placeHolder: 'Repository for storing Copilot prompts and AI interactions'
            });

            return { name: repoName.trim(), description: description?.trim() };
        }

        return undefined;
    }

    public async promptForSaveLocation(): Promise<string | undefined> {
        const location = await vscode.window.showQuickPick([
            { label: 'prompts', description: 'Save in /prompts directory' },
            { label: 'docs', description: 'Save in /docs directory' },
            { label: 'ai-history', description: 'Save in /ai-history directory' }
        ], {
            placeHolder: 'Select where to save prompts in the repository'
        });

        if (location) {
            await this.updateConfiguration('saveLocation', location.label);
            return location.label;
        }

        return undefined;
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        // ConfigurationManager doesn't hold resources that need cleanup
        // This method is provided for consistency with other services
    }
}
