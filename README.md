# Copilot Git Prompt Tracker

A VS Code extension that saves Copilot prompts to GitHub repositories with Git context for better development tracking and team collaboration.

## ✨ Features

- 🔗 **Multi-Project Support**: Store prompts from multiple projects in a single repository
- 🆕 **Repository Creation**: Automatically create and initialize GitHub repositories
- 💾 **Automatic Git Context**: Captures commit hash, branch, changed files, and author info
- 📝 **Template System**: Predefined templates for common prompt scenarios
- 🔐 **Secure Authentication**: GitHub Personal Access Token stored securely
- 📊 **Rich History Viewer**: Browse prompts by project with detailed context
- ⚙️ **Configurable Storage**: Choose where prompts are saved in your repository

## 🚀 Quick Start

### 1. Install Extension

Install the extension from the VS Code Marketplace or build from source.

### 2. Configure Repository

- Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
- Run "Copilot Prompt Tracker: Configure GitHub Repository"
- Choose to **create a new repository** or **use an existing one**
- Enter your GitHub Personal Access Token

### 3. Start Tracking Prompts

- Use "Save Current Prompt" to manually save prompts
- Use "Save Prompt from Template" for structured prompts
- View your prompts with "View Prompt History" or "View Project Prompts"

## 📁 Repository Structure

The extension organizes prompts by project in your chosen repository:

```text
your-prompts-repo/
├── prompts/
│   ├── project-frontend/
│   │   ├── prompt-2025-07-23T10-30-00-000Z.json
│   │   └── prompt-2025-07-23T11-15-30-000Z.json
│   ├── project-backend/
│   │   ├── prompt-2025-07-23T14-45-00-000Z.json
│   │   └── prompt-2025-07-23T16-20-00-000Z.json
│   └── mobile-app/
│       └── prompt-2025-07-23T18-30-00-000Z.json
└── README.md
```

Each prompt file contains:

- Original prompt text and response (when available)
- Git context (commit hash, branch, author, changed files)
- Timestamp and metadata
- Project information

## 📋 Commands

| Command | Description |
|---------|-------------|
| `Configure GitHub Repository` | Set up repository and authentication |
| `Save Current Prompt` | Manually save a prompt with git context |
| `Save Prompt from Template` | Use predefined templates for common scenarios |
| `View Prompt History` | Browse all prompts or filter by project |
| `View Project Prompts` | Quick access to current project's prompts |
| `Toggle Prompt Tracking` | Enable/disable the extension |

## 🛠️ Template System

Built-in templates for common scenarios:

- **Feature Request**: Document new feature implementations
- **Bug Fix**: Track debugging and resolution prompts
- **Code Review**: Save review-related AI interactions
- **Refactoring**: Document code improvement sessions
- **Testing**: Track test generation and debugging

## ⚙️ Configuration

Access settings via VS Code preferences (`copilotPromptTracker.*`):

- `githubRepo`: Target GitHub repository (format: `owner/repo`)
- `enabled`: Enable/disable prompt tracking
- `autoSave`: Automatically save prompts (future feature)
- `saveLocation`: Directory in repository (`prompts`, `docs`, etc.)

## 🔒 Security & Privacy

- GitHub tokens stored securely using VS Code's SecretStorage API
- Only prompt text and git context are saved (no sensitive code content)
- Configurable repository visibility (public/private)
- All data stored in your own GitHub repository

## 🤝 Multi-Project Workflow

Perfect for developers working on multiple projects:

1. **Single Repository**: Store all prompts in one centralized location
2. **Project Separation**: Automatic organization by project name
3. **Easy Navigation**: Quick access to current project's prompts
4. **Team Sharing**: Share prompt repository with team members
5. **Cross-Project Learning**: See patterns and solutions across projects

## 📖 Use Cases

### Individual Developer

- Track learning and problem-solving patterns
- Document AI-assisted coding sessions
- Build personal knowledge base

### Team Collaboration

- Share effective prompts with team members
- Learn from colleagues' AI interactions
- Standardize prompt patterns across projects

### Code Reviews

- Reference AI assistance during code reviews
- Understand context behind generated code
- Improve prompt quality over time

## 🛠️ Installation & Development

### From Source

```bash
git clone <repository-url>
cd vscode-copilot-git-prompt-commit
npm install
npm run compile
```

### Prerequisites

- VS Code 1.102.0 or later
- Git repository (local project)
- GitHub Personal Access Token
- GitHub repository for storing prompts

### GitHub Personal Access Token Setup

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Select `repo` scope
4. Copy the generated token
5. Paste it when prompted by the extension

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
