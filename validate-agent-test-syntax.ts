#!/usr/bin/env ts-node

/**
 * Syntax validation for agent test files
 * Validates TypeScript syntax and basic structure before running tests
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const testFiles = [
  'tests/agents/verify-agent.test.ts',
  'tests/agents/regression-check-agent.test.ts',
  'tests/workflows/tdd-workflow-integration.test.ts',
  'tests/utils/agent-yaml-parser.test.ts',
  'tests/quality/agent-prompt-quality.test.ts'
];

function validateTestFile(filePath: string): boolean {
  console.log(`Validating ${filePath}...`);

  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = readFileSync(filePath, 'utf-8');

  // Basic syntax checks
  const checks = [
    {
      name: 'Has proper imports',
      test: () => content.includes("import { describe, it, expect") || content.includes("from 'vitest'"),
      required: true
    },
    {
      name: 'Has describe blocks',
      test: () => /describe\s*\(\s*['"`]/.test(content),
      required: true
    },
    {
      name: 'Has test cases',
      test: () => /it\s*\(\s*['"`]/.test(content),
      required: true
    },
    {
      name: 'Has assertions',
      test: () => content.includes('expect('),
      required: true
    },
    {
      name: 'Proper string escaping',
      test: () => !content.includes('\\"') || content.includes('\\n'),
      required: false
    },
    {
      name: 'No syntax errors (basic)',
      test: () => {
        // Check for unmatched brackets
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        return Math.abs(openBraces - closeBraces) <= 1 && Math.abs(openParens - closeParens) <= 1;
      },
      required: true
    }
  ];

  let hasErrors = false;

  for (const check of checks) {
    try {
      const passed = check.test();
      if (passed) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.log(`  ${check.required ? '❌' : '⚠️'} ${check.name}`);
        if (check.required) hasErrors = true;
      }
    } catch (error) {
      console.log(`  ❌ ${check.name}: ${error}`);
      if (check.required) hasErrors = true;
    }
  }

  return !hasErrors;
}

function main() {
  console.log('🧪 Validating agent test files...\n');

  let allValid = true;

  for (const testFile of testFiles) {
    const fullPath = join(process.cwd(), testFile);
    const isValid = validateTestFile(fullPath);
    allValid = allValid && isValid;
    console.log('');
  }

  if (allValid) {
    console.log('✅ All test files passed validation');
    process.exit(0);
  } else {
    console.log('❌ Some test files failed validation');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}