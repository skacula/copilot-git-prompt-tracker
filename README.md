# AI Git Prompt Tracker

A VS Code extension that **monitors** your AI assistant interactions (GitHub Copilot, Claude Code, Cursor) and correlates them with Git commits to provide insights into your AI-assisted development workflow.

## 🎯 Overview

This extension is designed to **passively monitor and track** your AI assistant interactions, then correlate them with Git commits to understand how AI assistance influences your development process. It does **not** suggest prompts or templates, but rather focuses on capturing and analyzing your natural workflow.

### 🤖 Multi-AI Assistant Support

**GitHub Copilot** - Full Integration ✅
- Direct access to actual prompts and responses via VS Code APIs
- Complete conversation context and real-time tracking
- Full feature support with accurate prompt capture

**Claude Code** - Inference-Based Detection ⚠️
- **Important**: Prompts are inferred, not captured directly
- Claude Code operates as standalone CLI tool without VS Code integration
- Extension detects code generation and infers likely prompts from patterns
- Captures generated responses and file context with high accuracy
- Uses sophisticated pattern recognition for prompt inference

**Other AI Assistants (Cursor, etc.)** - Pattern-Based Detection 🔍
- Detection capabilities vary by assistant architecture
- Generated code and file modifications are tracked
- Basic prompt inference based on code patterns

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

### 📊 AI Interaction Tracking
- **Multiple AI Providers**: Monitors GitHub Copilot, Claude Code, Cursor, and other assistants
- **Multiple Interaction Types**: Tracks chat, inline suggestions, code comments, and file modifications
- **Conversation Arrays**: Stores multi-turn chat conversations as structured arrays of prompt-response pairs
- **Rich Context Capture**: Records file names, languages, code selections, and timestamps
- **Prompt Handling**: 
  - **Copilot**: Captures actual prompts and responses directly
  - **Claude Code**: Infers prompts from generated code patterns and context
  - **Others**: Pattern-based detection and basic inference
- **Provider Identification**: Automatically identifies which AI assistant generated each interaction

### 🔗 Git Integration
- **Commit Correlation**: Manually trigger correlation between sessions and commits
- **Branch Tracking**: Records which branch interactions occurred on
- **Author Information**: Captures commit author details
- **Repository Context**: Links interactions to specific repositories

### �️ Modern GUI Interface
- **Activity Bar Integration**: Custom tracker icon in the left sidebar
- **Interactive Webview**: Modern interface for browsing prompt history
- **Real-time Updates**: Auto-refresh when new prompts are saved
- **Project-aware Navigation**: Filter by project or view all prompts
- **VS Code Theming**: Seamlessly integrates with your VS Code theme

### 🎯 Multi-Project Support
- **Project-based Organization**: Prompts organized by project in subdirectories
- **Automatic Project Detection**: Extracts project name from Git repository URL
- **Cross-project Navigation**: View prompts from all projects or filter by specific project
- **Centralized Storage**: Single repository can store prompts from multiple projects

## 🚀 Installation & Setup

### Prerequisites
- VS Code (version 1.102.0+)
- At least one AI assistant:
  - GitHub Copilot (for full prompt capture)
  - Claude Code (for inference-based detection)
  - Cursor or other AI assistants (for pattern-based detection)
- A Git repository
- A GitHub account for storing session data

### Installation Methods

#### Method 1: Command Line Installation
```bash
code --install-extension copilot-git-prompt-tracker-0.0.1.vsix
```

#### Method 2: VS Code UI Installation
1. Open VS Code
2. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Extensions: Install from VSIX..."
4. Select the downloaded `.vsix` file
5. Restart VS Code

### Initial Configuration

#### Quick Setup
1. Click the AI tracker icon (🎯) in the activity bar
2. Click "Configure Repository" in the view
3. Choose to create a new repository or use an existing one
4. The extension handles GitHub OAuth authentication automatically
5. Start using your AI assistants - interactions are automatically detected and tracked

#### Detailed Configuration Process
1. **Repository Setup**:
   - **New Repository**: Enter repository name and optional description
   - **Existing Repository**: Enter repository in format `username/repo-name`

