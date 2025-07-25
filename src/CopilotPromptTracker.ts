import * as vscode from 'vscode';
import { ConfigurationManager } from './ConfigurationManager';
import { GitService, GitInfo } from './GitService';
import { GitHubService, PromptEntry } from './GitHubService';
import { CopilotChatReader } from './CopilotChatReader';
import { ContentSanitizer } from './ContentSanitizer';
import { CopilotSessionMonitor, DevelopmentSession, CopilotInteraction } from './CopilotSessionMonitor';

export class CopilotPromptTracker implements vscode.Disposable {
    private readonly context: vscode.ExtensionContext;
    private readonly configManager: ConfigurationManager;
    private readonly gitService: GitService;
    private readonly githubService: GitHubService;
    private readonly copilotChatReader: CopilotChatReader;
    private readonly sessionMonitor: CopilotSessionMonitor;
    private readonly disposables: vscode.Disposable[] = [];
    private statusBarItem: vscode.StatusBarItem;

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
        this.sessionMonitor = new CopilotSessionMonitor(context.extension.packageJSON.version);

        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'copilotPromptTracker.showSession';
        this.updateStatusBar();
        this.statusBarItem.show();
        this.disposables.push(this.statusBarItem);
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

        // Set up Copilot interaction monitoring
        this.setupCopilotMonitoring();

        // Set up Git commit monitoring
        this.setupGitCommitMonitoring();

