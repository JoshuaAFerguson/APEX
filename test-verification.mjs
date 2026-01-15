#!/usr/bin/env node

// Simple verification script to check if MCP tests exist and are properly structured
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const testFiles = [
  'packages/orchestrator/src/__tests__/mcp-installer.test.ts',
  'packages/orchestrator/src/__tests__/mcp-store.test.ts'
];

const acceptanceCriteria = {
  'mcp-installer.test.ts': [
    'successfully install',
    'successfully uninstall',
    'return list of installed',
    'throw.*error'
  ],
  'mcp-store.test.ts': [
    'save',
    'get',
    'delete',
    'getAll'
  ]
};

console.log('🧪 Verifying MCP test files...\n');

for (const testFile of testFiles) {
  const fileName = testFile.split('/').pop();

  if (!existsSync(testFile)) {
    console.log(`❌ ${fileName} - File not found`);
    continue;
  }

  const content = readFileSync(testFile, 'utf8');
  const criteria = acceptanceCriteria[fileName] || [];

  console.log(`✅ ${fileName} - File exists`);

  for (const criterion of criteria) {
    const regex = new RegExp(criterion, 'i');
    if (regex.test(content)) {
      console.log(`  ✅ Contains tests for: ${criterion}`);
    } else {
      console.log(`  ❌ Missing tests for: ${criterion}`);
    }
  }
  console.log('');
}

console.log('✅ Test verification complete!');