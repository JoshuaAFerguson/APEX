#!/usr/bin/env node

/**
 * Focused Test Runner for Browser Permission Integration Tests
 *
 * This script attempts to run the browser permission integration tests
 * in isolation to identify specific issues that might be preventing
 * the full test suite from passing.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const testFiles = [
  'tests/integration/browser-tool-permission-integration.test.ts',
  'tests/integration/comprehensive-tool-permission-browser.integration.test.ts',
  'tests/integration/tools-permissions-browser.integration.test.ts'
];

const configFiles = [
  'tests/integration/vitest.browser-permissions.config.ts',
  'vitest.config.ts',
  'vitest.integration.config.ts'
];

async function checkRequirements() {
  console.log('🔍 Checking Test Requirements\n');

  // Check if test files exist
  console.log('📁 Test Files:');
  for (const file of testFiles) {
    try {
      await fs.access(file);
      console.log(`  ✅ ${file}`);
    } catch {
      console.log(`  ❌ ${file} (missing)`);
    }
  }

  // Check if config files exist
  console.log('\n⚙️  Configuration Files:');
  for (const file of configFiles) {
    try {
      await fs.access(file);
      console.log(`  ✅ ${file}`);
    } catch {
      console.log(`  ❌ ${file} (missing)`);
    }
  }

  // Check if key dependencies are installed
  console.log('\n📦 Dependencies:');
  const deps = ['playwright', 'vitest', 'typescript'];
  for (const dep of deps) {
    try {
      execSync(`npm list ${dep}`, { encoding: 'utf8', stdio: 'pipe' });
      console.log(`  ✅ ${dep}`);
    } catch {
      console.log(`  ❌ ${dep} (not installed)`);
    }
  }
}

async function runTypeCheck() {
  console.log('\n🏗️  Running TypeScript Check...');
  try {
    const result = execSync('npx tsc --noEmit', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log('✅ TypeScript check passed');
    return true;
  } catch (error) {
    console.log('❌ TypeScript check failed:');
    console.log(error.stdout || error.stderr);
    return false;
  }
}

async function runSpecificTest(testFile) {
  console.log(`\n🧪 Testing: ${testFile}`);
  try {
    const result = execSync(
      `npx vitest run ${testFile} --config=vitest.config.ts --reporter=verbose --no-coverage`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000 // 1 minute timeout
      }
    );
    console.log(`✅ ${testFile} passed`);
    return { success: true, output: result };
  } catch (error) {
    console.log(`❌ ${testFile} failed`);
    console.log('Error output:');
    console.log(error.stdout || error.stderr || error.message);
    return {
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}

async function runBrowserPermissionConfig() {
  console.log('\n🌐 Testing with Browser Permission Config...');
  try {
    const result = execSync(
      'npx vitest run --config=tests/integration/vitest.browser-permissions.config.ts --reporter=verbose --no-coverage',
      {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 120000 // 2 minute timeout
      }
    );
    console.log('✅ Browser permission tests passed');
    return { success: true, output: result };
  } catch (error) {
    console.log('❌ Browser permission tests failed');
    console.log('Error output:');
    console.log(error.stdout || error.stderr || error.message);
    return {
      success: false,
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}

async function main() {
  console.log('🚀 APEX Browser Permission Integration Test Runner');
  console.log('================================================\n');

  try {
    // Check requirements
    await checkRequirements();

    // Run TypeScript check
    const tsCheckPassed = await runTypeCheck();
    if (!tsCheckPassed) {
      console.log('\n⚠️  TypeScript errors detected. Tests may fail due to compilation issues.');
    }

    // Try running with specific browser permission config
    const browserConfigResult = await runBrowserPermissionConfig();

    // Try running individual test files if browser config failed
    if (!browserConfigResult.success) {
      console.log('\n🔍 Attempting individual test files...');

      const individualResults = [];
      for (const testFile of testFiles) {
        try {
          await fs.access(testFile);
          const result = await runSpecificTest(testFile);
          individualResults.push({ testFile, ...result });
        } catch {
          console.log(`  ⏭️  Skipping ${testFile} (file not found)`);
        }
      }

      // Summary of individual test results
      console.log('\n📊 Individual Test Results:');
      individualResults.forEach(result => {
        console.log(`  ${result.success ? '✅' : '❌'} ${result.testFile}`);
      });

      const successCount = individualResults.filter(r => r.success).length;
      const totalCount = individualResults.length;

      if (successCount === totalCount && totalCount > 0) {
        console.log(`\n🎉 All individual tests passed (${successCount}/${totalCount})`);
      } else if (successCount > 0) {
        console.log(`\n⚠️  Partial success: ${successCount}/${totalCount} tests passed`);
      } else {
        console.log('\n❌ All tests failed or no tests found');
      }
    } else {
      console.log('\n🎉 Browser permission tests configuration works correctly!');
    }

    // Write detailed results
    const summary = {
      timestamp: new Date().toISOString(),
      typeScriptCheck: tsCheckPassed,
      browserConfigTest: browserConfigResult
    };

    await fs.writeFile(
      'focused-test-results.json',
      JSON.stringify(summary, null, 2)
    );

    console.log('\n📝 Detailed results saved to: focused-test-results.json');

  } catch (error) {
    console.error('\n💥 Test runner failed:', error.message);
    process.exit(1);
  }
}

main();