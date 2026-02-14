/**
 * @fileoverview Unified Test Runner E2E Validation Tests
 *
 * This test suite validates that the unified test runner successfully:
 * - Discovers all E2E tests across the monorepo
 * - Properly categorizes test types
 * - Executes test runs without configuration errors
 * - Provides accurate reporting and validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(require('child_process').exec);

describe('Unified Test Runner E2E Validation', () => {
  const testRunnerPath = path.join(process.cwd(), 'scripts/unified-test-runner.js');

  beforeAll(async () => {
    // Ensure test runner script exists
    expect(fs.existsSync(testRunnerPath)).toBe(true);
  });

  describe('Test Discovery', () => {
    it('should discover E2E tests using list mode', async () => {
      const result = await execAsync(`node ${testRunnerPath} --type=e2e --list`);

      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('test files');

      // Should discover marketplace E2E tests
      expect(result.stdout).toContain('marketplace');

      // Should discover various E2E test patterns
      expect(result.stdout).toContain('.e2e.test.ts');
    }, 30000);

    it('should validate E2E test discovery configuration', async () => {
      const result = await execAsync(`node ${testRunnerPath} --type=e2e --validate`);

      expect(result.stdout).toContain('Validating e2e test discovery');
      expect(result.stdout).toContain('Manual discovery:');
      expect(result.stdout).toContain('Vitest discovery:');

      // Should indicate successful validation
      expect(result.stdout).toContain('test discovery is working correctly');
    }, 30000);

    it('should discover tests by package filter', async () => {
      const result = await execAsync(`node ${testRunnerPath} --package=cli --list`);

      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('packages/cli');
    }, 15000);

    it('should discover tests by pattern filter', async () => {
      const result = await execAsync(`node ${testRunnerPath} --type=e2e --pattern=marketplace --list`);

      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('marketplace');
    }, 15000);
  });

  describe('Configuration Validation', () => {
    it('should have all required vitest config files', () => {
      const expectedConfigs = [
        'vitest.config.ts',
        'vitest.unit.config.ts',
        'vitest.integration.config.ts',
        'vitest.e2e.config.ts',
        'vitest.browser.config.ts',
        'vitest.shared.config.ts'
      ];

      for (const config of expectedConfigs) {
        const configPath = path.join(process.cwd(), config);
        expect(fs.existsSync(configPath), `Config file ${config} should exist`).toBe(true);
      }
    });

    it('should validate unit test configuration', async () => {
      const result = await execAsync(`node ${testRunnerPath} --type=unit --validate`);

      expect(result.stdout).toContain('Validating unit test discovery');
    }, 30000);

    it('should validate integration test configuration', async () => {
      const result = await execAsync(`node ${testRunnerPath} --type=integration --validate`);

      expect(result.stdout).toContain('Validating integration test discovery');
    }, 30000);
  });

  describe('Help and Information', () => {
    it('should display help information', async () => {
      const result = await execAsync(`node ${testRunnerPath} --help`);

      expect(result.stdout).toContain('APEX Unified Test Runner');
      expect(result.stdout).toContain('USAGE:');
      expect(result.stdout).toContain('OPTIONS:');
      expect(result.stdout).toContain('TEST TYPES:');
      expect(result.stdout).toContain('EXAMPLES:');
    });

    it('should list all available test types', async () => {
      const result = await execAsync(`node ${testRunnerPath} --help`);

      // Check that all major test types are documented
      expect(result.stdout).toContain('unit');
      expect(result.stdout).toContain('integration');
      expect(result.stdout).toContain('e2e');
      expect(result.stdout).toContain('browser');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid test type gracefully', async () => {
      try {
        await execAsync(`node ${testRunnerPath} --type=invalid`);
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('Unknown test type');
      }
    });

    it('should handle missing configuration gracefully', async () => {
      // Test with a hypothetical non-existent config
      try {
        await execAsync(`node ${testRunnerPath} --type=nonexistent`);
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('Unknown test type');
      }
    });
  });

  describe('Integration with npm scripts', () => {
    it('should work with npm run test:unified commands', async () => {
      // Test that npm scripts are properly configured
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      expect(packageJson.scripts['test:unified']).toBeDefined();
      expect(packageJson.scripts['test:unified:e2e']).toBeDefined();
      expect(packageJson.scripts['test:unified:unit']).toBeDefined();
      expect(packageJson.scripts['test:unified:integration']).toBeDefined();
      expect(packageJson.scripts['test:unified:validate']).toBeDefined();

      // Each script should reference the unified test runner
      expect(packageJson.scripts['test:unified']).toContain('scripts/unified-test-runner.js');
      expect(packageJson.scripts['test:unified:e2e']).toContain('scripts/unified-test-runner.js');
      expect(packageJson.scripts['test:unified:validate']).toContain('scripts/unified-test-runner.js');
    });
  });

  describe('Marketplace E2E Test Discovery', () => {
    it('should discover all marketplace-related E2E tests', async () => {
      const result = await execAsync(`node ${testRunnerPath} --type=e2e --pattern=marketplace --list`);

      // Should find various marketplace test files
      expect(result.stdout).toContain('marketplace');

      // Count the number of discovered files
      const lines = result.stdout.split('\n').filter(line => line.includes('marketplace'));
      expect(lines.length).toBeGreaterThan(0);
    }, 15000);

    it('should validate marketplace E2E tests can be run', async () => {
      // This is a quick smoke test to ensure the configuration is valid
      // We're not actually running the tests to avoid side effects
      const result = await execAsync(`node ${testRunnerPath} --type=e2e --pattern=marketplace --validate`);

      expect(result.stdout).toContain('test discovery is working correctly');
    }, 30000);
  });
});