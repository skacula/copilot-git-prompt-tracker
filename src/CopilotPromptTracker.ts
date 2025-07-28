import * as vscode from 'vscode';
import { ConfigurationManager } from './ConfigurationManager';
import { GitService, GitInfo } from './GitService';
import { GitHubService, PromptEntry } from './GitHubService';
import { CopilotChatReader } from './CopilotChatReader';
import { ContentSanitizer } from './ContentSanitizer';
import { CopilotSessionMonitor, DevelopmentSession, AIInteraction } from './CopilotSessionMonitor';
import { CopilotIntegrationService } from './CopilotIntegrationService';
import { SmartSessionManager } from './SmartSessionManager';
import { BackgroundMonitoringService } from './BackgroundMonitoringService';

export class CopilotPromptTracker implements vscode.Disposable {
    private readonly context: vscode.ExtensionContext;
    private readonly configManager: ConfigurationManager;
    private readonly gitService: GitService;
    private readonly githubService: GitHubService;
    private readonly copilotChatReader: CopilotChatReader;
    private readonly sessionMonitor: CopilotSessionMonitor;
    private readonly copilotIntegrationService: CopilotIntegrationService;
    private readonly smartSessionManager: SmartSessionManager;
    private readonly backgroundMonitoringService: BackgroundMonitoringService;
    private readonly disposables: vscode.Disposable[] = [];
    private statusBarItem: vscode.StatusBarItem;
    private autoCorrelationEnabled: boolean = true;

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
        this.copilotIntegrationService = new CopilotIntegrationService();
        this.smartSessionManager = new SmartSessionManager(this.sessionMonitor);
        this.backgroundMonitoringService = new BackgroundMonitoringService(
            this.configManager,
            this.gitService,
            this.copilotIntegrationService,
            this.smartSessionManager,
            this.sessionMonitor,
            this.githubService
        );

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

        // Set up automated Copilot interaction monitoring
        this.setupAutomatedCopilotMonitoring();

        // Set up automated Git commit monitoring with auto-correlation
        this.setupAutomatedGitCommitMonitoring();

