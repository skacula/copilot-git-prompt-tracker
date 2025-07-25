import * as vscode from 'vscode';
import { ConfigurationManager, NewRepositoryConfig } from './ConfigurationManager';
import { GitService, GitInfo } from './GitService';
import { GitHubService, PromptEntry } from './GitHubService';
import { PromptTemplateManager, PromptTemplate } from './PromptTemplateManager';
import { CopilotChatReader } from './CopilotChatReader';
import { ContentSanitizer } from './ContentSanitizer';

export class CopilotPromptTracker implements vscode.Disposable {
    private readonly context: vscode.ExtensionContext;
    private readonly configManager: ConfigurationManager;
    private readonly gitService: GitService;
    private readonly githubService: GitHubService;
    private readonly copilotChatReader: CopilotChatReader;
    private readonly disposables: vscode.Disposable[] = [];
    private currentPromptData: { prompt: string; response?: string } | null = null;
    private statusBarItem: vscode.StatusBarItem;
    private promptViewRefreshCallback?: () => void;

    constructor(
        context: vscode.ExtensionContext,
        configManager: ConfigurationManager,
        gitService: GitService,
        githubService: GitHubService
    ) {
        this.context = context;
        this.configManager = configManager;
        this.gitService = gitService;
        this.githubService = githubService;
        this.copilotChatReader = new CopilotChatReader();

        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'copilotPromptTracker.toggle';
        this.updateStatusBar();
        this.statusBarItem.show();
        this.disposables.push(this.statusBarItem);
    }

    public setPromptViewRefreshCallback(callback: () => void) {
        this.promptViewRefreshCallback = callback;
    }

    public async initialize(): Promise<void> {
        // Initialize Git service
        await this.gitService.initialize();

        // Listen for configuration changes
        const configChangeListener = this.configManager.onConfigurationChanged((e) => {
            if (e.affectsConfiguration('copilotPromptTracker')) {
                this.updateStatusBar();
            }
        });
        this.disposables.push(configChangeListener);

        // Try to set up Copilot chat monitoring
        this.setupCopilotMonitoring();
    }

    private setupCopilotMonitoring(): void {
        // Note: VS Code doesn't provide direct API to monitor Copilot chat
        // But we can try to access the chat history from VS Code's storage

        console.log('Copilot monitoring setup (attempting to access chat history)');
        
        // Try to set up file system monitoring for Copilot chat data
        this.setupCopilotChatMonitoring();
    }

