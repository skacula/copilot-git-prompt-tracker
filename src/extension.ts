import * as vscode from 'vscode';
import { CopilotPromptTracker } from './CopilotPromptTracker';
import { GitHubService } from './GitHubService';
import { GitService } from './GitService';
import { ConfigurationManager } from './ConfigurationManager';
import { PromptViewProvider } from './PromptViewProvider';

let promptTracker: CopilotPromptTracker;
let promptViewProvider: PromptViewProvider;

export function activate(context: vscode.ExtensionContext) {
	console.log('=== Copilot Git Prompt Tracker Extension Activated ===');
	console.log('Extension context workspace state keys:', context.workspaceState.keys());
	console.log('Current workspace folders:', vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));

	// Initialize services
	const configManager = new ConfigurationManager();
	const gitService = new GitService();
	const githubService = new GitHubService();

	// Initialize the prompt view provider
	promptViewProvider = new PromptViewProvider(context, githubService, configManager);

	// Register webview provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			PromptViewProvider.viewType,
			promptViewProvider
		)
	);

	// Initialize the prompt tracker with session monitoring
	promptTracker = new CopilotPromptTracker(
		context,
		configManager,
		gitService,
		githubService
	);

	// Register missing commands
	const refreshViewCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.refreshView',
		() => {
			console.log('Extension: Refresh view command triggered');
			if (promptViewProvider) {
				promptViewProvider.refresh();
			}
		}
	);
	context.subscriptions.push(refreshViewCommand);

	// Initialize the tracker
	promptTracker.initialize().then(() => {
		console.log('CopilotPromptTracker initialized successfully');
	}).catch((error) => {
		console.error('Failed to initialize CopilotPromptTracker:', error);
		vscode.window.showErrorMessage('Failed to initialize Copilot Prompt Tracker');
	});

	// Add tracker to disposables
	context.subscriptions.push(promptTracker);

	console.log('Copilot Git Prompt Tracker extension is now active!');
}

export function deactivate() {
	console.log('Copilot Git Prompt Tracker extension is being deactivated');
	
	try {
		if (promptTracker) {
			promptTracker.dispose();
		}
	} catch (error) {
		console.error('Error disposing promptTracker:', error);
	}
	
	try {
		if (promptViewProvider) {
			promptViewProvider.dispose();
		}
	} catch (error) {
		console.error('Error disposing promptViewProvider:', error);
	}
	
	console.log('Copilot Git Prompt Tracker extension deactivation completed');
}