        // Set up periodic cleanup
        this.setupPeriodicMaintenance();
    }

    private setupAutomatedCopilotMonitoring(): void {
        console.log('CopilotPromptTracker: Setting up automated Copilot interaction monitoring');
        
        // Register commands for manual interaction capture (backward compatibility)
        this.registerCopilotCaptureCommands();
        
        // Set up automatic Copilot interaction detection
        const copilotListener = this.copilotIntegrationService.onInteractionDetected((interaction) => {
            this.sessionMonitor.addInteraction(interaction);
            this.updateStatusBar();
            console.log(`CopilotPromptTracker: Auto-detected ${interaction.interactionType} interaction`);
        });
        this.disposables.push(copilotListener);
        
        // Keep the existing manual detection for fallback
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

        // Command to toggle auto-correlation
        const toggleAutoCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.toggleAutoCorrelation',
            async () => {
                await this.toggleAutoCorrelation();
            }
        );
        this.disposables.push(toggleAutoCommand);

        // Command to show automation status
        const statusCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.showAutomationStatus',
            async () => {
                await this.showAutomationStatus();
            }
        );
        this.disposables.push(statusCommand);

        // Command to show session insights
        const insightsCommand = vscode.commands.registerCommand(
            'copilotPromptTracker.showSessionInsights',
            async () => {
                await this.showSessionInsights();
            }
        );
        this.disposables.push(insightsCommand);
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

    private setupAutomatedGitCommitMonitoring(): void {
        console.log('CopilotPromptTracker: Setting up automated Git commit monitoring');
        
        // Set up automatic commit detection and correlation
        const commitListener = this.gitService.onCommit(async (commitInfo) => {
            if (this.autoCorrelationEnabled) {
                await this.handleAutomaticCommitCorrelation(commitInfo);
            }
        });
        this.disposables.push(commitListener);
        
        console.log('CopilotPromptTracker: Automated Git commit monitoring enabled');
    }

    private setupPeriodicMaintenance(): void {
        // Skip periodic maintenance in test environment to prevent extension host issues
        if (this.isTestEnvironment()) {
            console.log('CopilotPromptTracker: Test environment detected, skipping periodic maintenance');
            return;
        }

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
                const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
                    prompt: `Code generation in ${event.document.fileName}`,
                    response: change.text,
                    aiProvider: 'other',
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
            // For backward compatibility, still allow manual input
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

            // Use the CopilotIntegrationService for consistent handling
            this.copilotIntegrationService.captureManualInteraction(prompt, response);
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

        // Use the CopilotIntegrationService for consistent handling
        this.copilotIntegrationService.captureManualInteraction(prompt, response);
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
        // Manual correlation (backward compatibility)
        await this.performCommitCorrelation('manual');
    }

    /**
     * Handle automatic commit correlation when a commit is detected
     */
    private async handleAutomaticCommitCorrelation(commitInfo: GitInfo & { changedFiles: string[] }): Promise<void> {
        console.log(`CopilotPromptTracker: Auto-correlating session with commit ${commitInfo.commitHash}`);
        
        const config = this.configManager.getConfiguration();
        if (!config) {
            console.log('CopilotPromptTracker: Repository not configured, skipping auto-correlation');
            return;
        }

        try {
            // Check if there are any interactions to correlate
            const currentSession = this.sessionMonitor.getCurrentSession();
            if (!currentSession || currentSession.interactions.length === 0) {
                console.log('CopilotPromptTracker: No interactions to correlate with commit');
                return;
            }

            // Finalize session with commit info
            const finalizedSession = this.sessionMonitor.finalizeSessionWithCommit({
                commitHash: commitInfo.commitHash,
                branch: commitInfo.branch,
                author: commitInfo.author,
                repository: commitInfo.repository,
                changedFiles: commitInfo.changedFiles,
                commitMessage: commitInfo.message || 'Automatic correlation'
            });

            if (finalizedSession) {
                // Save session to GitHub
                await this.saveSessionToGitHub(finalizedSession);
                
                // Show subtle notification
                const message = `Auto-saved ${finalizedSession.interactions.length} Copilot interactions for commit ${commitInfo.commitHash.substring(0, 7)}`;
                vscode.window.showInformationMessage(message);
                
                console.log(`CopilotPromptTracker: Successfully auto-correlated session with ${finalizedSession.interactions.length} interactions`);
            }

        } catch (error) {
            console.error('CopilotPromptTracker: Error in automatic commit correlation:', error);
            // Don't show error to user for automatic operations, just log
        }
    }

    /**
     * Perform commit correlation (shared by manual and automatic flows)
     */
    private async performCommitCorrelation(source: 'manual' | 'automatic'): Promise<void> {
        const config = this.configManager.getConfiguration();
        if (!config) {
            if (source === 'manual') {
                const action = 'Configure Repository';
                const result = await vscode.window.showWarningMessage(
                    'Repository not configured. Please configure a GitHub repository to save prompts.',
                    action
                );
                if (result === action) {
                    await this.configure();
                }
            }
            return;
        }

        try {
            // Get current Git information
            const gitInfo = await this.gitService.getCurrentGitInfo();
            if (!gitInfo) {
                if (source === 'manual') {
                    vscode.window.showErrorMessage('Unable to get Git information. Make sure you\'re in a Git repository.');
                }
                return;
            }

            // Get changed files
            const changedFiles = await this.gitService.getChangedFiles();

            // Finalize current session with commit info
            const finalizedSession = this.sessionMonitor.finalizeSessionWithCommit({
                commitHash: gitInfo.commitHash,
                branch: gitInfo.branch,
                author: gitInfo.author,
                repository: gitInfo.repository,
                changedFiles,
                commitMessage: gitInfo.message || `${source} correlation`
            });

            if (!finalizedSession) {
                if (source === 'manual') {
                    vscode.window.showWarningMessage('No interactions to correlate with commit');
                }
                return;
            }

            // Save session to GitHub
            await this.saveSessionToGitHub(finalizedSession);
            
            if (source === 'manual') {
                vscode.window.showInformationMessage(
                    `Session correlated with commit ${gitInfo.commitHash.substring(0, 7)} and saved to GitHub!`
                );
            }

        } catch (error) {
            console.error('Error correlating session with commit:', error);
            if (source === 'manual') {
                vscode.window.showErrorMessage('Failed to correlate session with commit');
            }
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

    // Note: extractFileContext method removed as it's no longer used
    // File context is now handled directly in session formatting methods

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
        const monitoringStats = this.backgroundMonitoringService.getMonitoringStats();
        
        if (config) {
            const autoStatus = this.autoCorrelationEnabled ? '🤖' : '⏸️';
            this.statusBarItem.text = `$(copilot) ${interactionCount} ${autoStatus}`;
            
            const effectiveness = Math.round(monitoringStats.automationEffectiveness);
            this.statusBarItem.tooltip = `Copilot Tracker: ${interactionCount} interactions in current session\n` +
                `Repository: ${config.githubRepo}\n` +
                `Auto-correlation: ${this.autoCorrelationEnabled ? 'Enabled' : 'Disabled'}\n` +
                `Automation effectiveness: ${effectiveness}%\n` +
                `Total detected: ${monitoringStats.interactionsDetected}\n` +
                `Commits correlated: ${monitoringStats.commitsCorrelated}\n` +
                `Click to view session details`;
        } else {
            this.statusBarItem.text = '$(copilot) Not configured';
            this.statusBarItem.tooltip = 'Copilot Tracker: Click to configure repository';
        }
    }

    /**
     * Toggle automatic commit correlation
     */
    private async toggleAutoCorrelation(): Promise<void> {
        this.autoCorrelationEnabled = !this.autoCorrelationEnabled;
        
        // Update background monitoring service configuration
        this.backgroundMonitoringService.updateAutomationConfig({
            autoCorrelationEnabled: this.autoCorrelationEnabled
        });
        
        const status = this.autoCorrelationEnabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`Automatic commit correlation ${status}`);
        
        this.updateStatusBar();
        console.log(`CopilotPromptTracker: Auto-correlation ${status}`);
    }

    /**
     * Show comprehensive automation status
     */
    private async showAutomationStatus(): Promise<void> {
        const statusReport = this.backgroundMonitoringService.getStatusReport();
        const analytics = this.smartSessionManager.getDevelopmentAnalytics();
        
        const statusMessage = `🤖 AUTOMATION STATUS\n\n` +
            `📊 Statistics:\n` +
            `• Sessions monitored: ${statusReport.stats.sessionsMonitored}\n` +
            `• Interactions detected: ${statusReport.stats.interactionsDetected}\n` +
            `• Commits auto-correlated: ${statusReport.stats.commitsCorrelated}\n` +
            `• Background operations: ${statusReport.stats.backgroundOperationsCount}\n\n` +
            `⚡ Performance:\n` +
            `• Automation effectiveness: ${Math.round(statusReport.stats.automationEffectiveness)}%\n` +
            `• Average session quality: ${Math.round(statusReport.stats.averageSessionQuality)}%\n` +
            `• Queue length: ${statusReport.queueLength}\n\n` +
            `⚙️ Configuration:\n` +
            `• Auto-correlation: ${statusReport.config.autoCorrelationEnabled ? 'ON' : 'OFF'}\n` +
            `• Enhanced detection: ${statusReport.config.enhancedCopilotDetection ? 'ON' : 'OFF'}\n` +
            `• Detection sensitivity: ${statusReport.config.detectionSensitivity.toUpperCase()}\n` +
            `• Quiet hours: ${statusReport.isQuietHours ? 'ACTIVE' : 'INACTIVE'}\n\n` +
            `🕐 Working Hours: ${analytics.workingHours.start}:00 - ${analytics.workingHours.end}:00`;
        
        vscode.window.showInformationMessage(statusMessage, { modal: true });
    }

    /**
     * Show session insights and recommendations
     */
    private async showSessionInsights(): Promise<void> {
        const currentSession = this.sessionMonitor.getCurrentSession();
        if (!currentSession) {
            vscode.window.showInformationMessage('No active session to analyze');
            return;
        }
        
        const insights = this.smartSessionManager.analyzeSessionQuality(currentSession);
        const analytics = this.smartSessionManager.getDevelopmentAnalytics();
        
        const insightsMessage = `🧠 SESSION INSIGHTS\n\n` +
            `📈 Current Session (${currentSession.sessionId}): \n` +
            `• Quality: ${insights.sessionQuality.toUpperCase()}\n` +
            `• Productivity score: ${Math.round(insights.productivityScore)}/100\n` +
            `• Focus level: ${Math.round(insights.focusLevel)}/100\n` +
            `• Copilot dependency: ${Math.round(insights.copilotDependency)}%\n` +
            `• Total interactions: ${currentSession.interactions.length}\n\n` +
            `💡 Recommendations:\n` +
            insights.recommendations.map(rec => `• ${rec}`).join('\n') +
            `\n\n📊 Overall Analytics:\n` +
            `• Average session quality: ${Math.round(analytics.averageSessionQuality)}/100\n` +
            `• Total sessions analyzed: ${analytics.totalSessions}\n` +
            `• Top recommendations:\n` +
            analytics.topRecommendations.slice(0, 2).map(rec => `  - ${rec}`).join('\n');
        
        vscode.window.showInformationMessage(insightsMessage, { modal: true });
    }

    private isTestEnvironment(): boolean {
        // Detect if running in test environment
        return process.env.NODE_ENV === 'test' || 
               process.env.VSCODE_TEST === 'true' ||
               typeof global !== 'undefined' && (global as any).suite !== undefined;
    }

    public dispose(): void {
        console.log('CopilotPromptTracker: Starting disposal...');
        
        // Dispose of all registered disposables first
        this.disposables.forEach(d => {
            try {
                d.dispose();
            } catch (error) {
                console.error('Error disposing resource:', error);
            }
        });
        
        // Clear the disposables array
        this.disposables.length = 0;
        
        // Dispose of services in reverse order of initialization
        try {
            this.backgroundMonitoringService.dispose();
        } catch (error) {
            console.error('Error disposing backgroundMonitoringService:', error);
        }
        
        try {
            this.smartSessionManager.dispose();
        } catch (error) {
            console.error('Error disposing smartSessionManager:', error);
        }
        
        try {
            this.copilotIntegrationService.dispose();
        } catch (error) {
            console.error('Error disposing copilotIntegrationService:', error);
        }
        
        try {
            this.gitService.dispose();
        } catch (error) {
            console.error('Error disposing gitService:', error);
        }
        
        try {
            this.githubService.dispose();
        } catch (error) {
            console.error('Error disposing githubService:', error);
        }
        
        console.log('CopilotPromptTracker: Disposal completed');
    }
}
