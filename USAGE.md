# Usage Examples

## Quick Start

1. **First Time Setup**
   - Open Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux)
   - Type "Configure Copilot Git Prompt Tracker"
   - Choose to create a new repository or use an existing one
   - If creating new: enter repository name and optional description
   - If using existing: enter repository in format `username/repo-name`
   - Enter your GitHub personal access token

2. **Save a Manual Prompt**
   - After using Copilot in your code
   - Open Command Palette
   - Type "Save Current Copilot Prompt"
   - Enter your prompt description
   - The extension will capture git context and save to GitHub

3. **Use a Template**
   - Open Command Palette
   - Type "Save Prompt from Template"
   - Choose from predefined templates (Feature Request, Bug Fix, Code Review, etc.)
   - Fill in the template fields
   - Save to GitHub with git context

4. **View Prompts by Project**
   - Open Command Palette
   - Type "View Project Prompts" for current project only
   - Or "View Prompt History" to choose from all projects
   - Browse prompts in VS Code or open in GitHub

## Multi-Project Workflow

### Scenario: Developer working on Frontend, Backend, and Mobile projects

```text
1. Working on frontend project: my-app-frontend
   - Save prompt: "Create responsive navigation component"
   - Extension saves to: prompts/my-app-frontend/

2. Switch to backend project: my-app-backend  
   - Save prompt: "Generate API endpoints for user authentication"
   - Extension saves to: prompts/my-app-backend/

3. Working on mobile project: my-app-mobile
   - Save prompt: "Create login screen with form validation"
   - Extension saves to: prompts/my-app-mobile/

4. View all prompts: 
   - "View Prompt History" → "All Projects" → see prompts from all 3 projects
   - "View Project Prompts" → see only current project's prompts
```

## Repository Creation Example

### Creating a centralized prompts repository

1. **Automatic Creation**:
   - Run "Configure Copilot Git Prompt Tracker"
   - Choose "Create New Repository"
   - Enter name: `my-copilot-prompts`
   - Enter description: `AI prompts and interactions from all my projects`
   - Extension creates repo with README and proper structure

2. **Repository Structure Created**:

   ```text
   my-copilot-prompts/
   ├── README.md (auto-generated)
   ├── prompts/
   │   └── (projects will be added here automatically)
   └── .gitignore
   ```

3. **First Prompt Save**:
   - When you save from any project, creates project folder automatically
   - Example: `prompts/ecommerce-site/prompt-2025-07-23T10-30-00-000Z.json`

## Sample Repository Structure

After using the extension across multiple projects:

```text
my-copilot-prompts/
├── README.md
├── prompts/
│   ├── ecommerce-frontend/
│   │   ├── prompt-2025-07-23T10-30-00-000Z.json  # React component creation
│   │   ├── prompt-2025-07-23T11-15-30-000Z.json  # CSS styling help
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
└── .gitignore
```

## Example Prompt File Content

```json
{
  "timestamp": "2025-07-23T10:30:00.000Z",
  "prompt": "Create a responsive navigation bar component in React with dropdown menus and mobile hamburger menu",
  "gitInfo": {
    "commitHash": "abc123def456",
    "branch": "feature/navigation",
    "author": "John Doe <john@example.com>",
    "repository": "https://github.com/user/ecommerce-frontend.git",
    "changedFiles": [
      "src/components/Navigation.jsx",
      "src/styles/navigation.css"
    ]
  },
  "metadata": {
    "vscodeVersion": "1.102.0",
    "extensionVersion": "0.0.1"
  }
}
```

## Team Collaboration Examples

### Sharing Best Practices

1. **Team Repository Setup**:
   - Create shared repository: `team-ai-prompts`
   - All team members configure extension to use same repo
   - Each member's prompts organized by their projects

2. **Learning from Colleagues**:
   - Browse `View Prompt History` → `All Projects`
   - See effective prompts from other team members
   - Learn prompt patterns that work well

3. **Code Review Context**:
   - During code review, check associated prompts
   - Understand the AI assistance behind code changes
   - Improve team's prompting skills

### Project Handoffs

When taking over a project:

1. Configure extension for the existing team prompts repo
2. Use "View Project Prompts" for the specific project
3. Review previous AI interactions and context
4. Continue building on established prompt patterns

This helps maintain context and consistency when multiple developers work on the same project over time!
