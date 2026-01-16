#!/usr/bin/env node

// Simple syntax validation script
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function validateSyntax() {
  try {
    console.log('Validating TypeScript syntax...');

    // Check if the test file compiles without errors
    const { stdout, stderr } = await execAsync(
      'npx tsc --noEmit packages/orchestrator/src/__tests__/mcp-connection-lifecycle.integration.test.ts --skipLibCheck',
      { cwd: process.cwd() }
    );

    if (stderr) {
      console.error('TypeScript compilation errors:');
      console.error(stderr);
      process.exit(1);
    } else {
      console.log('✅ TypeScript syntax validation passed');
    }
  } catch (error) {
    console.error('❌ TypeScript compilation failed:');
    console.error(error.stderr || error.message);
    process.exit(1);
  }
}

validateSyntax();