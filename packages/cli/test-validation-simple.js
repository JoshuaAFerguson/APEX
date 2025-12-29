/**
 * Simple test validation script to check individual test files
 */
import { spawn } from 'child_process';
import { resolveExecutable } from '@apexcli/core';

async function runSingleTest(testFile) {
  console.log(`\n🧪 Testing: ${testFile}`);
  console.log('=' .repeat(60));

  return new Promise((resolve, reject) => {
    const child = spawn(resolveExecutable('npx'), ['vitest', 'run', testFile, '--reporter=verbose'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ PASSED');
        resolve(true);
      } else {
        console.log('\n❌ FAILED');
        resolve(false);
      }
    });

    child.on('error', (error) => {
      console.error('Error running test:', error);
      reject(error);
    });
  });
}

async function main() {
  console.log('🎯 TaskProgress Test Validation');
  console.log('================================\n');

  const testFiles = [
    'src/ui/components/__tests__/TaskProgress.responsive.test.tsx',
    'src/ui/hooks/__tests__/useStdoutDimensions.test.ts',
  ];

  let allPassed = true;

  for (const testFile of testFiles) {
    try {
      const passed = await runSingleTest(testFile);
      if (!passed) {
        allPassed = false;
      }
    } catch (error) {
      console.error(`Failed to run ${testFile}:`, error);
      allPassed = false;
    }
  }

  console.log('\n🎯 FINAL RESULT');
  console.log('================');
  if (allPassed) {
    console.log('✅ All tests PASSED!');
    process.exit(0);
  } else {
    console.log('❌ Some tests FAILED!');
    process.exit(1);
  }
}

main().catch(console.error);