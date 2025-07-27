import * as vscode from 'vscode';
import { CopilotInteraction } from './CopilotSessionMonitor';

export interface CopilotDetectionResult {
    detected: boolean;
    confidence: number;
    interactionType: 'chat' | 'inline' | 'comment';
    context?: {
        fileUri: vscode.Uri;
        language: string;
        range?: vscode.Range;
    };
}

/**
 * Enhanced service for detecting and capturing Copilot interactions
 * Uses multiple detection strategies to automatically identify Copilot usage
 */
export class CopilotIntegrationService implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private interactionListeners: Array<(interaction: Omit<CopilotInteraction, 'id' | 'timestamp'>) => void> = [];
    private copilotExtension: vscode.Extension<any> | undefined;
    private recentTextChanges: Map<string, { change: vscode.TextDocumentContentChangeEvent; timestamp: number }> = new Map();
    private userTypingPatterns: Map<string, number[]> = new Map(); // Track typing speed patterns
    private chatParticipantAPI: any;

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        console.log('CopilotIntegrationService: Initializing Copilot integration');
        
        // Try to get Copilot extension
        await this.initializeCopilotExtension();
        
        // Set up various detection methods
        this.setupTextChangeDetection();
        this.setupChatParticipantIntegration();
        this.setupCompletionProviderMonitoring();
        this.setupEditorActivityMonitoring();
        
        // Clean up old tracking data periodically
        this.setupCleanupTimer();
    }

    /**
     * Initialize integration with GitHub Copilot extension
     */
    private async initializeCopilotExtension(): Promise<void> {
        try {
            // Try GitHub Copilot extension
            this.copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
            
            if (!this.copilotExtension) {
                // Try alternative extension IDs
                this.copilotExtension = vscode.extensions.getExtension('github.copilot');
            }

            if (this.copilotExtension && !this.copilotExtension.isActive) {
                await this.copilotExtension.activate();
                console.log('CopilotIntegrationService: Activated Copilot extension');
            }

            // Try to access Copilot Chat extension for chat interactions
            const copilotChatExtension = vscode.extensions.getExtension('GitHub.copilot-chat');
            if (copilotChatExtension && !copilotChatExtension.isActive) {
                await copilotChatExtension.activate();
                console.log('CopilotIntegrationService: Activated Copilot Chat extension');
            }

        } catch (error) {
            console.log('CopilotIntegrationService: Copilot extension not available or failed to activate:', error);
        }
    }

    /**
     * Set up enhanced text change detection for Copilot completions
     */
    private setupTextChangeDetection(): void {
        const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
            this.analyzeTextChanges(event);
        });
        this.disposables.push(changeListener);

        // Also monitor when completions are accepted
        const completionListener = vscode.languages.registerCompletionItemProvider(
            { scheme: 'file' },
            {
                provideCompletionItems: (document, position, token, context) => {
                    // This is a hook to detect when completions are being requested
                    this.trackCompletionContext(document, position);
                    return [];
                }
            }
        );
        this.disposables.push(completionListener);
    }

    /**
     * Set up chat participant integration (if available)
     */
    private setupChatParticipantIntegration(): void {
        try {
            // This is experimental - check if chat participant API is available
            if (typeof (vscode as any).chat !== 'undefined' && typeof (vscode as any).chat.createChatParticipant === 'function') {
                console.log('CopilotIntegrationService: Chat participant API detected');
                // We could potentially register our own participant to intercept conversations
            }
        } catch (error) {
            console.log('CopilotIntegrationService: Chat participant API not available');
        }
    }

    /**
     * Monitor completion provider activity
     */
    private setupCompletionProviderMonitoring(): void {
        // Monitor when inline completions are shown/accepted
        const inlineCompletionListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.trackEditorForInlineCompletions(editor);
            }
        });
        this.disposables.push(inlineCompletionListener);
    }

    /**
     * Set up editor activity monitoring for context detection
     */
    private setupEditorActivityMonitoring(): void {
        // Track cursor movements and selections that might indicate Copilot usage
        const selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
            this.analyzeSelectionChanges(event);
        });
        this.disposables.push(selectionListener);

        // Track when editors become active (context switching)
        const editorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.trackEditorContext(editor);
            }
        });
        this.disposables.push(editorListener);
    }

    /**
     * Analyze text changes to detect potential Copilot completions
     */
    private async analyzeTextChanges(event: vscode.TextDocumentChangeEvent): Promise<void> {
        const document = event.document;
        const documentUri = document.uri.toString();

        for (const change of event.contentChanges) {
            const detectionResult = this.detectCopilotInteraction(change, document);
            
            if (detectionResult.detected && detectionResult.confidence > 0.7) {
                await this.captureInteraction(change, document, detectionResult);
            }

            // Store recent changes for pattern analysis
            this.recentTextChanges.set(
                `${documentUri}-${Date.now()}`,
                { change, timestamp: Date.now() }
            );
        }
    }

    /**
     * Advanced Copilot interaction detection using multiple heuristics
     */
    private detectCopilotInteraction(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument
    ): CopilotDetectionResult {
        let confidence = 0;
        let interactionType: 'chat' | 'inline' | 'comment' = 'inline';

        // Heuristic 1: Large text insertions (likely completions)
        if (change.text.length > 30 && change.rangeLength === 0) {
            confidence += 0.3;
        }

        // Heuristic 2: Multi-line completions
        if (change.text.includes('\n') && change.text.split('\n').length > 2) {
            confidence += 0.2;
        }

        // Heuristic 3: Code-like patterns
        if (this.isCodeLikeContent(change.text, document.languageId)) {
            confidence += 0.2;
        }

        // Heuristic 4: Instant appearance (no typing pattern)
        const documentUri = document.uri.toString();
        const typingSpeed = this.getRecentTypingSpeed(documentUri);
        if (typingSpeed === 0 && change.text.length > 10) {
            confidence += 0.3; // Likely a completion, not typing
        }

        // Heuristic 5: Comment-like insertions might be Copilot comments
        if (this.isCommentLikeContent(change.text, document.languageId)) {
            confidence += 0.1;
            interactionType = 'comment';
        }

        // Heuristic 6: Function/method completions
        if (this.isFunctionLikeContent(change.text, document.languageId)) {
            confidence += 0.2;
        }

        return {
            detected: confidence > 0.4,
            confidence,
            interactionType,
            context: {
                fileUri: document.uri,
                language: document.languageId,
                range: change.range
            }
        };
    }

    /**
     * Capture and format a detected Copilot interaction
     */
    private async captureInteraction(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument,
        detection: CopilotDetectionResult
    ): Promise<void> {
        try {
            // Try to infer the prompt context from surrounding code
            const prompt = await this.inferPromptFromContext(change, document);
            
            const interaction: Omit<CopilotInteraction, 'id' | 'timestamp'> = {
                prompt,
                response: change.text,
                fileContext: {
                    fileName: document.fileName,
                    language: document.languageId,
                    selection: change.range ? {
                        start: { 
                            line: change.range.start.line, 
                            character: change.range.start.character 
                        },
                        end: { 
                            line: change.range.end.line, 
                            character: change.range.end.character 
                        }
                    } : undefined,
                    content: change.text
                },
                interactionType: detection.interactionType
            };

            // Notify listeners
            this.interactionListeners.forEach(listener => {
                try {
                    listener(interaction);
                } catch (error) {
                    console.error('CopilotIntegrationService: Error in interaction listener:', error);
                }
            });

            console.log(`CopilotIntegrationService: Captured ${detection.interactionType} interaction with confidence ${detection.confidence}`);
        } catch (error) {
            console.error('CopilotIntegrationService: Error capturing interaction:', error);
        }
    }

    /**
     * Infer the likely prompt from code context
     */
    private async inferPromptFromContext(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument
    ): Promise<string> {
        try {
            // Get context around the change
            const startLine = Math.max(0, change.range.start.line - 3);
            const endLine = Math.min(document.lineCount - 1, change.range.end.line + 1);
            
            let contextBefore = '';
            for (let i = startLine; i < change.range.start.line; i++) {
                contextBefore += document.lineAt(i).text + '\\n';
            }

            // Infer intent from context
            if (this.isCommentLikeContent(change.text, document.languageId)) {
                return `Generate comment for code: ${contextBefore.trim()}`;
            }
            
            if (this.isFunctionLikeContent(change.text, document.languageId)) {
                return `Complete function implementation based on: ${contextBefore.trim()}`;
            }

            // Generic completion
            return `Code completion for: ${contextBefore.trim() || 'code generation'}`;
        } catch (error) {
            return `Code completion in ${document.fileName}`;
        }
    }

    /**
     * Check if content looks like code for the given language
     */
    private isCodeLikeContent(text: string, languageId: string): boolean {
        const codePatterns = {
            javascript: /(?:function|const|let|var|=>|async|await|import|export)/,
            typescript: /(?:interface|type|function|const|let|var|=>|async|await|import|export)/,
            python: /(?:def|class|import|from|async|await|lambda)/,
            java: /(?:public|private|class|interface|void|return)/,
            csharp: /(?:public|private|class|interface|void|return|using)/,
            go: /(?:func|package|import|var|const|type)/,
            rust: /(?:fn|struct|impl|use|let|const|pub)/,
        };

        const pattern = codePatterns[languageId as keyof typeof codePatterns];
        return pattern ? pattern.test(text) : /[{}();]/.test(text);
    }

    /**
     * Check if content looks like a comment
     */
    private isCommentLikeContent(text: string, languageId: string): boolean {
        const commentPatterns = {
            javascript: /^\s*\/\//,
            typescript: /^\s*\/\//,
            python: /^\s*#/,
            java: /^\s*\/\//,
            csharp: /^\s*\/\//,
            go: /^\s*\/\//,
            rust: /^\s*\/\//,
        };

        const pattern = commentPatterns[languageId as keyof typeof commentPatterns];
        return pattern ? pattern.test(text) : false;
    }

    /**
     * Check if content looks like a function
     */
    private isFunctionLikeContent(text: string, languageId: string): boolean {
        const functionPatterns = {
            javascript: /(?:function\s+\w+|const\s+\w+\s*=|=>\s*{)/,
            typescript: /(?:function\s+\w+|const\s+\w+\s*=|=>\s*{)/,
            python: /def\s+\w+\s*\(/,
            java: /(?:public|private|protected)?\s*\w+\s+\w+\s*\(/,
            csharp: /(?:public|private|protected)?\s*\w+\s+\w+\s*\(/,
            go: /func\s+\w+\s*\(/,
            rust: /fn\s+\w+\s*\(/,
        };

        const pattern = functionPatterns[languageId as keyof typeof functionPatterns];
        return pattern ? pattern.test(text) : false;
    }

    /**
     * Get recent typing speed for a document to help detect completions vs typing
     */
    private getRecentTypingSpeed(documentUri: string): number {
        const patterns = this.userTypingPatterns.get(documentUri) || [];
        if (patterns.length < 2) {
            return 0;
        }

        // Average time between recent keystrokes
        const recentPatterns = patterns.slice(-10);
        let totalTime = 0;
        for (let i = 1; i < recentPatterns.length; i++) {
            totalTime += recentPatterns[i] - recentPatterns[i - 1];
        }

        return totalTime / (recentPatterns.length - 1);
    }

    /**
     * Track completion context for better detection
     */
    private trackCompletionContext(document: vscode.TextDocument, position: vscode.Position): void {
        // This is called when completions are requested, helping us track context
        const documentUri = document.uri.toString();
        const patterns = this.userTypingPatterns.get(documentUri) || [];
        patterns.push(Date.now());
        
        // Keep only recent patterns
        if (patterns.length > 20) {
            patterns.splice(0, patterns.length - 20);
        }
        
        this.userTypingPatterns.set(documentUri, patterns);
    }

    /**
     * Track editor for inline completions
     */
    private trackEditorForInlineCompletions(editor: vscode.TextEditor): void {
        // Monitor this editor for potential inline completion acceptance
        console.log(`CopilotIntegrationService: Monitoring editor ${editor.document.fileName} for inline completions`);
    }

    /**
     * Analyze selection changes that might indicate Copilot usage
     */
    private analyzeSelectionChanges(event: vscode.TextEditorSelectionChangeEvent): void {
        // Large sudden selection changes might indicate Copilot suggestion acceptance
        for (const selection of event.selections) {
            if (!selection.isEmpty) {
                const selectedText = event.textEditor.document.getText(selection);
                if (selectedText.length > 50) {
                    // Potential Copilot suggestion selection
                    console.log('CopilotIntegrationService: Large selection detected, potential Copilot interaction');
                }
            }
        }
    }

    /**
     * Track editor context for better interaction detection
     */
    private trackEditorContext(editor: vscode.TextEditor): void {
        console.log(`CopilotIntegrationService: Tracking editor context for ${editor.document.fileName}`);
    }

    private isTestEnvironment(): boolean {
        // Detect if running in test environment
        return process.env.NODE_ENV === 'test' || 
               process.env.VSCODE_TEST === 'true' ||
               typeof global !== 'undefined' && (global as any).suite !== undefined;
    }

    /**
     * Set up periodic cleanup of tracking data
     */
    private setupCleanupTimer(): void {
        // Skip cleanup timer in test environment to prevent extension host issues
        if (this.isTestEnvironment()) {
            console.log('CopilotIntegrationService: Test environment detected, skipping cleanup timer');
            return;
        }

        const cleanupInterval = setInterval(() => {
            this.cleanupOldData();
        }, 60000); // Clean up every minute

        this.disposables.push({
            dispose: () => clearInterval(cleanupInterval)
        });
    }

    /**
     * Clean up old tracking data to prevent memory leaks
     */
    private cleanupOldData(): void {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes

        // Clean up recent text changes
        for (const [key, data] of this.recentTextChanges.entries()) {
            if (now - data.timestamp > maxAge) {
                this.recentTextChanges.delete(key);
            }
        }

        // Clean up typing patterns
        for (const [key, patterns] of this.userTypingPatterns.entries()) {
            const recentPatterns = patterns.filter(timestamp => now - timestamp < maxAge);
            if (recentPatterns.length === 0) {
                this.userTypingPatterns.delete(key);
            } else {
                this.userTypingPatterns.set(key, recentPatterns);
            }
        }
    }

    /**
     * Register a listener for detected Copilot interactions
     */
    public onInteractionDetected(listener: (interaction: Omit<CopilotInteraction, 'id' | 'timestamp'>) => void): vscode.Disposable {
        this.interactionListeners.push(listener);
        
        return {
            dispose: () => {
                const index = this.interactionListeners.indexOf(listener);
                if (index > -1) {
                    this.interactionListeners.splice(index, 1);
                }
            }
        };
    }

    /**
     * Manually trigger interaction capture (for backward compatibility)
     */
    public async captureManualInteraction(prompt: string, response?: string): Promise<void> {
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

        this.interactionListeners.forEach(listener => {
            try {
                listener(interaction);
            } catch (error) {
                console.error('CopilotIntegrationService: Error in manual interaction listener:', error);
            }
        });
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.interactionListeners = [];
        this.recentTextChanges.clear();
        this.userTypingPatterns.clear();
    }
}