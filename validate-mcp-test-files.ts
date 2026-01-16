// Quick validation script for the MCP test files
import fs from 'fs';
import path from 'path';

const testFiles = [
  'packages/core/src/__tests__/mcp-tool-types.test.ts',
  'packages/core/src/__tests__/mcp-connection-comprehensive.test.ts'
];

console.log('Checking MCP test files for syntax issues...\n');

testFiles.forEach((filePath, index) => {
  console.log(`${index + 1}. Checking ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ File does not exist: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Check for basic syntax issues
  let issues = [];

  // Check imports
  const importLines = lines.filter(line => line.trim().startsWith('import'));
  console.log(`   📦 Found ${importLines.length} import statements`);

  // Check describe blocks
  const describeBlocks = lines.filter(line => line.includes('describe('));
  console.log(`   🧪 Found ${describeBlocks.length} describe blocks`);

  // Check test blocks
  const testBlocks = lines.filter(line => line.includes('it(') || line.includes('test('));
  console.log(`   ✅ Found ${testBlocks.length} test cases`);

  // Check for missing closing braces (simple heuristic)
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;

  if (openBraces !== closeBraces) {
    issues.push(`Mismatched braces: ${openBraces} opening vs ${closeBraces} closing`);
  }

  // Check for missing closing parentheses (simple heuristic)
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;

  if (openParens !== closeParens) {
    issues.push(`Mismatched parentheses: ${openParens} opening vs ${closeParens} closing`);
  }

  if (issues.length === 0) {
    console.log(`   ✅ No obvious syntax issues found`);
  } else {
    console.log(`   ⚠️ Potential issues:`);
    issues.forEach(issue => console.log(`      - ${issue}`));
  }

  console.log();
});

console.log('✨ MCP test file validation complete!');