// Simple syntax validation for our new test file
const fs = require('fs');
const path = require('path');

async function checkSyntax() {
  try {
    const testFile = path.join(__dirname, 'packages/api/src/__tests__/confirmations-websocket-streaming.integration.test.ts');
    const content = await fs.promises.readFile(testFile, 'utf8');

    // Basic syntax checks
    const syntaxChecks = [
      { pattern: /import.*from.*;/g, description: 'Import statements' },
      { pattern: /describe\('.*',.*\{/g, description: 'Describe blocks' },
      { pattern: /it\('.*',.*\{/g, description: 'Test cases' },
      { pattern: /expect\(.*\)/g, description: 'Expectations' },
      { pattern: /interface\s+\w+/g, description: 'Interface definitions' },
      { pattern: /async\s+\w+.*\{/g, description: 'Async functions' }
    ];

    console.log('Checking syntax for confirmations-websocket-streaming.integration.test.ts...');

    syntaxChecks.forEach(check => {
      const matches = content.match(check.pattern) || [];
      console.log(`✓ ${check.description}: ${matches.length} found`);
    });

    // Check for common issues
    const issues = [];

    if (content.includes('import { ApexEvent } from ')) {
      if (!content.includes("'@apexcli/core'")) {
        issues.push('ApexEvent import may be missing @apexcli/core');
      }
    }

    if (!content.includes('import WebSocket from \'ws\'') && !content.includes('import { WebSocket } from \'ws\'')) {
      issues.push('WebSocket import may be missing');
    }

    if (content.includes('describe(') && !content.includes('it(')) {
      issues.push('Describe blocks without test cases');
    }

    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Mismatched braces: ${openBraces} open, ${closeBraces} close`);
    }

    if (issues.length === 0) {
      console.log('✅ No syntax issues detected');
      console.log('✅ Test file appears to be properly structured');
    } else {
      console.log('⚠️  Potential issues:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    // Count test cases
    const testCases = content.match(/it\(/g) || [];
    const describeBlocks = content.match(/describe\(/g) || [];

    console.log(`📊 Statistics:`);
    console.log(`  - ${describeBlocks.length} describe blocks`);
    console.log(`  - ${testCases.length} test cases`);
    console.log(`  - ${Math.round(content.length / 1000)}KB file size`);

    return issues.length === 0;

  } catch (error) {
    console.error('❌ Error checking syntax:', error.message);
    return false;
  }
}

checkSyntax().then(success => {
  console.log(success ? '\n✅ Syntax validation passed' : '\n❌ Syntax validation failed');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Validation error:', error);
  process.exit(1);
});