2. **Authentication**: Uses VS Code's built-in GitHub OAuth (no manual tokens needed)

3. **Project Configuration**: Extension creates proper directory structure automatically

## 🎮 Usage

### Monitoring Workflow

The extension works in the background to monitor your development sessions:

1. **Start Working**: Begin coding with any supported AI assistant (Copilot, Claude Code, Cursor, etc.)
2. **Interactions Are Tracked**: Extension automatically detects AI interactions with provider identification
3. **Different Detection Methods**:
   - **Copilot**: Direct API integration captures actual prompts
   - **Claude Code**: File monitoring and pattern analysis infers prompts
   - **Others**: Basic detection and inference based on code patterns
4. **Commit Correlation**: When ready to commit, correlate your session with the commit

### Available Commands

Access these through the Command Palette (`Cmd+Shift+P`):

#### Core Commands
- **`Copilot Tracker: Show Current Session`** - View your current development session and recent AI interactions
- **`Copilot Tracker: Record Interaction`** - Manually record an AI interaction
- **`Copilot Tracker: Capture Last Chat`** - Capture your most recent AI chat (Copilot only)
- **`Copilot Tracker: Save Chat Conversation`** - Save a multi-turn chat conversation with prompts and responses (Ctrl+Shift+Alt+S)
- **`Copilot Tracker: Quick Save Chat`** - Quick save current chat conversation (Ctrl+Shift+Alt+C)
- **`Copilot Tracker: Correlate with Commit`** - Link current session with Git commit and save to GitHub

#### Configuration Commands
- **`Copilot Tracker: Configure`** - Set up or change GitHub repository
- **`Copilot Tracker: Sign Out from GitHub`** - Clean sign out when needed

#### Navigation Commands
- **`Copilot Tracker: View Project Prompts`** - View AI prompts for current project only
- **`Copilot Tracker: View Prompt History`** - Browse all AI prompts with project filtering

### GUI Interface

#### Activity Bar Integration
- Look for the AI tracker icon (🎯) in the left activity bar
- Click to open the AI Git Prompt Tracker view
- Browse your saved AI interactions in chronological order
- See provider identification (Copilot, Claude Code, etc.) for each interaction
- Use refresh and configure buttons in the view header

#### Interactive Features
- **Prompt Cards**: Show timestamp, repository info, and prompt preview
- **Click to Expand**: View full prompt details
- **Auto-refresh**: Updates when new prompts are saved
- **Empty State Handling**: Helpful messages and quick setup links

### Status Bar Integration

The status bar shows:
- Number of AI interactions in current session
- Configuration status (🤖 = automation enabled)
- Quick access to session view

## 💾 Data Storage & Structure

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

### Repository Structure

After using the extension across multiple projects:

```text
my-copilot-prompts/
├── README.md (auto-generated)
├── .gitignore
├── prompts/
│   ├── ecommerce-frontend/
│   │   ├── prompt-2025-07-23T10-30-00-000Z.json  # React components
│   │   ├── prompt-2025-07-23T11-15-30-000Z.json  # CSS styling
│   │   └── prompt-2025-07-23T14-22-10-000Z.json  # State management
│   ├── api-backend/
│   │   ├── prompt-2025-07-23T09-45-00-000Z.json  # Database schema
│   │   ├── prompt-2025-07-23T13-30-00-000Z.json  # Authentication
│   │   └── prompt-2025-07-23T16-00-00-000Z.json  # Error handling
│   ├── mobile-app/
│   │   ├── prompt-2025-07-23T08-15-00-000Z.json  # Navigation setup
│   │   └── prompt-2025-07-23T12-45-00-000Z.json  # API integration
│   └── data-analysis/
│       ├── prompt-2025-07-23T15-30-00-000Z.json  # Pandas operations
│       └── prompt-2025-07-23T17-20-00-000Z.json  # Visualization
```

### GitHub Storage Format
Sessions are converted to structured prompt entries:

