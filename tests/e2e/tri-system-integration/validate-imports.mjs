#!/usr/bin/env node
/**
 * Simple validation script to check if test-utils.ts imports can resolve
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { access } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const filesToCheck = [
  '../../../packages/core/src/types.js',
  '../../../packages/orchestrator/src/index.js',
  '../../../packages/orchestrator/src/store.js',
  '../../../tests/test-utils/index.js',
  '../../../tests/test-utils/permission-test-helpers.js',
  '../../../packages/core/src/test-fixtures/mock-factories.js',
  '../../../packages/orchestrator/tests/utils/event-capture.js'
];

console.log('🔍 Validating import paths for test-utils.ts...\n');

let allValid = true;

for (const file of filesToCheck) {
  const fullPath = join(__dirname, file);
  try {
    await access(fullPath);
    console.log(`✅ ${file}`);
  } catch (error) {
    console.log(`❌ ${file} - ${error.message}`);
    allValid = false;
  }
}

console.log(allValid ? '\n✅ All imports are valid!' : '\n❌ Some imports are missing');
process.exit(allValid ? 0 : 1);