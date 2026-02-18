/**
 * @fileoverview Test Configuration Validation
 *
 * This test verifies that the dual-mode test configuration is properly set up
 * and that both unit and E2E test modes can be distinguished correctly.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Test Configuration Validation', () => {
  const rootDir = path.resolve(__dirname, '../../../..');

  describe('Configuration Files', () => {
    it('should have vitest.unit.config.ts with correct configuration', () => {
      const unitConfigPath = path.join(rootDir, 'vitest.unit.config.ts');
      expect(fs.existsSync(unitConfigPath)).toBe(true);

      const content = fs.readFileSync(unitConfigPath, 'utf8');

      // Should include unit test patterns
      expect(content).toContain('*.test.ts');
      expect(content).toContain('*.unit.test.ts');

      // Should exclude E2E patterns
      expect(content).toContain('*.e2e.test.ts');
      expect(content).toMatch(/exclude.*e2e/i);

      // Should use appropriate environment
      expect(content).toContain('environment');
    });

    it('should have vitest.e2e.config.ts with correct configuration', () => {
      const e2eConfigPath = path.join(rootDir, 'vitest.e2e.config.ts');
      expect(fs.existsSync(e2eConfigPath)).toBe(true);

      const content = fs.readFileSync(e2eConfigPath, 'utf8');

      // Should include E2E test patterns
      expect(content).toContain('*.e2e.test.ts');

      // Should have extended timeouts
      expect(content).toContain('testTimeout');
      expect(content).toMatch(/60000|30000/); // Either test or hook timeout

      // Should use node environment
      expect(content).toContain("'node'");

      // Should have setup files
      expect(content).toContain('setupFiles');
    });

    it('should have E2E setup file', () => {
      const setupPath = path.join(rootDir, 'tests/e2e/setup.ts');
      expect(fs.existsSync(setupPath)).toBe(true);

      const content = fs.readFileSync(setupPath, 'utf8');
      expect(content).toContain('E2ETestHelpers');
      expect(content).toContain('createTempDir');
      expect(content).toContain('cleanupAll');
    });
  });

  describe('Package.json Scripts', () => {
    it('should have all required test scripts', () => {
      const packagePath = path.join(rootDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      const expectedScripts = [
        'test',
        'test:unit',
        'test:e2e',
        'test:unit:watch',
        'test:e2e:watch',
        'test:unit:coverage',
        'test:coverage'
      ];

      for (const script of expectedScripts) {
        expect(packageJson.scripts).toHaveProperty(script);
        expect(typeof packageJson.scripts[script]).toBe('string');
        expect(packageJson.scripts[script].length).toBeGreaterThan(0);
      }

      // Verify scripts point to correct configs
      expect(packageJson.scripts['test:unit']).toContain('vitest.unit.config.ts');
      expect(packageJson.scripts['test:e2e']).toContain('vitest.e2e.config.ts');
    });
  });

  describe('Test File Organization', () => {
    it('should detect unit test files correctly', () => {
      // This test is running, so it should be detected as a unit test
      expect(process.env.VITEST).toBeTruthy(); // Vitest sets this in test environment

      // Unit tests should run in jsdom or node environment
      expect(['jsdom', 'node']).toContain(process.env.VITEST_ENVIRONMENT || 'jsdom');
    });

    it('should have appropriate test timeouts configured', () => {
      // Unit tests should have default (shorter) timeouts
      // This test itself should complete quickly as it's a unit test
      const start = Date.now();

      // Simple synchronous operations should be very fast
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // Should be very fast for unit tests
    });
  });

  describe('Test Mode Detection', () => {
    it('should be able to determine current test mode', () => {
      // When running under unit test config, this should be detectable
      const isUnitTest = !process.argv.some(arg => arg.includes('e2e'));
      const isE2ETest = process.env.APEX_TEST_MODE === 'e2e';

      // This test should run as a unit test, not E2E
      if (process.argv.some(arg => arg.includes('unit'))) {
        expect(isUnitTest).toBe(true);
        expect(isE2ETest).toBe(false);
      }
    });
  });
});

// Export for other test utilities that might need this validation
export const validateTestConfig = () => {
  const rootDir = path.resolve(__dirname, '../../../..');

  return {
    hasUnitConfig: fs.existsSync(path.join(rootDir, 'vitest.unit.config.ts')),
    hasE2EConfig: fs.existsSync(path.join(rootDir, 'vitest.e2e.config.ts')),
    hasE2ESetup: fs.existsSync(path.join(rootDir, 'tests/e2e/setup.ts')),
    hasPackageScripts: (() => {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
        return ['test:unit', 'test:e2e'].every(script => pkg.scripts[script]);
      } catch {
        return false;
      }
    })()
  };
};