    private async setupCopilotChatMonitoring(): Promise<void> {
        try {
            // VS Code stores Copilot chat history in its application data
            // Let's try to monitor for new chat sessions
            const os = require('os');
            const path = require('path');
            
            // Common paths where VS Code stores data
            const possiblePaths = [
                path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage'),
                path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'CachedExtensions'),
                path.join(os.homedir(), '.vscode', 'extensions')
            ];
            
            console.log('CopilotPromptTracker: Looking for Copilot chat data in:', possiblePaths);
            
            // For now, we'll implement a command to capture the last Copilot interaction
            this.registerCopilotCaptureCommand();
            
        } catch (error) {
            console.error('Failed to setup Copilot chat monitoring:', error);
        }
    }

    private registerCopilotCaptureCommand(): void {
        // Register a command to capture recent Copilot interactions
        const captureCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.captureLastCopilotChat',
            async () => {
                try {
                    await this.captureLastCopilotInteraction();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to capture Copilot chat: ${error}`);
                }
            }
        );
        this.disposables.push(captureCommand);
    }

    private async captureLastCopilotInteraction(): Promise<void> {
        console.log('CopilotPromptTracker: Attempting to capture last Copilot interaction');
        
        try {
            // First, try to automatically read the last Copilot chat
            const lastChat = await this.copilotChatReader.getLastUserPrompt();
            
            if (lastChat) {
                console.log('CopilotPromptTracker: Found recent Copilot chat');
                
                // Show the user what we found and ask for confirmation
                const shouldSave = await vscode.window.showQuickPick([
                    {
                        label: '✅ Save this interaction',
                        description: `"${lastChat.prompt.substring(0, 50)}${lastChat.prompt.length > 50 ? '...' : ''}"`
                    },
                    {
                        label: '✏️ Edit before saving',
                        description: 'Modify the prompt or response before saving'
                    },
                    {
                        label: '❌ Cancel',
                        description: 'Don\'t save this interaction'
                    }
                ], {
                    placeHolder: 'Found recent Copilot interaction. What would you like to do?'
                });

                if (!shouldSave || shouldSave.label.includes('Cancel')) {
                    return;
                }

                let finalPrompt = lastChat.prompt;
                let finalResponse = lastChat.response;

                if (shouldSave.label.includes('Edit')) {
                    // Let user edit the prompt
                    const editedPrompt = await vscode.window.showInputBox({
                        prompt: 'Edit the Copilot prompt',
                        value: lastChat.prompt,
                        ignoreFocusOut: true
                    });

                    if (!editedPrompt) {
                        return;
                    }

                    finalPrompt = editedPrompt;

                    // Let user edit the response
                    if (lastChat.response) {
                        const editedResponse = await vscode.window.showInputBox({
                            prompt: 'Edit Copilot\'s response (optional)',
                            value: lastChat.response,
                            ignoreFocusOut: true
                        });
                        finalResponse = editedResponse || lastChat.response;
                    }
                }

                console.log('CopilotPromptTracker: Saving captured Copilot interaction');
                await this.savePrompt(finalPrompt, finalResponse);

                vscode.window.showInformationMessage('✅ Copilot interaction saved successfully!');
                return;
            }

            // Fallback: Ask user to manually enter the prompt
            console.log('CopilotPromptTracker: No recent chat found, falling back to manual entry');
            
            const activeEditor = vscode.window.activeTextEditor;
            let contextInfo = '';
            
            if (activeEditor) {
                const selection = activeEditor.selection;
                const selectedText = activeEditor.document.getText(selection);
                const fileName = activeEditor.document.fileName;
                
                if (selectedText) {
                    contextInfo = `\n\nContext from ${fileName}:\n${selectedText}`;
                }
            }

            const manualPrompt = await vscode.window.showInputBox({
                prompt: 'Enter the prompt you just sent to Copilot',
                placeHolder: 'e.g., "Explain this function" or "Add error handling to this code"',
                ignoreFocusOut: true
            });

            if (!manualPrompt) {
                vscode.window.showInformationMessage('Cancelled saving Copilot interaction');
                return;
            }

            const response = await vscode.window.showInputBox({
                prompt: 'Enter Copilot\'s response (optional)',
                placeHolder: 'Leave empty if you just want to save the prompt',
                ignoreFocusOut: true
            });

            const enhancedPrompt = manualPrompt + contextInfo;

            console.log('CopilotPromptTracker: Saving manually entered Copilot interaction');
            await this.savePrompt(enhancedPrompt, response);

            vscode.window.showInformationMessage('✅ Copilot interaction saved successfully!');

        } catch (error) {
            console.error('Failed to capture Copilot interaction:', error);
            vscode.window.showErrorMessage(`Failed to capture Copilot interaction: ${error}`);
        }
    }

    public async configure(): Promise<void> {
        const config = this.configManager.getConfiguration();

        // Configure GitHub repository
        const repoResult = await this.configManager.promptForGitHubRepo();
        if (!repoResult) {
            return;
        }

        let repoString: string;

        // Handle repository creation if needed
        if (typeof repoResult === 'object') {
            // User wants to create a new repository
            const newRepo = repoResult as NewRepositoryConfig;

            // Authenticate first to create repository
            const authenticated = await this.githubService.authenticate();
            if (!authenticated) {
                vscode.window.showErrorMessage('GitHub authentication failed. Cannot create repository.');
                return;
            }

            // Create the repository
            const created = await this.githubService.createRepository(newRepo.name, newRepo.description);
            if (!created) {
                vscode.window.showErrorMessage('Failed to create repository. Please try again.');
                return;
            }

            // Get current user to construct repo string
            try {
                const username = await this.githubService.getCurrentUserLogin();
                if (!username) {
                    vscode.window.showErrorMessage('Failed to get GitHub username. Please try again.');
                    return;
                }
                repoString = `${username}/${newRepo.name}`;
                await this.configManager.updateConfiguration('githubRepo', repoString);
                vscode.window.showInformationMessage(`Repository "${repoString}" created successfully!`);
            } catch (error) {
                vscode.window.showErrorMessage('Created repository but failed to configure it. Please configure manually.');
                return;
            }
        } else {
            // User provided existing repository
            repoString = repoResult as string;

            // Verify repository exists
            const [owner, repo] = repoString.split('/');

            // Authenticate to check repository
            const authenticated = await this.githubService.authenticate();
            if (!authenticated) {
                vscode.window.showErrorMessage('GitHub authentication failed. Configuration incomplete.');
                return;
            }

            const exists = await this.githubService.repositoryExists(owner, repo);
            if (!exists) {
                const createAction = 'Create Repository';
                const result = await vscode.window.showWarningMessage(
                    `Repository "${repoString}" does not exist or you don't have access to it.`,
                    createAction,
                    'Cancel'
                );

                if (result === createAction) {
                    const created = await this.githubService.createRepository(repo, 'Repository for storing Copilot prompts and AI interactions');
                    if (!created) {
                        vscode.window.showErrorMessage('Failed to create repository.');
                        return;
                    }
                    vscode.window.showInformationMessage(`Repository "${repoString}" created successfully!`);
                } else {
                    return;
                }
            }
        }

        // Configure save location
        await this.configManager.promptForSaveLocation();

        vscode.window.showInformationMessage(
            `Configuration complete! Prompts will be saved to ${repoString}/${config.saveLocation}`
        );

        this.updateStatusBar();
    }

    public async saveCurrentPrompt(): Promise<void> {
        console.log('CopilotPromptTracker: saveCurrentPrompt called - trying automatic capture first');
        
        try {
            // First, try to automatically capture the last Copilot interaction
            await this.captureLastCopilotInteraction();
        } catch (error) {
            console.error('CopilotPromptTracker: Auto-capture failed, falling back to manual entry');
            
            // Fallback to manual entry
            await this.saveCurrentPromptManual();
        }
    }

    public async saveCurrentPromptManual(): Promise<void> {
        console.log('CopilotPromptTracker: saveCurrentPromptManual called');
        
        try {
            // Validate configuration first
            const isValid = await this.validateProjectConfiguration();
            if (!isValid) {
                console.log('CopilotPromptTracker: Configuration validation failed');
                return;
            }

            const config = this.configManager.getConfiguration();
            console.log('CopilotPromptTracker: Using configuration:', config);

            // Get prompt text from user
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter the Copilot prompt you want to save',
                placeHolder: 'Describe what you asked Copilot...'
            });

            if (!prompt) {
                console.log('CopilotPromptTracker: User cancelled prompt input');
                return;
            }

            // Get optional response
            const response = await vscode.window.showInputBox({
                prompt: 'Enter Copilot\'s response (optional)',
                placeHolder: 'Paste Copilot\'s response or leave empty...'
            });

            console.log('CopilotPromptTracker: Saving prompt with text length:', prompt.length);
            console.log('CopilotPromptTracker: Response length:', response ? response.length : 0);
            const result = await this.savePrompt(prompt, response);
            console.log('CopilotPromptTracker: savePrompt result:', result);

        } catch (error) {
            console.error('CopilotPromptTracker: Error in saveCurrentPromptManual:', error);
            vscode.window.showErrorMessage(`Error saving prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public async savePromptFromTemplate(): Promise<void> {
        const config = this.configManager.getConfiguration();

        if (!this.configManager.isConfigured()) {
            const action = 'Configure Now';
            const result = await vscode.window.showWarningMessage(
                'Please configure GitHub repository first.',
                action
            );
            if (result === action) {
                await this.configure();
            }
            return;
        }

        // Get available templates
        const templates = PromptTemplateManager.getTemplates();
        const templateItems = templates.map(template => ({
            label: template.name,
            description: template.description,
            detail: template.category,
            template: template
        }));

        const selectedItem = await vscode.window.showQuickPick(templateItems, {
            placeHolder: 'Select a prompt template'
        });

        if (!selectedItem) {
            return;
        }

        const template = selectedItem.template;

        // Get the active editor content for code placeholder
        const activeEditor = vscode.window.activeTextEditor;
        let selectedCode = '';

        if (activeEditor) {
            const selection = activeEditor.selection;
            if (!selection.isEmpty) {
                selectedCode = activeEditor.document.getText(selection);
            } else {
                // If no selection, get the current line
                const currentLine = activeEditor.document.lineAt(selection.active.line);
                selectedCode = currentLine.text;
            }
        }

        // Create variables object
        const variables: Record<string, string> = {
            code: selectedCode
        };

        // If template requires additional variables, prompt for them
        if (template.template.includes('{expected}')) {
            const expected = await vscode.window.showInputBox({
                prompt: 'What is the expected behavior?',
                placeHolder: 'Describe what should happen...'
            });
            if (expected) {
                variables.expected = expected;
            }
        }

        if (template.template.includes('{actual}')) {
            const actual = await vscode.window.showInputBox({
                prompt: 'What is the actual behavior?',
                placeHolder: 'Describe what is actually happening...'
            });
            if (actual) {
                variables.actual = actual;
            }
        }

        // Format the template
        const formattedPrompt = PromptTemplateManager.formatTemplate(template, variables);

        // Get optional response
        const response = await vscode.window.showInputBox({
            prompt: 'Enter Copilot\'s response (optional)',
            placeHolder: 'Paste Copilot\'s response or leave empty...'
        });

        await this.savePrompt(formattedPrompt, response);
    }

    private async savePrompt(prompt: string, response?: string): Promise<void> {
        console.log('CopilotPromptTracker: savePrompt called with prompt length:', prompt.length);
        
        try {
            const config = this.configManager.getConfiguration();
            console.log('CopilotPromptTracker: Using config:', config);
            
            const [owner, repo] = config.githubRepo.split('/');
            console.log(`CopilotPromptTracker: Parsed repository: ${owner}/${repo}`);

            // Get current Git info
            console.log('CopilotPromptTracker: Getting Git info...');
            const gitInfo = await this.gitService.getCurrentGitInfo();
            console.log('CopilotPromptTracker: Git info:', gitInfo);
            
            if (!gitInfo) {
                console.log('CopilotPromptTracker: No Git info available');
                vscode.window.showWarningMessage(
                    'No Git repository found. Saving prompt without Git context.'
                );
            }

            // Get current file context
            const activeEditor = vscode.window.activeTextEditor;
            console.log('CopilotPromptTracker: Active editor:', !!activeEditor);
            
            console.log('CopilotPromptTracker: Getting changed files...');
            const changedFiles = await this.gitService.getChangedFiles();
            console.log('CopilotPromptTracker: Changed files:', changedFiles);

            // Create prompt entry
            const promptEntry: PromptEntry = {
                timestamp: new Date().toISOString(),
                prompt: prompt.trim(),
                response: response?.trim(),
                gitInfo: {
                    commitHash: gitInfo?.commitHash || 'unknown',
                    branch: gitInfo?.branch || 'unknown',
                    author: gitInfo?.author || 'unknown',
                    repository: gitInfo?.repository || 'unknown',
                    changedFiles: changedFiles
                },
                metadata: {
                    vscodeVersion: vscode.version,
                    extensionVersion: this.context.extension?.packageJSON.version || '0.0.1'
                }
            };

            // Add current file context if available
            if (activeEditor) {
                const document = activeEditor.document;
                (promptEntry as any).fileContext = {
                    fileName: document.fileName,
                    language: document.languageId,
                    selection: {
                        start: activeEditor.selection.start,
                        end: activeEditor.selection.end
                    }
                };
                console.log('CopilotPromptTracker: Added file context for:', document.fileName);
            }

            console.log('CopilotPromptTracker: Created prompt entry:', promptEntry);

            // SECURITY: Sanitize entire prompt entry to remove sensitive data
            console.log('CopilotPromptTracker: Sanitizing prompt entry for security...');
            const originalEntry = JSON.stringify(promptEntry);
            
            // Get workspace root for .gitignore-aware sanitization
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const sanitizedPromptEntry = ContentSanitizer.sanitizePromptEntry(promptEntry, workspaceRoot);
            
            // Check if any sensitive content was detected and redacted
            if (JSON.stringify(sanitizedPromptEntry) !== originalEntry) {
                console.warn('CopilotPromptTracker: Sensitive content detected and redacted from prompt entry');
                vscode.window.showWarningMessage(
                    'Sensitive data detected and removed from prompt before saving (API keys, passwords, etc.)'
                );
            }

            // Save to GitHub
            console.log(`CopilotPromptTracker: Saving to GitHub ${owner}/${repo} in ${config.saveLocation}`);
            const saved = await this.githubService.savePromptToRepository(
                owner,
                repo,
                sanitizedPromptEntry,
                config.saveLocation
            );

            if (saved) {
                console.log('CopilotPromptTracker: Prompt saved successfully');
                vscode.window.showInformationMessage(
                    `Prompt saved to ${config.githubRepo}/${config.saveLocation}`
                );
                
                // Refresh the prompt view if available
                if (this.promptViewRefreshCallback) {
                    console.log('CopilotPromptTracker: Refreshing prompt view');
                    this.promptViewRefreshCallback();
                }
            } else {
                console.error('CopilotPromptTracker: Failed to save prompt');
                vscode.window.showErrorMessage('Failed to save prompt to GitHub.');
            }

        } catch (error) {
            console.error('CopilotPromptTracker: Error in savePrompt:', error);
            vscode.window.showErrorMessage(
                `Failed to save prompt: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    public async viewHistory(): Promise<void> {
        const config = this.configManager.getConfiguration();

        if (!this.configManager.isConfigured()) {
            vscode.window.showWarningMessage('Please configure GitHub repository first.');
            return;
        }

        try {
            const [owner, repo] = config.githubRepo.split('/');

            // Get list of projects first
            const projects = await this.githubService.getProjectList(owner, repo, config.saveLocation);

            if (projects.length === 0) {
                const repoUrl = `https://github.com/${config.githubRepo}`;
                await vscode.env.openExternal(vscode.Uri.parse(repoUrl));
                vscode.window.showInformationMessage('No prompts found yet. Repository opened in browser.');
                return;
            }

            const options = [
                { label: 'All Projects', description: 'View prompts from all projects' },
                ...projects.map(project => ({
                    label: project,
                    description: `View prompts from ${project}`
                }))
            ];

            const choice = await vscode.window.showQuickPick(options, {
                placeHolder: 'Select project to view prompts from'
            });

            if (!choice) {
                return;
            }

            let prompts: PromptEntry[];
            if (choice.label === 'All Projects') {
                prompts = await this.githubService.listPrompts(owner, repo, config.saveLocation);
            } else {
                prompts = await this.githubService.listPrompts(owner, repo, config.saveLocation, choice.label);
            }

            if (prompts.length === 0) {
                vscode.window.showInformationMessage(`No prompts found for ${choice.label}.`);
                return;
            }

            // Create webview to display history
            const panel = vscode.window.createWebviewPanel(
                'promptHistory',
                `Copilot Prompt History - ${choice.label}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.generateHistoryHTML(prompts, choice.label);

        } catch (error) {
            console.error('Error viewing history:', error);
            // Fallback to opening main repository
            const repoUrl = `https://github.com/${config.githubRepo}`;
            await vscode.env.openExternal(vscode.Uri.parse(repoUrl));
            vscode.window.showWarningMessage('Failed to get project list. Opened main repository instead.');
        }
    }

    private generateHistoryHTML(prompts: PromptEntry[], projectFilter?: string): string {
        const promptItems = prompts.map(prompt => `
            <div class="prompt-item">
                <div class="prompt-header">
                    <span class="timestamp">${new Date(prompt.timestamp).toLocaleString()}</span>
                    <span class="commit">${prompt.gitInfo.commitHash.substring(0, 7)}</span>
                    <span class="branch">${prompt.gitInfo.branch}</span>
                    <span class="project">${prompt.gitInfo.repository.split('/').pop()?.replace('.git', '') || 'Unknown'}</span>
                </div>
                <div class="prompt-content">
                    <h4>Prompt:</h4>
                    <p>${prompt.prompt}</p>
                    ${prompt.response ? `
                        <h4>Response:</h4>
                        <p>${prompt.response}</p>
                    ` : ''}
                </div>
                <div class="git-info">
                    <small>Repository: ${prompt.gitInfo.repository} | Author: ${prompt.gitInfo.author}</small>
                    ${prompt.gitInfo.changedFiles.length > 0 ? `
                        <br><small>Changed files: ${prompt.gitInfo.changedFiles.join(', ')}</small>
                    ` : ''}
                </div>
            </div>
        `).join('');

        const title = projectFilter ? `Copilot Prompt History - ${projectFilter}` : 'Copilot Prompt History';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
                    .prompt-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
                    .prompt-header { display: flex; gap: 10px; margin-bottom: 10px; font-size: 0.9em; flex-wrap: wrap; }
                    .timestamp { color: #666; }
                    .commit { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
                    .branch { background: #e1f5fe; padding: 2px 6px; border-radius: 3px; }
                    .project { background: #f3e5f5; padding: 2px 6px; border-radius: 3px; }
                    .prompt-content h4 { margin: 10px 0 5px 0; color: #333; }
                    .prompt-content p { margin: 5px 0 10px 0; line-height: 1.4; }
                    .git-info { color: #666; font-size: 0.8em; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <p>Total prompts: ${prompts.length}</p>
                ${promptItems}
            </body>
            </html>
        `;
    }

    public async viewProjectPrompts(): Promise<void> {
        const config = this.configManager.getConfiguration();

        if (!this.configManager.isConfigured()) {
            vscode.window.showWarningMessage('Please configure GitHub repository first.');
            return;
        }

        const [owner, repo] = config.githubRepo.split('/');

        try {
            // Get current git info to suggest current project
            const gitInfo = await this.gitService.getCurrentGitInfo();
            let currentProject: string | undefined;

            if (gitInfo) {
                // Extract project name from current repository
                currentProject = gitInfo.repository.split('/').pop()?.replace('.git', '');
            }

            // Get list of all projects
            const projects = await this.githubService.getProjectList(owner, repo, config.saveLocation);

            if (projects.length === 0) {
                vscode.window.showInformationMessage('No project prompts found yet.');
                return;
            }

            // Sort projects with current project first
            const sortedProjects = projects.sort((a, b) => {
                if (currentProject) {
                    if (a === currentProject) {
                        return -1;
                    }
                    if (b === currentProject) {
                        return 1;
                    }
                }
                return a.localeCompare(b);
            });

            const options = sortedProjects.map(project => ({
                label: project,
                description: project === currentProject ? '(Current project)' : undefined
            }));

            const choice = await vscode.window.showQuickPick(options, {
                placeHolder: 'Select project to view prompts'
            });

            if (!choice) {
                return;
            }

            const repoUrl = `https://github.com/${config.githubRepo}/tree/main/${config.saveLocation}/${choice.label}`;
            await vscode.env.openExternal(vscode.Uri.parse(repoUrl));
            vscode.window.showInformationMessage(`Opened ${choice.label} prompts in browser.`);

        } catch (error) {
            console.error('Failed to view project prompts:', error);
            vscode.window.showErrorMessage('Failed to retrieve project prompts.');
        }
    }

    public async toggle(): Promise<void> {
        const config = this.configManager.getConfiguration();
        const newState = !config.enabled;

        await this.configManager.updateConfiguration('enabled', newState);

        vscode.window.showInformationMessage(
            `Copilot Prompt Tracker ${newState ? 'enabled' : 'disabled'}`
        );

        this.updateStatusBar();
    }

    private updateStatusBar(): void {
        const config = this.configManager.getConfiguration();

        if (!this.configManager.isConfigured()) {
            this.statusBarItem.text = '$(gear) Configure Copilot Tracker';
            this.statusBarItem.tooltip = 'Click to configure GitHub repository';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (config.enabled) {
            this.statusBarItem.text = '$(check) Copilot Tracker';
            this.statusBarItem.tooltip = `Tracking prompts to ${config.githubRepo}`;
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = '$(x) Copilot Tracker';
            this.statusBarItem.tooltip = 'Copilot tracking disabled';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    public async signOut(): Promise<void> {
        try {
            await this.githubService.signOut();
            this.updateStatusBar();
            vscode.window.showInformationMessage('Successfully signed out from GitHub');
        } catch (error) {
            console.error('Error during sign out:', error);
            vscode.window.showErrorMessage('Failed to sign out from GitHub');
        }
    }

    public async validateProjectConfiguration(): Promise<boolean> {
        console.log('CopilotPromptTracker: Validating project configuration');
        
        // Check if global configuration exists
        if (!this.configManager.isConfigured()) {
            vscode.window.showWarningMessage(
                'Copilot Prompt Tracker is not configured.',
                'Configure Now'
            ).then(selection => {
                if (selection === 'Configure Now') {
                    vscode.commands.executeCommand('copilotPromptTracker.configure');
                }
            });
            return false;
        }

        const config = this.configManager.getConfiguration();
        
        if (!config.enabled) {
            vscode.window.showWarningMessage(
                'Copilot prompt tracking is disabled.',
                'Enable Tracking'
            ).then(selection => {
                if (selection === 'Enable Tracking') {
                    vscode.commands.executeCommand('copilotPromptTracker.toggle');
                }
            });
            return false;
        }

        if (!config.githubRepo) {
            vscode.window.showWarningMessage(
                'No GitHub repository configured.',
                'Configure Repository'
            ).then(selection => {
                if (selection === 'Configure Repository') {
                    vscode.commands.executeCommand('copilotPromptTracker.configure');
                }
            });
            return false;
        }

        // Validate repository format
        const repoParts = config.githubRepo.split('/');
        if (repoParts.length !== 2) {
            vscode.window.showErrorMessage(
                `Invalid repository format: ${config.githubRepo}. Expected format: owner/repo-name`,
                'Fix Configuration'
            ).then(selection => {
                if (selection === 'Fix Configuration') {
                    vscode.commands.executeCommand('copilotPromptTracker.configure');
                }
            });
            return false;
        }

        console.log(`CopilotPromptTracker: Configuration valid for repository: ${config.githubRepo}`);
        return true;
    }

    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
    }
}
