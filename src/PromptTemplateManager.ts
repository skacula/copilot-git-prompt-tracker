export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    category: string;
}

export class PromptTemplateManager {
    private static readonly DEFAULT_TEMPLATES: PromptTemplate[] = [
        {
            id: 'code-review',
            name: 'Code Review',
            description: 'Request code review and suggestions',
            template: 'Please review this code and suggest improvements:\n\n{code}',
            category: 'Review'
        },
        {
            id: 'bug-fix',
            name: 'Bug Fix',
            description: 'Ask for help fixing a bug',
            template: 'I have a bug in my code. The expected behavior is {expected}, but I\'m getting {actual}. Here\'s the relevant code:\n\n{code}',
            category: 'Debug'
        },
        {
            id: 'optimization',
            name: 'Code Optimization',
            description: 'Request performance optimization',
            template: 'How can I optimize this code for better performance?\n\n{code}',
            category: 'Performance'
        },
        {
            id: 'documentation',
            name: 'Documentation',
            description: 'Generate documentation for code',
            template: 'Please generate documentation for this code:\n\n{code}',
            category: 'Documentation'
        },
        {
            id: 'testing',
            name: 'Unit Tests',
            description: 'Generate unit tests',
            template: 'Please create unit tests for this function:\n\n{code}',
            category: 'Testing'
        }
    ];

    public static getTemplates(): PromptTemplate[] {
        return [...this.DEFAULT_TEMPLATES];
    }

    public static getTemplate(id: string): PromptTemplate | undefined {
        return this.DEFAULT_TEMPLATES.find(template => template.id === id);
    }

    public static getTemplatesByCategory(category: string): PromptTemplate[] {
        return this.DEFAULT_TEMPLATES.filter(template => template.category === category);
    }

    public static formatTemplate(template: PromptTemplate, variables: Record<string, string>): string {
        let formatted = template.template;

        Object.entries(variables).forEach(([key, value]) => {
            formatted = formatted.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        });

        return formatted;
    }
}
