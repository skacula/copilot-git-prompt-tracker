# Copilot Git Prompt Tracker 🚀

A comprehensive VS Code extension that automatically captures Copilot prompts and saves them to GitHub repositories with full Git context, featuring enterprise-grade security and multi-project support.

## ✨ Key Features

### 🔒 **Enterprise Security**
- **Multi-Layer Protection**: Detects and redacts API keys, tokens, passwords, and sensitive data
- **Project-Aware Security**: Uses your `.gitignore` patterns to identify sensitive files
- **Content Sanitization**: JWT tokens, database URLs, environment variables automatically redacted
- **File Context Protection**: Sensitive files (`.env`, certificates, secrets) automatically excluded

### 💬 **Intelligent Copilot Integration**
- **Automatic Chat Detection**: Reads VS Code Copilot chat history automatically
- **Seamless Fallback**: Manual input when automatic detection isn't available
- **Smart Extraction**: Captures both prompts and responses with context

### 🔗 **Advanced Project Management**
- **Multi-Project Support**: Single repository for all your projects with automatic organization
- **Per-Project Configuration**: Custom settings stored in `.vscode/copilot-prompt-tracker.json`
- **Repository Creation**: Automatically creates and initializes GitHub repositories
- **Smart Organization**: Project-based folder structure with chronological naming

### 📊 **Rich Context & History**
- **Complete Git Context**: Commit hash, branch, author, changed files captured automatically
- **Interactive GUI**: Activity bar integration with prompt history viewer
- **Template System**: Predefined templates for common scenarios (bug fixes, features, reviews)
- **Searchable History**: Easy browsing and filtering of past prompts

### 🛡️ **Privacy & Control**
- **Your Data, Your Repository**: Everything stored in your own GitHub repository
- **Configurable Visibility**: Public or private repository support
- **Secure Authentication**: GitHub OAuth integration with enhanced error handling
- **No External Dependencies**: No third-party services or data collection

## 🚀 Quick Start

### 1. Install & Configure
```bash
# Install from VS Code Marketplace or clone source
git clone https://github.com/skacula/copilot-git-prompt-tracker.git
cd copilot-git-prompt-tracker
npm install && npm run compile
```

### 2. Set Up Repository
- Open Command Palette (`Cmd+Shift+P`)
- Run **"Copilot Prompt Tracker: Configure GitHub Repository"**
- Choose to create new or select existing repository
- Authenticate with GitHub (OAuth or Personal Access Token)

### 3. Start Tracking
- Use **"Save Current Prompt"** - automatically detects recent Copilot chat
- Use **"Save Prompt from Template"** for structured scenarios
- View prompts via the Activity Bar or **"View Prompt History"**

## 🔒 Security Features

### Multi-Layer Protection System

#### **1. Built-in Pattern Detection**
```typescript
// Automatically detects and redacts:
- OpenAI API keys (sk-*)
- GitHub tokens (ghp_*, gho_*, github_pat_*)
- GitLab tokens (glpat-*)
- Google API keys (AIza*)
- Environment variables (*_KEY, *_SECRET, *_TOKEN, *_PASSWORD)
- JWT tokens (complete 3-part tokens)
- Database URLs (postgres://, mongodb://, mysql://)
- AWS credentials (AKIA*, access keys)
```

#### **2. Project-Specific Protection (.gitignore Integration)**
```bash
# Your .gitignore patterns automatically protect:
*.log          # Log files
.env*          # Environment files  
secrets/       # Secret directories
*.key          # Certificate files
node_modules/  # Dependencies
dist/          # Build artifacts
```

#### **3. File Context Protection**
- Automatically excludes context from sensitive files
- Redacts content from `.env`, `.key`, `.pem` files
- Removes file paths that match sensitive patterns
- Warns users when sensitive content is detected

### Security in Action
```typescript
// Before (dangerous):
{
  "prompt": "Here's my API key: sk-1234567890abcdef...",
  "fileContext": { "fileName": ".env", "content": "DATABASE_URL=postgres://..." }
}

// After (secure):
{
  "prompt": "Here's my API key: [REDACTED]\n\n[WARNING: Sensitive data redacted]",
  "fileContext": null
}
```

