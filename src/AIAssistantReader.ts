import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AIChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface CopilotChatSession {
    id: string;
    messages: AIChatMessage[];
    timestamp: number;
}

export class AIAssistantReader {
    private chatHistoryPath: string | null = null;

    constructor() {
        this.findChatHistoryPath();
    }

    private findChatHistoryPath(): void {
        // VS Code stores chat history in different locations depending on the platform
        const possiblePaths = [
            // macOS
            path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'github.copilot-chat'),
            path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'CachedExtensions', 'github.copilot-chat'),
            
            // Alternative locations
            path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'logs'),
            path.join(os.homedir(), '.vscode', 'extensions'),
        ];

        for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
                console.log('AIAssistantReader: Found potential chat history path:', possiblePath);
                this.chatHistoryPath = possiblePath;
                break;
            }
        }

        if (!this.chatHistoryPath) {
            console.log('AIAssistantReader: No chat history path found');
        }
    }

    public async getRecentChatSessions(limit: number = 5): Promise<CopilotChatSession[]> {
        if (!this.chatHistoryPath) {
            console.log('AIAssistantReader: No chat history path available');
            return [];
        }

        try {
            // Try to read chat history files
            const files = await this.findChatFiles();
            const sessions: CopilotChatSession[] = [];

            for (const file of files.slice(0, limit)) {
                try {
                    const session = await this.parseChatFile(file);
                    if (session) {
                        sessions.push(session);
                    }
                } catch (error) {
                    console.error(`Failed to parse chat file ${file}:`, error);
                }
            }

            // Sort by timestamp (newest first)
            sessions.sort((a, b) => b.timestamp - a.timestamp);

            return sessions;
        } catch (error) {
            console.error('Failed to read chat sessions:', error);
            return [];
        }
    }

    private async findChatFiles(): Promise<string[]> {
        if (!this.chatHistoryPath) {
            return [];
        }

        const files: string[] = [];

        try {
            const entries = fs.readdirSync(this.chatHistoryPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.includes('chat'))) {
                    files.push(path.join(this.chatHistoryPath, entry.name));
                } else if (entry.isDirectory()) {
                    // Recursively search subdirectories
                    const subFiles = await this.searchDirectory(path.join(this.chatHistoryPath, entry.name));
                    files.push(...subFiles);
                }
            }
        } catch (error) {
            console.error('Failed to read chat history directory:', error);
        }

        return files;
    }

    private async searchDirectory(dirPath: string): Promise<string[]> {
        const files: string[] = [];

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.includes('chat'))) {
                    files.push(path.join(dirPath, entry.name));
                }
            }
        } catch (error) {
            // Ignore errors in subdirectories
        }

        return files;
    }

    private async parseChatFile(filePath: string): Promise<CopilotChatSession | null> {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);

            // Try to extract chat messages from various possible formats
            let messages: AIChatMessage[] = [];
            let timestamp = Date.now();

            // Format 1: Direct array of messages
            if (Array.isArray(data)) {
                messages = this.extractMessagesFromArray(data);
            }
            // Format 2: Object with messages property
            else if (data.messages && Array.isArray(data.messages)) {
                messages = this.extractMessagesFromArray(data.messages);
                timestamp = data.timestamp || data.createdAt || timestamp;
            }
            // Format 3: Chat history format
            else if (data.history && Array.isArray(data.history)) {
                messages = this.extractMessagesFromArray(data.history);
                timestamp = data.timestamp || data.createdAt || timestamp;
            }

            if (messages.length > 0) {
                return {
                    id: path.basename(filePath),
                    messages,
                    timestamp
                };
            }

        } catch (error) {
            console.error(`Failed to parse chat file ${filePath}:`, error);
        }

        return null;
    }

    private extractMessagesFromArray(array: any[]): AIChatMessage[] {
        const messages: AIChatMessage[] = [];

        for (const item of array) {
            if (typeof item === 'object' && item.content) {
                const role = item.role || (item.author === 'user' ? 'user' : 'assistant');
                const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
                const timestamp = item.timestamp || item.createdAt || Date.now();

                messages.push({
                    role: role === 'user' ? 'user' : 'assistant',
                    content,
                    timestamp
                });
            }
        }

        return messages;
    }

    public async getLastUserPrompt(): Promise<{ prompt: string; response?: string } | null> {
        const sessions = await this.getRecentChatSessions(1);
        
        if (sessions.length === 0) {
            return null;
        }

        const session = sessions[0];
        const messages = session.messages;

        // Find the last user message and the assistant response that follows
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.role === 'user') {
                const response = messages[i + 1]?.role === 'assistant' ? messages[i + 1].content : undefined;
                return {
                    prompt: message.content,
                    response
                };
            }
        }

        return null;
    }
}
