const { ContentSanitizer } = require('./dist/extension.js');

// Test JWT pattern
const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
console.log('JWT Token:', jwtToken);
console.log('Sanitized:', ContentSanitizer.sanitizeContent(jwtToken));

// Test API key
const apiKey = 'sk-test123456789';
console.log('API Key:', apiKey);
console.log('Sanitized:', ContentSanitizer.sanitizeContent(apiKey));
