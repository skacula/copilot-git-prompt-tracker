import * as vscode from 'vscode';
import { AIPromptTracker } from './AIPromptTracker';
import { GitHubService } from './GitHubService';
import { GitService } from './GitService';
import { ConfigurationManager } from './ConfigurationManager';
import { PromptViewProvider } from './PromptViewProvider';

let promptTracker: AIPromptTracker;
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
	promptTracker = new AIPromptTracker(
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

	// Register chat capture commands
	const saveChatConversationCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.saveChatConversation',
		async () => {
			await saveChatConversation(promptTracker);
		}
	);
	context.subscriptions.push(saveChatConversationCommand);

	const quickSaveChatCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.quickSaveChat',
		async () => {
			await quickSaveChat(promptTracker);
		}
	);
	context.subscriptions.push(quickSaveChatCommand);

	const saveChatWithContextCommand = vscode.commands.registerCommand(
		'copilotPromptTracker.saveChatWithContext',
		async () => {
			await saveChatWithContext(promptTracker);
		}
	);
	context.subscriptions.push(saveChatWithContextCommand);

	// Initialize the tracker
	promptTracker.initialize().then(() => {
		console.log('AIPromptTracker initialized successfully');
	}).catch((error) => {
		console.error('Failed to initialize AIPromptTracker:', error);
		vscode.window.showErrorMessage('Failed to initialize AI Prompt Tracker');
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

// Chat capture functions
async function saveChatConversation(promptTracker: AIPromptTracker) {
	try {
		const prompt = await vscode.window.showInputBox({
			prompt: 'Enter your chat prompt/question',
			placeHolder: 'What did you ask the AI assistant?'
		});

		if (!prompt) {
			return;
		}

		const response = await vscode.window.showInputBox({
			prompt: 'Enter the AI response (optional)',
			placeHolder: 'What was the AI\'s response? (leave blank if not needed)'
		});

		// Ask if this is part of a longer conversation
		const isConversation = await vscode.window.showQuickPick(
			['Single prompt/response', 'Part of a conversation'],
			{ placeHolder: 'Is this a single interaction or part of a longer conversation?' }
		);

		let conversation: any[] = [];

		if (isConversation === 'Part of a conversation') {
			// Start building conversation array
			conversation.push({
				prompt: prompt,
				response: response || 'No response captured',
				timestamp: new Date().toISOString(),
				type: 'user'
			});

			// Allow adding more turns
			while (true) {
				const addMore = await vscode.window.showQuickPick(
					['Add another turn', 'Finish conversation'],
					{ placeHolder: 'Add another conversation turn?' }
				);

				if (addMore === 'Finish conversation') {
					break;
				}

				const nextPrompt = await vscode.window.showInputBox({
					prompt: 'Enter the next prompt in the conversation',
					placeHolder: 'What was asked next?'
				});

				if (!nextPrompt) {
					break;
				}

				const nextResponse = await vscode.window.showInputBox({
					prompt: 'Enter the response to this prompt',
					placeHolder: 'What was the AI\'s response?'
				});

				conversation.push({
					prompt: nextPrompt,
					response: nextResponse || 'No response captured',
					timestamp: new Date().toISOString(),
					type: 'user'
				});
			}
		}

		// Create a manual chat entry
		const chatData = {
			type: 'CHAT',
			prompt: prompt,
			response: response || 'Manual chat entry - no response captured',
			conversation: conversation.length > 0 ? conversation : undefined,
			timestamp: new Date().toISOString(),
			source: 'manual'
		};

		// Save using the existing prompt tracker
		await promptTracker.saveManualChatSession(chatData);

		const conversationText = conversation.length > 0 ? ` (${conversation.length} turns)` : '';
		vscode.window.showInformationMessage(`💬 Chat conversation saved successfully!${conversationText}`);

		// Refresh the webview if available
		if (promptViewProvider) {
			promptViewProvider.refresh();
		}
	} catch (error) {
		console.error('Error saving chat conversation:', error);
		vscode.window.showErrorMessage('Failed to save chat conversation');
	}
}

async function quickSaveChat(promptTracker: AIPromptTracker) {
	try {
		// Get clipboard content to check if it contains a chat conversation
		const clipboardText = await vscode.env.clipboard.readText();

		let defaultPrompt = '';
		if (clipboardText && isLikelyChatContent(clipboardText)) {
			const parsed = parseChatFromClipboard(clipboardText);
			defaultPrompt = parsed.prompt;
		}

		const prompt = await vscode.window.showInputBox({
			prompt: 'Quick save: Enter your chat prompt',
			placeHolder: 'Your question or prompt...',
			value: defaultPrompt
		});

		if (!prompt) {
			return;
		}

		const chatData = {
			type: 'CHAT',
			prompt: prompt,
			response: 'Quick save - response not captured',
			timestamp: new Date().toISOString(),
			source: 'quick-save'
		};

		await promptTracker.saveManualChatSession(chatData);
		vscode.window.showInformationMessage('⚡ Chat saved quickly!');

		if (promptViewProvider) {
			promptViewProvider.refresh();
		}
	} catch (error) {
		console.error('Error quick saving chat:', error);
		vscode.window.showErrorMessage('Failed to quick save chat');
	}
}

async function saveChatWithContext(promptTracker: AIPromptTracker) {
	try {
		const activeEditor = vscode.window.activeTextEditor;
		let contextInfo = '';

		if (activeEditor) {
			const document = activeEditor.document;
			const selection = activeEditor.selection;

			contextInfo = `File: ${document.fileName}\n`;

			if (!selection.isEmpty) {
				const selectedText = document.getText(selection);
				contextInfo += `Selected code:\n\`\`\`${document.languageId}\n${selectedText}\n\`\`\`\n\n`;
			}
		}

		const prompt = await vscode.window.showInputBox({
			prompt: 'Enter your chat prompt about this code',
			placeHolder: 'What did you ask about the code context?',
			value: contextInfo ? `${contextInfo}Question: ` : ''
		});

		if (!prompt) {
			return;
		}

		const response = await vscode.window.showInputBox({
			prompt: 'Enter the AI response (optional)',
			placeHolder: 'What was the response?'
		});

		const chatData = {
			type: 'CHAT',
			prompt: prompt,
			response: response || 'Chat with context - response not captured',
			timestamp: new Date().toISOString(),
			source: 'context-aware',
			context: contextInfo
		};

		await promptTracker.saveManualChatSession(chatData);
		vscode.window.showInformationMessage('📝 Chat with context saved!');

		if (promptViewProvider) {
			promptViewProvider.refresh();
		}
	} catch (error) {
		console.error('Error saving chat with context:', error);
		vscode.window.showErrorMessage('Failed to save chat with context');
	}
}

function isLikelyChatContent(text: string): boolean {
	const chatIndicators = [
		'User:', 'Assistant:', 'Human:', 'AI:',
		'@github', '@copilot',
		'Question:', 'Response:',
		'Chat conversation'
	];

	return chatIndicators.some(indicator =>
		text.toLowerCase().includes(indicator.toLowerCase())
	);
}

function parseChatFromClipboard(text: string): { prompt: string; response?: string } {
	// Try to extract prompt and response from clipboard
	const lines = text.split('\n');
	let prompt = '';
	let response = '';
	let inResponse = false;

	for (const line of lines) {
		if (line.toLowerCase().includes('user:') || line.toLowerCase().includes('human:')) {
			prompt += line.replace(/^(user:|human:)/i, '').trim() + '\n';
		} else if (line.toLowerCase().includes('assistant:') || line.toLowerCase().includes('ai:')) {
			inResponse = true;
			response += line.replace(/^(assistant:|ai:)/i, '').trim() + '\n';
		} else if (inResponse) {
			response += line + '\n';
		} else if (!inResponse && prompt) {
			prompt += line + '\n';
		}
	}

	return {
		prompt: prompt.trim() || text.substring(0, 200) + '...',
		response: response.trim()
	};
}
