import * as fs from 'fs';
import * as path from 'path';

export class ContentSanitizer {
    // Patterns for sensitive data that should be filtered out
    private static readonly SENSITIVE_PATTERNS = [
        // OpenAI and AI service API keys
        /(sk-[a-zA-Z0-9]{20,})/g, // OpenAI API keys
        /(pk-[a-zA-Z0-9]{20,})/g, // OpenAI public keys  
        /(org-[a-zA-Z0-9]{20,})/g, // OpenAI organization keys
        /(sess-[a-zA-Z0-9]{20,})/g, // OpenAI session keys
        
        // Other common API key patterns
        /(ghp_[a-zA-Z0-9]{36})/g, // GitHub personal access tokens
        /(gho_[a-zA-Z0-9]{36})/g, // GitHub OAuth tokens
        /(github_pat_[a-zA-Z0-9_]{82})/g, // GitHub fine-grained tokens
        /(glpat-[a-zA-Z0-9_-]{20})/g, // GitLab personal access tokens
        /(AIza[0-9A-Za-z_-]{35})/g, // Google API keys
        
        // Environment variables and API keys
        /([A-Z_]+_KEY\s*=\s*['"`]?)[^'"`\n\r]+(['"`]?)/gi,
        /([A-Z_]+_SECRET\s*=\s*['"`]?)[^'"`\n\r]+(['"`]?)/gi,
        /([A-Z_]+_TOKEN\s*=\s*['"`]?)[^'"`\n\r]+(['"`]?)/gi,
        /([A-Z_]+_PASSWORD\s*=\s*['"`]?)[^'"`\n\r]+(['"`]?)/gi,
        /(API_KEY\s*=\s*['"`]?)[^'"`\n\r]+(['"`]?)/gi,
        /(DATABASE_URL\s*=\s*['"`]?)[^'"`\n\r]+(['"`]?)/gi,
        /(SUPABASE_\w+\s*=\s*['"`]?)[^'"`\n\r]+(['"`]?)/gi,
        
        // JWT tokens
        /(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g,
        
        // AWS keys
        /(AKIA[0-9A-Z]{16})/g,
        /([a-zA-Z0-9/+]{40})/g, // AWS secret keys
        
        // Database connection strings
        /(mongodb:\/\/[^@]+@[^/]+)/gi,
        /(postgres:\/\/[^@]+@[^/]+)/gi,
        /(mysql:\/\/[^@]+@[^/]+)/gi,
        
        // Common secret formats
        /(['"`])[a-f0-9]{32,}(['"`])/gi, // 32+ character hex strings
        /(['"`])[A-Za-z0-9+/=]{20,}(['"`])/gi, // Base64-like strings
    ];

    // File extensions that commonly contain sensitive data
    private static readonly SENSITIVE_FILE_EXTENSIONS = [
        '.env',
        '.env.local',
        '.env.production',
        '.env.development',
        '.secrets',
        '.key',
        '.pem',
        '.p12',
        '.pfx',
    ];

    // Paths that commonly contain sensitive data
    private static readonly SENSITIVE_PATH_PATTERNS = [
        /\/\.env/i,
        /\/secrets/i,
        /\/config\/[^/]*secret/i,
        /\/\.aws/i,
        /\/\.ssh/i,
    ];

    public static sanitizeContent(content: string, fileName?: string): string {
        if (!content) {
            return content;
        }

        // If this is a known sensitive file, redact heavily
        if (fileName && this.isSensitiveFile(fileName)) {
            return this.redactSensitiveFile(content, fileName);
        }

        // Apply general sanitization
        let sanitized = content;
        
        for (const pattern of this.SENSITIVE_PATTERNS) {
            sanitized = sanitized.replace(pattern, (match, ...groups) => {
                // For patterns like environment variables that have format: (PREFIX)(VALUE)(SUFFIX)
                // where we want to keep PREFIX and SUFFIX but redact VALUE
                // Check if we have exactly 2 meaningful capture groups (prefix and suffix)
                if (groups.length >= 2 && 
                    typeof groups[0] === 'string' && groups[0].length > 0 &&
                    typeof groups[1] === 'string' && 
                    groups[0] !== match) { // Make sure the first group isn't the entire match
                    return `${groups[0]}[REDACTED]${groups[1] || ''}`;
                }
                // Otherwise, just redact the entire match (for tokens, JWTs, etc.)
                return '[REDACTED]';
            });
        }

        return sanitized;
    }

    public static isSensitiveFile(fileName: string): boolean {
        const lowerFileName = fileName.toLowerCase();
        
        // Check file extensions
        for (const ext of this.SENSITIVE_FILE_EXTENSIONS) {
            if (lowerFileName.endsWith(ext)) {
                return true;
            }
        }
        
        // Check path patterns
        for (const pattern of this.SENSITIVE_PATH_PATTERNS) {
            if (pattern.test(fileName)) {
                return true;
            }
        }
        
        return false;
    }

    private static redactSensitiveFile(content: string, fileName: string): string {
        // For .env files and similar, show structure but redact all values
        if (fileName.toLowerCase().includes('.env')) {
            return content.replace(/^([^=\n\r]+)(=)(.*)$/gm, (match, key, equals, value) => {
                // Keep key names but redact values
                if (value.trim()) {
                    return `${key}${equals}[REDACTED]`;
                }
                return match; // Keep empty lines and comments
            });
        }
        
        // For other sensitive files, provide a generic message
        return `[SENSITIVE FILE CONTENT REDACTED]\nFile: ${fileName}\nReason: This file type commonly contains sensitive information.`;
    }

    public static shouldIncludeFileContext(fileName: string): boolean {
        // Don't include any context from sensitive files
        return !this.isSensitiveFile(fileName);
    }

    public static sanitizePromptEntry(promptEntry: any, workspaceRoot?: string): any {
        const sanitized = { ...promptEntry };
        
        // Sanitize the main prompt text
        if (sanitized.prompt) {
            sanitized.prompt = this.sanitizeContent(sanitized.prompt);
        }
        
        // Sanitize the response
        if (sanitized.response) {
            sanitized.response = this.sanitizeContent(sanitized.response);
        }
        
        // Remove or sanitize file context if it's from a sensitive file (including .gitignore patterns)
        if (sanitized.fileContext && sanitized.fileContext.fileName) {
            const fileName = sanitized.fileContext.fileName;
            
            if (this.isSensitiveFileEnhanced(fileName, workspaceRoot)) {
                // Remove the sensitive file context entirely
                delete sanitized.fileContext;
                
                // Add a warning to the prompt about redacted content
                const isGitIgnored = this.isGitIgnoredFile(fileName, workspaceRoot);
                const reason = isGitIgnored ? 
                    'Context from .gitignore file was redacted for security' :
                    'Context from sensitive file was redacted for security';
                sanitized.prompt += `\n\n[WARNING: ${reason}]`;
            }
        }
        
        return sanitized;
    }

    /**
     * Load and parse .gitignore patterns from the workspace
     */
    private static loadGitignorePatterns(workspaceRoot?: string): string[] {
        if (!workspaceRoot) {
            return [];
        }

        const gitignorePath = path.join(workspaceRoot, '.gitignore');
        
        try {
            if (fs.existsSync(gitignorePath)) {
                const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
                const patterns = gitignoreContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#')) // Remove comments and empty lines
                    .map(pattern => {
                        // Convert gitignore patterns to regex-friendly format
                        return pattern
                            .replace(/\./g, '\\.')  // Escape dots
                            .replace(/\*/g, '.*')   // Convert * to .*
                            .replace(/\?/g, '.');   // Convert ? to .
                    });
                
                console.log(`ContentSanitizer: Loaded ${patterns.length} patterns from .gitignore`);
                return patterns;
            }
        } catch (error) {
            console.warn('ContentSanitizer: Could not read .gitignore file:', error);
        }

        return [];
    }

    /**
     * Check if a file matches any .gitignore pattern
     */
    public static isGitIgnoredFile(fileName: string, workspaceRoot?: string): boolean {
        const gitignorePatterns = this.loadGitignorePatterns(workspaceRoot);
        
        if (gitignorePatterns.length === 0) {
            return false;
        }

        // Normalize the file path for comparison
        const normalizedPath = fileName.replace(/\\/g, '/');
        const relativePath = workspaceRoot 
            ? path.relative(workspaceRoot, fileName).replace(/\\/g, '/')
            : normalizedPath;

        for (const pattern of gitignorePatterns) {
            // Handle directory patterns (ending with /)
            if (pattern.endsWith('/')) {
                const dirPattern = pattern.slice(0, -1); // Remove trailing /
                const dirRegex = new RegExp(`^${dirPattern}($|/)`, 'i');
                if (dirRegex.test(normalizedPath) || dirRegex.test(relativePath)) {
                    console.log(`ContentSanitizer: File '${fileName}' matches .gitignore directory pattern '${pattern}'`);
                    return true;
                }
            } else {
                const regex = new RegExp(`^${pattern}$`, 'i');
                
                // Check both full path and relative path
                if (regex.test(normalizedPath) || regex.test(relativePath)) {
                    console.log(`ContentSanitizer: File '${fileName}' matches .gitignore pattern '${pattern}'`);
                    return true;
                }
                
                // Also check if any parent directory matches
                const pathParts = relativePath.split('/');
                for (let i = 0; i < pathParts.length; i++) {
                    const partialPath = pathParts.slice(0, i + 1).join('/');
                    if (regex.test(partialPath)) {
                        console.log(`ContentSanitizer: File '${fileName}' matches .gitignore pattern '${pattern}' via parent directory`);
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Enhanced file sensitivity check that includes .gitignore patterns
     */
    public static isSensitiveFileEnhanced(fileName: string, workspaceRoot?: string): boolean {
        // First check our built-in patterns
        if (this.isSensitiveFile(fileName)) {
            return true;
        }

        // Then check if it matches .gitignore patterns
        if (this.isGitIgnoredFile(fileName, workspaceRoot)) {
            return true;
        }

        return false;
    }
}