## 📁 Repository Structure

```text
your-prompts-repo/
├── prompts/
│   ├── frontend-project/
│   │   ├── prompt-2025-07-25T10-30-00-123Z.json
│   │   └── prompt-2025-07-25T14-45-30-456Z.json
│   ├── backend-api/
│   │   ├── prompt-2025-07-25T11-15-00-789Z.json
│   │   └── prompt-2025-07-25T16-20-15-012Z.json
│   └── mobile-app/
│       └── prompt-2025-07-25T18-30-45-345Z.json
├── .gitignore
└── README.md (auto-generated with project overview)
```

### Prompt File Structure
```json
{
  "timestamp": "2025-07-25T10:30:00.123Z",
  "prompt": "How do I implement user authentication?",
  "response": "Here are several approaches to implement authentication...",
  "gitInfo": {
    "commitHash": "abc123def456",
    "branch": "feature/auth-system", 
    "author": "John Doe <john@example.com>",
    "repository": "my-project",
    "changedFiles": ["src/auth.js", "tests/auth.test.js"]
  },
  "metadata": {
    "vscodeVersion": "1.102.2",
    "extensionVersion": "0.0.1"
  },
  "fileContext": {
    "fileName": "src/auth.js",
    "language": "javascript"
  }
}
```

## �️ Complete Command Reference

| Command | Description | Shortcut |
|---------|-------------|----------|
| **Configure GitHub Repository** | Set up repository and authentication | |
| **Save Current Prompt** | Auto-detect and save recent Copilot chat | |
| **Save Prompt from Template** | Use predefined templates | |
| **View Prompt History** | Browse all prompts across projects | |
| **View Project Prompts** | Current project's prompts only | |
| **Toggle Prompt Tracking** | Enable/disable extension | |
| **Test Project Configuration** | Debug project settings | |
| **Test GitHub Authentication** | Verify GitHub connection | |
| **Debug Current Configuration** | Show detailed configuration info | |

## 📋 Template System

### Built-in Templates
- **🐛 Bug Fix**: Document debugging sessions and solutions
- **✨ Feature Request**: Track new feature development
- **🔍 Code Review**: Save review-related AI interactions  
- **🔄 Refactoring**: Document code improvement sessions
- **🧪 Testing**: Track test generation and debugging
- **📖 Learning**: Educational prompts and explanations
- **🚀 Performance**: Optimization-related discussions

### Custom Templates
Create your own templates with variable substitution:
```typescript
{
  "id": "custom-debug",
  "title": "Custom Debug Session",
  "template": "I'm debugging {issue} in {file}. The expected behavior is {expected} but I'm getting {actual}. Here's the relevant code:\n\n{code}",
  "variables": ["issue", "file", "expected", "actual", "code"]
}
```

## ⚙️ Configuration

### Global Settings (VS Code Settings)
```json
{
  "copilotPromptTracker.githubRepo": "username/my-prompts",
  "copilotPromptTracker.enabled": true,
  "copilotPromptTracker.autoSave": false,
  "copilotPromptTracker.saveLocation": "prompts"
}
```

### Per-Project Settings (`.vscode/copilot-prompt-tracker.json`)
```json
{
  "githubRepo": "team/shared-prompts",
  "saveLocation": "ai-sessions",
  "projectName": "frontend-app",
  "enabled": true
}
```

## 🧪 Testing & Quality Assurance

### Comprehensive Test Suite ✅
- **19 Unit Tests** covering all functionality
- **Security Pattern Testing** for all sensitive data types
- **GitIgnore Integration Testing** with various patterns
- **Copilot Chat Reader Testing** for automatic detection
- **Mock Data Testing** for edge cases and error scenarios

