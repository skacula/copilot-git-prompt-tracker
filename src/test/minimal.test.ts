import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Minimal test suite that avoids creating automation services
 * This prevents the extension host from becoming unresponsive
 */
suite('Minimal Extension Tests', () => {
    
    test('VS Code should be available', () => {
        assert.ok(vscode);
        assert.ok(vscode.window);
        assert.ok(vscode.workspace);
    });

    test('Extension should be loadable', () => {
        // Just test that imports work without instantiating services
        const { ConfigurationManager } = require('../ConfigurationManager');
        const { ContentSanitizer } = require('../ContentSanitizer');
        
        assert.ok(ConfigurationManager);
        assert.ok(ContentSanitizer);
    });

    test('ConfigurationManager should validate repo format', () => {
        const { ConfigurationManager } = require('../ConfigurationManager');
        const configManager = new ConfigurationManager();
        
        assert.strictEqual(configManager.isValidRepoFormat('user/repo'), true);
        assert.strictEqual(configManager.isValidRepoFormat('invalid'), false);
        assert.strictEqual(configManager.isValidRepoFormat(''), false);
        
        configManager.dispose();
    });

    test('ContentSanitizer should detect API keys', () => {
        const { ContentSanitizer } = require('../ContentSanitizer');
        
        const content = 'API key: sk-1234567890abcdefghijklmnopqrstuvwxyzABC123';
        const sanitized = ContentSanitizer.sanitizeContent(content);
        
        assert.ok(sanitized.includes('[REDACTED]'));
        assert.ok(!sanitized.includes('sk-1234567890abcdefghijklmnopqrstuvwxyzABC123'));
    });

    test('ContentSanitizer should preserve safe content', () => {
        const { ContentSanitizer } = require('../ContentSanitizer');
        
        const content = 'This is safe content without secrets';
        const sanitized = ContentSanitizer.sanitizeContent(content);
        
        assert.strictEqual(sanitized, content);
    });
});