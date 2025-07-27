# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that tracks and monitors GitHub Copilot interactions, correlating them with Git commits to provide insights into AI-assisted development workflows. The extension passively monitors Copilot sessions and allows manual correlation with Git commits.

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

1. **CopilotPromptTracker** (`src/CopilotPromptTracker.ts`) - Main orchestrator that coordinates all components and manages the extension lifecycle

2. **CopilotSessionMonitor** (`src/CopilotSessionMonitor.ts`) - Tracks development sessions and Copilot interactions. Sessions auto-timeout after 30 minutes and are limited to 50 interactions each

3. **ContentSanitizer** (`src/ContentSanitizer.ts`) - Multi-layer security system that removes sensitive data (API keys, tokens, secrets, database URLs) before storage

4. **GitService** (`src/GitService.ts`) - Git repository integration for commit information and branch tracking

5. **GitHubService** (`src/GitHubService.ts`) - GitHub API integration for storing session data to user-configured repositories

6. **ConfigurationManager** (`src/ConfigurationManager.ts`) - Extension settings and user preferences management

7. **PromptViewProvider** (`src/PromptViewProvider.ts`) - Webview UI component for displaying prompts and session history

### Data Flow

1. **Session Creation**: Sessions start automatically and track Copilot interactions
2. **Interaction Capture**: File context, prompts, and responses are captured with timestamps
3. **Content Sanitization**: All content is sanitized to remove sensitive information
4. **Manual Correlation**: Users manually trigger correlation between sessions and Git commits
5. **GitHub Storage**: Sanitized session data is saved to the configured GitHub repository

### Key Interfaces

- `DevelopmentSession` - Complete session with interactions, git info, and metadata
- `CopilotInteraction` - Individual Copilot interaction with context and type (chat/inline/comment)
- `GitInfo` - Git commit information including hash, branch, author, and changed files
- `PromptEntry` - Sanitized prompt data for GitHub storage

### Extension Structure

- **Main Entry**: `src/extension.ts` - Extension activation and command registration
- **Commands**: All commands are prefixed with `copilotPromptTracker.` and include configuration, session management, and GitHub integration
- **Settings**: Configured via VS Code settings with prefix `copilotPromptTracker.`
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