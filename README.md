# Copilot Git Prompt Tracker

A VS Code extension that **monitors** your GitHub Copilot interactions and correlates them with Git commits to provide insights into your AI-assisted development workflow.

## 🎯 Purpose

This extension is designed to **passively monitor and track** your actual Copilot interactions, then correlate them with Git commits to understand how AI assistance influences your development process. It does **not** suggest prompts or templates, but rather focuses on capturing and analyzing your natural workflow.

## ✨ Key Features

### 🔍 Session-Based Monitoring
- **Development Sessions**: Groups related Copilot interactions into logical sessions
- **Automatic Correlation**: Links sessions with Git commits when you correlate manually
- **File Context Awareness**: Tracks which files were involved in each interaction
- **Time-Based Filtering**: Focuses on recent, relevant interactions

### 🛡️ Advanced Security Protection
- **Multi-Layer Content Sanitization**: Automatically removes sensitive data before storage
- **API Key Detection**: Identifies and redacts OpenAI, GitHub, GitLab, Google, AWS, and other API keys
- **Environment Variable Protection**: Detects and sanitizes environment variables and secrets
- **Project-Specific .gitignore Integration**: Respects your project's ignore patterns
- **JWT Token Detection**: Identifies and redacts JSON Web Tokens
- **Database URL Sanitization**: Protects database connection strings

### 📊 Interaction Tracking
- **Multiple Interaction Types**: Monitors chat, inline suggestions, and code comments
- **Rich Context Capture**: Records file names, languages, code selections, and timestamps
- **Response Recording**: Captures both your prompts and Copilot's responses
- **Automatic Detection**: Attempts to identify Copilot-generated code changes

### 🔗 Git Integration
- **Commit Correlation**: Manually trigger correlation between sessions and commits
- **Branch Tracking**: Records which branch interactions occurred on
- **Author Information**: Captures commit author details
- **Repository Context**: Links interactions to specific repositories

## 🚀 Getting Started

### Prerequisites
- VS Code with GitHub Copilot installed and configured
- A Git repository
- A GitHub account for storing session data

### Installation
1. Install the extension from the VS Code marketplace
2. Open a project with Git initialized
3. Configure your GitHub repository for storing sessions

### Initial Configuration
1. Click the Copilot icon in the status bar
2. Select "Configure Repository"
3. Enter your GitHub repository in the format: `owner/repo-name`
4. The extension will handle GitHub authentication automatically

## 🎮 Usage

### Monitoring Workflow

The extension works in the background to monitor your development sessions:

1. **Start Working**: Begin coding with Copilot as usual
2. **Interactions Are Tracked**: The extension automatically detects potential Copilot interactions
3. **Manual Recording** (when needed): Use commands to capture specific interactions
4. **Commit Correlation**: When ready to commit, correlate your session with the commit

### Available Commands

Access these through the Command Palette (`Cmd+Shift+P`):

- **`Copilot Tracker: Show Current Session`** - View your current development session and recent interactions
- **`Copilot Tracker: Record Interaction`** - Manually record a Copilot interaction
- **`Copilot Tracker: Capture Last Chat`** - Capture your most recent Copilot chat (manual input for now)
- **`Copilot Tracker: Correlate with Commit`** - Link current session with Git commit and save to GitHub
- **`Copilot Tracker: Configure`** - Set up or change GitHub repository

### Status Bar Integration

The status bar shows:
- Number of interactions in current session
- Configuration status
- Quick access to session view

## 💾 Data Storage

### Session Data Structure
```json
{
  "sessionId": "session-1234567890-abcdef",
  "startTime": "2024-01-15T10:30:00.000Z",
  "endTime": "2024-01-15T11:45:00.000Z",
  "interactions": [
    {
      "id": "interaction-1234567890-xyz",
      "timestamp": "2024-01-15T10:35:00.000Z",
      "prompt": "How do I implement authentication?",
      "response": "Here's a secure way to implement authentication...",
      "interactionType": "chat",
      "fileContext": {
        "fileName": "src/auth.ts",
        "language": "typescript",
        "selection": { "start": {"line": 10, "character": 0}, "end": {"line": 15, "character": 20} }
      }
    }
  ],
  "gitInfo": {
    "commitHash": "abc123def456",
    "branch": "feature/auth",
    "author": "Your Name",
    "repository": "your-org/your-repo",
    "changedFiles": ["src/auth.ts", "src/types.ts"],
    "commitMessage": "Implement user authentication system"
  },
  "metadata": {
    "vscodeVersion": "1.85.0",
    "extensionVersion": "1.0.0",
    "workspaceFolder": "/path/to/your/project"
  }
}
```

### GitHub Storage Format
Sessions are converted to structured prompt entries and stored in your configured GitHub repository:

