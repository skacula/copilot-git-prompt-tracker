import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Test utilities for Copilot Git Prompt Tracker extension tests
 */

// Mock VS Code extension context
export function createMockExtensionContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        workspaceState: {
            keys: () => [],
            get: sinon.stub().returns(undefined),
            update: sinon.stub().resolves()
        },
        globalState: {
            keys: () => [],
            get: sinon.stub().returns(undefined),
            update: sinon.stub().resolves(),
            setKeysForSync: sinon.stub()
        },
        extensionPath: __dirname,
        extensionUri: vscode.Uri.file(__dirname),
        environmentVariableCollection: {
            persistent: false,
            replace: sinon.stub(),
            append: sinon.stub(),
            prepend: sinon.stub(),
            get: sinon.stub(),
            forEach: sinon.stub(),
            delete: sinon.stub(),
            clear: sinon.stub()
        },
        asAbsolutePath: (relativePath: string) => path.join(__dirname, relativePath),
        storageUri: vscode.Uri.file(path.join(os.tmpdir(), 'test-storage')),
        globalStorageUri: vscode.Uri.file(path.join(os.tmpdir(), 'test-global-storage')),
        logUri: vscode.Uri.file(path.join(os.tmpdir(), 'test-logs')),
        extensionMode: vscode.ExtensionMode.Test,
        extension: {
            id: 'test.copilot-git-prompt-tracker',
            extensionUri: vscode.Uri.file(__dirname),
            extensionPath: __dirname,
            isActive: true,
            packageJSON: { version: '1.0.0' },
            extensionKind: vscode.ExtensionKind.Workspace,
            exports: undefined,
            activate: sinon.stub().resolves()
        },
        secrets: {
            get: sinon.stub().resolves(undefined),
            store: sinon.stub().resolves(),
            delete: sinon.stub().resolves(),
            onDidChange: sinon.stub().returns({ dispose: sinon.stub() })
        },
        languageModelAccessInformation: {
            onDidChange: sinon.stub().returns({ dispose: sinon.stub() }),
            canSendRequest: sinon.stub().returns(false)
        }
    } as any;
}

// Mock VS Code workspace configuration
export function createMockWorkspaceConfiguration(settings: any = {}): vscode.WorkspaceConfiguration {
    return {
        get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
            return settings[key] !== undefined ? settings[key] : defaultValue;
        }),
        has: sinon.stub().callsFake((key: string) => settings.hasOwnProperty(key)),
        inspect: sinon.stub(),
        update: sinon.stub().resolves()
    } as any;
}

// Mock Git repository structure
export function createMockGitRepository(tempDir: string): {
    repoPath: string;
    cleanup: () => void;
} {
    const repoPath = path.join(tempDir, 'mock-repo');
    fs.mkdirSync(repoPath, { recursive: true });
    
    // Create basic Git structure
    const gitDir = path.join(repoPath, '.git');
    fs.mkdirSync(gitDir, { recursive: true });
    
    // Create some sample files
    fs.writeFileSync(path.join(repoPath, 'README.md'), '# Test Repository');
    fs.writeFileSync(path.join(repoPath, 'src', 'main.ts'), 'console.log("Hello, world!");');
    fs.mkdirSync(path.join(repoPath, 'src'), { recursive: true });
    
    return {
        repoPath,
        cleanup: () => {
            if (fs.existsSync(repoPath)) {
                fs.rmSync(repoPath, { recursive: true, force: true });
            }
        }
    };
}

// Mock text document
export function createMockTextDocument(options: {
    fileName?: string;
    languageId?: string;
    content?: string;
    uri?: vscode.Uri;
} = {}): vscode.TextDocument {
    const fileName = options.fileName || 'test.ts';
    const content = options.content || 'test content';
    const lines = content.split('\n');
    
    return {
        uri: options.uri || vscode.Uri.file(fileName),
        fileName,
        isUntitled: false,
        languageId: options.languageId || 'typescript',
        version: 1,
        isDirty: false,
        isClosed: false,
        save: sinon.stub().resolves(true),
        eol: vscode.EndOfLine.LF,
        lineCount: lines.length,
        lineAt: sinon.stub().callsFake((line: number) => ({
            lineNumber: line,
            text: lines[line] || '',
            range: new vscode.Range(line, 0, line, (lines[line] || '').length),
            rangeIncludingLineBreak: new vscode.Range(line, 0, line + 1, 0),
            firstNonWhitespaceCharacterIndex: 0,
            isEmptyOrWhitespace: (lines[line] || '').trim().length === 0
        })),
        offsetAt: sinon.stub().returns(0),
        positionAt: sinon.stub().returns(new vscode.Position(0, 0)),
        getText: sinon.stub().callsFake((range?: vscode.Range) => {
            if (!range) {return content;}
            // Simplified implementation for testing
            return content.substring(0, 10);
        }),
        getWordRangeAtPosition: sinon.stub().returns(undefined),
        validateRange: sinon.stub().callsFake((range: vscode.Range) => range),
        validatePosition: sinon.stub().callsFake((position: vscode.Position) => position)
    } as any;
}

