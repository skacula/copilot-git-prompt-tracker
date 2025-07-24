# Change Log

All notable changes to the "Copilot Git Prompt Tracker" extension will be documented in this file.

## [0.0.1] - 2025-01-23

### Added
- Initial release of Copilot Git Prompt Tracker
- Manual prompt saving functionality
- GitHub integration for storing prompts
- Git context capture (commit hash, branch, changed files)
- Configuration management for GitHub repository
- Secure GitHub token storage using VS Code secrets API
- Status bar indicator for tracking status
- Command palette integration
- Prompt history viewer with webview interface
- Rich metadata capture (VS Code version, file context)

### Features
- **Configure GitHub Repository**: Set up repository for prompt storage
- **Save Current Prompt**: Manually save Copilot prompts with full context
- **View Prompt History**: Browse saved prompts in a beautiful interface
- **Toggle Tracking**: Enable/disable prompt tracking
- **Git Integration**: Automatic capture of Git repository context
- **Secure Authentication**: Safe storage of GitHub personal access tokens
- **Configurable Save Location**: Choose where prompts are saved in repository

### Technical Details
- TypeScript implementation
- ES6 module support
- VS Code API 1.102.0+ compatibility
- GitHub REST API integration via Octokit
- Simple Git for repository operations
- ESBuild for efficient bundling

### Security
- GitHub tokens stored securely in VS Code secrets storage
- No automatic data collection
- User controls all saved content
- Open source for transparency

## Future Releases

### Planned Features
- Automatic Copilot chat monitoring (when API available)
- Enhanced search and filtering in history viewer
- Export functionality (Markdown, CSV)
- Prompt templates and snippets
- Team collaboration features
- Analytics and insights dashboard