```json
{
  "prompt": "Development Session: session-1234567890-abcdef
Duration: 2024-01-15T10:30:00.000Z to 2024-01-15T11:45:00.000Z
Total Interactions: 3

Copilot Interactions:
[1] CHAT: How do I implement authentication?
[2] INLINE: Code generation in src/auth.ts
[3] CHAT: How to add password validation?",
  "response": "[1] Here's a secure way to implement authentication...
[2] [Generated code content]
[3] You can add password validation using...",
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

#### 🔐 Pattern-Based Detection
- **API Keys**: OpenAI, GitHub, GitLab, Google Cloud, AWS, Azure, Stripe, etc.
- **Tokens**: JWT tokens, Bearer tokens, Access tokens
- **Secrets**: Environment variables, Database URLs, Private keys
- **Custom Patterns**: Extensible pattern matching system

#### 📁 Project-Aware Filtering  
- **`.gitignore` Integration**: Automatically respects your project's ignore patterns
- **Directory Matching**: Supports complex directory-based ignore rules
- **Path Normalization**: Handles different path formats consistently

#### 🛡️ Multi-Layer Sanitization
1. **Content Scanning**: All prompts and responses are scanned for sensitive patterns
2. **File Context Protection**: Code snippets and file contents are sanitized
3. **Path Sanitization**: File paths are checked against ignore patterns
4. **Safe Defaults**: Unknown patterns are conservatively redacted

#### Example Protection
```typescript
// Before sanitization:
const apiKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
const dbUrl = "mongodb://username:password@cluster.mongodb.net/database";

// After sanitization:
const apiKey = "[REDACTED_API_KEY]";
const dbUrl = "[REDACTED_DATABASE_URL]";
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

## 🤝 Team Collaboration

### Multi-Project Workflow Example

**Individual Developer Scenario:**
```text
1. Working on frontend project: my-app-frontend
   - Save interactions to: prompts/my-app-frontend/

2. Switch to backend project: my-app-backend  
   - Save interactions to: prompts/my-app-backend/

3. Working on mobile project: my-app-mobile
   - Save interactions to: prompts/my-app-mobile/

4. View all prompts: 
   - Use "View Prompt History" → see prompts from all projects
   - Use "View Project Prompts" → see only current project's prompts
```

### Team Repository Setup

1. **Shared Repository**: Create team repository like `team-ai-prompts`
2. **All Members Configure**: Each team member uses the same repository
3. **Project Organization**: Prompts automatically organized by project
4. **Knowledge Sharing**: Team members can learn from each other's effective prompts

### Project Handoffs

When taking over a project:
1. Configure extension for the existing team prompts repo
2. Use "View Project Prompts" for the specific project
3. Review previous AI interactions and context
4. Continue building on established prompt patterns

## 🧪 Testing

The extension includes comprehensive unit tests covering:

### ✅ Test Coverage
- **Session Monitoring**: Session creation, interaction tracking, commit correlation
- **Security Features**: API key detection, environment variable protection, .gitignore integration
- **Integration Tests**: Configuration management, GitHub service, Git service functionality
- **Extension Integration**: Command registration, webview provider, activation lifecycle

### Running Tests
```bash
# Run all tests
npm test

# Run with compilation and linting
npm run pretest

# Compile tests only
npm run compile-tests

# Watch mode for test development
npm run watch-tests
```

### Test Results
- **24 comprehensive tests** covering all functionality
- **Security validation** for content sanitization
- **Session workflow testing** from creation to GitHub storage
- **Integration testing** for VS Code APIs and GitHub services

## 🔄 Architecture

### Core Components

1. **CopilotSessionMonitor**: Manages development sessions and interaction tracking
2. **CopilotPromptTracker**: Main orchestrator coordinating all components
3. **ContentSanitizer**: Multi-layer security and content protection
4. **GitService**: Git repository integration and commit information
5. **GitHubService**: GitHub API integration for data storage
6. **ConfigurationManager**: Extension settings and user preferences
7. **PromptViewProvider**: Webview UI component for prompt display

### Session Lifecycle

