# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a VS Code extension project that tracks and saves Copilot prompts to a GitHub repository. Please use the get_vscode_api with a query as input to fetch the latest VS Code API references.

## Project Overview

This extension helps developers:
- Capture Copilot chat prompts and responses
- Associate prompts with Git commits and code context
- Save prompt history to a user-configured GitHub repository
- Maintain a chronological record of AI-assisted development

## Key Features

- Monitor Copilot chat interactions
- Extract current Git commit information
- Save prompts with metadata (timestamp, commit hash, file context)
- GitHub API integration for repository storage
- User-configurable settings for target repository

## Architecture Guidelines

- Use TypeScript for type safety
- Follow VS Code extension best practices
- Implement proper error handling and user feedback
- Use secure authentication methods for GitHub integration
- Maintain clean separation between UI, logic, and storage layers
