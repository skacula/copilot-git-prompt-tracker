import * as vscode from 'vscode';
import { AIInteraction } from './AISessionMonitor';

export interface AIDetectionResult {
    detected: boolean;
    confidence: number;
    aiProvider: 'copilot' | 'claude' | 'cursor' | 'other';
    interactionType: 'chat' | 'inline' | 'comment' | 'completion' | 'generation';
    context?: {
        fileUri: vscode.Uri;
        language: string;
        range?: vscode.Range;
    };
}

// Backward compatibility alias
export type CopilotDetectionResult = AIDetectionResult;

/**
 * Enhanced service for detecting and capturing AI assistant interactions
 * Uses multiple detection strategies to automatically identify AI usage from various providers
 * Supports GitHub Copilot, Claude Code, Cursor, and other AI coding assistants
 */
export class AIAssistantDetectionService implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private interactionListeners: Array<(interaction: Omit<AIInteraction, 'id' | 'timestamp'>) => void> = [];
    private copilotExtension: vscode.Extension<any> | undefined;
    private claudeExtension: vscode.Extension<any> | undefined;
    private cursorExtension: vscode.Extension<any> | undefined;
    private recentTextChanges: Map<string, { change: vscode.TextDocumentContentChangeEvent; timestamp: number }> = new Map();
    private userTypingPatterns: Map<string, number[]> = new Map(); // Track typing speed patterns
    private chatParticipantAPI: any;

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        console.log('AIAssistantDetectionService: Initializing AI assistant integrations');
        
        // Try to get various AI extensions
        await this.initializeAIExtensions();
        
        // Set up various detection methods
        this.setupTextChangeDetection();
        this.setupChatParticipantIntegration();
        this.setupCompletionProviderMonitoring();
        this.setupEditorActivityMonitoring();
        this.setupClaudeCodeDetection();
        this.setupCursorDetection();
        
        // Clean up old tracking data periodically
        this.setupCleanupTimer();
    }

    /**
     * Initialize integration with various AI extensions
     */
    private async initializeAIExtensions(): Promise<void> {
        await this.initializeCopilotExtension();
        await this.initializeClaudeExtension();
        await this.initializeCursorExtension();
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
                console.log('AIAssistantDetectionService: Activated Copilot extension');
            }

            // Try to access Copilot Chat extension for chat interactions
            const copilotChatExtension = vscode.extensions.getExtension('GitHub.copilot-chat');
            if (copilotChatExtension && !copilotChatExtension.isActive) {
                await copilotChatExtension.activate();
                console.log('AIAssistantDetectionService: Activated Copilot Chat extension');
            }

        } catch (error) {
            console.log('AIAssistantDetectionService: Copilot extension not available or failed to activate:', error);
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
                console.log('AIAssistantDetectionService: Chat participant API detected');
                // We could potentially register our own participant to intercept conversations
            }
        } catch (error) {
            console.log('AIAssistantDetectionService: Chat participant API not available');
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
     * Analyze text changes to detect potential AI assistant interactions
     */
    private async analyzeTextChanges(event: vscode.TextDocumentChangeEvent): Promise<void> {
        const document = event.document;
        const documentUri = document.uri.toString();

        for (const change of event.contentChanges) {
            // Only analyze substantial text changes
            if (change.text.length > 10) {
                console.log(`📝 ANALYZING TEXT CHANGE: ${change.text.length} chars in ${document.languageId} (${document.fileName})`);
                console.log(`📝 Change preview: "${change.text.substring(0, 100).replace(/\n/g, '\\n')}..."`);
                
                const detectionResults = this.detectAIInteractions(change, document);
                
                console.log(`📝 Detection results: ${detectionResults.length} providers checked`);
                for (const detectionResult of detectionResults) {
                    console.log(`🔍 ${detectionResult.aiProvider.toUpperCase()}: confidence=${Math.round(detectionResult.confidence * 100)}%, detected=${detectionResult.detected}, type=${detectionResult.interactionType}`);
                    
                    if (detectionResult.detected && detectionResult.confidence > 0.5) {
                        console.log(`✅ CAPTURING ${detectionResult.aiProvider.toUpperCase()} INTERACTION`);
                        await this.captureAIInteraction(change, document, detectionResult);
                    } else if (detectionResult.aiProvider === 'claude' && detectionResult.confidence > 0.3) {
                        // Special logging for Claude near-misses
                        console.log(`⚠️ CLAUDE NEAR-MISS: confidence=${Math.round(detectionResult.confidence * 100)}% (threshold=50%)`);
                        console.log(`⚠️ Claude characteristics check:`);
                        console.log(`   - Length > 200: ${change.text.length > 200}`);
                        console.log(`   - Lines > 10: ${change.text.split('\n').length > 10}`);
                        console.log(`   - Has comments: ${this.hasThoughtfulComments(change.text, document.languageId)}`);
                        console.log(`   - Complete function: ${this.isCompleteFunction(change.text, document.languageId)}`);
                        console.log(`   - Has error handling: ${this.hasErrorHandling(change.text, document.languageId)}`);
                        console.log(`   - Claude markers: ${this.hasClaudeCodeMarkers(change.text)}`);
                        console.log(`   - Verbose code: ${this.isVerboseCode(change.text)}`);
                    }
                }
                
                if (detectionResults.length === 0 || !detectionResults.some(r => r.detected)) {
                    console.log(`🔍 NO AI DETECTED for ${change.text.length} char change in ${document.languageId}`);
                }
            }

            // Store recent changes for pattern analysis
            this.recentTextChanges.set(
                `${documentUri}-${Date.now()}`,
                { change, timestamp: Date.now() }
            );
        }
    }

    /**
     * Detect potential AI interactions from multiple providers
     */
    private detectAIInteractions(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument
    ): AIDetectionResult[] {
        const results: AIDetectionResult[] = [];
        
        // Try Copilot detection
        const copilotResult = this.detectCopilotInteraction(change, document);
        if (copilotResult.detected) {
            results.push(copilotResult);
        }
        
        // Try Claude Code detection
        const claudeResult = this.detectClaudeInteraction(change, document);
        if (claudeResult.detected) {
            results.push(claudeResult);
        }
        
        // Try Cursor detection
        const cursorResult = this.detectCursorInteraction(change, document);
        if (cursorResult.detected) {
            results.push(cursorResult);
        }
        
        // Generic AI detection if no specific provider detected
        if (results.length === 0) {
            const genericResult = this.detectGenericAI(change, document);
            if (genericResult.detected) {
                results.push(genericResult);
            }
        }
        
        return results;
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
            aiProvider: 'copilot',
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
            // Try to infer the prompt context from surrounding code, AI-specific
            const prompt = await this.inferPromptFromContext(change, document, detection.aiProvider);
            
            const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
                prompt,
                response: change.text,
                aiProvider: 'copilot',
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
                    console.error('AIAssistantDetectionService: Error in interaction listener:', error);
                }
            });

            console.log(`AIAssistantDetectionService: Captured ${detection.interactionType} interaction with confidence ${detection.confidence}`);
        } catch (error) {
            console.error('AIAssistantDetectionService: Error capturing interaction:', error);
        }
    }

    /**
     * Infer the likely prompt from code context, with AI-provider specific logic
     */
    private async inferPromptFromContext(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument,
        aiProvider: 'copilot' | 'claude' | 'cursor' | 'other' = 'other'
    ): Promise<string> {
        try {
            // Get broader context for Claude as it typically generates larger blocks
            const contextLines = aiProvider === 'claude' ? 5 : 3;
            const startLine = Math.max(0, change.range.start.line - contextLines);
            const endLine = Math.min(document.lineCount - 1, change.range.end.line + 2);
            
            let contextBefore = '';
            let contextAfter = '';
            
            // Get context before the change
            for (let i = startLine; i < change.range.start.line; i++) {
                contextBefore += document.lineAt(i).text + '\\n';
            }
            
            // Get context after the change for better inference
            for (let i = change.range.end.line + 1; i <= endLine; i++) {
                if (i < document.lineCount) {
                    contextAfter += document.lineAt(i).text + '\\n';
                }
            }

            // Claude-specific prompt inference
            if (aiProvider === 'claude') {
                return this.inferClaudePrompt(change, contextBefore, contextAfter, document);
            }
            
            // Copilot-specific prompt inference
            if (aiProvider === 'copilot') {
                return this.inferCopilotPrompt(change, contextBefore, document);
            }
            
            // Cursor-specific prompt inference
            if (aiProvider === 'cursor') {
                return this.inferCursorPrompt(change, contextBefore, document);
            }

            // Generic prompt inference
            return this.inferGenericPrompt(change, contextBefore, document);
        } catch (error) {
            return `${aiProvider.toUpperCase()} code generation in ${document.fileName}`;
        }
    }

    /**
     * Claude-specific prompt inference based on typical Claude patterns
     */
    private inferClaudePrompt(
        change: vscode.TextDocumentContentChangeEvent,
        contextBefore: string,
        contextAfter: string,
        document: vscode.TextDocument
    ): string {
        const generatedText = change.text;
        
        // Claude often generates complete functions with explanatory comments
        if (this.isCompleteFunction(generatedText, document.languageId)) {
            if (this.hasThoughtfulComments(generatedText, document.languageId)) {
                return `Write a complete function with comments for: ${contextBefore.trim() || 'the given requirements'}`;
            }
            return `Implement the function: ${contextBefore.trim() || 'based on context'}`;
        }
        
        // Claude frequently adds detailed comments
        if (this.hasThoughtfulComments(generatedText, document.languageId)) {
            return `Add detailed comments explaining: ${contextBefore.trim() || 'this code'}`;
        }
        
        // Claude often generates multi-line, well-structured code blocks
        if (generatedText.split('\\n').length > 10) {
            const firstLine = contextBefore.split('\\n').pop()?.trim() || '';
            if (firstLine.includes('class') || firstLine.includes('interface')) {
                return `Create a ${firstLine.includes('class') ? 'class' : 'interface'} implementation for: ${firstLine}`;
            }
            return `Generate a comprehensive code block to ${this.inferIntentFromContext(contextBefore, contextAfter)}`;
        }
        
        // Claude often refactors or improves existing code
        if (contextBefore.trim() && generatedText.length > contextBefore.length) {
            return `Refactor and improve this code: ${contextBefore.trim()}`;
        }
        
        // Default Claude prompt
        return `Generate code to ${this.inferIntentFromContext(contextBefore, contextAfter) || 'solve the problem'}`;
    }

    /**
     * Copilot-specific prompt inference
     */
    private inferCopilotPrompt(
        change: vscode.TextDocumentContentChangeEvent,
        contextBefore: string,
        document: vscode.TextDocument
    ): string {
        const generatedText = change.text;
        
        // Copilot often completes partial lines or functions
        if (this.isFunctionLikeContent(generatedText, document.languageId)) {
            return `Complete the function: ${contextBefore.trim()}`;
        }
        
        // Copilot frequently generates inline completions
        if (generatedText.split('\\n').length <= 3) {
            return `Complete this line: ${contextBefore.split('\\n').pop()?.trim() || contextBefore.trim()}`;
        }
        
        // Copilot comment completions
        if (this.isCommentLikeContent(generatedText, document.languageId)) {
            return `Generate comment for: ${contextBefore.trim()}`;
        }
        
        return `Copilot completion for: ${contextBefore.trim() || 'code generation'}`;
    }

    /**
     * Cursor-specific prompt inference
     */
    private inferCursorPrompt(
        change: vscode.TextDocumentContentChangeEvent,
        contextBefore: string,
        document: vscode.TextDocument
    ): string {
        const generatedText = change.text;
        
        // Cursor often generates focused, concise completions
        if (generatedText.length < 100) {
            return `Complete: ${contextBefore.split('\\n').pop()?.trim() || contextBefore.trim()}`;
        }
        
        return `Cursor completion for: ${contextBefore.trim() || 'code generation'}`;
    }

    /**
     * Generic prompt inference for unknown AI providers
     */
    private inferGenericPrompt(
        change: vscode.TextDocumentContentChangeEvent,
        contextBefore: string,
        document: vscode.TextDocument
    ): string {
        const generatedText = change.text;
        
        if (this.isCommentLikeContent(generatedText, document.languageId)) {
            return `Generate comment for: ${contextBefore.trim()}`;
        }
        
        if (this.isFunctionLikeContent(generatedText, document.languageId)) {
            return `Complete function implementation: ${contextBefore.trim()}`;
        }

        return `Code completion for: ${contextBefore.trim() || 'code generation'}`;
    }

    /**
     * Infer intent from surrounding context
     */
    private inferIntentFromContext(contextBefore: string, contextAfter: string): string {
        const combined = (contextBefore + ' ' + contextAfter).toLowerCase();
        
        if (combined.includes('todo') || combined.includes('fixme')) {
            return 'implement TODO or fix issue';
        }
        if (combined.includes('test') || combined.includes('spec')) {
            return 'write tests';
        }
        if (combined.includes('error') || combined.includes('exception')) {
            return 'handle errors';
        }
        if (combined.includes('async') || combined.includes('await') || combined.includes('promise')) {
            return 'implement async functionality';
        }
        if (combined.includes('api') || combined.includes('endpoint')) {
            return 'implement API functionality';
        }
        if (combined.includes('database') || combined.includes('query')) {
            return 'implement database operations';
        }
        
        return 'implement functionality';
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
        console.log(`AIAssistantDetectionService: Monitoring editor ${editor.document.fileName} for inline completions`);
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
                    console.log('AIAssistantDetectionService: Large selection detected, potential Copilot interaction');
                }
            }
        }
    }

    /**
     * Track editor context for better interaction detection
     */
    private trackEditorContext(editor: vscode.TextEditor): void {
        console.log(`AIAssistantDetectionService: Tracking editor context for ${editor.document.fileName}`);
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
            console.log('AIAssistantDetectionService: Test environment detected, skipping cleanup timer');
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
    public onInteractionDetected(listener: (interaction: Omit<AIInteraction, 'id' | 'timestamp'>) => void): vscode.Disposable {
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
        const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
            prompt,
            response,
            aiProvider: 'other',
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
                console.error('AIAssistantDetectionService: Error in manual interaction listener:', error);
            }
        });
    }

    /**
     * Initialize integration with Claude Code (binary-based, not VS Code extension)
     */
    private async initializeClaudeExtension(): Promise<void> {
        try {
            // Claude Code is not a VS Code extension - it's a standalone binary
            // Instead, we'll detect its presence and set up monitoring for its interactions
            console.log('AIAssistantDetectionService: Initializing Claude Code detection (binary-based)');
            
            // Check if Claude Code binary might be available
            const isClaudeAvailable = await this.checkClaudeCodeAvailability();
            if (isClaudeAvailable) {
                console.log('AIAssistantDetectionService: Claude Code binary detected');
                this.claudeExtension = { isActive: true } as any; // Mock extension object for compatibility
                
                // Set up enhanced file system monitoring for Claude Code
                this.setupClaudeFileSystemMonitoring();
                
                // Set up process monitoring
                this.setupClaudeProcessMonitoring();
            } else {
                console.log('AIAssistantDetectionService: Claude Code binary not found or not accessible');
            }
        } catch (error) {
            console.error('AIAssistantDetectionService: Error initializing Claude detection:', error);
        }
    }

    /**
     * Initialize integration with Cursor extension
     */
    private async initializeCursorExtension(): Promise<void> {
        try {
            // Check for Cursor-related extensions
            this.cursorExtension = vscode.extensions.getExtension('cursor.cursor') ||
                                   vscode.extensions.getExtension('anysphere.cursor');
            
            if (this.cursorExtension) {
                console.log('AIAssistantDetectionService: Cursor extension detected');
                if (!this.cursorExtension.isActive) {
                    await this.cursorExtension.activate();
                }
            } else {
                console.log('AIAssistantDetectionService: Cursor extension not found');
            }
        } catch (error) {
            console.error('AIAssistantDetectionService: Error initializing Cursor extension:', error);
        }
    }

    /**
     * Set up Claude Code specific detection patterns
     */
    private setupClaudeCodeDetection(): void {
        console.log('AIAssistantDetectionService: Setting up Claude Code detection');
        
        // Monitor terminal processes for claude command execution
        this.setupTerminalMonitoring();
        
        // Monitor for keyboard shortcuts used by Claude Code
        this.setupClaudeKeyboardShortcuts();
        
        // Monitor for large text insertions that might be Claude-generated
        // Claude Code often inserts substantial blocks of code at once
        // We'll enhance the text change detection to identify Claude patterns
    }

    /**
     * Set up monitoring for Claude Code extension commands
     */
    private setupClaudeCommandMonitoring(): void {
        if (!this.claudeExtension) {
            return;
        }

        // Monitor for Claude Code commands being executed
        const originalExecuteCommand = vscode.commands.executeCommand;
        
        // Wrap the executeCommand to detect Claude Code usage
        const commandMonitor = async (command: string, ...args: any[]) => {
            // Check if this is a Claude Code command
            if (command.startsWith('claude-code.') || command.includes('claude')) {
                console.log(`AIAssistantDetectionService: Claude Code command detected: ${command}`);
                this.handleClaudeCommandExecution(command, args);
            }
            
            return originalExecuteCommand.call(vscode.commands, command, ...args);
        };

        // Note: This is a conceptual approach - VS Code doesn't allow direct command interception
        // In practice, we'd need to listen for specific events or use other detection methods
        console.log('AIAssistantDetectionService: Claude Code command monitoring initialized');
    }

    /**
     * Handle detected Claude Code command execution
     */
    private handleClaudeCommandExecution(command: string, args: any[]): void {
        console.log(`AIAssistantDetectionService: Processing Claude Code command: ${command}`);
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
            prompt: `Claude Code command: ${command}`,
            response: 'Claude Code command executed',
            aiProvider: 'claude',
            fileContext: {
                fileName: editor.document.fileName,
                language: editor.document.languageId,
                selection: editor.selection ? {
                    start: { line: editor.selection.start.line, character: editor.selection.start.character },
                    end: { line: editor.selection.end.line, character: editor.selection.end.character }
                } : undefined,
                content: editor.selection && !editor.selection.isEmpty ? 
                    editor.document.getText(editor.selection) : undefined
            },
            interactionType: 'generation'
        };

        this.interactionListeners.forEach(listener => {
            try {
                listener(interaction);
            } catch (error) {
                console.error('AIAssistantDetectionService: Error in Claude command listener:', error);
            }
        });
    }

    /**
     * Monitor terminal processes for Claude Code usage
     */
    private setupTerminalMonitoring(): void {
        // Monitor when terminals are created - Claude Code auto-installs when run
        const terminalListener = vscode.window.onDidOpenTerminal((terminal) => {
            this.monitorTerminalForClaude(terminal);
        });
        this.disposables.push(terminalListener);

        // Monitor existing terminals
        vscode.window.terminals.forEach(terminal => {
            this.monitorTerminalForClaude(terminal);
        });

        // Monitor when terminals close (Claude sessions ending)
        const terminalCloseListener = vscode.window.onDidCloseTerminal((terminal) => {
            console.log('AIAssistantDetectionService: Terminal closed, potential Claude session ended');
        });
        this.disposables.push(terminalCloseListener);
    }

    /**
     * Monitor a specific terminal for Claude Code commands
     */
    private monitorTerminalForClaude(terminal: vscode.Terminal): void {
        // Unfortunately, VS Code doesn't provide direct access to terminal command history
        // But we can monitor when the terminal becomes active and look for Claude-related patterns
        
        console.log(`AIAssistantDetectionService: Monitoring terminal "${terminal.name}" for Claude activity`);
        
        // Monitor when this terminal sends text (if possible through future VS Code API updates)
        // For now, we'll rely on heuristic detection when Claude Code generates code
        
        // Attempt to detect Claude process if possible
        this.detectClaudeProcess();
    }

    /**
     * Check if Claude Code binary is available on the system
     */
    private async checkClaudeCodeAvailability(): Promise<boolean> {
        try {
            // Check if we're in a Node.js environment with child_process access
            if (typeof require !== 'undefined') {
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);
                
                try {
                    // Try to run claude --version or which claude
                    const command = process.platform === 'win32' ? 'where claude' : 'which claude';
                    await execAsync(command);
                    return true;
                } catch {
                    // Claude binary not found in PATH, but it might still be installed
                    console.log('AIAssistantDetectionService: Claude binary not found in PATH');
                    return false;
                }
            }
            return false;
        } catch (error) {
            console.log('AIAssistantDetectionService: Cannot check Claude availability:', error);
            return false;
        }
    }

    /**
     * Set up enhanced file system monitoring specifically for Claude Code
     */
    private setupClaudeFileSystemMonitoring(): void {
        console.log('AIAssistantDetectionService: Setting up Claude Code file system monitoring');
        
        // Monitor for rapid file changes that are characteristic of Claude Code
        const fileSystemWatcher = vscode.workspace.onDidChangeTextDocument((event) => {
            // Claude Code often makes large, instantaneous changes to files
            this.analyzeForClaudeCodePatterns(event);
        });
        
        this.disposables.push(fileSystemWatcher);
        
        // Monitor when files are saved (Claude often auto-saves after generation)
        const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
            this.checkForClaudeCodeSavePattern(document);
        });
        
        this.disposables.push(saveListener);
    }

    /**
     * Set up process monitoring for Claude Code
     */
    private setupClaudeProcessMonitoring(): void {
        console.log('AIAssistantDetectionService: Setting up Claude Code process monitoring');
        
        // Set up periodic process monitoring
        const processCheckInterval = setInterval(() => {
            this.detectClaudeProcess();
        }, 5000); // Check every 5 seconds
        
        this.disposables.push({
            dispose: () => clearInterval(processCheckInterval)
        });
    }

    /**
     * Analyze text changes for Claude Code specific patterns
     */
    private analyzeForClaudeCodePatterns(event: vscode.TextDocumentChangeEvent): void {
        for (const change of event.contentChanges) {
            // Claude Code characteristics:
            // 1. Large blocks of text inserted instantly
            // 2. Well-formatted, complete functions/classes
            // 3. Often includes detailed comments
            // 4. May include multiple files being modified simultaneously
            
            if (change.text.length > 100 && change.rangeLength === 0) {
                const claudeConfidence = this.calculateClaudeCodeConfidence(change.text, event.document);
                
                if (claudeConfidence > 0.6) {
                    console.log(`🧠 Claude Code pattern detected with confidence: ${Math.round(claudeConfidence * 100)}%`);
                    
                    // Create a Claude-specific interaction
                    const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
                        prompt: this.inferClaudeCodePrompt(change.text, event.document),
                        response: change.text,
                        aiProvider: 'claude',
                        fileContext: {
                            fileName: event.document.fileName,
                            language: event.document.languageId,
                            selection: change.range ? {
                                start: { line: change.range.start.line, character: change.range.start.character },
                                end: { line: change.range.end.line, character: change.range.end.character }
                            } : undefined,
                            content: change.text
                        },
                        interactionType: 'generation'
                    };
                    
                    this.notifyInteractionListeners(interaction);
                }
            }
        }
    }

    /**
     * Calculate confidence that a text change was generated by Claude Code
     */
    private calculateClaudeCodeConfidence(text: string, document: vscode.TextDocument): number {
        let confidence = 0;
        
        // Claude Code characteristics
        
        // 1. Large, complete code blocks
        if (text.length > 200) {
            confidence += 0.2;
        }
        
        // 2. Multiple lines with proper structure
        const lines = text.split('\n');
        if (lines.length > 10) {
            confidence += 0.15;
        }
        
        // 3. Detailed comments and documentation
        if (this.hasThoughtfulComments(text, document.languageId)) {
            confidence += 0.25;
        }
        
        // 4. Complete functions with proper error handling
        if (this.isCompleteFunction(text, document.languageId) && this.hasErrorHandling(text, document.languageId)) {
            confidence += 0.2;
        }
        
        // 5. Type annotations and modern patterns
        if (this.hasTypeAnnotations(text, document.languageId)) {
            confidence += 0.1;
        }
        
        // 6. Claude-specific markers
        if (this.hasClaudeCodeMarkers(text)) {
            confidence += 0.15;
        }
        
        // 7. Verbose, explanatory style
        if (this.isVerboseCode(text)) {
            confidence += 0.1;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * Infer what prompt might have generated this Claude Code
     */
    private inferClaudeCodePrompt(generatedText: string, document: vscode.TextDocument): string {
        // Analyze the generated content to infer the likely prompt
        
        if (this.isCompleteFunction(generatedText, document.languageId)) {
            if (this.hasThoughtfulComments(generatedText, document.languageId)) {
                return `Write a complete, well-documented function for ${document.fileName}`;
            }
            return `Implement a function in ${document.fileName}`;
        }
        
        if (generatedText.includes('class ') || generatedText.includes('interface ')) {
            return `Create a class/interface implementation for ${document.fileName}`;
        }
        
        if (this.hasErrorHandling(generatedText, document.languageId)) {
            return `Write robust code with error handling for ${document.fileName}`;
        }
        
        if (generatedText.split('\n').length > 20) {
            return `Generate a comprehensive code solution for ${document.fileName}`;
        }
        
        return `Claude Code generation for ${document.fileName}`;
    }

    /**
     * Check for save patterns typical of Claude Code
     */
    private checkForClaudeCodeSavePattern(document: vscode.TextDocument): void {
        // Claude Code often saves files after making changes
        // Look for recent large changes that might indicate Claude involvement
        
        const documentUri = document.uri.toString();
        const recentChanges = Array.from(this.recentTextChanges.values())
            .filter(change => Date.now() - change.timestamp < 2000); // Within last 2 seconds
        
        if (recentChanges.length > 0) {
            const totalChanges = recentChanges.reduce((sum, change) => sum + change.change.text.length, 0);
            
            if (totalChanges > 200) {
                console.log('AIAssistantDetectionService: Claude Code save pattern detected');
                // This reinforces our confidence in recent Claude detections
            }
        }
    }

    /**
     * Attempt to detect Claude Code process (system-level detection)
     */
    private detectClaudeProcess(): void {
        // Note: VS Code extensions run in a sandboxed environment with limited process access
        // This is a best-effort approach that may work on some systems
        
        try {
            // Check if we're in a Node.js environment with child_process access
            if (typeof require !== 'undefined') {
                const { exec } = require('child_process');
                
                // Try to detect Claude processes on different platforms
                const command = process.platform === 'win32' 
                    ? 'tasklist /FI "IMAGENAME eq claude*"'
                    : 'ps aux | grep -i claude | grep -v grep';
                
                exec(command, (error: any, stdout: string, stderr: string) => {
                    if (!error && stdout.includes('claude')) {
                        console.log('AIAssistantDetectionService: Claude process detected via system monitor');
                        this.handlePotentialClaudeUsage('terminal_command');
                    }
                });
            }
        } catch (error) {
            // Silently fail - process detection is optional and may not work in all environments
            console.log('AIAssistantDetectionService: Process detection not available in this environment');
        }
    }

    /**
     * Notify all interaction listeners about a detected interaction
     */
    private notifyInteractionListeners(interaction: Omit<AIInteraction, 'id' | 'timestamp'>): void {
        this.interactionListeners.forEach(listener => {
            try {
                listener(interaction);
            } catch (error) {
                console.error('AIAssistantDetectionService: Error in interaction listener:', error);
            }
        });
    }

    /**
     * Set up monitoring for Claude Code keyboard shortcuts
     */
    private setupClaudeKeyboardShortcuts(): void {
        // Claude Code uses Cmd+Esc (Mac) / Ctrl+Esc (Windows/Linux)
        // Unfortunately, VS Code doesn't provide direct keyboard event monitoring
        // But we can register similar commands to detect when users might be using Claude
        
        try {
            const claudeLaunchCommand = vscode.commands.registerCommand(
                'aiAssistantDetection.detectClaudeLaunch',
                () => {
                    console.log('AIAssistantDetectionService: Potential Claude Code launch detected');
                    this.handlePotentialClaudeUsage('keyboard_shortcut');
                }
            );
            this.disposables.push(claudeLaunchCommand);
        } catch (error) {
            console.log('AIAssistantDetectionService: Could not register Claude detection command');
        }
    }

    /**
     * Handle potential Claude Code usage detection
     */
    private handlePotentialClaudeUsage(trigger: 'keyboard_shortcut' | 'terminal_command' | 'text_pattern'): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        console.log(`AIAssistantDetectionService: Claude Code usage detected via ${trigger}`);

        // Create a placeholder interaction that will be refined when actual code changes occur
        const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
            prompt: `Claude Code session initiated via ${trigger}`,
            response: 'Claude Code interaction in progress',
            aiProvider: 'claude',
            fileContext: {
                fileName: editor.document.fileName,
                language: editor.document.languageId,
                selection: editor.selection ? {
                    start: { line: editor.selection.start.line, character: editor.selection.start.character },
                    end: { line: editor.selection.end.line, character: editor.selection.end.character }
                } : undefined,
                content: editor.selection && !editor.selection.isEmpty ? 
                    editor.document.getText(editor.selection) : undefined
            },
            interactionType: 'generation'
        };

        // Store this as a potential interaction - it will be confirmed/refined by text change detection
        this.interactionListeners.forEach(listener => {
            try {
                listener(interaction);
            } catch (error) {
                console.error('AIAssistantDetectionService: Error in Claude usage listener:', error);
            }
        });
    }

    /**
     * Set up Cursor specific detection patterns
     */
    private setupCursorDetection(): void {
        console.log('AIAssistantDetectionService: Setting up Cursor detection');
        
        // Monitor for Cursor-specific patterns in text changes
        // Cursor has different insertion patterns than Copilot
        // We'll enhance the text change detection to identify Cursor patterns
    }

    /**
     * Handle detected Claude Code interaction
     */
    private handleClaudeInteraction(command: { command: string; arguments?: any[] }): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
            prompt: `Claude command: ${command.command}`,
            response: 'Claude Code interaction detected',
            aiProvider: 'claude',
            fileContext: {
                fileName: editor.document.fileName,
                language: editor.document.languageId,
                selection: editor.selection ? {
                    start: { line: editor.selection.start.line, character: editor.selection.start.character },
                    end: { line: editor.selection.end.line, character: editor.selection.end.character }
                } : undefined,
                content: editor.selection ? editor.document.getText(editor.selection) : undefined
            },
            interactionType: 'generation'
        };

        this.interactionListeners.forEach(listener => {
            try {
                listener(interaction);
            } catch (error) {
                console.error('AIAssistantDetectionService: Error in Claude interaction listener:', error);
            }
        });
    }

    /**
     * Handle detected Cursor interaction
     */
    private handleCursorInteraction(command: { command: string; arguments?: any[] }): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
            prompt: `Cursor command: ${command.command}`,
            response: 'Cursor interaction detected',
            aiProvider: 'cursor',
            fileContext: {
                fileName: editor.document.fileName,
                language: editor.document.languageId,
                selection: editor.selection ? {
                    start: { line: editor.selection.start.line, character: editor.selection.start.character },
                    end: { line: editor.selection.end.line, character: editor.selection.end.character }
                } : undefined,
                content: editor.selection ? editor.document.getText(editor.selection) : undefined
            },
            interactionType: 'generation'
        };

        this.interactionListeners.forEach(listener => {
            try {
                listener(interaction);
            } catch (error) {
                console.error('AIAssistantDetectionService: Error in Cursor interaction listener:', error);
            }
        });
    }

    /**
     * Detect Claude Code interactions based on patterns typical of Claude
     */
    private detectClaudeInteraction(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument
    ): AIDetectionResult {
        // Use the enhanced Claude-specific confidence calculation
        const confidence = this.calculateClaudeCodeConfidence(change.text, document);
        let interactionType: 'chat' | 'inline' | 'comment' | 'completion' | 'generation' = 'generation';

        // Determine interaction type based on content characteristics
        if (this.hasThoughtfulComments(change.text, document.languageId)) {
            interactionType = 'comment';
        } else if (change.text.length < 50) {
            interactionType = 'completion';
        } else if (this.isCompleteFunction(change.text, document.languageId)) {
            interactionType = 'generation';
        }

        // Claude Code uses a lower threshold since it has very distinct patterns
        const detected = confidence > 0.5;
        
        if (detected) {
            const lines = change.text.split('\n');
            console.log(`🧠 CLAUDE CODE DETECTED: length=${change.text.length}, lines=${lines.length}, confidence=${Math.round(confidence * 100)}%, type=${interactionType}`);
            console.log(`🧠 Claude content preview: ${change.text.substring(0, 150).replace(/\n/g, '\\n')}...`);
        }

        return {
            detected,
            confidence,
            aiProvider: 'claude',
            interactionType,
            context: {
                fileUri: document.uri,
                language: document.languageId,
                range: change.range
            }
        };
    }

    /**
     * Detect Cursor interactions
     */
    private detectCursorInteraction(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument
    ): AIDetectionResult {
        let confidence = 0;
        let interactionType: 'chat' | 'inline' | 'comment' | 'completion' | 'generation' = 'completion';

        // Cursor has different patterns than Copilot
        if (change.text.length > 20 && change.rangeLength === 0) {
            confidence += 0.3;
        }

        // Check for Cursor extension presence
        if (this.cursorExtension && this.cursorExtension.isActive) {
            confidence += 0.4;
        }

        // Cursor-specific code patterns
        if (this.isCursorLikeCode(change.text, document.languageId)) {
            confidence += 0.2;
        }

        return {
            detected: confidence > 0.4,
            confidence,
            aiProvider: 'cursor',
            interactionType,
            context: {
                fileUri: document.uri,
                language: document.languageId,
                range: change.range
            }
        };
    }

    /**
     * Generic AI detection for unknown providers
     */
    private detectGenericAI(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument
    ): AIDetectionResult {
        let confidence = 0;
        let interactionType: 'chat' | 'inline' | 'comment' | 'completion' | 'generation' = 'generation';

        // Look for AI-like patterns
        if (change.text.length > 50 && change.rangeLength === 0) {
            confidence += 0.3;
        }

        // Instant large text insertion
        const documentUri = document.uri.toString();
        const typingSpeed = this.getRecentTypingSpeed(documentUri);
        if (typingSpeed === 0 && change.text.length > 20) {
            confidence += 0.3;
        }

        // Well-structured code patterns
        if (this.isStructuredCode(change.text, document.languageId)) {
            confidence += 0.2;
        }

        return {
            detected: confidence > 0.4,
            confidence,
            aiProvider: 'other',
            interactionType,
            context: {
                fileUri: document.uri,
                language: document.languageId,
                range: change.range
            }
        };
    }

    /**
     * Check if text contains thoughtful comments typical of Claude
     */
    private hasThoughtfulComments(text: string, language: string): boolean {
        const commentPatterns = {
            'typescript': /\/\/\s*[A-Z][^\/]*(?:implementation|approach|strategy|explanation)/i,
            'javascript': /\/\/\s*[A-Z][^\/]*(?:implementation|approach|strategy|explanation)/i,
            'python': /#\s*[A-Z][^#]*(?:implementation|approach|strategy|explanation)/i,
            'java': /\/\/\s*[A-Z][^\/]*(?:implementation|approach|strategy|explanation)/i
        };
        
        const pattern = commentPatterns[language as keyof typeof commentPatterns];
        return pattern ? pattern.test(text) : false;
    }

    /**
     * Check if text represents a complete function
     */
    private isCompleteFunction(text: string, language: string): boolean {
        const functionPatterns = {
            'typescript': /(?:function\s+\w+|const\s+\w+\s*=|class\s+\w+)[\s\S]*\{[\s\S]*\}/,
            'javascript': /(?:function\s+\w+|const\s+\w+\s*=|class\s+\w+)[\s\S]*\{[\s\S]*\}/,
            'python': /def\s+\w+\([\s\S]*?\):[\s\S]+/,
            'java': /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*\}/
        };
        
        const pattern = functionPatterns[language as keyof typeof functionPatterns];
        return pattern ? pattern.test(text) : text.includes('{') && text.includes('}');
    }

    /**
     * Check for Cursor-specific code patterns
     */
    private isCursorLikeCode(text: string, language: string): boolean {
        // Cursor often generates more concise, focused code snippets
        return text.length < 200 && text.split('\n').length <= 10 && this.isCodeLikeContent(text, language);
    }

    /**
     * Check if text is well-structured code
     */
    private isStructuredCode(text: string, language: string): boolean {
        const lines = text.split('\n');
        const indentedLines = lines.filter(line => line.match(/^\s+/));
        return indentedLines.length > lines.length * 0.3; // 30% of lines are indented
    }

    /**
     * Check if code has documentation (JSDoc, docstrings, etc.)
     */
    private hasDocumentation(text: string, language: string): boolean {
        const docPatterns = {
            'typescript': /\/\*\*[\s\S]*?\*\/|\/\/\s*@\w+/,
            'javascript': /\/\*\*[\s\S]*?\*\/|\/\/\s*@\w+/,
            'python': /"""[\s\S]*?"""|'''[\s\S]*?'''|#\s*@\w+/,
            'java': /\/\*\*[\s\S]*?\*\/|\/\/\s*@\w+/,
            'csharp': /\/\*\*[\s\S]*?\*\/|\/\/\s*<\w+>/
        };
        
        const pattern = docPatterns[language as keyof typeof docPatterns];
        return pattern ? pattern.test(text) : false;
    }

    /**
     * Check if lines have consistent indentation
     */
    private hasConsistentIndentation(lines: string[]): boolean {
        const indentedLines = lines.filter(line => line.trim().length > 0 && line.match(/^\s+/));
        if (indentedLines.length < 2) {
            return false;
        }
        
        // Check if indentation follows a consistent pattern (2, 4, or tab spaces)
        const indentations = indentedLines.map(line => {
            const match = line.match(/^(\s+)/);
            return match ? match[1].length : 0;
        });
        
        // Check for consistent 2-space or 4-space indentation
        const hasConsistent2Space = indentations.every(indent => indent % 2 === 0);
        const hasConsistent4Space = indentations.every(indent => indent % 4 === 0);
        
        return hasConsistent2Space || hasConsistent4Space;
    }

    /**
     * Check if code includes error handling patterns
     */
    private hasErrorHandling(text: string, language: string): boolean {
        const errorPatterns = {
            'typescript': /try\s*\{|catch\s*\(|throw\s+|Error\(|\.catch\(|Promise\.reject/,
            'javascript': /try\s*\{|catch\s*\(|throw\s+|Error\(|\.catch\(|Promise\.reject/,
            'python': /try:|except\s+|raise\s+|Exception\(|finally:/,
            'java': /try\s*\{|catch\s*\(|throw\s+|throws\s+|Exception/,
            'csharp': /try\s*\{|catch\s*\(|throw\s+|Exception/,
            'go': /if\s+err\s*!=\s*nil|error\s*\{|panic\(/,
            'rust': /Result<|Error>|\.unwrap\(|\.expect\(|panic!/
        };
        
        const pattern = errorPatterns[language as keyof typeof errorPatterns];
        return pattern ? pattern.test(text) : /error|exception|catch|try/i.test(text);
    }

    /**
     * Check if code has type annotations
     */
    private hasTypeAnnotations(text: string, language: string): boolean {
        const typePatterns = {
            'typescript': /:\s*\w+(\[\])?(\s*\|\s*\w+)*\s*[=;,\)]/,
            'python': /:\s*\w+(\[.*?\])?(\s*\|\s*\w+)*\s*[=,\)]/,
            'java': /\b(public|private|protected)\s+\w+\s+\w+\s*\(/,
            'csharp': /\b(public|private|protected)\s+\w+\s+\w+\s*\(/,
            'go': /func\s+\w+\s*\([^)]*\)\s*\w+/,
            'rust': /:\s*&?\w+|fn\s+\w+\([^)]*\)\s*->/
        };
        
        const pattern = typePatterns[language as keyof typeof typePatterns];
        return pattern ? pattern.test(text) : false;
    }

    /**
     * Check for Claude Code specific markers and patterns
     */
    private hasClaudeCodeMarkers(text: string): boolean {
        // Claude Code often includes specific patterns in generated code
        const claudeMarkers = [
            // Claude often includes detailed explanations
            /\/\/ Here's how/i,
            /\/\/ This function/i,
            /\/\/ Note that/i,
            /\/\/ The following/i,
            
            // Claude frequently uses specific phrasings
            /\/\/ We can use/i,
            /\/\/ Let's create/i,
            /\/\/ First, we'll/i,
            /\/\/ To accomplish this/i,
            
            // Python specific Claude patterns
            /# Here's how/i,
            /# This function/i,
            /# We can use/i,
            /# Let's create/i,
            
            // Claude's typical error handling patterns
            /try:\s*\n\s*\/\/ or #.*implementation/i,
            /except.*:\s*\n\s*\/\/ or #.*handle/i,
            
            // Claude often includes type hints and detailed docstrings
            /def\s+\w+\([^)]*\)\s*->\s*\w+:\s*\n\s*"""/,
            /function\s+\w+\([^)]*\):\s+\w+\s*{\s*\/\*\*/
        ];
        
        return claudeMarkers.some(pattern => pattern.test(text));
    }

    /**
     * Check if code is verbose (characteristic of Claude's explanatory style)
     */
    private isVerboseCode(text: string): boolean {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length < 5) {
            return false;
        }
        
        // Look for verbose patterns
        const commentLines = lines.filter(line => 
            line.trim().startsWith('//') || 
            line.trim().startsWith('#') || 
            line.trim().startsWith('/*') ||
            line.trim().startsWith('*')
        );
        
        // Claude tends to have more comments relative to code
        const commentRatio = commentLines.length / lines.length;
        
        // Claude also uses longer variable/function names
        const hasDescriptiveNames = /\w{8,}/.test(text); // 8+ char identifiers
        
        // Claude often includes multiple blank lines for readability
        const hasSpacing = text.includes('\n\n');
        
        return commentRatio > 0.2 || hasDescriptiveNames || hasSpacing;
    }

    /**
     * Update captureInteraction to handle AI interactions
     */
    private async captureAIInteraction(
        change: vscode.TextDocumentContentChangeEvent,
        document: vscode.TextDocument,
        detection: AIDetectionResult
    ): Promise<void> {
        try {
            // Try to infer the prompt context from surrounding code, AI-specific
            const prompt = await this.inferPromptFromContext(change, document, detection.aiProvider);
            
            const interaction: Omit<AIInteraction, 'id' | 'timestamp'> = {
                prompt,
                response: change.text,
                aiProvider: detection.aiProvider,
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
                    console.error('AIAssistantDetectionService: Error in interaction listener:', error);
                }
            });

            console.log(`🤖 AI DETECTED: ${detection.aiProvider.toUpperCase()} interaction with confidence ${Math.round(detection.confidence * 100)}% (${detection.interactionType})`);
        } catch (error) {
            console.error('AIAssistantDetectionService: Error capturing AI interaction:', error);
        }
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.interactionListeners = [];
        this.recentTextChanges.clear();
        this.userTypingPatterns.clear();
    }
}