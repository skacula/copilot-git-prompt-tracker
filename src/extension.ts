import * as vscode from 'vscode';
import { CopilotPromptTracker } from './CopilotPromptTracker';
import { GitHubService } from './GitHubService';
import { GitService } from './GitService';
import { ConfigurationManager } from './ConfigurationManager';
import { PromptViewProvider } from './PromptViewProvider';
import { ProjectConfigurationManager } from './ProjectConfigurationManager';
import { GitCommitWatcher } from './GitCommitWatcher';

let promptTracker: CopilotPromptTracker;
let promptViewProvider: PromptViewProvider;
let projectConfigManager: ProjectConfigurationManager;
let gitCommitWatcher: GitCommitWatcher;

export function activate(context: vscode.ExtensionContext) {
	console.log('=== Copilot Git Prompt Tracker Extension Activated ===');
	console.log('Extension context workspace state keys:', context.workspaceState.keys());
	console.log('Current workspace folders:', vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));

	// Initialize services
	const configManager = new ConfigurationManager();
	const gitService = new GitService();
	const githubService = new GitHubService();
	projectConfigManager = new ProjectConfigurationManager(githubService);

	// Initialize the prompt tracker
	promptTracker = new CopilotPromptTracker(
		context,
		configManager,
		gitService,
		githubService
	);

	// Initialize webview provider
	promptViewProvider = new PromptViewProvider(context, githubService, configManager);
	
	// Initialize Git commit watcher for automatic tracking
	gitCommitWatcher = new GitCommitWatcher(gitService, githubService, configManager);
	
	// Connect the refresh callback
	promptTracker.setPromptViewRefreshCallback(() => promptViewProvider.refresh());
	
	// Register webview provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			PromptViewProvider.viewType,
			promptViewProvider
		)
	);

	// Register commands
	const configureCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.configure',
		() => promptTracker.configure()
	);

	const savePromptCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.savePrompt',
		async () => {
			console.log('=== Save Prompt Command Triggered ===');
			console.log('Current workspace folders:', vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath));
			console.log('Active text editor file:', vscode.window.activeTextEditor?.document.uri.fsPath);
			try {
				const result = await promptTracker.saveCurrentPrompt();
				console.log('Save prompt result:', result);
			} catch (error) {
				console.error('Save prompt error:', error);
				vscode.window.showErrorMessage(`Failed to save prompt: ${error}`);
			}
		}
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

	const initializeProjectCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.initializeProject',
		async () => {
			console.log('Extension: initializeProject command triggered');
			try {
				await projectConfigManager.initializeProjectConfig();
				console.log('Extension: initializeProjectConfig completed successfully');
			} catch (error) {
				console.error('Extension: Error in initializeProjectConfig:', error);
				vscode.window.showErrorMessage(`Error initializing project config: ${error}`);
			}
		}
	);

	const testConfigurationCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.testConfiguration',
		async () => {
			console.log('Extension: Test configuration command triggered');
			
			try {
				// Check if main configuration is valid
				const isValid = await promptTracker.validateProjectConfiguration();
				if (!isValid) {
					return;
				}

				// Test GitHub authentication
				const isAuthenticated = githubService.isAuthenticated();
				console.log('Extension: GitHub authenticated:', isAuthenticated);
				
				if (!isAuthenticated) {
					vscode.window.showWarningMessage('Not authenticated with GitHub. Attempting authentication...');
					const authResult = await githubService.authenticate();
					if (!authResult) {
						vscode.window.showErrorMessage('GitHub authentication failed.');
						return;
					}
				}

				// Get main config
				const config = configManager.getConfiguration();
				const [owner, repo] = config.githubRepo!.split('/');
				console.log(`Extension: Testing access to ${owner}/${repo}`);

				// Test repository access
				try {
					const octokit = (githubService as any).octokit;
					if (!octokit) {
						throw new Error('GitHub client not initialized');
					}
					
					const repoResult = await octokit.rest.repos.get({ owner, repo });
					console.log('Extension: Repository access successful');
					
					// Test directory access
					try {
						await octokit.rest.repos.getContent({
							owner,
							repo,
							path: config.saveLocation
						});
						console.log(`Extension: Directory ${config.saveLocation} exists`);
					} catch (dirError: any) {
						if (dirError.status === 404) {
							console.log(`Extension: Directory ${config.saveLocation} doesn't exist but can be created`);
						} else {
							throw dirError;
						}
					}
					
					vscode.window.showInformationMessage(
						`✅ Configuration test successful!\n` +
						`Repository: ${owner}/${repo}\n` +
						`Save location: ${config.saveLocation}\n` +
						`Tracking enabled: ${config.enabled}`
					);
				} catch (repoError: any) {
					console.error('Extension: Repository access failed:', repoError);
					vscode.window.showErrorMessage(
						`❌ Cannot access repository ${owner}/${repo}.\n` +
						`Error: ${repoError.message || repoError.status || 'Unknown error'}\n` +
						`Please check if the repository exists and you have access.`
					);
				}

			} catch (error) {
				console.error('Extension: Test configuration error:', error);
				vscode.window.showErrorMessage(`Configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	const debugConfigCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.debugConfig',
		async () => {
			console.log('Extension: Debug configuration command triggered');
			
			try {
				const globalConfig = configManager.getConfiguration();
				console.log('Global config:', globalConfig);
				
				// Check project-specific config
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (workspaceFolder) {
					const configPath = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode', 'copilot-prompt-tracker.json');
					console.log('Checking project config at:', configPath.fsPath);
					
					try {
						const configContent = await vscode.workspace.fs.readFile(configPath);
						const projectConfig = JSON.parse(configContent.toString());
						console.log('Project config:', projectConfig);
						
						vscode.window.showInformationMessage(
							`📋 Configuration Debug:\n` +
							`Global: ${JSON.stringify(globalConfig, null, 2)}\n` +
							`Project: ${JSON.stringify(projectConfig, null, 2)}`
						);
					} catch (fileError) {
						console.log('No project config file found:', fileError);
						vscode.window.showInformationMessage(
							`📋 Configuration Debug:\n` +
							`Global: ${JSON.stringify(globalConfig, null, 2)}\n` +
							`Project: No project config found`
						);
					}
				} else {
					vscode.window.showInformationMessage(
						`📋 Configuration Debug:\n` +
						`Global: ${JSON.stringify(globalConfig, null, 2)}\n` +
						`No workspace folder open`
					);
				}
				
			} catch (error) {
				console.error('Extension: Debug config error:', error);
				vscode.window.showErrorMessage(`Debug config failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	const testAuthCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.testAuth',
		async () => {
			console.log('Extension: Test authentication command triggered');
			
			try {
				const authResult = await githubService.ensureAuthenticated();
				
				if (authResult) {
					const userLogin = await githubService.getCurrentUserLogin();
					vscode.window.showInformationMessage(
						`✅ GitHub authentication successful!\nUser: ${userLogin}`
					);
				} else {
					vscode.window.showErrorMessage('❌ GitHub authentication failed');
				}
			} catch (error) {
				console.error('Extension: Test auth error:', error);
				vscode.window.showErrorMessage(`Authentication test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}
	);

	const signOutCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.signOut',
		() => promptTracker.signOut()
	);

	const openViewCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.openView',
		() => vscode.commands.executeCommand('copilotPromptTracker.promptsView.focus')
	);

	const refreshViewCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.refreshView',
		() => promptViewProvider.refresh()
	);

	// Add all commands to subscriptions
	context.subscriptions.push(
		configureCommand,
		savePromptCommand,
		savePromptFromTemplateCommand,
		viewHistoryCommand,
		viewProjectPromptsCommand,
		toggleCommand,
		initializeProjectCommand,
		testConfigurationCommand,
		debugConfigCommand,
		testAuthCommand,
		signOutCommand,
		openViewCommand,
		refreshViewCommand
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
	if (gitCommitWatcher) {
		gitCommitWatcher.dispose();
	}
}
