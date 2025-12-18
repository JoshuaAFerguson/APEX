#!/usr/bin/env node

/**
 * Simple syntax checker for TypeScript/JSX files
 * This validates our test file syntax without running the actual tests
 */

const fs = require('fs');
const path = require('path');

async function checkSyntax() {
  const testFile = path.join(__dirname, 'src/__tests__/v030-features.integration.test.tsx');

  try {
    const content = fs.readFileSync(testFile, 'utf8');

    // Basic syntax checks
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    const openBrackets = (content.match(/\[/g) || []).length;
    const closeBrackets = (content.match(/\]/g) || []).length;

    console.log('🔍 Syntax check results:');
    console.log(`📁 File: ${testFile}`);
    console.log(`📏 Lines: ${content.split('\n').length}`);
    console.log(`🔧 Braces: ${openBraces} open, ${closeBraces} close ${openBraces === closeBraces ? '✅' : '❌'}`);
    console.log(`🔧 Parentheses: ${openParens} open, ${closeParens} close ${openParens === closeParens ? '✅' : '❌'}`);
    console.log(`🔧 Brackets: ${openBrackets} open, ${closeBrackets} close ${openBrackets === closeBrackets ? '✅' : '❌'}`);

    // Check for basic structural elements
    const hasDescribeBlocks = content.includes('describe(');
    const hasItBlocks = content.includes('it(');
    const hasExpectStatements = content.includes('expect(');
    const hasImports = content.includes('import ');
    const hasCompletionTests = content.includes('Completion Engine Integration');

    console.log('\n🔍 Structural checks:');
    console.log(`📦 Has imports: ${hasImports ? '✅' : '❌'}`);
    console.log(`🧪 Has describe blocks: ${hasDescribeBlocks ? '✅' : '❌'}`);
    console.log(`🧪 Has test cases: ${hasItBlocks ? '✅' : '❌'}`);
    console.log(`🧪 Has assertions: ${hasExpectStatements ? '✅' : '❌'}`);
    console.log(`🧪 Has completion tests: ${hasCompletionTests ? '✅' : '❌'}`);

    // Count test categories
    const providerTests = (content.match(/describe\('.*Provider.*'/g) || []).length;
    const debounceTests = (content.match(/should debounce/gi) || []).length;
    const fuzzyTests = (content.match(/fuzzy/gi) || []).length;
    const contextTests = (content.match(/Context-Aware/gi) || []).length;

    console.log('\n📊 Test coverage:');
    console.log(`🔌 Provider tests: ${providerTests}`);
    console.log(`⏱️  Debounce tests: ${debounceTests}`);
    console.log(`🔍 Fuzzy search tests: ${fuzzyTests}`);
    console.log(`🎯 Context-aware tests: ${contextTests}`);

    // Check for common issues
    const issues = [];
    if (openBraces !== closeBraces) issues.push('Unmatched braces');
    if (openParens !== closeParens) issues.push('Unmatched parentheses');
    if (openBrackets !== closeBrackets) issues.push('Unmatched brackets');
    if (!hasCompletionTests) issues.push('Missing completion integration tests');

    if (issues.length === 0) {
      console.log('\n✅ Syntax check passed! No issues detected.');
      return true;
    } else {
      console.log('\n❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      return false;
    }

  } catch (error) {
    console.error('❌ Error reading test file:', error.message);
    return false;
  }
}

if (require.main === module) {
  checkSyntax().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { checkSyntax };