### Test Coverage
```bash
npm test  # Run full test suite

# Test Results:
✅ ConfigurationManager Tests (3 tests)
✅ PromptTemplateManager Tests (5 tests)  
✅ ContentSanitizer Tests (7 tests)
✅ CopilotChatReader Tests (3 tests)
✅ Extension Integration Test (1 test)

ALL 19 TESTS PASSING 🎉
```

### Security Verification
```bash
# Automated security testing confirms:
✅ API key detection and redaction
✅ Environment variable protection
✅ JWT token sanitization
✅ Database URL redaction
✅ File context filtering
✅ GitIgnore pattern matching
```

## 🤝 Multi-Project Workflows

### Individual Developer
```bash
# Single repository for all projects
my-ai-prompts/
├── web-frontend/     # React/Vue prompts
├── mobile-app/       # Flutter/React Native
├── backend-api/      # Node.js/Python API
└── data-analysis/    # Python/R analytics
```

### Team Collaboration
```bash
# Shared team repository
team-ai-knowledge/
├── onboarding/       # New developer prompts
├── code-reviews/     # Review assistance
├── debugging/        # Common issues & solutions
└── best-practices/   # Standardized approaches
```

### Enterprise Usage
```bash
# Department-wide knowledge base
engineering-ai-prompts/
├── frontend-team/
├── backend-team/
├── devops-team/
├── qa-team/
└── architecture/
```

## 📖 Advanced Use Cases

### Learning & Development
- **Pattern Recognition**: Identify common prompt patterns that work well
- **Knowledge Building**: Create searchable database of AI interactions
- **Skill Tracking**: Monitor learning progress across different technologies

### Code Review Enhancement
- **Context Preservation**: Reference AI assistance during code reviews
- **Quality Improvement**: Learn from effective prompts across the team
- **Decision Documentation**: Record AI-assisted architectural decisions

### Debugging & Problem Solving
- **Solution Database**: Build repository of debugging approaches
- **Error Pattern Matching**: Identify recurring issues and solutions
- **Team Knowledge Sharing**: Leverage collective problem-solving experience

## 🔧 Development & Contributing

### Prerequisites
- VS Code 1.102.0+
- Node.js 18+
- Git repository
- GitHub account

### Development Setup
```bash
git clone https://github.com/skacula/copilot-git-prompt-tracker.git
cd copilot-git-prompt-tracker
npm install
npm run compile
npm run watch  # For development
npm test       # Run test suite
```

### Build & Package
```bash
npm run compile     # TypeScript compilation
npm run lint        # ESLint checking  
npm run package     # Create VSIX package
```

### Architecture Overview
```text
Extension Structure:
├── ConfigurationManager    # Project & global settings
├── GitHubService           # OAuth & repository operations
├── GitService              # Git context extraction
├── CopilotPromptTracker    # Main orchestration
├── CopilotChatReader       # Automatic chat detection
├── ContentSanitizer        # Security & data protection
├── PromptTemplateManager   # Template system
└── PromptViewProvider      # GUI components
```

## 🛡️ Privacy & Security Commitment

### Data Ownership
- **Your Data**: Everything stored in your own GitHub repository
- **No Tracking**: Extension doesn't collect or transmit data to third parties
- **Local Processing**: All sanitization and processing happens locally

### Security Measures
- **OAuth Integration**: Secure GitHub authentication
- **Token Encryption**: Credentials stored using VS Code's SecretStorage
- **Content Filtering**: Multi-layer sensitive data detection
- **Access Control**: Repository-level access control via GitHub

### Compliance
- **GDPR Ready**: No personal data collection by extension
- **Enterprise Friendly**: Works with GitHub Enterprise
- **Audit Trail**: Complete history in your repository

## 📄 License & Support

### License
MIT License - see [LICENSE](LICENSE) file for details.

### Contributing
Contributions welcome! Please:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

### Support & Issues
- **Bug Reports**: Use GitHub Issues with detailed reproduction steps
- **Feature Requests**: Use GitHub Issues with use case description
- **Security Issues**: Email security@[domain] for responsible disclosure

---

**Made with ❤️ for the developer community**

*Enhance your AI-assisted development workflow while keeping your data secure and organized.*
