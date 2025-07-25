import * as vscode from 'vscode';
import { GitHubService, PromptEntry } from './GitHubService';
import { ConfigurationManager } from './ConfigurationManager';

export class PromptViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'copilotPromptTracker.promptsView';
    
    private _view?: vscode.WebviewView;
    private readonly _extensionUri: vscode.Uri;
    
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
        if (!this._view) {
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
        return `# Copilot Prompt Details

**Timestamp:** ${new Date(prompt.timestamp).toLocaleString()}

**Repository:** ${prompt.gitInfo.repository}
**Branch:** ${prompt.gitInfo.branch}
**Commit:** ${prompt.gitInfo.commitHash}
**Author:** ${prompt.gitInfo.author}

## Changed Files
${prompt.gitInfo.changedFiles.map(file => `- ${file}`).join('\n')}

## Prompt
\`\`\`
${prompt.prompt}
\`\`\`

${prompt.response ? `## Response
\`\`\`
${prompt.response}
\`\`\`` : ''}

## Metadata
- **VS Code Version:** ${prompt.metadata.vscodeVersion}
- **Extension Version:** ${prompt.metadata.extensionVersion}
`;
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
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
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
                        border-radius: 4px;
                        padding: 12px;
                        cursor: pointer;
                        transition: background-color 0.1s;
                    }
                    
                    .prompt-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    
                    .prompt-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    
                    .prompt-timestamp {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .prompt-repo {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        background-color: var(--vscode-badge-background);
                        padding: 2px 6px;
                        border-radius: 3px;
                    }
                    
                    .prompt-preview {
                        font-size: 13px;
                        color: var(--vscode-foreground);
                        line-height: 1.4;
                        margin-bottom: 8px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        display: -webkit-box;
                        -webkit-line-clamp: 3;
                        -webkit-box-orient: vertical;
                    }
                    
                    .prompt-meta {
                        display: flex;
                        gap: 12px;
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
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
                    <div class="title">📝 Copilot Prompts</div>
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
                                    <p>Start using Copilot and save your prompts!</p>
                                </div>
                            \`;
                            return;
                        }
                        
                        const promptsHtml = prompts.map((prompt, index) => \`
                            <div class="prompt-item" data-prompt-index="\${index}">
                                <div class="prompt-header">
                                    <div class="prompt-timestamp">\${new Date(prompt.timestamp).toLocaleString()}</div>
                                    <div class="prompt-repo">\${prompt.gitInfo.repository}</div>
                                </div>
                                <div class="prompt-preview">\${prompt.prompt}</div>
                                <div class="prompt-meta">
                                    <span>🌿 \${prompt.gitInfo.branch}</span>
                                    <span>📝 \${prompt.gitInfo.commitHash.substring(0, 7)}</span>
                                    <span>👤 \${prompt.gitInfo.author}</span>
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
        this.refreshPrompts();
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
