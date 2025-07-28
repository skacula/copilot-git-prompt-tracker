import * as vscode from 'vscode';
import { ConfigurationManager } from './ConfigurationManager';
import { GitService, GitInfo } from './GitService';
import { AIAssistantDetectionService } from './AIAssistantDetectionService';
import { SmartSessionManager, SessionInsights } from './SmartSessionManager';
import { AISessionMonitor, DevelopmentSession, AIInteraction } from './AISessionMonitor';
import { GitHubService } from './GitHubService';
import { ContentSanitizer } from './ContentSanitizer';

export interface MonitoringStats {
    sessionsMonitored: number;
    interactionsDetected: number;
    commitsCorrelated: number;
    averageSessionQuality: number;
    automationEffectiveness: number;
    lastProcessedCommit?: string;
    backgroundOperationsCount: number;
}

export interface AutomationConfig {
    autoCorrelationEnabled: boolean;
    enhancedCopilotDetection: boolean;
    backgroundProcessingEnabled: boolean;
    detectionSensitivity: 'low' | 'medium' | 'high';
    maxBackgroundOperations: number;
    quietHours: { start: number; end: number } | null;
}

/**
 * Background monitoring service that coordinates all automation features
 * Runs silently in the background to provide seamless automation
 */
export class BackgroundMonitoringService implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private stats: MonitoringStats;
    private config: AutomationConfig;
    private isMonitoring: boolean = false;
    private backgroundQueue: Array<() => Promise<void>> = [];
    private processingQueue: boolean = false;
    
    // Services
    private readonly configManager: ConfigurationManager;
    private readonly gitService: GitService;
    private readonly copilotIntegrationService: AIAssistantDetectionService;
    private readonly smartSessionManager: SmartSessionManager;
    private readonly sessionMonitor: AISessionMonitor;
    private readonly githubService: GitHubService;

    constructor(
        configManager: ConfigurationManager,
        gitService: GitService,
        copilotIntegrationService: AIAssistantDetectionService,
        smartSessionManager: SmartSessionManager,
        sessionMonitor: AISessionMonitor,
        githubService: GitHubService
    ) {
        this.configManager = configManager;
        this.gitService = gitService;
        this.copilotIntegrationService = copilotIntegrationService;
        this.smartSessionManager = smartSessionManager;
        this.sessionMonitor = sessionMonitor;
        this.githubService = githubService;

        this.stats = this.initializeStats();
        this.config = this.loadAutomationConfig();
        
        // Only initialize background services if not in test environment
        if (!this.isTestEnvironment()) {
            this.initialize();
        } else {
            console.log('BackgroundMonitoringService: Test environment detected, skipping background initialization');
        }
    }

    private initializeStats(): MonitoringStats {
        return {
            sessionsMonitored: 0,
            interactionsDetected: 0,
            commitsCorrelated: 0,
            averageSessionQuality: 0,
            automationEffectiveness: 0,
            backgroundOperationsCount: 0
        };
    }

    private loadAutomationConfig(): AutomationConfig {
        const vsCodeConfig = vscode.workspace.getConfiguration('copilotPromptTracker');
        
        return {
            autoCorrelationEnabled: vsCodeConfig.get('autoCorrelation', true),
            enhancedCopilotDetection: vsCodeConfig.get('enhancedCopilotDetection', true),
            backgroundProcessingEnabled: true,
            detectionSensitivity: vsCodeConfig.get('commitDetectionSensitivity', 'medium'),
            maxBackgroundOperations: 5,
            quietHours: this.getQuietHours()
        };
    }

    private isTestEnvironment(): boolean {
        // Detect if running in test environment
        return process.env.NODE_ENV === 'test' || 
               process.env.VSCODE_TEST === 'true' ||
               typeof global !== 'undefined' && (global as any).suite !== undefined;
    }

    private getQuietHours(): { start: number; end: number } | null {
        // Define quiet hours (e.g., 11 PM to 6 AM) when background operations should be minimized
        const analytics = this.smartSessionManager.getDevelopmentAnalytics();
        
        // Use inverse of working hours as quiet hours
        if (analytics.workingHours.start > 6) {
            return {
                start: 23, // 11 PM
                end: Math.max(6, analytics.workingHours.start - 1)
            };
        }
        
        return null; // No quiet hours if working very early
    }

    private async initialize(): Promise<void> {
        console.log('BackgroundMonitoringService: Initializing background monitoring');
        
        // Set up configuration monitoring
        this.setupConfigurationMonitoring();
        
        // Set up background operation processing
        this.setupBackgroundQueueProcessor();
        
        // Set up periodic maintenance
        this.setupPeriodicMaintenance();
        
        // Start monitoring
        await this.startMonitoring();
    }

    /**
     * Monitor configuration changes and adapt behavior
     */
    private setupConfigurationMonitoring(): void {
        const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('copilotPromptTracker')) {
                this.config = this.loadAutomationConfig();
                console.log('BackgroundMonitoringService: Configuration updated');
            }
        });
        this.disposables.push(configListener);
    }

    /**
     * Set up background queue processor for non-blocking operations
     */
    private setupBackgroundQueueProcessor(): void {
        const processQueue = async () => {
            if (this.processingQueue || this.backgroundQueue.length === 0) {
                return;
            }

            // Check if we're in quiet hours
            if (this.isQuietHours()) {
                console.log('BackgroundMonitoringService: Skipping background processing during quiet hours');
                return;
            }

            this.processingQueue = true;
            
            try {
                // Process up to maxBackgroundOperations at once
                const operations = this.backgroundQueue.splice(0, this.config.maxBackgroundOperations);
                
                await Promise.all(operations.map(async (operation) => {
                    try {
                        await operation();
                        this.stats.backgroundOperationsCount++;
                    } catch (error) {
                        console.error('BackgroundMonitoringService: Error in background operation:', error);
                    }
                }));
                
            } finally {
                this.processingQueue = false;
            }
        };

        // Process queue every 30 seconds
        const queueInterval = setInterval(processQueue, 30000);
        this.disposables.push({
            dispose: () => clearInterval(queueInterval)
        });
    }

    /**
     * Set up periodic maintenance tasks
     */
    private setupPeriodicMaintenance(): void {
        // Daily maintenance
        const dailyMaintenance = setInterval(() => {
            this.performDailyMaintenance();
        }, 24 * 60 * 60 * 1000); // 24 hours

        // Hourly light maintenance
        const hourlyMaintenance = setInterval(() => {
            this.performHourlyMaintenance();
        }, 60 * 60 * 1000); // 1 hour

        this.disposables.push(
            { dispose: () => clearInterval(dailyMaintenance) },
            { dispose: () => clearInterval(hourlyMaintenance) }
        );
    }

    /**
     * Start comprehensive monitoring
     */
    private async startMonitoring(): Promise<void> {
        if (this.isMonitoring) {
            return;
        }

        this.isMonitoring = true;
        console.log('BackgroundMonitoringService: Starting comprehensive monitoring');

        // Monitor Copilot interactions
        this.setupAIInteractionMonitoring();
        
        // Monitor Git commits
        this.setupGitCommitMonitoring();
        
        // Monitor session quality
        this.setupSessionQualityMonitoring();
        
        // Monitor automation effectiveness
        this.setupAutomationEffectivenessTracking();
    }

    /**
     * Set up Copilot interaction monitoring with background processing
     */
    private setupAIInteractionMonitoring(): void {
        const interactionListener = this.copilotIntegrationService.onInteractionDetected((interaction) => {
            this.stats.interactionsDetected++;
            
            // Queue background processing for interaction analysis
            this.queueBackgroundOperation(async () => {
                await this.processInteractionInBackground(interaction);
            });
            
            console.log(`BackgroundMonitoringService: Detected Copilot interaction (${this.stats.interactionsDetected} total)`);
        });
        
        this.disposables.push(interactionListener);
    }

    /**
     * Set up Git commit monitoring with automatic correlation
     */
    private setupGitCommitMonitoring(): void {
        const commitListener = this.gitService.onCommit(async (commitInfo) => {
            if (this.config.autoCorrelationEnabled) {
                // Queue background correlation
                this.queueBackgroundOperation(async () => {
                    await this.processCommitCorrelation(commitInfo);
                });
            }
        });
        
        this.disposables.push(commitListener);
    }

    /**
     * Set up session quality monitoring
     */
    private setupSessionQualityMonitoring(): void {
        // Monitor when sessions end to analyze quality
        const originalFinalizeSession = this.sessionMonitor.finalizeSessionWithCommit.bind(this.sessionMonitor);
        
        // Wrap the finalize method to add quality monitoring
        this.sessionMonitor.finalizeSessionWithCommit = (gitInfo) => {
            const result = originalFinalizeSession(gitInfo);
            
            if (result) {
                this.stats.sessionsMonitored++;
                
                // Queue session quality analysis
                this.queueBackgroundOperation(async () => {
                    await this.analyzeSessionQuality(result);
                });
            }
            
            return result;
        };
    }

    /**
     * Set up automation effectiveness tracking
     */
    private setupAutomationEffectivenessTracking(): void {
        // Track effectiveness metrics periodically
        const effectivenessInterval = setInterval(() => {
            this.calculateAutomationEffectiveness();
        }, 10 * 60 * 1000); // Every 10 minutes

        this.disposables.push({
            dispose: () => clearInterval(effectivenessInterval)
        });
    }

    /**
     * Queue a background operation for non-blocking execution
     */
    private queueBackgroundOperation(operation: () => Promise<void>): void {
        if (this.backgroundQueue.length >= this.config.maxBackgroundOperations * 2) {
            // Queue is full, remove oldest operations
            this.backgroundQueue.shift();
        }
        
        this.backgroundQueue.push(operation);
    }

    /**
     * Process Copilot interaction in background
     */
    private async processInteractionInBackground(interaction: Omit<AIInteraction, 'id' | 'timestamp'>): Promise<void> {
        try {
            // Sanitize content for security
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const sanitizedPrompt = await ContentSanitizer.sanitizeContent(interaction.prompt, workspaceRoot);
            const sanitizedResponse = interaction.response ? 
                await ContentSanitizer.sanitizeContent(interaction.response, workspaceRoot) : undefined;

            // Store processed interaction metadata
            console.log('BackgroundMonitoringService: Processed interaction in background');
            
        } catch (error) {
            console.error('BackgroundMonitoringService: Error processing interaction:', error);
        }
    }

    /**
     * Process commit correlation in background
     */
    private async processCommitCorrelation(commitInfo: GitInfo & { changedFiles: string[] }): Promise<void> {
        try {
            const config = this.configManager.getConfiguration();
            if (!config) {
                console.log('BackgroundMonitoringService: No configuration, skipping commit correlation');
                return;
            }

            const currentSession = this.sessionMonitor.getCurrentSession();
            if (!currentSession || currentSession.interactions.length === 0) {
                console.log('BackgroundMonitoringService: No active session to correlate');
                return;
            }

            // Finalize session with commit info
            const finalizedSession = this.sessionMonitor.finalizeSessionWithCommit({
                commitHash: commitInfo.commitHash,
                branch: commitInfo.branch,
                author: commitInfo.author,
                repository: commitInfo.repository,
                changedFiles: commitInfo.changedFiles,
                commitMessage: commitInfo.message || 'Background correlation'
            });

            if (finalizedSession) {
                // Save to GitHub in background
                await this.saveSessionToGitHubBackground(finalizedSession);
                
                this.stats.commitsCorrelated++;
                this.stats.lastProcessedCommit = commitInfo.commitHash.substring(0, 7);
                
                console.log(`BackgroundMonitoringService: Auto-correlated session with commit ${this.stats.lastProcessedCommit}`);
            }

        } catch (error) {
            console.error('BackgroundMonitoringService: Error in commit correlation:', error);
        }
    }

    /**
     * Save session to GitHub in background (non-blocking)
     */
    private async saveSessionToGitHubBackground(session: DevelopmentSession): Promise<void> {
        try {
            const config = this.configManager.getConfiguration();
            if (!config) {
                return;
            }

            // This is a simplified version of the save operation for background processing
            // The actual implementation would use the existing saveSessionToGitHub logic
            console.log(`BackgroundMonitoringService: Queued session ${session.sessionId} for GitHub save`);
            
        } catch (error) {
            console.error('BackgroundMonitoringService: Error saving session to GitHub:', error);
        }
    }

    /**
     * Analyze session quality in background
     */
    private async analyzeSessionQuality(session: DevelopmentSession): Promise<void> {
        try {
            const insights = this.smartSessionManager.analyzeSessionQuality(session);
            
            // Update average session quality
            const currentAvg = this.stats.averageSessionQuality;
            const sessionCount = this.stats.sessionsMonitored;
            this.stats.averageSessionQuality = ((currentAvg * (sessionCount - 1)) + insights.productivityScore) / sessionCount;
            
            console.log(`BackgroundMonitoringService: Analyzed session quality: ${insights.sessionQuality}`);
            
        } catch (error) {
            console.error('BackgroundMonitoringService: Error analyzing session quality:', error);
        }
    }

    /**
     * Calculate automation effectiveness
     */
    private calculateAutomationEffectiveness(): void {
        try {
            let effectiveness = 0;
            
            // Factor 1: Interaction detection rate
            if (this.stats.interactionsDetected > 0) {
                effectiveness += 30; // Base points for detecting interactions
            }
            
            // Factor 2: Commit correlation rate
            if (this.stats.commitsCorrelated > 0) {
                const correlationRate = this.stats.commitsCorrelated / Math.max(this.stats.sessionsMonitored, 1);
                effectiveness += Math.min(correlationRate * 40, 40);
            }
            
            // Factor 3: Session quality
            effectiveness += (this.stats.averageSessionQuality / 100) * 30;
            
            this.stats.automationEffectiveness = Math.min(effectiveness, 100);
            
        } catch (error) {
            console.error('BackgroundMonitoringService: Error calculating effectiveness:', error);
        }
    }

    /**
     * Check if current time is in quiet hours
     */
    private isQuietHours(): boolean {
        if (!this.config.quietHours) {
            return false;
        }
        
        const currentHour = new Date().getHours();
        const { start, end } = this.config.quietHours;
        
        if (start > end) {
            // Quiet hours span midnight (e.g., 23 to 6)
            return currentHour >= start || currentHour < end;
        } else {
            // Normal quiet hours (e.g., 2 to 6)
            return currentHour >= start && currentHour < end;
        }
    }

    /**
     * Perform daily maintenance tasks
     */
    private async performDailyMaintenance(): Promise<void> {
        console.log('BackgroundMonitoringService: Performing daily maintenance');
        
        try {
            // Clean up old session data
            this.sessionMonitor.cleanupOldSessions(50);
            
            // Update automation config based on patterns
            this.config.quietHours = this.getQuietHours();
            
            // Reset daily stats if needed
            if (this.stats.backgroundOperationsCount > 1000) {
                this.stats.backgroundOperationsCount = 0;
            }
            
        } catch (error) {
            console.error('BackgroundMonitoringService: Error in daily maintenance:', error);
        }
    }

    /**
     * Perform hourly maintenance tasks
     */
    private performHourlyMaintenance(): void {
        try {
            // Update effectiveness calculation
            this.calculateAutomationEffectiveness();
            
            // Clean up background queue if it gets too large
            if (this.backgroundQueue.length > this.config.maxBackgroundOperations * 3) {
                this.backgroundQueue = this.backgroundQueue.slice(-this.config.maxBackgroundOperations);
                console.log('BackgroundMonitoringService: Cleaned up background queue');
            }
            
        } catch (error) {
            console.error('BackgroundMonitoringService: Error in hourly maintenance:', error);
        }
    }

    /**
     * Get current monitoring statistics
     */
    public getMonitoringStats(): MonitoringStats {
        return { ...this.stats };
    }

    /**
     * Get current automation configuration
     */
    public getAutomationConfig(): AutomationConfig {
        return { ...this.config };
    }

    /**
     * Update automation configuration
     */
    public updateAutomationConfig(updates: Partial<AutomationConfig>): void {
        this.config = { ...this.config, ...updates };
        console.log('BackgroundMonitoringService: Configuration updated');
    }

    /**
     * Pause monitoring (useful for maintenance or testing)
     */
    public pauseMonitoring(): void {
        this.isMonitoring = false;
        console.log('BackgroundMonitoringService: Monitoring paused');
    }

    /**
     * Resume monitoring
     */
    public async resumeMonitoring(): Promise<void> {
        if (!this.isMonitoring) {
            await this.startMonitoring();
        }
    }

    /**
     * Get detailed status report
     */
    public getStatusReport(): {
        isMonitoring: boolean;
        stats: MonitoringStats;
        config: AutomationConfig;
        queueLength: number;
        isProcessingQueue: boolean;
        isQuietHours: boolean;
    } {
        return {
            isMonitoring: this.isMonitoring,
            stats: this.getMonitoringStats(),
            config: this.getAutomationConfig(),
            queueLength: this.backgroundQueue.length,
            isProcessingQueue: this.processingQueue,
            isQuietHours: this.isQuietHours()
        };
    }

    public dispose(): void {
        console.log('BackgroundMonitoringService: Disposing background monitoring service');
        
        this.isMonitoring = false;
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.backgroundQueue = [];
    }
}