// Mock text editor
export function createMockTextEditor(document?: vscode.TextDocument): vscode.TextEditor {
    const mockDocument = document || createMockTextDocument();
    
    return {
        document: mockDocument,
        selection: new vscode.Selection(0, 0, 0, 0),
        selections: [new vscode.Selection(0, 0, 0, 0)],
        visibleRanges: [new vscode.Range(0, 0, 10, 0)],
        options: {
            tabSize: 4,
            insertSpaces: true,
            cursorStyle: vscode.TextEditorCursorStyle.Line,
            lineNumbers: vscode.TextEditorLineNumbersStyle.On
        },
        viewColumn: vscode.ViewColumn.One,
        edit: sinon.stub().resolves(true),
        insertSnippet: sinon.stub().resolves(true),
        setDecorations: sinon.stub(),
        revealRange: sinon.stub(),
        show: sinon.stub(),
        hide: sinon.stub()
    } as any;
}

// Mock Copilot interactions
export function createMockCopilotInteraction(options: {
    prompt?: string;
    response?: string;
    interactionType?: 'chat' | 'inline' | 'comment';
    fileName?: string;
} = {}) {
    return {
        id: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: options.prompt || 'Test prompt',
        response: options.response || 'Test response',
        fileContext: {
            fileName: options.fileName || 'test.ts',
            language: 'typescript',
            selection: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 10 }
            },
            content: options.response || 'Test response'
        },
        interactionType: options.interactionType || 'chat'
    };
}

// Mock Git commit info
export function createMockGitInfo(options: {
    commitHash?: string;
    branch?: string;
    author?: string;
    repository?: string;
    message?: string;
    changedFiles?: string[];
} = {}) {
    return {
        commitHash: options.commitHash || 'abc123def456',
        branch: options.branch || 'main',
        author: options.author || 'Test User <test@example.com>',
        repository: options.repository || 'test/repo',
        message: options.message || 'Test commit',
        changedFiles: options.changedFiles || ['src/test.ts']
    };
}

// Mock development session
export function createMockDevelopmentSession(options: {
    sessionId?: string;
    interactions?: any[];
    gitInfo?: any;
} = {}) {
    return {
        sessionId: options.sessionId || `session-${Date.now()}`,
        startTime: new Date().toISOString(),
        endTime: undefined,
        interactions: options.interactions || [createMockCopilotInteraction()],
        gitInfo: options.gitInfo || null,
        metadata: {
            vscodeVersion: '1.0.0',
            extensionVersion: '1.0.0',
            workspaceFolder: '/test/workspace'
        }
    };
}

// Temporary directory management
export class TempDirManager {
    private tempDirs: string[] = [];

    createTempDir(prefix: string = 'copilot-test'): string {
        const tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        fs.mkdirSync(tempDir, { recursive: true });
        this.tempDirs.push(tempDir);
        return tempDir;
    }

    cleanupAll(): void {
        for (const dir of this.tempDirs) {
            if (fs.existsSync(dir)) {
                try {
                    fs.rmSync(dir, { recursive: true, force: true });
                } catch (error) {
                    console.warn(`Failed to cleanup temp dir ${dir}:`, error);
                }
            }
        }
        this.tempDirs = [];
    }
}

// Mock GitHub API responses
export function createMockGitHubResponses() {
    return {
        getRepo: sinon.stub().resolves({
            data: {
                id: 12345,
                name: 'test-repo',
                full_name: 'test/repo',
                private: true,
                default_branch: 'main'
            }
        }),
        createFile: sinon.stub().resolves({
            data: {
                content: { sha: 'file-sha' },
                commit: { sha: 'commit-sha' }
            }
        }),
        updateFile: sinon.stub().resolves({
            data: {
                content: { sha: 'updated-file-sha' },
                commit: { sha: 'updated-commit-sha' }
            }
        }),
        getContent: sinon.stub().resolves({
            data: {
                content: Buffer.from('test content').toString('base64'),
                sha: 'content-sha'
            }
        })
    };
}

// Performance testing utilities
export class PerformanceTimer {
    private startTime: number = 0;

    start(): void {
        this.startTime = performance.now();
    }

    end(): number {
        return performance.now() - this.startTime;
    }

    static async measureAsync<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
        const timer = new PerformanceTimer();
        timer.start();
        const result = await operation();
        const duration = timer.end();
        return { result, duration };
    }

    static measure<T>(operation: () => T): { result: T; duration: number } {
        const timer = new PerformanceTimer();
        timer.start();
        const result = operation();
        const duration = timer.end();
        return { result, duration };
    }
}

// Async testing utilities
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 5000,
    intervalMs: number = 100
): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
        if (await condition()) {
            return;
        }
        await sleep(intervalMs);
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
}

// Sandbox for test isolation
export class TestSandbox {
    private sandbox: sinon.SinonSandbox;
    private tempDirManager: TempDirManager;

    constructor() {
        this.sandbox = sinon.createSandbox();
        this.tempDirManager = new TempDirManager();
    }

    stub(object: any, method: string): sinon.SinonStub {
        return this.sandbox.stub(object, method);
    }

    spy(object: any, method?: string): sinon.SinonSpy {
        return method ? this.sandbox.spy(object, method) : this.sandbox.spy(object);
    }

    createTempDir(prefix?: string): string {
        return this.tempDirManager.createTempDir(prefix);
    }

    restore(): void {
        this.sandbox.restore();
        this.tempDirManager.cleanupAll();
    }
}