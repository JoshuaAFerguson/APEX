// Basic validation script for SecretScanner
import { SecretScanner } from './scanner';

// Test basic instantiation
console.log('Testing SecretScanner instantiation...');
const scanner = new SecretScanner();

// Test pattern loading
console.log('Testing pattern loading...');
const patterns = scanner.getPatterns();
console.log(`Loaded ${patterns.length} built-in patterns`);

// Test basic scanning with safe test data
console.log('Testing basic scanning...');
const testContent = 'This is just normal text without secrets';
const findings = scanner.scan(testContent, 'test.txt');
console.log(`Found ${findings.length} findings in safe content (expected: 0)`);

// Test with custom pattern
console.log('Testing custom patterns...');
const customScanner = new SecretScanner({
  customPatterns: [{
    name: 'test-pattern',
    regex: /TEST_PATTERN_\w{4}/g,
    secretType: 'test',
    confidence: 0.8,
    severity: 'high',
    description: 'Test pattern'
  }],
  includeBuiltInPatterns: false
});

const customContent = 'value: TEST_PATTERN_abcd';
const customFindings = customScanner.scan(customContent, 'custom.txt');
console.log(`Found ${customFindings.length} findings with custom pattern (expected: 1)`);

if (customFindings.length > 0) {
  const finding = customFindings[0];
  console.log('Finding details:', {
    file: finding.file,
    line: finding.line,
    column: finding.column,
    secretType: finding.secretType,
    patternName: finding.patternName,
    hasContext: !!finding.context
  });
}

console.log('Basic validation complete!');