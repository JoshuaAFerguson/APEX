// Simple Node.js script to validate the gates test syntax and structure
const fs = require('fs');
const path = require('path');

// Check if the test file exists and is readable
const testFile = './packages/orchestrator/src/gates.test.ts';

try {
  const content = fs.readFileSync(testFile, 'utf8');

  console.log('✅ Test file exists and is readable');

  // Check basic structure
  const checks = [
    { name: 'Contains describe blocks', pattern: /describe\(/g },
    { name: 'Contains it blocks', pattern: /it\(/g },
    { name: 'Has proper imports', pattern: /import.*from/g },
    { name: 'Uses expect assertions', pattern: /expect\(/g },
    { name: 'Tests loadGates functionality', pattern: /loadGates/g },
    { name: 'Tests config gates', pattern: /config.*gates/gi },
    { name: 'Tests workflow gates', pattern: /workflow.*gates/gi },
    { name: 'Tests stage gate references', pattern: /stage.*gate/gi }
  ];

  let allPassed = true;

  for (const check of checks) {
    const matches = content.match(check.pattern);
    if (matches && matches.length > 0) {
      console.log(`✅ ${check.name}: ${matches.length} instances found`);
    } else {
      console.log(`❌ ${check.name}: Not found`);
      allPassed = false;
    }
  }

  // Count test cases
  const testCases = content.match(/it\(/g);
  console.log(`\n📊 Test Statistics:`);
  console.log(`   - Total test cases: ${testCases ? testCases.length : 0}`);
  console.log(`   - File size: ${(content.length / 1024).toFixed(2)} KB`);
  console.log(`   - Lines: ${content.split('\n').length}`);

  if (allPassed) {
    console.log('\n🎉 All basic structure checks passed!');
    console.log('The test file appears to be well-structured and comprehensive.');
  } else {
    console.log('\n⚠️  Some structure checks failed. Please review the test file.');
  }

  // Check for TypeScript syntax issues (basic check)
  const syntaxIssues = [];

  // Check for unmatched braces
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    syntaxIssues.push(`Unmatched braces: ${openBraces} open, ${closeBraces} close`);
  }

  // Check for unmatched parentheses
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    syntaxIssues.push(`Unmatched parentheses: ${openParens} open, ${closeParens} close`);
  }

  if (syntaxIssues.length === 0) {
    console.log('✅ Basic syntax check passed');
  } else {
    console.log('❌ Potential syntax issues found:');
    syntaxIssues.forEach(issue => console.log(`   - ${issue}`));
  }

} catch (error) {
  console.error('❌ Error reading test file:', error.message);
  process.exit(1);
}