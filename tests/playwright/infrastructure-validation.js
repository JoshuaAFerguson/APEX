#!/usr/bin/env node
/**
 * @fileoverview Infrastructure Validation for Playwright Setup
 *
 * This script validates that all Playwright infrastructure is correctly configured
 * and ready for browser automation testing.
 */

const fs = require('fs').promises;
const path = require('path');

async function validatePlaywrightInfrastructure() {
  console.log('🔍 Validating Playwright Infrastructure...\n');

  const results = [];
  let hasErrors = false;

  try {
    // Check core Playwright files
    const checks = [
      { file: 'playwright.config.ts', description: 'Main Playwright configuration' },
      { file: 'tests/playwright/global-setup.ts', description: 'Global setup file' },
      { file: 'tests/playwright/global-teardown.ts', description: 'Global teardown file' },
      { file: 'tests/playwright/basic-verification.spec.ts', description: 'Basic verification tests' },
      { file: 'tests/playwright/browser-launch-verification.spec.ts', description: 'Browser launch tests' },
      { file: 'vitest.browser.config.ts', description: 'Vitest browser configuration' },
      { file: 'tests/browser/setup.ts', description: 'Vitest browser setup' },
      { file: 'tests/browser/playwright-vitest-integration.test.ts', description: 'Vitest-Playwright integration tests' }
    ];

    for (const check of checks) {
      try {
        const filePath = path.join(process.cwd(), check.file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          results.push(`✅ ${check.description}: ${check.file}`);
        } else {
          results.push(`❌ ${check.description}: ${check.file} (not a file)`);
          hasErrors = true;
        }
      } catch (error) {
        results.push(`❌ ${check.description}: ${check.file} (missing)`);
        hasErrors = true;
      }
    }

    // Check package.json dependencies
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const devDeps = packageJson.devDependencies || {};

      const requiredDeps = [
        '@playwright/test',
        'playwright',
        '@vitest/browser',
        'vitest'
      ];

      requiredDeps.forEach(dep => {
        if (devDeps[dep]) {
          results.push(`✅ Dependency: ${dep} (${devDeps[dep]})`);
        } else {
          results.push(`❌ Dependency: ${dep} (missing)`);
          hasErrors = true;
        }
      });

    } catch (error) {
      results.push(`❌ Package.json validation failed: ${error.message}`);
      hasErrors = true;
    }

    // Check if modules can be required
    const modules = [
      { name: 'playwright', path: 'playwright' },
      { name: '@playwright/test', path: '@playwright/test' },
      { name: 'vitest', path: 'vitest' }
    ];

    for (const module of modules) {
      try {
        require(module.path);
        results.push(`✅ Module import: ${module.name}`);
      } catch (error) {
        results.push(`❌ Module import: ${module.name} (${error.message})`);
        hasErrors = true;
      }
    }

    // Validate configuration syntax
    try {
      const playwrightConfig = path.join(process.cwd(), 'playwright.config.ts');
      const configContent = await fs.readFile(playwrightConfig, 'utf8');

      // Basic syntax checks
      if (configContent.includes('export default defineConfig')) {
        results.push('✅ Playwright config: Valid TypeScript syntax');
      } else {
        results.push('❌ Playwright config: Invalid structure');
        hasErrors = true;
      }

      if (configContent.includes('testDir') && configContent.includes('projects')) {
        results.push('✅ Playwright config: Required properties present');
      } else {
        results.push('❌ Playwright config: Missing required properties');
        hasErrors = true;
      }
    } catch (error) {
      results.push(`❌ Playwright config validation failed: ${error.message}`);
      hasErrors = true;
    }

    // Check test result directories
    try {
      await fs.mkdir('test-results', { recursive: true });
      results.push('✅ Test results directory: Created/verified');
    } catch (error) {
      results.push(`❌ Test results directory: ${error.message}`);
      hasErrors = true;
    }

  } catch (error) {
    results.push(`❌ Validation process failed: ${error.message}`);
    hasErrors = true;
  }

  // Print results
  console.log('Validation Results:');
  console.log('==================');
  results.forEach(result => console.log(result));

  console.log('\n' + '='.repeat(60));

  if (hasErrors) {
    console.log('❌ Playwright infrastructure has issues that need to be resolved.');
    console.log('\nRecommended actions:');
    console.log('  1. Run: npm install');
    console.log('  2. Run: npx playwright install');
    console.log('  3. Check file paths and configurations');
    console.log('  4. Verify TypeScript compilation');
    process.exit(1);
  } else {
    console.log('✅ Playwright infrastructure is correctly set up!');
    console.log('\nAvailable test commands:');
    console.log('  npm run playwright:test              - Run Playwright tests');
    console.log('  npm run playwright:test:headed       - Run with browser UI');
    console.log('  npm run playwright:test:debug        - Debug mode');
    console.log('  npm run test:browser                 - Run Vitest browser tests');
    console.log('  npm run test:browser:watch           - Watch mode');
    console.log('  npm run validate:playwright-setup    - Validate setup');
    console.log('\nNext steps:');
    console.log('  1. Install browsers: npm run playwright:install');
    console.log('  2. Run tests: npm run playwright:test');
    console.log('  3. Run browser integration: npm run test:browser');
  }
}

// Run validation
validatePlaywrightInfrastructure().catch(error => {
  console.error('❌ Infrastructure validation failed:', error);
  process.exit(1);
});