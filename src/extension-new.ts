import * as vscode from 'vscode';
import { AIPromptTracker } from './AIPromptTracker';
import { GitHubService } from './GitHubService';
import { GitService } from './GitService';
import { ConfigurationManager } from './ConfigurationManager';

let promptTracker: AIPromptTracker;

export function activate(context: vscode.ExtensionContext) {
	console.log('=== Copilot Git Prompt Tracker Extension Activated ===');
	console.log('Extension context workspace state keys:', context.workspaceState.keys());
	console.log('Current workspace folders:', vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));

	// Initialize services
	const configManager = new ConfigurationManager();
	const gitService = new GitService();
	const githubService = new GitHubService();

	// Initialize the prompt tracker with session monitoring
	promptTracker = new AIPromptTracker(
		context,
		configManager,
		gitService,
		githubService
	);

	// Initialize the tracker
	promptTracker.initialize().then(() => {
		console.log('AIPromptTracker initialized successfully');
	}).catch((error) => {
		console.error('Failed to initialize AIPromptTracker:', error);
		vscode.window.showErrorMessage('Failed to initialize Copilot Prompt Tracker');
	});

	// Add tracker to disposables
	context.subscriptions.push(promptTracker);

	console.log('Copilot Git Prompt Tracker extension is now active!');
}

export function deactivate() {
	console.log('Copilot Git Prompt Tracker extension is being deactivated');
	
	if (promptTracker) {
		promptTracker.dispose();
	}
}
