import * as vscode from 'vscode';
import { AISessionMonitor, DevelopmentSession } from './AISessionMonitor';

export interface ActivityPattern {
    fileActivity: Map<string, number>; // file -> last activity timestamp
    interactionFrequency: number; // interactions per minute
    commitFrequency: number; // commits per hour
    lastActivityTime: number;
    workingHours: { start: number; end: number }; // hours of day when developer is most active
}

export interface SessionInsights {
    productivityScore: number; // 0-100
    focusLevel: number; // 0-100 based on file switching frequency
    copilotDependency: number; // 0-100 percentage of code via Copilot
    sessionQuality: 'high' | 'medium' | 'low';
    recommendations: string[];
}

/**
 * Smart session management that automatically adapts to developer behavior
 * and provides insights about development patterns
 */
export class SmartSessionManager implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private sessionMonitor: AISessionMonitor;
    private activityPattern: ActivityPattern;
    private sessionInsights: Map<string, SessionInsights> = new Map();
    private idleTimeoutHandle: NodeJS.Timeout | null = null;
    private lastActivityTime: number = Date.now();
    
    // Configuration
    private readonly IDLE_TIMEOUT_MINUTES = 15;
    private readonly CONTEXT_SWITCH_PENALTY = 5; // minutes
    private readonly MIN_SESSION_INTERACTIONS = 3;

    constructor(sessionMonitor: AISessionMonitor) {
        this.sessionMonitor = sessionMonitor;
        this.activityPattern = this.initializeActivityPattern();
        this.setupActivityMonitoring();
        this.setupSmartIdleDetection();
    }

    private initializeActivityPattern(): ActivityPattern {
        return {
            fileActivity: new Map(),
            interactionFrequency: 0,
            commitFrequency: 0,
            lastActivityTime: Date.now(),
            workingHours: { start: 9, end: 17 } // default 9-5
        };
    }

    /**
     * Set up comprehensive activity monitoring
     */
    private setupActivityMonitoring(): void {
        // Monitor text document changes
        const textChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
            this.recordActivity('textChange', event.document.uri.fsPath);
        });
        this.disposables.push(textChangeListener);

        // Monitor active editor changes (context switching)
        const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.recordActivity('editorSwitch', editor.document.uri.fsPath);
                this.analyzeContextSwitching(editor.document.uri.fsPath);
            }
        });
        this.disposables.push(editorChangeListener);

        // Monitor file operations
        const fileCreateListener = vscode.workspace.onDidCreateFiles((event) => {
            event.files.forEach(file => {
                this.recordActivity('fileCreate', file.fsPath);
            });
        });
        this.disposables.push(fileCreateListener);

        const fileDeleteListener = vscode.workspace.onDidDeleteFiles((event) => {
            event.files.forEach(file => {
                this.recordActivity('fileDelete', file.fsPath);
            });
        });
        this.disposables.push(fileDeleteListener);

        // Monitor workspace changes
        const workspaceChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('copilotPromptTracker')) {
                this.recordActivity('configChange');
            }
        });
        this.disposables.push(workspaceChangeListener);
    }

    /**
     * Set up smart idle detection that adapts to user behavior
     */
    private setupSmartIdleDetection(): void {
        // Clear any existing timeout
        if (this.idleTimeoutHandle) {
            clearTimeout(this.idleTimeoutHandle);
        }

        // Set up adaptive idle timeout
        const adaptiveTimeout = this.calculateAdaptiveIdleTimeout();
        
        this.idleTimeoutHandle = setTimeout(() => {
            this.handleSmartIdleTimeout();
        }, adaptiveTimeout);
    }

    /**
     * Calculate adaptive idle timeout based on user patterns
     */
    private calculateAdaptiveIdleTimeout(): number {
        const baseTimeout = this.IDLE_TIMEOUT_MINUTES * 60 * 1000;
        const currentHour = new Date().getHours();
        
        // Extend timeout during typical working hours
        if (currentHour >= this.activityPattern.workingHours.start && 
            currentHour <= this.activityPattern.workingHours.end) {
            return baseTimeout * 1.5; // 50% longer during work hours
        }
        
        // Shorter timeout outside working hours
        return baseTimeout * 0.7;
    }

    /**
     * Record various types of development activity
     */
    private recordActivity(activityType: string, filePath?: string): void {
        const now = Date.now();
        this.lastActivityTime = now;
        this.activityPattern.lastActivityTime = now;

        if (filePath) {
            this.activityPattern.fileActivity.set(filePath, now);
        }

        // Update working hours pattern
        const currentHour = new Date().getHours();
        this.updateWorkingHoursPattern(currentHour);

        // Reset idle timeout
        this.setupSmartIdleDetection();

        console.log(`SmartSessionManager: Recorded ${activityType} activity${filePath ? ` for ${filePath}` : ''}`);
    }

    /**
     * Update working hours pattern based on activity
     */
    private updateWorkingHoursPattern(currentHour: number): void {
        // Gradually adjust working hours based on actual activity
        if (currentHour < this.activityPattern.workingHours.start) {
            this.activityPattern.workingHours.start = Math.max(6, currentHour);
        } else if (currentHour > this.activityPattern.workingHours.end) {
            this.activityPattern.workingHours.end = Math.min(23, currentHour);
        }
    }

    /**
     * Analyze context switching patterns to detect focus issues
     */
    private analyzeContextSwitching(newFilePath: string): void {
        const recentFiles = Array.from(this.activityPattern.fileActivity.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by most recent activity
            .slice(0, 5) // Last 5 files
            .map(entry => entry[0]);

        // Check for rapid context switching (indicator of low focus)
        const now = Date.now();
        const recentSwitches = recentFiles.filter(filePath => {
            const lastActivity = this.activityPattern.fileActivity.get(filePath) || 0;
            return now - lastActivity < 2 * 60 * 1000; // Within last 2 minutes
        });

        if (recentSwitches.length > 3) {
            console.log('SmartSessionManager: Detected rapid context switching - potential focus issue');
        }
    }

    /**
     * Handle smart idle timeout with session quality analysis
     */
    private handleSmartIdleTimeout(): void {
        const currentSession = this.sessionMonitor.getCurrentSession();
        
        if (currentSession && currentSession.interactions.length >= this.MIN_SESSION_INTERACTIONS) {
            // Analyze session before potential timeout
            const insights = this.analyzeSessionQuality(currentSession);
            this.sessionInsights.set(currentSession.sessionId, insights);
            
            // Decide whether to end session based on quality
            if (insights.sessionQuality === 'low' && currentSession.interactions.length < 5) {
                console.log('SmartSessionManager: Ending low-quality session due to idle timeout');
                // Session will naturally timeout, but we've recorded insights
            } else {
                console.log('SmartSessionManager: Session has sufficient quality, extending timeout');
                this.setupSmartIdleDetection(); // Give more time for quality sessions
            }
        }
    }

    /**
     * Analyze the quality and characteristics of a development session
     */
    public analyzeSessionQuality(session: DevelopmentSession): SessionInsights {
        const insights: SessionInsights = {
            productivityScore: 0,
            focusLevel: 0,
            copilotDependency: 0,
            sessionQuality: 'low',
            recommendations: []
        };

        if (session.interactions.length === 0) {
            return insights;
        }

        // Calculate productivity score
        insights.productivityScore = this.calculateProductivityScore(session);
        
        // Calculate focus level
        insights.focusLevel = this.calculateFocusLevel(session);
        
        // Calculate Copilot dependency
        insights.copilotDependency = this.calculateCopilotDependency(session);
        
        // Determine overall session quality
        insights.sessionQuality = this.determineSessionQuality(insights);
        
        // Generate recommendations
        insights.recommendations = this.generateRecommendations(insights, session);

        return insights;
    }

    /**
     * Calculate productivity score based on various metrics
     */
    private calculateProductivityScore(session: DevelopmentSession): number {
        let score = 0;
        
        // Base score from interaction count
        score += Math.min(session.interactions.length * 5, 40);
        
        // Bonus for variety of interaction types
        const interactionTypes = new Set(session.interactions.map(i => i.interactionType));
        score += interactionTypes.size * 10;
        
        // Bonus for file diversity (but not too much - indicates focus)
        const uniqueFiles = new Set(
            session.interactions
                .map(i => i.fileContext?.fileName)
                .filter(f => f !== undefined)
        );
        const fileBonus = Math.min(uniqueFiles.size * 8, 25);
        score += fileBonus;
        
        // Time-based productivity
        const sessionDuration = Date.now() - new Date(session.startTime).getTime();
        const hourlyInteractionRate = (session.interactions.length / (sessionDuration / 3600000));
        if (hourlyInteractionRate > 5) {score += 15;} // Good interaction rate
        
        return Math.min(score, 100);
    }

    /**
     * Calculate focus level based on context switching patterns
     */
    private calculateFocusLevel(session: DevelopmentSession): number {
        const uniqueFiles = new Set(
            session.interactions
                .map(i => i.fileContext?.fileName)
                .filter(f => f !== undefined)
        );
        
        if (uniqueFiles.size === 0) {return 50;} // Neutral if no file context
        
        // Higher focus = fewer files relative to interactions
        const focusRatio = session.interactions.length / uniqueFiles.size;
        
        if (focusRatio > 8) {return 90;} // Very focused
        if (focusRatio > 5) {return 75;} // Focused
        if (focusRatio > 3) {return 60;} // Moderately focused
        if (focusRatio > 1.5) {return 40;} // Some focus issues
        return 20; // Low focus
    }

    /**
     * Calculate Copilot dependency percentage
     */
    private calculateCopilotDependency(session: DevelopmentSession): number {
        const totalResponseLength = session.interactions.reduce((sum, interaction) => {
            return sum + (interaction.response?.length || 0);
        }, 0);
        
        if (totalResponseLength === 0) {return 0;}
        
        // Estimate based on average response length
        // Longer responses typically indicate higher Copilot usage
        const avgResponseLength = totalResponseLength / session.interactions.length;
        
        if (avgResponseLength > 100) {return 85;} // High dependency
        if (avgResponseLength > 50) {return 65;} // Moderate dependency
        if (avgResponseLength > 20) {return 40;} // Some dependency
        return 20; // Low dependency
    }

    /**
     * Determine overall session quality
     */
    private determineSessionQuality(insights: SessionInsights): 'high' | 'medium' | 'low' {
        const avgScore = (insights.productivityScore + insights.focusLevel) / 2;
        
        if (avgScore >= 75) {return 'high';}
        if (avgScore >= 50) {return 'medium';}
        return 'low';
    }

    /**
     * Generate personalized recommendations based on session analysis
     */
    private generateRecommendations(insights: SessionInsights, session: DevelopmentSession): string[] {
        const recommendations: string[] = [];
        
        if (insights.focusLevel < 50) {
            recommendations.push('Consider working on fewer files simultaneously to improve focus');
        }
        
        if (insights.productivityScore < 40) {
            recommendations.push('Try breaking down complex tasks into smaller, more manageable pieces');
        }
        
        if (insights.copilotDependency > 80) {
            recommendations.push('Consider reviewing Copilot suggestions more carefully to maintain learning');
        } else if (insights.copilotDependency < 30) {
            recommendations.push('You might benefit from using Copilot more for routine coding tasks');
        }
        
        if (session.interactions.length < 5) {
            recommendations.push('Consider documenting your development process more thoroughly');
        }
        
        const sessionDuration = Date.now() - new Date(session.startTime).getTime();
        if (sessionDuration > 4 * 3600000) { // More than 4 hours
            recommendations.push('Consider taking regular breaks during long coding sessions');
        }
        
        return recommendations;
    }

    /**
     * Get insights for a specific session
     */
    public getSessionInsights(sessionId: string): SessionInsights | undefined {
        return this.sessionInsights.get(sessionId);
    }

    /**
     * Get current activity pattern
     */
    public getActivityPattern(): ActivityPattern {
        return { ...this.activityPattern };
    }

    /**
     * Get development analytics summary
     */
    public getDevelopmentAnalytics(): {
        averageSessionQuality: number;
        totalSessions: number;
        topRecommendations: string[];
        workingHours: { start: number; end: number };
    } {
        const sessions = Array.from(this.sessionInsights.values());
        
        if (sessions.length === 0) {
            return {
                averageSessionQuality: 0,
                totalSessions: 0,
                topRecommendations: [],
                workingHours: this.activityPattern.workingHours
            };
        }

        const qualityScores = sessions.map(s => s.productivityScore);
        const averageSessionQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
        
        // Aggregate recommendations
        const allRecommendations = sessions.flatMap(s => s.recommendations);
        const recommendationCounts = new Map<string, number>();
        
        allRecommendations.forEach(rec => {
            recommendationCounts.set(rec, (recommendationCounts.get(rec) || 0) + 1);
        });
        
        const topRecommendations = Array.from(recommendationCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(entry => entry[0]);

        return {
            averageSessionQuality,
            totalSessions: sessions.length,
            topRecommendations,
            workingHours: this.activityPattern.workingHours
        };
    }

    /**
     * Reset activity patterns (useful for testing or major workflow changes)
     */
    public resetActivityPatterns(): void {
        this.activityPattern = this.initializeActivityPattern();
        this.sessionInsights.clear();
        console.log('SmartSessionManager: Activity patterns reset');
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        if (this.idleTimeoutHandle) {
            clearTimeout(this.idleTimeoutHandle);
            this.idleTimeoutHandle = null;
        }
        
        this.sessionInsights.clear();
    }
}