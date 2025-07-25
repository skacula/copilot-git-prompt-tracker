// Test the replacement logic
const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
const jwtPattern = /(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;

console.log('Original:', jwtToken);

const sanitized = jwtToken.replace(jwtPattern, (match, ...groups) => {
    console.log('Match:', match);
    console.log('Groups:', groups);
    
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

console.log('Sanitized:', sanitized);
console.log('Contains original header?', sanitized.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
