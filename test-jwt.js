// Simple test to check JWT pattern
const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

// Our pattern from ContentSanitizer
const jwtPattern = /(eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;

console.log('JWT Token:', jwtToken);
console.log('Pattern matches:', jwtPattern.test(jwtToken));

// Let's check each part
const parts = jwtToken.split('.');
console.log('Part 1 (header):', parts[0]);
console.log('Part 2 (payload):', parts[1]); 
console.log('Part 3 (signature):', parts[2]);

// Check if each part matches expected pattern
const headerPattern = /^eyJ[A-Za-z0-9_-]+$/;
const payloadPattern = /^eyJ[A-Za-z0-9_-]+$/;
const signaturePattern = /^[A-Za-z0-9_-]+$/;

console.log('Header matches:', headerPattern.test(parts[0]));
console.log('Payload matches:', payloadPattern.test(parts[1]));
console.log('Signature matches:', signaturePattern.test(parts[2]));

// Let's try the full pattern again
const fullMatch = jwtToken.match(jwtPattern);
console.log('Full match result:', fullMatch);