```json
{
  "prompt": "Development Session: session-1234567890-abcdef\nDuration: 2024-01-15T10:30:00.000Z to 2024-01-15T11:45:00.000Z\nTotal Interactions: 3\n\nCopilot Interactions:\n[1] CHAT: How do I implement authentication?\n[2] INLINE: Code generation in src/auth.ts\n[3] CHAT: How to add password validation?",
  "response": "[1] Here's a secure way to implement authentication...\n[2] [Generated code content]\n[3] You can add password validation using...",
  "timestamp": "2024-01-15T11:45:00.000Z",
  "gitInfo": {
    "commitHash": "abc123def456",
    "branch": "feature/auth",
    "author": "Your Name",
    "repository": "your-org/your-repo",
    "changedFiles": ["src/auth.ts", "src/types.ts"]
  },
  "metadata": {
    "vscodeVersion": "1.85.0",
    "extensionVersion": "1.0.0"
  }
}
```

## 🔒 Security & Privacy

### Comprehensive Protection
This extension implements multiple layers of security to protect sensitive information:

### 🔐 Pattern-Based Detection
- **API Keys**: OpenAI, GitHub, GitLab, Google Cloud, AWS, Azure, Stripe, etc.
- **Tokens**: JWT tokens, Bearer tokens, Access tokens
- **Secrets**: Environment variables, Database URLs, Private keys
- **Custom Patterns**: Extensible pattern matching system

### 📁 Project-Aware Filtering  
- **`.gitignore` Integration**: Automatically respects your project's ignore patterns
- **Directory Matching**: Supports complex directory-based ignore rules
- **Path Normalization**: Handles different path formats consistently

### 🛡️ Multi-Layer Sanitization
1. **Content Scanning**: All prompts and responses are scanned for sensitive patterns
2. **File Context Protection**: Code snippets and file contents are sanitized
3. **Path Sanitization**: File paths are checked against ignore patterns
4. **Safe Defaults**: Unknown patterns are conservatively redacted

### Example Protection
```typescript
// Before sanitization:
const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
const dbUrl = "mongodb://username:password@cluster.mongodb.net/database";

// After sanitization:
const apiKey = "[REDACTED_API_KEY]";
const dbUrl = "[REDACTED_DATABASE_URL]";
```

## 🧪 Testing

The extension includes comprehensive unit tests covering:

### ✅ Session Monitoring Tests
- Session creation and management
- Interaction tracking and filtering
- Commit correlation functionality
- File context capture

### ✅ Security Tests  
- API key detection and redaction
- Environment variable protection
- .gitignore pattern matching
- Content sanitization validation

### ✅ Integration Tests
- Configuration management
- GitHub service integration
- Git service functionality

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm test -- --grep "CopilotSessionMonitor"
```

## 🔧 Configuration

### Extension Settings
Configure through VS Code settings (`Cmd+,`):

```json
{
  "copilotPromptTracker.githubRepo": "your-username/your-repo",
  "copilotPromptTracker.enabled": true,
  "copilotPromptTracker.autoSave": false,
  "copilotPromptTracker.saveLocation": "prompts"
}
```

### Advanced Configuration
- **Session Timeout**: Sessions automatically timeout after 30 minutes of inactivity
- **Max Interactions**: Sessions are limited to 50 interactions to prevent memory issues
- **Cleanup Frequency**: Old sessions are cleaned up hourly, keeping the most recent 100

## 🔄 Architecture

### Core Components

1. **CopilotSessionMonitor**: Manages development sessions and interaction tracking
2. **CopilotPromptTracker**: Main orchestrator coordinating all components
3. **ContentSanitizer**: Multi-layer security and content protection
4. **GitService**: Git repository integration and commit information
5. **GitHubService**: GitHub API integration for data storage
6. **ConfigurationManager**: Extension settings and user preferences

### Session Lifecycle

```mermaid
graph TD
    A[Start Session] --> B[Monitor Interactions]
    B --> C[Detect Copilot Usage]
    C --> D[Capture Context]
    D --> B
    B --> E[Manual Correlation Trigger]
    E --> F[Finalize Session]
    F --> G[Sanitize Content]
    G --> H[Save to GitHub]
    H --> A
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-username/copilot-git-prompt-tracker.git

# Install dependencies
npm install

# Start development mode
npm run watch

# Run tests
npm test
```

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

- Report bugs on [GitHub Issues](https://github.com/your-username/copilot-git-prompt-tracker/issues)
- Feature requests welcome
- Check existing issues before creating new ones

## 🎉 Acknowledgments

- GitHub Copilot team for the amazing AI coding assistant
- VS Code team for the extensible editor platform
- Open source community for inspiration and tools
