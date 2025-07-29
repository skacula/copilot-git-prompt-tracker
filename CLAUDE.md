# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that tracks and monitors AI assistant interactions (GitHub Copilot, Claude Code, Cursor, and others), correlating them with Git commits to provide insights into AI-assisted development workflows. The extension passively monitors AI interactions and allows manual correlation with Git commits.

### AI Assistant Support

The extension supports multiple AI assistants with different levels of data access:

**GitHub Copilot** - Full Integration
- ✅ Direct access to actual prompts and responses via VS Code APIs
- ✅ Complete conversation context and metadata
- ✅ Real-time interaction tracking

**Claude Code** - Inference-Based Detection
- ⚠️ **Prompts are inferred, not captured directly** - Claude Code is a standalone CLI tool without VS Code integration
- ✅ Generated code/responses are captured when Claude modifies files
- ✅ Sophisticated pattern recognition analyzes code characteristics to infer likely prompts
- ✅ File context, timing, and metadata are captured
- 📝 Inferred prompts like "Write a complete function with comments for: [context]" based on generated code patterns

**Other AI Assistants (Cursor, etc.)** - Pattern-Based Detection
- ⚠️ Detection capabilities vary by assistant architecture
- ✅ Generated code and file modifications are tracked
- ✅ Basic prompt inference based on code patterns

## Development Commands

### Build & Development
- `npm run compile` - Compile TypeScript and lint (includes type checking)
- `npm run watch` - Start development mode with file watching
- `npm run package` - Build production package with type checking and linting
- `npm run check-types` - Run TypeScript type checking without compilation
- `npm run lint` - Run ESLint on source files

### Testing
- `npm test` - Run all tests (includes compilation and linting)
- `npm run pretest` - Prepare for testing (compile tests, compile source, lint)
- `npm run compile-tests` - Compile test files to `out` directory
- `npm run watch-tests` - Watch and compile test files

### Package Management
- `npm run vscode:prepublish` - Prepare for VS Code marketplace publishing

## Architecture Overview

### Core Components

1. **AIPromptTracker** (`src/AIPromptTracker.ts`) - Main orchestrator that coordinates all components and manages the extension lifecycle for multiple AI assistants

2. **AISessionMonitor** (`src/AISessionMonitor.ts`) - Tracks development sessions and AI interactions from multiple providers. Sessions auto-timeout after 30 minutes and are limited to 50 interactions each

3. **AIAssistantDetectionService** (`src/AIAssistantDetectionService.ts`) - Multi-provider AI detection system that:
   - Monitors GitHub Copilot via VS Code APIs (direct prompt capture)
   - Detects Claude Code via file system monitoring and pattern analysis (prompt inference)
   - Supports extensible detection for other AI assistants
   - Uses confidence scoring and characteristic analysis for accurate provider identification

4. **ContentSanitizer** (`src/ContentSanitizer.ts`) - Multi-layer security system that removes sensitive data (API keys, tokens, secrets, database URLs) before storage

5. **GitService** (`src/GitService.ts`) - Git repository integration for commit information and branch tracking

6. **GitHubService** (`src/GitHubService.ts`) - GitHub API integration for storing session data to user-configured repositories

7. **ConfigurationManager** (`src/ConfigurationManager.ts`) - Extension settings and user preferences management

8. **PromptViewProvider** (`src/PromptViewProvider.ts`) - Webview UI component for displaying prompts and session history from all supported AI assistants

### Data Flow

1. **Session Creation**: Sessions start automatically and track AI interactions from multiple providers
2. **Interaction Detection**: 
   - **GitHub Copilot**: Direct capture of prompts, responses, and context via VS Code APIs
   - **Claude Code**: File system monitoring detects code generation, infers prompts from patterns
   - **Other AI Assistants**: Pattern-based detection of code modifications
3. **Content Sanitization**: All content is sanitized to remove sensitive information
4. **Manual Correlation**: Users manually trigger correlation between sessions and Git commits
5. **GitHub Storage**: Sanitized session data is saved to the configured GitHub repository

### Important Limitations

**Claude Code Prompt Inference**: Unlike GitHub Copilot which provides direct API access, Claude Code operates as a standalone CLI tool. The extension cannot capture actual prompts and must infer them based on:
- Generated code characteristics (functions, classes, comments)
- Surrounding code context and file modifications
- Pattern recognition of Claude's typical coding style
- Timing and file change analysis

While inferred prompts are sophisticated and often accurate, they are approximations based on the generated output, not the actual user input.

### Key Interfaces

- `DevelopmentSession` - Complete session with interactions, git info, and metadata from multiple AI providers
- `AIInteraction` - Individual AI interaction with context, provider identification, and type (chat/inline/comment/inferred)
- `GitInfo` - Git commit information including hash, branch, author, and changed files
- `PromptEntry` - Sanitized prompt data for GitHub storage, includes flags for inferred vs. actual prompts

### Extension Structure

- **Main Entry**: `src/extension.ts` - Extension activation and command registration
- **Commands**: All commands are prefixed with `copilotPromptTracker.` (legacy naming) and include configuration, session management, and GitHub integration
- **Settings**: Configured via VS Code settings with prefix `copilotPromptTracker.` (legacy naming)
- **Views**: Activity bar view for prompt history and session management

### Security Features

The extension implements comprehensive content sanitization:
- API key detection (OpenAI, GitHub, AWS, Google, etc.)
- JWT token redaction
- Environment variable protection
- Database URL sanitization
- Project-specific .gitignore integration
- Multi-layer pattern matching

### Dependencies

- **@octokit/rest** - GitHub API integration
- **simple-git** - Git operations
- TypeScript compilation with strict mode enabled
- ESLint for code quality
- VS Code extension APIs (minimum version 1.102.0)

### Testing Structure

Tests are located in `src/test/` and cover:
- Session monitoring and interaction tracking
- Content sanitization and security features
- Git integration and commit correlation
- Configuration management
- GitHub service integration

Use `npm test` to run the full test suite which includes compilation, linting, and test execution.