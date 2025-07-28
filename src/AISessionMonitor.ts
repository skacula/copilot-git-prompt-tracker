import * as vscode from 'vscode';

export interface AIInteraction {
    id: string;
    timestamp: string;
    prompt: string;
    response?: string;
    aiProvider: 'copilot' | 'claude' | 'cursor' | 'other';
    fileContext?: {
        fileName: string;
        language: string;
        selection?: {
            start: { line: number; character: number };
            end: { line: number; character: number };
        };
        content?: string;
    };
    interactionType: 'chat' | 'inline' | 'comment' | 'completion' | 'generation';
}

// Backward compatibility alias
export type CopilotInteraction = AIInteraction;

export interface DevelopmentSession {
    sessionId: string;
    startTime: string;
    endTime?: string;
    interactions: AIInteraction[];
    gitInfo?: {
        commitHash: string;
        branch: string;
        author: string;
        repository: string;
        changedFiles: string[];
        commitMessage: string;
    };
    metadata: {
        vscodeVersion: string;
        extensionVersion: string;
        workspaceFolder: string;
        aiProvidersUsed: string[]; // Track which AI assistants were used
    };
}

/**
 * Monitors AI assistant interactions and correlates them with development sessions
 * Sessions are defined as periods of activity that culminate in a Git commit
 * Supports GitHub Copilot, Claude Code, Cursor, and other AI coding assistants
 */
export class AISessionMonitor {
    private currentSession: DevelopmentSession | null = null;
    private sessionHistory: DevelopmentSession[] = [];
    private readonly SESSION_TIMEOUT_MINUTES = 30;
    private readonly MAX_INTERACTIONS_PER_SESSION = 50;
    
    constructor(private extensionVersion: string) {
        this.startNewSession();
    }

    /**
     * Start a new development session
     */
    private startNewSession(): void {
        this.currentSession = {
            sessionId: this.generateSessionId(),
            startTime: new Date().toISOString(),
            interactions: [],
            metadata: {
                vscodeVersion: vscode.version,
                extensionVersion: this.extensionVersion,
                workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'unknown',
                aiProvidersUsed: []
            }
        };
        
        console.log(`AISessionMonitor: Started new session ${this.currentSession.sessionId}`);
    }

    /**
     * Add an AI assistant interaction to the current session
     */
    public addInteraction(interaction: Omit<AIInteraction, 'id' | 'timestamp'>): void {
        if (!this.currentSession) {
            this.startNewSession();
        }

        const fullInteraction: AIInteraction = {
            id: this.generateInteractionId(),
            timestamp: new Date().toISOString(),
            ...interaction
        };

        this.currentSession!.interactions.push(fullInteraction);
        
        // Track AI providers used in this session
        const provider = interaction.aiProvider || 'other';
        if (!this.currentSession!.metadata.aiProvidersUsed.includes(provider)) {
            this.currentSession!.metadata.aiProvidersUsed.push(provider);
        }
        
        // Prevent session from growing too large
        if (this.currentSession!.interactions.length > this.MAX_INTERACTIONS_PER_SESSION) {
            this.currentSession!.interactions = this.currentSession!.interactions.slice(-this.MAX_INTERACTIONS_PER_SESSION);
        }

        console.log(`AISessionMonitor: Added ${provider} interaction ${fullInteraction.id} to session ${this.currentSession!.sessionId}`);
    }

    /**
     * Finalize current session with Git commit information
     */
    public finalizeSessionWithCommit(gitInfo: DevelopmentSession['gitInfo']): DevelopmentSession | null {
        if (!this.currentSession || this.currentSession.interactions.length === 0) {
            console.log('AISessionMonitor: No active session or interactions to finalize');
            return null;
        }

        // End current session
        this.currentSession.endTime = new Date().toISOString();
        this.currentSession.gitInfo = gitInfo;

        // Filter interactions to most relevant ones
        const filteredInteractions = this.filterRelevantInteractions(
            this.currentSession.interactions, 
            gitInfo?.changedFiles || []
        );
        
        this.currentSession.interactions = filteredInteractions;

        // Archive session
        const finalizedSession = { ...this.currentSession };
        this.sessionHistory.push(finalizedSession);
        
        console.log(`AISessionMonitor: Finalized session ${finalizedSession.sessionId} with ${finalizedSession.interactions.length} interactions`);

        // Start new session for future interactions
        this.startNewSession();

        return finalizedSession;
    }

    /**
     * Filter interactions to most relevant ones for the commit
     */
    private filterRelevantInteractions(interactions: CopilotInteraction[], changedFiles: string[]): CopilotInteraction[] {
        const now = new Date().getTime();
        const cutoffTime = now - (this.SESSION_TIMEOUT_MINUTES * 60 * 1000);

        return interactions.filter(interaction => {
            const interactionTime = new Date(interaction.timestamp).getTime();
            
            // Include if within time window
            if (interactionTime < cutoffTime) {
                return false;
            }

            // Prioritize interactions related to changed files
            if (interaction.fileContext?.fileName) {
                const isRelatedToChangedFile = changedFiles.some(changedFile => 
                    interaction.fileContext!.fileName.endsWith(changedFile) ||
                    changedFile.endsWith(interaction.fileContext!.fileName)
                );
                
                if (isRelatedToChangedFile) {
                    return true;
                }
            }

            // Include recent chat interactions even if not file-specific
            return interaction.interactionType === 'chat';
        });
    }

    /**
     * Get current session for inspection
     */
    public getCurrentSession(): DevelopmentSession | null {
        return this.currentSession;
    }

    /**
     * Get session history
     */
    public getSessionHistory(): DevelopmentSession[] {
        return [...this.sessionHistory];
    }

    /**
     * Get recent interactions from current session
     */
    public getRecentInteractions(limit: number = 10): CopilotInteraction[] {
        if (!this.currentSession) {
            return [];
        }
        
        return this.currentSession.interactions.slice(-limit);
    }

    /**
     * Clear old sessions to prevent memory buildup
     */
    public cleanupOldSessions(maxSessions: number = 100): void {
        if (this.sessionHistory.length > maxSessions) {
            this.sessionHistory = this.sessionHistory.slice(-maxSessions);
            console.log(`AISessionMonitor: Cleaned up old sessions, keeping ${maxSessions} most recent`);
        }
    }

    /**
     * Check if current session should timeout due to inactivity
     */
    public checkSessionTimeout(): void {
        if (!this.currentSession || this.currentSession.interactions.length === 0) {
            return;
        }

        const lastInteraction = this.currentSession.interactions[this.currentSession.interactions.length - 1];
        const lastInteractionTime = new Date(lastInteraction.timestamp).getTime();
        const now = new Date().getTime();
        const timeSinceLastInteraction = now - lastInteractionTime;

        // If no activity for SESSION_TIMEOUT_MINUTES, start fresh session
        if (timeSinceLastInteraction > (this.SESSION_TIMEOUT_MINUTES * 60 * 1000)) {
            console.log(`AISessionMonitor: Session ${this.currentSession.sessionId} timed out due to inactivity`);
            this.startNewSession();
        }
    }

    private generateSessionId(): string {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private generateInteractionId(): string {
        return `interaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.currentSession = null;
        this.sessionHistory = [];
        console.log('AISessionMonitor: Disposed');
    }
}
