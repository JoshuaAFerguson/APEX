#!/usr/bin/env node

/**
 * Simple test validation script to check system status
 * This script checks for basic requirements and attempts to identify issues
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

async function checkFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command, cwd = process.cwd()) {
  try {
    const result = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { success: true, output: result };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString(),
      stdout: error.stdout?.toString()
    };
  }
}

async function main() {
  console.log('🔍 APEX Test Validation Status Check');
  console.log('=====================================\n');

  const results = {
    dependencies: {},
    configs: {},
    tests: {},
    build: {}
  };

  // Check Node.js and npm versions
  console.log('📦 Checking Dependencies...');
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Node.js: ${nodeVersion}`);
    console.log(`✅ npm: ${npmVersion}`);
    results.dependencies.node = nodeVersion;
    results.dependencies.npm = npmVersion;
  } catch (error) {
    console.log('❌ Error checking Node.js/npm versions:', error.message);
    results.dependencies.error = error.message;
  }

  // Check package.json existence
  console.log('\n📋 Checking Configuration Files...');
  const configFiles = [
    'package.json',
    'tsconfig.json',
    'vitest.config.ts',
    'vitest.integration.config.ts',
    'vitest.e2e.config.ts',
    'tests/integration/vitest.browser-permissions.config.ts'
  ];

  for (const file of configFiles) {
    const exists = await checkFileExists(file);
    console.log(`${exists ? '✅' : '❌'} ${file}`);
    results.configs[file] = exists;
  }

  // Check if node_modules exists
  console.log('\n📚 Checking Dependencies Installation...');
  const nodeModulesExists = await checkFileExists('node_modules');
  console.log(`${nodeModulesExists ? '✅' : '❌'} node_modules directory`);
  results.dependencies.nodeModules = nodeModulesExists;

  if (!nodeModulesExists) {
    console.log('💡 Running npm install...');
    const installResult = await runCommand('npm install');
    if (installResult.success) {
      console.log('✅ npm install completed');
      results.dependencies.npmInstall = 'success';
    } else {
      console.log('❌ npm install failed:', installResult.error);
      results.dependencies.npmInstall = installResult.error;
    }
  }

  // Check TypeScript compilation
  console.log('\n🏗️  Checking Build Status...');
  const tscResult = await runCommand('npx tsc --noEmit');
  if (tscResult.success) {
    console.log('✅ TypeScript compilation check passed');
    results.build.typescript = 'success';
  } else {
    console.log('❌ TypeScript compilation check failed:');
    console.log(tscResult.stderr || tscResult.error);
    results.build.typescript = tscResult.error;
  }

  // Try to run a simple test to check test runner
  console.log('\n🧪 Checking Test Runner...');
  const testFiles = [
    'tests/integration/browser-tool-permission-integration.test.ts'
  ];

  for (const testFile of testFiles) {
    const exists = await checkFileExists(testFile);
    console.log(`${exists ? '✅' : '❌'} ${testFile}`);
    results.tests[testFile] = exists;
  }

  // Try to run the specific browser permissions test
  console.log('\n🌐 Checking Browser Permission Tests...');
  const browserTestResult = await runCommand('npx vitest run --config tests/integration/vitest.browser-permissions.config.ts --reporter=verbose --no-coverage --run');
  if (browserTestResult.success) {
    console.log('✅ Browser permission tests can run');
    results.tests.browserPermissions = 'success';
  } else {
    console.log('❌ Browser permission tests failed:');
    console.log(browserTestResult.stderr || browserTestResult.error);
    results.tests.browserPermissions = browserTestResult.error;
  }

  // Summary
  console.log('\n📊 Summary');
  console.log('==========');
  const issues = [];

  if (results.dependencies.error) issues.push('Node.js/npm setup');
  if (!results.dependencies.nodeModules) issues.push('Dependencies not installed');
  if (results.build.typescript !== 'success') issues.push('TypeScript compilation errors');
  if (results.tests.browserPermissions !== 'success') issues.push('Browser permission tests failing');

  if (issues.length === 0) {
    console.log('🎉 All systems operational!');
  } else {
    console.log('⚠️  Issues found:');
    issues.forEach(issue => console.log(`  • ${issue}`));
  }

  // Write results to file
  await fs.writeFile('test-validation-results.json', JSON.stringify(results, null, 2));
  console.log('\n📝 Detailed results saved to test-validation-results.json');

  return issues.length === 0;
}

main().catch(error => {
  console.error('❌ Validation script failed:', error);
  process.exit(1);
});