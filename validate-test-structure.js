#!/usr/bin/env node

/**
 * Simple validation script for agent test files
 */

const fs = require('fs');
const path = require('path');

const testFiles = [
  'tests/agents/verify-agent.test.ts',
  'tests/agents/regression-check-agent.test.ts',
  'tests/workflows/tdd-workflow-integration.test.ts',
  'tests/utils/agent-yaml-parser.test.ts',
  'tests/quality/agent-prompt-quality.test.ts'
];

function validateTestFile(filePath) {
  console.log(`📝 Validating ${filePath}...`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Basic structure validation
  const checks = [
    {
      name: 'Has vitest imports',
      test: content.includes("import { describe, it, expect") && content.includes("vitest"),
      required: true
    },
    {
      name: 'Has describe blocks',
      test: /describe\s*\(\s*['"`]/.test(content),
      required: true
    },
    {
      name: 'Has test cases',
      test: /it\s*\(\s*['"`]/.test(content),
      required: true
    },
    {
      name: 'Has expect assertions',
      test: content.includes('expect(') && content.includes('.toBe'),
      required: true
    },
    {
      name: 'Uses proper file operations',
      test: content.includes('readFileSync') || content.includes('existsSync'),
      required: false
    },
    {
      name: 'No obvious syntax errors',
      test: () => {
        // Count brackets
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        return Math.abs(openBraces - closeBraces) <= 2 && Math.abs(openParens - closeParens) <= 2;
      },
      required: true
    }
  ];

  let hasErrors = false;

  for (const check of checks) {
    try {
      const passed = typeof check.test === 'function' ? check.test() : check.test;
      if (passed) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.log(`  ${check.required ? '❌' : '⚠️'} ${check.name}`);
        if (check.required) hasErrors = true;
      }
    } catch (error) {
      console.log(`  ❌ ${check.name}: ${error.message}`);
      if (check.required) hasErrors = true;
    }
  }

  return !hasErrors;
}

function main() {
  console.log('🧪 Validating agent test files structure...\n');

  let allValid = true;

  for (const testFile of testFiles) {
    const fullPath = path.join(process.cwd(), testFile);
    const isValid = validateTestFile(fullPath);
    allValid = allValid && isValid;
    console.log('');
  }

  console.log('📊 Validation Summary:');
  if (allValid) {
    console.log('✅ All test files passed structural validation');
    console.log('✅ Test files are ready for execution');
  } else {
    console.log('❌ Some test files failed structural validation');
    console.log('❌ Review and fix errors before running tests');
  }

  return allValid;
}

if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}