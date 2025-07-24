import * as vscode from 'vscode';
import { CopilotPromptTracker } from './CopilotPromptTracker';
import { GitHubService } from './GitHubService';
import { GitService } from './GitService';
import { ConfigurationManager } from './ConfigurationManager';

let promptTracker: CopilotPromptTracker;

export function activate(context: vscode.ExtensionContext) {
	console.log('Copilot Git Prompt Tracker is now active!');

	// Initialize services
	const configManager = new ConfigurationManager();
	const gitService = new GitService();
	const githubService = new GitHubService(context.secrets);

	// Initialize the prompt tracker
	promptTracker = new CopilotPromptTracker(
		context,
		configManager,
		gitService,
		githubService
	);

	// Register commands
	const configureCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.configure',
		() => promptTracker.configure()
	);

	const savePromptCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.savePrompt',
		() => promptTracker.saveCurrentPrompt()
	);

	const savePromptFromTemplateCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.savePromptFromTemplate',
		() => promptTracker.savePromptFromTemplate()
	);

	const viewHistoryCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.viewHistory',
		() => promptTracker.viewHistory()
	);

	const viewProjectPromptsCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.viewProjectPrompts',
		() => promptTracker.viewProjectPrompts()
	);

	const toggleCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.toggle',
		() => promptTracker.toggle()
	);

	// Add all commands to subscriptions
	context.subscriptions.push(
		configureCommand,
		savePromptCommand,
		savePromptFromTemplateCommand,
		viewHistoryCommand,
		viewProjectPromptsCommand,
		toggleCommand
	);

	// Initialize the tracker
	promptTracker.initialize();

	// Show welcome message if not configured
	if (!configManager.isConfigured()) {
		showWelcomeMessage();
	}
}

function showWelcomeMessage() {
	const action = 'Configure Now';
	vscode.window.showInformationMessage(
		'Welcome to Copilot Git Prompt Tracker! Configure your GitHub repository to start tracking prompts.',
		action
	).then(selection => {
		if (selection === action) {
			vscode.commands.executeCommand('copilotPromptTracker.configure');
		}
	});
}

export function deactivate() {
	if (promptTracker) {
		promptTracker.dispose();
	}
}
