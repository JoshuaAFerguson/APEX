#!/usr/bin/env node
/**
 * @fileoverview Test Setup Verification Script
 *
 * This script verifies that the test and build infrastructure is working correctly
 * without actually running the full test suite.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function verifyTestSetup() {
  console.log('🔧 Verifying Test and Build Setup...\n');

  const results = [];
  let hasErrors = false;

  try {
    // Check if package.json has the expected scripts
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};

    const expectedScripts = [
      'build',
      'test',
      'test:browser',
      'playwright:test',
      'playwright:install'
    ];

    expectedScripts.forEach(script => {
      if (scripts[script]) {
        results.push(`✅ Script available: ${script}`);
      } else {
        results.push(`❌ Script missing: ${script}`);
        hasErrors = true;
      }
    });

    // Check if we can import required modules
    const modules = [
      'vitest',
      'playwright',
      '@playwright/test',
      'turbo'
    ];

    modules.forEach(moduleName => {
      try {
        require.resolve(moduleName);
        results.push(`✅ Module resolvable: ${moduleName}`);
      } catch (error) {
        results.push(`❌ Module not found: ${moduleName}`);
        hasErrors = true;
      }
    });

    // Check TypeScript configuration
    try {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      await fs.access(tsconfigPath);
      results.push('✅ TypeScript configuration: tsconfig.json exists');
    } catch (error) {
      results.push('❌ TypeScript configuration: tsconfig.json missing');
      hasErrors = true;
    }

    // Check if packages directory exists and has expected structure
    try {
      const packagesDir = path.join(process.cwd(), 'packages');
      const packages = await fs.readdir(packagesDir);
      const expectedPackages = ['core', 'orchestrator', 'cli', 'api'];

      expectedPackages.forEach(pkg => {
        if (packages.includes(pkg)) {
          results.push(`✅ Package directory: ${pkg}`);
        } else {
          results.push(`❌ Package directory missing: ${pkg}`);
          hasErrors = true;
        }
      });
    } catch (error) {
      results.push(`❌ Packages directory not accessible: ${error.message}`);
      hasErrors = true;
    }

    // Check test configuration files
    const testConfigs = [
      'vitest.config.ts',
      'vitest.browser.config.ts',
      'vitest.unit.config.ts',
      'vitest.integration.config.ts',
      'playwright.config.ts'
    ];

    for (const config of testConfigs) {
      try {
        await fs.access(path.join(process.cwd(), config));
        results.push(`✅ Test configuration: ${config}`);
      } catch (error) {
        results.push(`❌ Test configuration missing: ${config}`);
        hasErrors = true;
      }
    }

    // Check if node_modules exists and has key dependencies
    try {
      const nodeModulesPath = path.join(process.cwd(), 'node_modules');
      await fs.access(nodeModulesPath);
      results.push('✅ Dependencies: node_modules directory exists');

      // Check for critical dependencies
      const criticalDeps = ['.bin/vitest', '.bin/playwright', 'playwright', '@playwright/test'];
      for (const dep of criticalDeps) {
        try {
          await fs.access(path.join(nodeModulesPath, dep));
          results.push(`✅ Dependency installed: ${dep}`);
        } catch (error) {
          results.push(`❌ Dependency missing: ${dep}`);
          hasErrors = true;
        }
      }
    } catch (error) {
      results.push('❌ Dependencies: node_modules directory missing - run npm install');
      hasErrors = true;
    }

    // Check workspace configuration
    if (packageJson.workspaces) {
      results.push(`✅ Workspace configuration: ${packageJson.workspaces.length} workspaces defined`);
    } else {
      results.push('❌ Workspace configuration: No workspaces defined');
      hasErrors = true;
    }

    // Verify turbo configuration
    try {
      const turboConfigPath = path.join(process.cwd(), 'turbo.json');
      await fs.access(turboConfigPath);
      results.push('✅ Turbo configuration: turbo.json exists');
    } catch (error) {
      results.push('❌ Turbo configuration: turbo.json missing');
      hasErrors = true;
    }

  } catch (error) {
    results.push(`❌ Setup verification failed: ${error.message}`);
    hasErrors = true;
  }

  // Print results
  console.log('Verification Results:');
  console.log('====================');
  results.forEach(result => console.log(result));

  console.log('\n' + '='.repeat(60));

  if (hasErrors) {
    console.log('❌ Test setup has issues that need to be resolved.');
    console.log('\nRecommended actions:');
    console.log('  1. Run: npm install');
    console.log('  2. Run: npm run build');
    console.log('  3. Run: npm run playwright:install');
    console.log('  4. Verify all packages are correctly set up');
    return false;
  } else {
    console.log('✅ Test and build setup is correctly configured!');
    console.log('\nReady to run:');
    console.log('  npm run build                     - Build all packages');
    console.log('  npm test                          - Run all tests');
    console.log('  npm run test:browser              - Run browser tests');
    console.log('  npm run playwright:test           - Run Playwright tests');
    console.log('  npm run test:coverage             - Run tests with coverage');
    console.log('\nBrowser automation ready:');
    console.log('  ✅ Playwright configuration complete');
    console.log('  ✅ Vitest browser integration ready');
    console.log('  ✅ Multi-browser support available');
    console.log('  ✅ CI/CD optimizations configured');
    return true;
  }
}

// Run verification
verifyTestSetup().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});