# Copilot Git Prompt Tracker - Installation Guide

## 📥 Installing the Extension

### Method 1: Command Line Installation
```bash
code --install-extension copilot-git-prompt-tracker-0.1.0.vsix
```

### Method 2: VS Code UI Installation
1. Open VS Code
2. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file
5. Restart VS Code

## ⚙️ Setup Instructions

### 1. Configure GitHub Repository
```bash
# Open Command Palette (Cmd+Shift+P)
# Run: "Copilot Prompt Tracker: Initialize Project Configuration"
```

### 2. Authenticate with GitHub
- Extension will prompt for GitHub authentication
- Uses VS Code's built-in GitHub authentication
- Requires repository write permissions

### 3. Project Configuration
The extension creates `.vscode/copilot-prompt-tracker.json` in your project:
```json
{
  "enabled": true,
  "autoTrackOnCommit": true,
  "githubRepo": "your-username/your-prompts-repo",
  "saveLocation": "prompts"
}
```

## 🎯 Usage

### Automatic Monitoring
- Extension automatically monitors Copilot interactions
- Groups interactions into development sessions
- Correlates sessions with Git commits

### Manual Commands
- `Copilot Prompt Tracker: Show Current Session` - View active session
- `Copilot Prompt Tracker: Record Interaction` - Manually record interaction
- `Copilot Prompt Tracker: Test Configuration` - Verify setup

## 🔒 Security Features
- Automatically redacts API keys, tokens, and secrets
- Respects `.gitignore` patterns for sensitive files
- Content sanitization before GitHub storage

## 🐛 Troubleshooting
- Check Developer Console (`Help > Toggle Developer Tools`)
- Run `Copilot Prompt Tracker: Test GitHub Authentication`
- Verify repository permissions on GitHub