        // Set up periodic cleanup
        this.setupPeriodicMaintenance();
    }

    private setupCopilotMonitoring(): void {
        console.log('CopilotPromptTracker: Setting up Copilot interaction monitoring');
        
        // Register commands for manual interaction capture
        this.registerCopilotCaptureCommands();
        
        // Try to set up automatic monitoring (limited by VS Code API)
        this.setupAutomaticCopilotDetection();
    }

    private registerCopilotCaptureCommands(): void {
        // Command to manually capture last Copilot interaction
        const captureCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.captureLastCopilotChat',
            async () => {
                await this.captureLastCopilotInteraction();
            }
        );
        this.disposables.push(captureCommand);

        // Command to manually record a Copilot interaction
        const recordCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.recordInteraction',
            async () => {
                await this.recordCopilotInteractionManually();
            }
        );
        this.disposables.push(recordCommand);

        // Command to show current session
        const showSessionCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.showSession',
            async () => {
                await this.showCurrentSession();
            }
        );
        this.disposables.push(showSessionCommand);

        // Command to trigger commit correlation
        const commitCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.correlateWithCommit',
            async () => {
                await this.correlateSessionWithCommit();
            }
        );
        this.disposables.push(commitCommand);

        // Command to configure repository
        const configCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.configure',
            async () => {
                await this.configure();
            }
        );
        this.disposables.push(configCommand);
    }

    private setupAutomaticCopilotDetection(): void {
        // Monitor text document changes for potential Copilot interactions
        const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
            this.detectPotentialCopilotInteraction(event);
        });
        this.disposables.push(changeListener);

        // Monitor active editor changes
        const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.trackEditorContext(editor);
            }
        });
        this.disposables.push(editorChangeListener);
    }

    private setupGitCommitMonitoring(): void {
        // Unfortunately, VS Code doesn't provide direct Git commit events
        // We'll need to periodically check for new commits or rely on manual triggering
        console.log('CopilotPromptTracker: Git commit monitoring relies on manual correlation');
    }

    private setupPeriodicMaintenance(): void {
        // Clean up old sessions every hour
        const maintenanceInterval = setInterval(() => {
            this.sessionMonitor.cleanupOldSessions();
            this.sessionMonitor.checkSessionTimeout();
        }, 60 * 60 * 1000); // 1 hour

        this.disposables.push({
            dispose: () => clearInterval(maintenanceInterval)
        });
    }

    private async detectPotentialCopilotInteraction(event: vscode.TextDocumentChangeEvent): Promise<void> {
        // Look for patterns that might indicate Copilot suggestions
        for (const change of event.contentChanges) {
            if (change.text.length > 50) { // Significant additions might be Copilot
                const interaction: Omit<CopilotInteraction, 'id' | 'timestamp'> = {
                    prompt: `Code generation in ${event.document.fileName}`,
                    response: change.text,
                    fileContext: {
                        fileName: event.document.fileName,
                        language: event.document.languageId,
                        selection: change.range ? {
                            start: { line: change.range.start.line, character: change.range.start.character },
                            end: { line: change.range.end.line, character: change.range.end.character }
                        } : undefined,
                        content: change.text
                    },
                    interactionType: 'inline'
                };

                this.sessionMonitor.addInteraction(interaction);
                console.log('CopilotPromptTracker: Detected potential Copilot interaction');
            }
        }
    }

    private trackEditorContext(editor: vscode.TextEditor): void {
        // Track current file context for future interactions
        console.log(`CopilotPromptTracker: Tracking context for ${editor.document.fileName}`);
    }

    private async captureLastCopilotInteraction(): Promise<void> {
        try {
            // For now, simulate getting interaction since we can't directly access Copilot chat
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter your last prompt to Copilot',
                placeHolder: 'What did you ask Copilot?'
            });

            if (!prompt) {
                return;
            }

            const response = await vscode.window.showInputBox({
                prompt: 'Enter Copilot\'s response (optional)',
                placeHolder: 'What did Copilot respond?'
            });

            const activeEditor = vscode.window.activeTextEditor;
            const interaction: Omit<CopilotInteraction, 'id' | 'timestamp'> = {
                prompt,
                response,
                fileContext: activeEditor ? {
                    fileName: activeEditor.document.fileName,
                    language: activeEditor.document.languageId,
                    selection: !activeEditor.selection.isEmpty ? {
                        start: { 
                            line: activeEditor.selection.start.line, 
                            character: activeEditor.selection.start.character 
                        },
                        end: { 
                            line: activeEditor.selection.end.line, 
                            character: activeEditor.selection.end.character 
                        }
                    } : undefined
                } : undefined,
                interactionType: 'chat'
            };

            this.sessionMonitor.addInteraction(interaction);
            vscode.window.showInformationMessage('Copilot interaction captured!');
        } catch (error) {
            console.error('Error capturing Copilot interaction:', error);
            vscode.window.showErrorMessage('Failed to capture Copilot interaction');
        }
    }

    private async recordCopilotInteractionManually(): Promise<void> {
        const prompt = await vscode.window.showInputBox({
            prompt: 'Enter the prompt you sent to Copilot',
            placeHolder: 'What did you ask Copilot?'
        });

        if (!prompt) {
            return;
        }

        const response = await vscode.window.showInputBox({
            prompt: 'Enter Copilot\'s response (optional)',
            placeHolder: 'What did Copilot respond?'
        });

        const activeEditor = vscode.window.activeTextEditor;
        const interaction: Omit<CopilotInteraction, 'id' | 'timestamp'> = {
            prompt,
            response,
            fileContext: activeEditor ? {
                fileName: activeEditor.document.fileName,
                language: activeEditor.document.languageId,
                selection: !activeEditor.selection.isEmpty ? {
                    start: { 
                        line: activeEditor.selection.start.line, 
                        character: activeEditor.selection.start.character 
                    },
                    end: { 
                        line: activeEditor.selection.end.line, 
                        character: activeEditor.selection.end.character 
                    }
                } : undefined
            } : undefined,
            interactionType: 'chat'
        };

        this.sessionMonitor.addInteraction(interaction);
        vscode.window.showInformationMessage('Copilot interaction recorded!');
    }

    private async showCurrentSession(): Promise<void> {
        const session = this.sessionMonitor.getCurrentSession();
        if (!session) {
            vscode.window.showInformationMessage('No active session');
            return;
        }

        const recentInteractions = this.sessionMonitor.getRecentInteractions(5);
        const interactionSummary = recentInteractions.map((interaction, index) => 
            `${index + 1}. [${interaction.interactionType}] ${interaction.prompt.substring(0, 50)}...`
        ).join('\n');

        const message = `Current Session: ${session.sessionId}
Started: ${new Date(session.startTime).toLocaleString()}
Interactions: ${session.interactions.length}

Recent interactions:
${interactionSummary || 'No interactions yet'}`;

        vscode.window.showInformationMessage(message, { modal: true });
    }

    private async correlateSessionWithCommit(): Promise<void> {
        const config = this.configManager.getConfiguration();
        if (!config) {
            const action = 'Configure Repository';
            const result = await vscode.window.showWarningMessage(
                'Repository not configured. Please configure a GitHub repository to save prompts.',
                action
            );
            if (result === action) {
                await this.configure();
            }
            return;
        }

        try {
            // Get current Git information
            const gitInfo = await this.gitService.getCurrentGitInfo();
            if (!gitInfo) {
                vscode.window.showErrorMessage('Unable to get Git information. Make sure you\'re in a Git repository.');
                return;
            }

            // Finalize current session with commit info
            const finalizedSession = this.sessionMonitor.finalizeSessionWithCommit({
                commitHash: gitInfo.commitHash,
                branch: gitInfo.branch,
                author: gitInfo.author,
                repository: gitInfo.repository,
                changedFiles: [], // No changed files info in current GitInfo
                commitMessage: gitInfo.message || 'Manual correlation'
            });

            if (!finalizedSession) {
                vscode.window.showWarningMessage('No interactions to correlate with commit');
                return;
            }

            // Save session to GitHub
            await this.saveSessionToGitHub(finalizedSession);
            
            vscode.window.showInformationMessage(
                `Session correlated with commit ${gitInfo.commitHash.substring(0, 7)} and saved to GitHub!`
            );

        } catch (error) {
            console.error('Error correlating session with commit:', error);
            vscode.window.showErrorMessage('Failed to correlate session with commit');
        }
    }

    private async saveSessionToGitHub(session: DevelopmentSession): Promise<void> {
        const config = this.configManager.getConfiguration();
        if (!config) {
            throw new Error('Repository not configured');
        }

        // Sanitize all interaction content
        const sanitizedSession = await this.sanitizeSession(session);

        // Convert session to prompt entry format
        const promptEntry: PromptEntry = {
            prompt: this.formatSessionAsPrompt(sanitizedSession),
            response: this.formatSessionResponse(sanitizedSession),
            timestamp: sanitizedSession.endTime || sanitizedSession.startTime,
            gitInfo: {
                commitHash: sanitizedSession.gitInfo?.commitHash || 'unknown',
                branch: sanitizedSession.gitInfo?.branch || 'unknown',
                author: sanitizedSession.gitInfo?.author || 'unknown',
                repository: sanitizedSession.gitInfo?.repository || 'unknown',
                changedFiles: sanitizedSession.gitInfo?.changedFiles || []
            },
            metadata: {
                vscodeVersion: sanitizedSession.metadata.vscodeVersion,
                extensionVersion: sanitizedSession.metadata.extensionVersion
            }
        };

        await this.githubService.savePromptToRepository(
            config.githubRepo.split('/')[0],
            config.githubRepo.split('/')[1],
            promptEntry,
            config.saveLocation
        );
    }

    private async sanitizeSession(session: DevelopmentSession): Promise<DevelopmentSession> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const sanitizedInteractions = await Promise.all(
            session.interactions.map(async (interaction) => ({
                ...interaction,
                prompt: await ContentSanitizer.sanitizeContent(interaction.prompt, workspaceRoot),
                response: interaction.response ? await ContentSanitizer.sanitizeContent(interaction.response, workspaceRoot) : undefined,
                fileContext: interaction.fileContext ? {
                    ...interaction.fileContext,
                    content: interaction.fileContext.content ? 
                        await ContentSanitizer.sanitizeContent(interaction.fileContext.content, workspaceRoot) : undefined
                } : undefined
            }))
        );

        return {
            ...session,
            interactions: sanitizedInteractions
        };
    }

    private formatSessionAsPrompt(session: DevelopmentSession): string {
        const interactions = session.interactions
            .map((interaction, index) => 
                `[${index + 1}] ${interaction.interactionType.toUpperCase()}: ${interaction.prompt}`
            )
            .join('\n\n');

        return `Development Session: ${session.sessionId}
Duration: ${session.startTime} to ${session.endTime || 'ongoing'}
Total Interactions: ${session.interactions.length}

Copilot Interactions:
${interactions}`;
    }

    private formatSessionResponse(session: DevelopmentSession): string {
        const responses = session.interactions
            .filter(interaction => interaction.response)
            .map((interaction, index) => 
                `[${index + 1}] ${interaction.response}`
            )
            .join('\n\n');

        return responses || 'No responses captured';
    }

    private extractFileContext(session: DevelopmentSession): any {
        const fileContexts = session.interactions
            .map(interaction => interaction.fileContext)
            .filter(context => context !== undefined);

        if (fileContexts.length === 0) {
            return undefined;
        }

        // Return summary of all file contexts
        const uniqueFiles = [...new Set(fileContexts.map(context => context!.fileName))];
        return {
            files: uniqueFiles,
            languages: [...new Set(fileContexts.map(context => context!.language))],
            totalContexts: fileContexts.length
        };
    }

    private async configure(): Promise<void> {
        const result = await this.showConfigurationDialog();
        if (result.success) {
            this.updateStatusBar();
            vscode.window.showInformationMessage('Repository configured successfully!');
        }
    }

    private async showConfigurationDialog(): Promise<{ success: boolean }> {
        const githubRepo = await vscode.window.showInputBox({
            prompt: 'Enter GitHub repository (owner/repo)',
            placeHolder: 'e.g., username/my-repo',
            value: this.configManager.getConfiguration().githubRepo
        });

        if (githubRepo) {
            await this.configManager.updateConfiguration('githubRepo', githubRepo);
            return { success: true };
        }

        return { success: false };
    }

    private updateStatusBar(): void {
        const config = this.configManager.getConfiguration();
        const session = this.sessionMonitor.getCurrentSession();
        const interactionCount = session?.interactions.length || 0;
        
        if (config) {
            this.statusBarItem.text = `$(copilot) ${interactionCount} interactions`;
            this.statusBarItem.tooltip = `Copilot Tracker: ${interactionCount} interactions in current session\nRepository: ${config.githubRepo}\nClick to view session`;
        } else {
            this.statusBarItem.text = '$(copilot) Not configured';
            this.statusBarItem.tooltip = 'Copilot Tracker: Click to configure repository';
        }
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}
