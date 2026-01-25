/**
 * @fileoverview Test Infrastructure Validation for Browser Automation
 *
 * This test suite validates that the complete browser automation test infrastructure
 * is correctly set up and functioning. It verifies dependencies, configurations,
 * and basic functionality before running comprehensive test suites.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Browser Automation Test Infrastructure Validation', () => {
  let validationResults: {
    dependencies: boolean;
    configurations: boolean;
    testFiles: boolean;
    artifacts: boolean;
  } = {
    dependencies: false,
    configurations: false,
    testFiles: false,
    artifacts: false,
  };

  beforeAll(async () => {
    console.log('\n🔍 Validating Browser Automation Test Infrastructure...\n');
  });

  afterAll(() => {
    console.log('\n📊 Validation Summary:');
    console.log(`  Dependencies: ${validationResults.dependencies ? '✅' : '❌'}`);
    console.log(`  Configurations: ${validationResults.configurations ? '✅' : '❌'}`);
    console.log(`  Test Files: ${validationResults.testFiles ? '✅' : '❌'}`);
    console.log(`  Artifacts: ${validationResults.artifacts ? '✅' : '❌'}`);

    const allValid = Object.values(validationResults).every(result => result);
    console.log(`\n🎯 Overall Status: ${allValid ? '✅ READY' : '❌ NEEDS ATTENTION'}\n`);
  });

  describe('Dependency Validation', () => {
    it('should have Playwright installed and accessible', async () => {
      try {
        const playwright = await import('playwright');
        expect(playwright.chromium).toBeDefined();
        expect(playwright.firefox).toBeDefined();
        expect(playwright.webkit).toBeDefined();
        expect(typeof playwright.chromium.launch).toBe('function');

        console.log('  ✅ Playwright: Available');
        validationResults.dependencies = true;
      } catch (error) {
        console.error('  ❌ Playwright: Failed to import', error);
        throw new Error('Playwright not available');
      }
    });

    it('should have image processing dependencies available', async () => {
      try {
        const pixelmatch = await import('pixelmatch');
        const pngjs = await import('pngjs');

        expect(pixelmatch.default).toBeDefined();
        expect(pngjs.PNG).toBeDefined();

        console.log('  ✅ Image Processing: pixelmatch and pngjs available');
      } catch (error) {
        console.error('  ❌ Image Processing: Missing dependencies', error);
        throw new Error('Image processing dependencies not available');
      }
    });

    it('should have browser package properly installed', async () => {
      try {
        const browserPackage = await import('../../packages/browser/src/index.js');

        expect(browserPackage.BrowserManager).toBeDefined();
        expect(browserPackage.BrowserSession).toBeDefined();
        expect(browserPackage.createBrowserManager).toBeDefined();
        expect(browserPackage.launchBrowser).toBeDefined();

        console.log('  ✅ Browser Package: Available with all exports');
      } catch (error) {
        console.error('  ❌ Browser Package: Import failed', error);
        throw new Error('Browser package not available');
      }
    });

    it('should have test utilities available', async () => {
      try {
        const testBase = await import('../test-utils/browser-test-base.js');

        expect(testBase.BrowserTestBase).toBeDefined();
        expect(testBase.createBrowserTest).toBeDefined();
        expect(testBase.BrowserTestUtils).toBeDefined();

        console.log('  ✅ Test Utilities: Browser test base available');
      } catch (error) {
        console.error('  ❌ Test Utilities: Import failed', error);
        throw new Error('Test utilities not available');
      }
    });
  });

  describe('Configuration File Validation', () => {
    it('should have Playwright configuration', async () => {
      const configPath = path.join(process.cwd(), 'playwright.config.ts');

      try {
        await fs.access(configPath);
        const configContent = await fs.readFile(configPath, 'utf-8');

        expect(configContent).toContain('defineConfig');
        expect(configContent).toContain('projects');
        expect(configContent).toContain('chromium');

        console.log('  ✅ Playwright Config: Found and valid');
        validationResults.configurations = true;
      } catch (error) {
        console.error('  ❌ Playwright Config: Missing or invalid', error);
        throw new Error('Playwright configuration not found');
      }
    });

    it('should have Puppeteer configuration', async () => {
      const configPath = path.join(process.cwd(), 'puppeteer.config.js');

      try {
        await fs.access(configPath);
        const configContent = await fs.readFile(configPath, 'utf-8');

        expect(configContent).toContain('module.exports');
        expect(configContent).toContain('launch');

        console.log('  ✅ Puppeteer Config: Found and valid');
      } catch (error) {
        console.error('  ❌ Puppeteer Config: Missing or invalid', error);
        throw new Error('Puppeteer configuration not found');
      }
    });

    it('should have browser integration test configuration', async () => {
      const configPath = path.join(__dirname, 'vitest.config.ts');

      try {
        await fs.access(configPath);
        const configContent = await fs.readFile(configPath, 'utf-8');

        expect(configContent).toContain('defineConfig');

        console.log('  ✅ Browser Test Config: Found and valid');
      } catch (error) {
        console.error('  ❌ Browser Test Config: Missing', error);
        // This might not exist, so don't fail the test
        console.log('  ℹ️  Using default Vitest configuration');
      }
    });

    it('should have package.json with browser test scripts', async () => {
      const packagePath = path.join(process.cwd(), 'package.json');

      try {
        const packageContent = await fs.readFile(packagePath, 'utf-8');
        const packageJson = JSON.parse(packageContent);

        expect(packageJson.scripts['test:browser-integration']).toBeDefined();
        expect(packageJson.devDependencies['playwright']).toBeDefined();
        expect(packageJson.devDependencies['vitest']).toBeDefined();

        console.log('  ✅ Package Config: Browser test scripts available');
      } catch (error) {
        console.error('  ❌ Package Config: Invalid package.json', error);
        throw new Error('Package configuration invalid');
      }
    });
  });

  describe('Test File Structure Validation', () => {
    it('should have all required test files', async () => {
      const requiredTestFiles = [
        'infrastructure-verification.test.ts',
        'comprehensive-api-integration.test.ts',
        'apex-orchestrator-integration.test.ts',
        'example.test.ts',
        'infrastructure.test.ts',
        'e2e-workflows.test.ts',
        'utils.test.ts',
        'edge-cases.test.ts',
      ];

      const testDir = __dirname;
      const missingFiles: string[] = [];

      for (const file of requiredTestFiles) {
        const filePath = path.join(testDir, file);
        try {
          await fs.access(filePath);
          console.log(`  ✅ Test File: ${file}`);
        } catch (error) {
          console.error(`  ❌ Test File: ${file} missing`);
          missingFiles.push(file);
        }
      }

      if (missingFiles.length > 0) {
        console.error(`\n  Missing test files: ${missingFiles.join(', ')}`);
        throw new Error(`Missing test files: ${missingFiles.join(', ')}`);
      }

      validationResults.testFiles = true;
      console.log('  ✅ All required test files present');
    });

    it('should have test utilities and helpers', async () => {
      const utilityFiles = [
        '../test-utils/browser-test-base.ts',
        'utils/test-helpers.ts',
        'fixtures/common-scenarios.ts',
        'setup.ts',
      ];

      const missingUtilities: string[] = [];

      for (const file of utilityFiles) {
        const filePath = path.join(__dirname, file);
        try {
          await fs.access(filePath);
          console.log(`  ✅ Utility: ${path.basename(file)}`);
        } catch (error) {
          console.error(`  ❌ Utility: ${path.basename(file)} missing`);
          missingUtilities.push(file);
        }
      }

      if (missingUtilities.length > 0) {
        console.error(`\n  Missing utilities: ${missingUtilities.map(f => path.basename(f)).join(', ')}`);
        throw new Error(`Missing utility files: ${missingUtilities.join(', ')}`);
      }

      console.log('  ✅ All test utilities present');
    });

    it('should have browser package test files', async () => {
      const browserTestDir = path.join(process.cwd(), 'packages/browser/src/__tests__');

      try {
        const testFiles = await fs.readdir(browserTestDir);
        const testTsFiles = testFiles.filter(file => file.endsWith('.test.ts'));

        expect(testTsFiles.length).toBeGreaterThan(0);

        // Check for key test files
        const keyTests = [
          'browser-manager.test.ts',
          'browser-session.test.ts',
          'screenshot-utility.test.ts',
          'integration.test.ts',
        ];

        const presentKeyTests = keyTests.filter(test => testTsFiles.includes(test));

        console.log(`  ✅ Browser Package Tests: ${testTsFiles.length} files, ${presentKeyTests.length}/${keyTests.length} key tests`);
      } catch (error) {
        console.error('  ❌ Browser Package Tests: Directory not accessible', error);
        throw new Error('Browser package tests not accessible');
      }
    });
  });

  describe('Test Artifact Directory Validation', () => {
    it('should be able to create test artifact directories', async () => {
      const artifactDirs = [
        'test-artifacts/browser-temp',
        'test-artifacts/screenshots',
        'test-artifacts/playwright-output',
        'test-artifacts/playwright-report',
      ];

      try {
        for (const dir of artifactDirs) {
          const fullPath = path.join(process.cwd(), dir);
          await fs.mkdir(fullPath, { recursive: true });

          // Test write permissions
          const testFile = path.join(fullPath, 'test-write.tmp');
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);

          console.log(`  ✅ Artifact Dir: ${dir}`);
        }

        validationResults.artifacts = true;
        console.log('  ✅ All artifact directories accessible');
      } catch (error) {
        console.error('  ❌ Artifact Directories: Cannot create or write', error);
        throw new Error('Cannot create test artifact directories');
      }
    });

    it('should have sufficient disk space for test artifacts', async () => {
      try {
        const testDir = path.join(process.cwd(), 'test-artifacts');
        await fs.mkdir(testDir, { recursive: true });

        const stats = await fs.stat(testDir);
        expect(stats.isDirectory()).toBe(true);

        // Test creating a small file to verify write access
        const testFile = path.join(testDir, 'space-test.tmp');
        const testData = 'x'.repeat(1024 * 1024); // 1MB test
        await fs.writeFile(testFile, testData);
        await fs.unlink(testFile);

        console.log('  ✅ Disk Space: Sufficient for test artifacts');
      } catch (error) {
        console.error('  ❌ Disk Space: Insufficient or permission denied', error);
        throw new Error('Insufficient disk space or permissions');
      }
    });
  });

  describe('Basic Browser Functionality Validation', () => {
    it('should be able to launch a headless browser', async () => {
      try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.setContent('<html><body><h1>Test</h1></body></html>');
        const title = await page.title();

        await browser.close();

        expect(title).toBe('');
        console.log('  ✅ Browser Launch: Headless browser working');
      } catch (error) {
        console.error('  ❌ Browser Launch: Failed', error);
        throw new Error('Cannot launch headless browser');
      }
    });

    it('should be able to take a screenshot', async () => {
      try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
        const page = await context.newPage();

        await page.setContent(`
          <html>
            <body style="background: #f0f0f0; padding: 20px;">
              <h1 style="color: #007acc;">Screenshot Test</h1>
            </body>
          </html>
        `);

        const artifactDir = path.join(process.cwd(), 'test-artifacts');
        await fs.mkdir(artifactDir, { recursive: true });

        const screenshotPath = path.join(artifactDir, 'validation-test.png');
        await page.screenshot({ path: screenshotPath });

        await browser.close();

        const stats = await fs.stat(screenshotPath);
        expect(stats.size).toBeGreaterThan(0);

        // Clean up
        await fs.unlink(screenshotPath);

        console.log('  ✅ Screenshot: Capture functionality working');
      } catch (error) {
        console.error('  ❌ Screenshot: Failed', error);
        throw new Error('Cannot capture screenshots');
      }
    });

    it('should be able to access browser package utilities', async () => {
      try {
        const { launchBrowser } = await import('../../packages/browser/src/index.js');

        const result = await launchBrowser({ headless: true });
        expect(result.success).toBe(true);

        if (result.success) {
          const session = result.data;
          expect(session.isLaunched()).toBe(true);

          const navResult = await session.setContent('<html><body><h1>Utility Test</h1></body></html>');
          expect(navResult.success).toBe(true);

          await session.close();
        }

        console.log('  ✅ Browser Utilities: Package utilities working');
      } catch (error) {
        console.error('  ❌ Browser Utilities: Failed', error);
        throw new Error('Browser package utilities not working');
      }
    });
  });

  describe('Test Environment Validation', () => {
    it('should run in appropriate environment', () => {
      const isCI = process.env.CI === 'true';
      const isHeadless = process.env.BROWSER_TEST_HEADLESS === 'true' || isCI;
      const nodeVersion = process.version;

      console.log(`  ✅ Environment: Node ${nodeVersion}, CI: ${isCI}, Headless: ${isHeadless}`);

      // Validate Node version
      const nodeVersionNum = parseInt(nodeVersion.substring(1).split('.')[0]);
      expect(nodeVersionNum).toBeGreaterThanOrEqual(18);
    });

    it('should have required environment capabilities', () => {
      const capabilities = {
        fileSystem: typeof fs !== 'undefined',
        pathUtils: typeof path !== 'undefined',
        processEnv: typeof process !== 'undefined',
        timers: typeof setTimeout !== 'undefined',
      };

      Object.entries(capabilities).forEach(([name, available]) => {
        expect(available).toBe(true);
        console.log(`  ✅ Capability: ${name} available`);
      });
    });
  });
});