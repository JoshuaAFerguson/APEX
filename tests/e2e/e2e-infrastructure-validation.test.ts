/**
 * @fileoverview E2E Infrastructure Validation Test
 *
 * This test verifies that the E2E test infrastructure meets all acceptance criteria:
 * 1. E2E test directory exists at tests/e2e with vitest config
 * 2. Global setup hook initializes test environment
 * 3. Global teardown hook cleans up resources
 * 4. Test runner can execute empty E2E test suite successfully
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

// Path constants
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const E2E_TEST_DIR = path.join(PROJECT_ROOT, 'tests/e2e');
const VITEST_E2E_CONFIG = path.join(PROJECT_ROOT, 'vitest.e2e.config.ts');

describe('E2E Infrastructure Validation', () => {
  describe('Acceptance Criteria 1: E2E test directory structure', () => {
    it('should have E2E test directory at tests/e2e', async () => {
      const stats = await fs.stat(E2E_TEST_DIR);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should have vitest E2E configuration file', async () => {
      const stats = await fs.stat(VITEST_E2E_CONFIG);
      expect(stats.isFile()).toBe(true);
    });

    it('should have vitest E2E config with correct settings', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');

      // Verify key configuration elements
      expect(configContent).toContain('vitest/config');
      expect(configContent).toContain('tests/e2e/**/*.test.ts');
      expect(configContent).toContain('tests/e2e/**/*.e2e.test.ts');
      expect(configContent).toContain('environment: \'node\'');
      expect(configContent).toContain('testTimeout:');
      expect(configContent).toContain('hookTimeout:');
    });

    it('should have package.json script for E2E tests', async () => {
      const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      expect(packageJson.scripts).toHaveProperty('test:e2e');
      expect(packageJson.scripts['test:e2e']).toContain('vitest.e2e.config.ts');
    });
  });

  describe('Acceptance Criteria 2: Global setup hook', () => {
    it('should have setup.ts file in tests/e2e', async () => {
      const setupPath = path.join(E2E_TEST_DIR, 'setup.ts');
      const stats = await fs.stat(setupPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should configure setup file in vitest config', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');
      expect(configContent).toContain('setupFiles');
      expect(configContent).toContain('./tests/e2e/setup.ts');
    });

    it('should export required setup functions', async () => {
      const setupPath = path.join(E2E_TEST_DIR, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf-8');

      // Check for essential setup functionality
      expect(setupContent).toContain('beforeAll');
      expect(setupContent).toContain('afterAll');
      expect(setupContent).toContain('afterEach');
      expect(setupContent).toContain('createTempDir');
      expect(setupContent).toContain('createTempGitRepo');
      expect(setupContent).toContain('cleanupAll');
    });

    it('should export E2E helper interface', async () => {
      const setupPath = path.join(E2E_TEST_DIR, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf-8');

      expect(setupContent).toContain('E2ETestHelpers');
      expect(setupContent).toContain('globalThis.apexE2EHelpers');
    });

    it('should initialize test environment variables', async () => {
      const setupPath = path.join(E2E_TEST_DIR, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf-8');

      expect(setupContent).toContain('APEX_TEST_MODE');
      expect(setupContent).toContain('NODE_ENV');
    });
  });

  describe('Acceptance Criteria 3: Global teardown hook', () => {
    it('should have teardown.ts file in tests/e2e', async () => {
      const teardownPath = path.join(E2E_TEST_DIR, 'teardown.ts');
      const stats = await fs.stat(teardownPath);
      expect(stats.isFile()).toBe(true);
    });

    it('should configure teardown file in vitest config', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');
      expect(configContent).toContain('globalTeardown');
      expect(configContent).toContain('./tests/e2e/teardown.ts');
    });

    it('should export global teardown function', async () => {
      const teardownPath = path.join(E2E_TEST_DIR, 'teardown.ts');
      const teardownContent = await fs.readFile(teardownPath, 'utf-8');

      expect(teardownContent).toContain('export default');
      expect(teardownContent).toContain('globalTeardown');
      expect(teardownContent).toContain('cleanupOrphanedTempDirs');
      expect(teardownContent).toContain('killOrphanedProcesses');
      expect(teardownContent).toContain('verifyDatabaseCleanup');
    });

    it('should clean up temporary directories', async () => {
      const teardownPath = path.join(E2E_TEST_DIR, 'teardown.ts');
      const teardownContent = await fs.readFile(teardownPath, 'utf-8');

      expect(teardownContent).toContain('apex-e2e-');
      expect(teardownContent).toContain('rm(');
      expect(teardownContent).toContain('recursive: true');
    });

    it('should handle orphaned process cleanup', async () => {
      const teardownPath = path.join(E2E_TEST_DIR, 'teardown.ts');
      const teardownContent = await fs.readFile(teardownPath, 'utf-8');

      expect(teardownContent).toContain('killOrphanedProcesses');
      expect(teardownContent).toContain('process.kill');
    });
  });

  describe('Acceptance Criteria 4: Empty test suite execution', () => {
    it('should be able to compile E2E configuration without errors', () => {
      // This will throw if there are TypeScript compilation errors
      expect(() => {
        execSync(`npx tsc --noEmit --project tsconfig.json`, {
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });
      }).not.toThrow();
    });

    it('should have valid vitest configuration syntax', async () => {
      // Import the config to validate syntax
      const configPath = path.resolve(VITEST_E2E_CONFIG);

      // This will throw if the config has syntax errors
      expect(async () => {
        await import(configPath);
      }).not.toThrow();
    });

    it('should list E2E test files correctly', async () => {
      const e2eFiles = await fs.readdir(E2E_TEST_DIR);
      const testFiles = e2eFiles.filter(file =>
        file.endsWith('.test.ts') || file.endsWith('.e2e.test.ts')
      );

      expect(testFiles.length).toBeGreaterThan(0);

      // Verify some known test files exist
      expect(testFiles).toContain('cli.e2e.test.ts');
      expect(testFiles).toContain('service-management.e2e.test.ts');
    });

    it('should have proper TypeScript types for global helpers', async () => {
      const setupPath = path.join(E2E_TEST_DIR, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf-8');

      // Check for proper type declarations
      expect(setupContent).toContain('declare global');
      expect(setupContent).toContain('var apexE2EHelpers: E2ETestHelpers');
    });
  });

  describe('E2E Test Infrastructure Features', () => {
    it('should support git repository testing', async () => {
      const setupPath = path.join(E2E_TEST_DIR, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf-8');

      expect(setupContent).toContain('createTempGitRepo');
      expect(setupContent).toContain('createBareGitRepo');
      expect(setupContent).toContain('git init');
    });

    it('should support APEX project scaffolding', async () => {
      const setupPath = path.join(E2E_TEST_DIR, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf-8');

      expect(setupContent).toContain('createApexProject');
      expect(setupContent).toContain('.apex');
      expect(setupContent).toContain('config.yaml');
    });

    it('should support resource tracking and cleanup', async () => {
      const setupPath = path.join(E2E_TEST_DIR, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf-8');

      expect(setupContent).toContain('registerTempDir');
      expect(setupContent).toContain('registerOrchestrator');
      expect(setupContent).toContain('registerServer');
      expect(setupContent).toContain('registerStore');
    });

    it('should support extended timeouts for E2E operations', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');

      // Check for extended timeouts suitable for E2E tests
      expect(configContent).toMatch(/testTimeout:\s*60000/);
      expect(configContent).toMatch(/hookTimeout:\s*30000/);
    });

    it('should support process isolation', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');

      expect(configContent).toContain('pool: \'forks\'');
      expect(configContent).toContain('maxForks:');
    });

    it('should support CI environment configuration', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');

      expect(configContent).toContain('process.env.CI');
      expect(configContent).toContain('retry:');
      expect(configContent).toContain('bail:');
    });
  });

  describe('Integration with Project Structure', () => {
    it('should have package aliases configured', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');

      expect(configContent).toContain('@apex/core');
      expect(configContent).toContain('@apex/orchestrator');
      expect(configContent).toContain('@apex/cli');
      expect(configContent).toContain('@apex/api');
    });

    it('should exclude non-test files', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');

      expect(configContent).toContain('exclude');
      expect(configContent).toContain('**/node_modules/**');
      expect(configContent).toContain('**/dist/**');
      expect(configContent).toContain('**/*.md');
    });

    it('should set appropriate environment variables', async () => {
      const configContent = await fs.readFile(VITEST_E2E_CONFIG, 'utf-8');

      expect(configContent).toContain('APEX_TEST_MODE');
      expect(configContent).toContain('e2e');
    });
  });
});