```
Start Session → Monitor Interactions → Detect Copilot Usage → Capture Context
      ↑                                                            ↓
Start New Session ← Save to GitHub ← Sanitize Content ← Finalize Session
                                                            ↑
                                                Manual Correlation Trigger
```

### Data Flow
1. **Session Creation**: Sessions start automatically and track Copilot interactions
2. **Interaction Capture**: File context, prompts, and responses are captured with timestamps
3. **Content Sanitization**: All content is sanitized to remove sensitive information
4. **Manual Correlation**: Users manually trigger correlation between sessions and Git commits
5. **GitHub Storage**: Sanitized session data is saved to the configured GitHub repository

## 🛠️ Development

### Build Commands
```bash
# Development mode with file watching
npm run watch

# Compile TypeScript and lint
npm run compile

# Build production package
npm run package

# Type checking only
npm run check-types

# Lint source files
npm run lint
```

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

# Package for distribution
npm run package
```

### Extension Structure
- **Main Entry**: `src/extension.ts` - Extension activation and command registration
- **Commands**: All commands prefixed with `copilotPromptTracker.`
- **Settings**: Configured via VS Code settings with prefix `copilotPromptTracker.`
- **Views**: Activity bar view for prompt history and session management

### Dependencies
- **@octokit/rest** - GitHub API integration
- **simple-git** - Git operations
- TypeScript compilation with strict mode enabled
- ESLint for code quality
- VS Code extension APIs (minimum version 1.102.0)

## 🐛 Troubleshooting

### Common Issues

#### Authentication Problems
1. **OAuth not working**: Run "Sign Out from GitHub" and reconfigure
2. **Repository access denied**: Verify repository permissions on GitHub
3. **Token expired**: VS Code will automatically refresh OAuth tokens

#### Session Monitoring Issues
1. **Interactions not detected**: Check that Copilot is active and generating content
2. **Sessions not saving**: Verify GitHub repository configuration and connectivity
3. **Missing commit correlation**: Ensure you're in a Git repository with commits

#### Configuration Issues
1. **Extension not activating**: Check VS Code version (requires 1.102.0+)
2. **Commands not found**: Restart VS Code after installation
3. **View not loading**: Check Developer Console for error messages

### Debug Information
- Check Developer Console (`Help > Toggle Developer Tools`)
- Look for extension logs in the Output panel
- Use `Copilot Tracker: Show Current Session` to verify monitoring status

## 📜 License & Support

### License
MIT License - see [LICENSE](LICENSE) file for details.

### Support & Issues
- **Bug Reports**: [GitHub Issues](https://github.com/your-username/copilot-git-prompt-tracker/issues)
- **Feature Requests**: Welcome via GitHub Issues
- **Documentation**: Check existing issues before creating new ones

### Contributing
We welcome contributions! See development setup above for getting started.

## 🎉 Acknowledgments

- **GitHub Copilot Team**: For the amazing AI coding assistant
- **VS Code Team**: For the extensible editor platform
- **Open Source Community**: For inspiration and tools

## 📈 Changelog

### [0.0.1] - 2025-01-23

#### Added
- Initial release with session-based monitoring
- GitHub OAuth integration (no manual tokens needed)
- Advanced security with content sanitization
- Multi-project support with automatic organization
- Modern GUI with activity bar integration
- Comprehensive test suite (24 tests)
- Command palette integration with 8+ commands
- Real-time webview interface with VS Code theming

#### Features
- **Session Monitoring**: Automatic session creation and interaction tracking
- **Security Protection**: Multi-layer content sanitization with API key detection
- **Git Integration**: Manual correlation with commit information
- **GitHub Storage**: Structured prompt storage with project organization
- **Multi-Project Support**: Centralized repository with project-based folders
- **Modern Interface**: Activity bar icon and interactive webview

#### Technical
- TypeScript implementation with strict mode
- ES6 module support with ESBuild
- VS Code API 1.102.0+ compatibility
- Comprehensive unit test coverage
- Secure OAuth authentication
- Content sanitization with .gitignore integration

---

*This extension transforms your Copilot interactions into valuable development insights while maintaining the highest security standards.*
