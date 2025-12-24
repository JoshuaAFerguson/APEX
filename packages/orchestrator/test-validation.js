// Test validation script to check syntax of new test files
const fs = require('fs');
const path = require('path');

function validateTestFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Basic syntax checks
    const issues = [];

    // Check for unclosed strings
    if ((content.match(/"/g) || []).length % 2 !== 0) {
      issues.push('Potential unclosed string literal');
    }

    // Check for unclosed brackets
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push(`Mismatched brackets: ${openBrackets} open, ${closeBrackets} close`);
    }

    // Check for basic test structure
    if (!content.includes('describe(')) {
      issues.push('Missing describe blocks');
    }

    if (!content.includes('it(')) {
      issues.push('Missing test cases');
    }

    // Check for imports
    if (!content.includes('import')) {
      issues.push('Missing imports');
    }

    return {
      file: path.basename(filePath),
      issues,
      valid: issues.length === 0,
      lineCount: content.split('\n').length
    };
  } catch (error) {
    return {
      file: path.basename(filePath),
      issues: [`Failed to read file: ${error.message}`],
      valid: false,
      lineCount: 0
    };
  }
}

// Validate all new test files
const testFiles = [
  'packages/orchestrator/src/__tests__/readme-section-analysis.test.ts',
  'packages/orchestrator/src/__tests__/readme-section-config.test.ts',
  'packages/orchestrator/src/__tests__/readme-section-edge-cases.test.ts',
  'packages/cli/src/__tests__/readme-section-display.test.ts'
];

console.log('Test File Validation Results:');
console.log('============================');

let totalIssues = 0;
let totalLines = 0;

testFiles.forEach(filePath => {
  const result = validateTestFile(filePath);
  console.log(`\nFile: ${result.file}`);
  console.log(`Lines: ${result.lineCount}`);
  console.log(`Status: ${result.valid ? '✅ Valid' : '❌ Issues Found'}`);

  if (result.issues.length > 0) {
    console.log('Issues:');
    result.issues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
  }

  totalIssues += result.issues.length;
  totalLines += result.lineCount;
});

console.log('\n============================');
console.log(`Total files validated: ${testFiles.length}`);
console.log(`Total lines of test code: ${totalLines}`);
console.log(`Total issues found: ${totalIssues}`);
console.log(`Overall status: ${totalIssues === 0 ? '✅ All files valid' : '❌ Issues need attention'}`);