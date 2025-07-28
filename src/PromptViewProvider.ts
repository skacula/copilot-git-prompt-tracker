import * as vscode from 'vscode';
import { GitHubService, PromptEntry } from './GitHubService';
import { ConfigurationManager } from './ConfigurationManager';

export class PromptViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = 'copilotPromptTracker.promptsView';
    
    private _view?: vscode.WebviewView;
    private readonly _extensionUri: vscode.Uri;
    private _disposed = false;
    
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly githubService: GitHubService,
        private readonly configManager: ConfigurationManager
    ) {
        this._extensionUri = context.extensionUri;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'refresh':
                        this.refreshPrompts();
                        break;
                    case 'configure':
                        vscode.commands.executeCommand('copilotPromptTracker.configure');
                        break;
                    case 'openPrompt':
                        this.openPromptDetails(message.prompt);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Load prompts when view is created
        this.refreshPrompts();
    }

    private async refreshPrompts() {
        if (!this._view || this._disposed) {
            return;
        }

        const config = this.configManager.getConfiguration();
        if (!config.githubRepo) {
            this._view.webview.postMessage({
                type: 'noConfig',
                message: 'Please configure your GitHub repository first.'
            });
            return;
        }

        try {
            const [owner, repo] = config.githubRepo.split('/');
            const prompts = await this.githubService.listPrompts(owner, repo, config.saveLocation);
            
            this._view.webview.postMessage({
                type: 'prompts',
                data: prompts
            });
        } catch (error) {
            console.error('Failed to load prompts:', error);
            this._view.webview.postMessage({
                type: 'error',
                message: 'Failed to load prompts. Please check your configuration.'
            });
        }
    }

    private async openPromptDetails(prompt: PromptEntry) {
        // Create a new document with the prompt details
        const content = this.formatPromptForDisplay(prompt);
        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }

    private formatPromptForDisplay(prompt: PromptEntry): string {
        // Extract clean prompts from session data
        const cleanPrompts = this.extractCleanPrompts(prompt.prompt);
        
        return `# AI Prompt Session

**🌿 Branch:** ${prompt.gitInfo.branch}
**📝 Commit:** ${prompt.gitInfo.commitHash}
**👤 Author:** ${prompt.gitInfo.author}

## 📁 Files Modified
${prompt.gitInfo.changedFiles.map(file => `- ${file}`).join('\n')}

## 💬 Prompts & Responses
${cleanPrompts}

---
*Captured on ${new Date(prompt.timestamp).toLocaleString()}*
`;
    }

    private extractCleanPrompts(rawPrompt: string): string {
        // Handle legacy "Development Session" format
        if (rawPrompt.includes('Development Session:')) {
            const lines = rawPrompt.split('\n');
            let extractedContent = '';
            let inInteractionSection = false;
            
            for (const line of lines) {
                if (line.includes('Copilot Interactions:') || line.includes('AI Interactions:')) {
                    inInteractionSection = true;
                    continue;
                }
                
                if (inInteractionSection && line.trim()) {
                    extractedContent += line + '\n';
                }
            }
            
            return extractedContent.trim() || 'Legacy session data with no extracted prompts';
        }
        
        // Handle new clean format
        const lines = rawPrompt.split('\n');
        let cleanPrompts = '';
        let currentInteraction = '';
        
        for (const line of lines) {
            // Look for interaction markers
            const interactionMatch = line.match(/^\[(\d+)\]\s*(CHAT|INLINE|COMMENT|COMPLETION|GENERATION):\s*(.+)$/);
            if (interactionMatch) {
                if (currentInteraction) {
                    cleanPrompts += currentInteraction + '\n\n';
                }
                const [, num, type, content] = interactionMatch;
                currentInteraction = `**${num}. ${type}:** ${content}`;
            } else if (line.trim() && currentInteraction) {
                // Continue building current interaction
                currentInteraction += '\n' + line;
            }
        }
        
        if (currentInteraction) {
            cleanPrompts += currentInteraction;
        }
        
        return cleanPrompts || 'No prompts found in session data';
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Copilot Prompts</title>
                <style>
                    body {
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        font-weight: var(--vscode-font-weight);
                        padding: 10px;
                        margin: 0;
                        max-width: 100%;
                        overflow-x: hidden;
                        box-sizing: border-box;
                    }
                    
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 16px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    .title {
                        font-size: 16px;
                        font-weight: bold;
                        color: var(--vscode-foreground);
                    }
                    
                    .actions {
                        display: flex;
                        gap: 8px;
                    }
                    
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 6px 12px;
                        border-radius: 2px;
                        cursor: pointer;
                        font-size: 12px;
                    }
                    
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    .secondary-button {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                    }
                    
                    .secondary-button:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    
                    .prompt-list {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }
                    
                    .prompt-item {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        padding: 14px;
                        cursor: pointer;
                        transition: background-color 0.1s;
                        margin-bottom: 8px;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    
                    .prompt-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    
                    .prompt-header {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                        margin-bottom: 6px;
                        flex-wrap: wrap;
                    }
                    
                    .prompt-branch {
                        font-size: 12px;
                        color: var(--vscode-charts-green);
                        font-weight: 500;
                    }
                    
                    .prompt-commit {
                        font-size: 12px;
                        color: var(--vscode-charts-blue);
                        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                    }
                    
                    .prompt-author {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 6px;
                    }
                    
                    .prompt-preview {
                        font-size: 13px;
                        color: var(--vscode-foreground);
                        line-height: 1.5;
                        margin-bottom: 8px;
                        background-color: var(--vscode-textCodeBlock-background);
                        padding: 10px;
                        border-radius: 4px;
                        border-left: 3px solid var(--vscode-charts-purple);
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        white-space: normal;
                        max-width: 100%;
                        box-sizing: border-box;
                    }
                    
                    .prompt-files {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        background-color: var(--vscode-inputOption-activeBackground);
                        padding: 4px 8px;
                        border-radius: 3px;
                        font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        white-space: normal;
                        max-width: 100%;
                        box-sizing: border-box;
                    }
                    
                    .empty-state {
                        text-align: center;
                        padding: 40px 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .loading {
                        text-align: center;
                        padding: 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .error {
                        color: var(--vscode-errorForeground);
                        text-align: center;
                        padding: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">🤖 AI Prompts</div>
                    <div class="actions">
                        <button id="refresh-button" class="secondary-button">↻ Refresh</button>
                        <button id="configure-button">⚙️ Configure</button>
                    </div>
                </div>
                
                <div id="content">
                    <div class="loading">Loading prompts...</div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    // Add event listeners when DOM is loaded
                    document.addEventListener('DOMContentLoaded', function() {
                        document.getElementById('refresh-button').addEventListener('click', refresh);
                        document.getElementById('configure-button').addEventListener('click', configure);
                    });
                    
                    function refresh() {
                        vscode.postMessage({ type: 'refresh' });
                        document.getElementById('content').innerHTML = '<div class="loading">Loading prompts...</div>';
                    }
                    
                    function configure() {
                        vscode.postMessage({ type: 'configure' });
                    }
                    
                    function openPrompt(prompt) {
                        vscode.postMessage({ 
                            type: 'openPrompt', 
                            prompt: prompt 
                        });
                    }
                    
                    function truncatePrompt(prompt) {
                        if (!prompt) return 'No prompt available';
                        
                        // Handle old "Development Session" format
                        if (prompt.includes('Development Session:')) {
                            return 'Legacy session data - click to view details';
                        }
                        
                        // Remove session formatting and get just the core prompts
                        const lines = prompt.split('\\n');
                        const interactionLines = lines.filter(line => 
                            line.match(/^\[[0-9]+\]\s*(CHAT|INLINE|COMMENT|COMPLETION|GENERATION):\s*/)
                        );
                        
                        if (interactionLines.length > 0) {
                            // Show first interaction, cleaned up
                            let firstInteraction = interactionLines[0].replace(/^\[[0-9]+\]\s*(CHAT|INLINE|COMMENT|COMPLETION|GENERATION):\s*/, '');
                            
                            // Clean up common generic prompts
                            if (firstInteraction.startsWith('Code generation in ') || 
                                firstInteraction.startsWith('Code completion for:') ||
                                firstInteraction.startsWith('CLAUDE code generation')) {
                                
                                // Try to extract more meaningful content from other interactions
                                if (interactionLines.length > 1) {
                                    firstInteraction = interactionLines[1].replace(/^\[[0-9]+\]\s*(CHAT|INLINE|COMMENT|COMPLETION|GENERATION):\s*/, '');
                                } else {
                                    firstInteraction = 'AI code generation';
                                }
                            }
                            
                            return firstInteraction.length > 100 ? firstInteraction.substring(0, 100) + '...' : firstInteraction;
                        }
                        
                        // Direct prompt without formatting
                        if (prompt.length > 100) {
                            return prompt.substring(0, 100) + '...';
                        }
                        
                        return prompt;
                    }
                    
                    function formatFilesList(files) {
                        if (!files || files.length === 0) return 'No files';
                        if (files.length === 1) return files[0];
                        if (files.length <= 3) return files.join(', ');
                        return \`\${files.slice(0, 2).join(', ')} +\${files.length - 2} more\`;
                    }
                    
                    // Listen for messages from the extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        const content = document.getElementById('content');
                        
                        switch (message.type) {
                            case 'prompts':
                                displayPrompts(message.data);
                                break;
                            case 'noConfig':
                                content.innerHTML = \`
                                    <div class="empty-state">
                                        <p>\${message.message}</p>
                                        <button id="configure-now-button">Configure Now</button>
                                    </div>
                                \`;
                                document.getElementById('configure-now-button').addEventListener('click', configure);
                                break;
                            case 'error':
                                content.innerHTML = \`
                                    <div class="error">
                                        <p>\${message.message}</p>
                                        <button id="try-again-button">Try Again</button>
                                    </div>
                                \`;
                                document.getElementById('try-again-button').addEventListener('click', refresh);
                                break;
                        }
                    });
                    
                    function displayPrompts(prompts) {
                        const content = document.getElementById('content');
                        
                        if (prompts.length === 0) {
                            content.innerHTML = \`
                                <div class="empty-state">
                                    <p>No prompts found.</p>
                                    <p>Start using AI assistants and save your prompts!</p>
                                </div>
                            \`;
                            return;
                        }
                        
                        const promptsHtml = prompts.map((prompt, index) => \`
                            <div class="prompt-item" data-prompt-index="\${index}">
                                <div class="prompt-header">
                                    <div class="prompt-branch">🌿 \${prompt.gitInfo.branch}</div>
                                    <div class="prompt-commit">📝 \${prompt.gitInfo.commitHash.substring(0, 7)}</div>
                                </div>
                                <div class="prompt-author">👤 \${prompt.gitInfo.author}</div>
                                <div class="prompt-preview">\${truncatePrompt(prompt.prompt)}</div>
                                <div class="prompt-files">
                                    📁 \${formatFilesList(prompt.gitInfo.changedFiles)}
                                </div>
                            </div>
                        \`).join('');
                        
                        content.innerHTML = \`<div class="prompt-list">\${promptsHtml}</div>\`;
                        
                        // Store prompts data for event handlers
                        window.promptsData = prompts;
                        
                        // Add event delegation for prompt items
                        const promptList = content.querySelector('.prompt-list');
                        if (promptList) {
                            promptList.addEventListener('click', function(e) {
                                const promptItem = e.target.closest('.prompt-item');
                                if (promptItem) {
                                    const index = parseInt(promptItem.dataset.promptIndex);
                                    const prompt = window.promptsData[index];
                                    if (prompt) {
                                        openPrompt(prompt);
                                    }
                                }
                            });
                        }
                    }
                </script>
            </body>
            </html>`;
    }

    public refresh() {
        if (!this._disposed) {
            this.refreshPrompts();
        }
    }

    public dispose() {
        console.log('PromptViewProvider: Starting disposal...');
        this._disposed = true;
        this._view = undefined;
        console.log('PromptViewProvider: Disposal completed');
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
