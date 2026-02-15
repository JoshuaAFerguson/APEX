#!/usr/bin/env node
/**
 * Simple validation script to check if browser-permission-basic.e2e.test.ts is syntactically correct
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validateTestSyntax() {
  console.log('🔍 Validating browser-permission-basic.e2e.test.ts syntax...\n');

  const testFile = join(__dirname, 'browser-permission-basic.e2e.test.ts');

  try {
    // Use TypeScript compiler to check syntax without generating output
    const { stdout, stderr } = await execAsync(`npx tsc --noEmit --skipLibCheck "${testFile}"`);

    if (stderr && stderr.includes('error')) {
      console.log('❌ TypeScript syntax errors found:');
      console.log(stderr);
      process.exit(1);
    } else {
      console.log('✅ TypeScript syntax validation passed!');
    }

    // Also validate imports by checking if the test-utils file exists and is importable
    const testUtilsFile = join(__dirname, 'test-utils.ts');
    const { stdout: utilsStdout, stderr: utilsStderr } = await execAsync(`npx tsc --noEmit --skipLibCheck "${testUtilsFile}"`);

    if (utilsStderr && utilsStderr.includes('error')) {
      console.log('❌ Test utilities syntax errors found:');
      console.log(utilsStderr);
      process.exit(1);
    } else {
      console.log('✅ Test utilities syntax validation passed!');
    }

    console.log('\n✅ All syntax validation checks passed!');
    console.log('The browser-permission-basic E2E test is syntactically correct.');

  } catch (error) {
    console.log('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

validateTestSyntax().catch(console.error);