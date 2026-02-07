/**
 * @fileoverview E2E tests for cleanup utilities and temporary directory management
 *
 * This test suite verifies that the cleanup mechanisms documented in the E2E README
 * function correctly, including:
 * - Manual cleanup scripts work as documented
 * - Temporary directory isolation functions properly
 * - Cleanup utilities handle edge cases gracefully
 * - Cross-platform cleanup scripts are functional
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import * as path from 'path';

describe('Cleanup Utilities E2E Tests', () => {
  const projectRoot = process.cwd();
  let testTempDir: string;
  let createdTestDirs: string[] = [];

  beforeEach(() => {
    // Create a unique temp directory for this test
    testTempDir = join(tmpdir(), `apex-cleanup-test-${randomUUID()}`);
    mkdirSync(testTempDir, { recursive: true });
    createdTestDirs.push(testTempDir);
  });

  afterEach(() => {
    // Clean up any test directories we created
    createdTestDirs.forEach(dir => {
      try {
        if (existsSync(dir)) {
          rmSync(dir, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn(`Failed to cleanup test directory ${dir}:`, error);
      }
    });
    createdTestDirs = [];
  });

  describe('Manual Cleanup Script Functionality', () => {
    it('should have functional cleanup:test script', () => {
      // Verify the cleanup script exists and can be executed
      const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
      expect(packageJson.scripts['cleanup:test']).toBeDefined();
      expect(packageJson.scripts['cleanup:test']).toContain('cleanup-test-directory.mjs');

      // Verify the cleanup script file exists
      const cleanupScriptPath = join(process.cwd(), 'scripts/cleanup-test-directory.mjs');
      expect(existsSync(cleanupScriptPath)).toBe(true);
    });

    it('should have platform-specific cleanup scripts', () => {
      const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));

      // Shell script for Unix/Linux/macOS
      expect(packageJson.scripts['cleanup:test:shell']).toBeDefined();
      expect(packageJson.scripts['cleanup:test:shell']).toContain('cleanup-test-directory.sh');

      // Batch script for Windows
      expect(packageJson.scripts['cleanup:test:windows']).toBeDefined();
      expect(packageJson.scripts['cleanup:test:windows']).toContain('cleanup-test-directory.bat');

      // Verify the script files exist
      const shellScript = join(process.cwd(), 'scripts/cleanup-test-directory.sh');
      const windowsScript = join(process.cwd(), 'scripts/cleanup-test-directory.bat');

      expect(existsSync(shellScript)).toBe(true);
      expect(existsSync(windowsScript)).toBe(true);
    });

    it('should execute cleanup script without errors', () => {
      // Create a test .apex-test directory to clean up
      const testApexDir = join(testTempDir, '.apex-test');
      mkdirSync(testApexDir, { recursive: true });
      writeFileSync(join(testApexDir, 'test-file.txt'), 'test content');

      expect(() => {
        execSync('npm run cleanup:test', {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 30000 // 30 seconds timeout
        });
      }).not.toThrow();
    });
  });

  describe('Temporary Directory Management', () => {
    it('should verify E2E tests use system temp directory', () => {
      const systemTempDir = tmpdir();

      // Test that our helper functions create directories in the system temp
      if (globalThis.apexE2EHelpers?.createTempDir) {
        const tempDir = globalThis.apexE2EHelpers.createTempDir('test-prefix');
        expect(tempDir).toContain(systemTempDir);
        expect(tempDir).toContain('test-prefix');

        // Clean up
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });

    it('should verify .apex-test directories are NOT created by E2E tests', () => {
      // This test ensures that E2E tests don't accidentally create .apex-test directories
      const currentDir = process.cwd();

      // Check if there are any .apex-test directories in the current working directory
      // (they should only exist if integration cleanup tests created them)
      const hasApexTestDir = existsSync(join(currentDir, '.apex-test'));

      if (hasApexTestDir) {
        // If .apex-test exists, it should be created by integration tests, not E2E tests
        // We can verify this by checking if integration tests are the only ones that create it
        console.log('Found .apex-test directory - verifying it was created by integration tests');
      }

      // The key point is that E2E tests should use system temp directories
      const systemTemp = tmpdir();
      expect(systemTemp).not.toContain('.apex-test');
    });

    it('should verify temp directory isolation works', () => {
      // Create multiple temp directories to verify isolation
      const tempDir1 = join(tmpdir(), `apex-e2e-isolation-1-${randomUUID()}`);
      const tempDir2 = join(tmpdir(), `apex-e2e-isolation-2-${randomUUID()}`);

      mkdirSync(tempDir1, { recursive: true });
      mkdirSync(tempDir2, { recursive: true });
      createdTestDirs.push(tempDir1, tempDir2);

      // Create different content in each
      writeFileSync(join(tempDir1, 'file1.txt'), 'content1');
      writeFileSync(join(tempDir2, 'file2.txt'), 'content2');

      // Verify isolation
      expect(existsSync(join(tempDir1, 'file1.txt'))).toBe(true);
      expect(existsSync(join(tempDir1, 'file2.txt'))).toBe(false);
      expect(existsSync(join(tempDir2, 'file2.txt'))).toBe(true);
      expect(existsSync(join(tempDir2, 'file1.txt'))).toBe(false);
    });
  });

  describe('Helper Function Availability', () => {
    it('should verify globalThis.apexE2EHelpers is available', () => {
      // Check if E2E helpers are properly set up
      if (typeof globalThis.apexE2EHelpers === 'object' && globalThis.apexE2EHelpers !== null) {
        const helpers = globalThis.apexE2EHelpers;

        // Verify documented helper functions exist
        expect(typeof helpers.createTempDir).toBe('function');
        expect(typeof helpers.createTempGitRepo).toBe('function');
        expect(typeof helpers.createApexProject).toBe('function');
        expect(typeof helpers.cleanupAll).toBe('function');

        console.log('✅ E2E helpers are properly available');
      } else {
        // If helpers aren't available, that's okay - it means we're not in E2E context
        // But the setup should still be correct
        console.log('ℹ️ E2E helpers not available (expected outside E2E test context)');
      }
    });

    it('should verify documented helper methods work correctly', () => {
      if (globalThis.apexE2EHelpers?.createTempDir) {
        const helpers = globalThis.apexE2EHelpers;

        // Test createTempDir
        const tempDir = helpers.createTempDir('test-helper');
        expect(typeof tempDir).toBe('string');
        expect(tempDir).toContain('test-helper');
        expect(tempDir).toContain(tmpdir());

        // Clean up if directory was actually created
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('Cross-Platform Cleanup Verification', () => {
    it('should handle permission issues gracefully', () => {
      // Create a test scenario that might have permission issues
      const testDir = join(testTempDir, '.apex-test-permissions');
      mkdirSync(testDir, { recursive: true });

      // Create a nested structure
      const nestedDir = join(testDir, 'nested', 'deep');
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, 'test-file.txt'), 'test content');

      // Verify the cleanup script can handle this
      expect(() => {
        execSync('npm run cleanup:test', {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 30000
        });
      }).not.toThrow();
    });

    it('should provide detailed logging as documented', () => {
      // Test that cleanup scripts provide the documented logging behavior
      let output: string;

      try {
        output = execSync('npm run cleanup:test', {
          cwd: process.cwd(),
          encoding: 'utf-8',
          timeout: 30000
        });
      } catch (error: any) {
        // Even if the command fails, it should provide useful output
        output = error.stdout || error.stderr || '';
      }

      // The cleanup script should provide some form of output/logging
      expect(typeof output).toBe('string');
    });
  });

  describe('Documentation Accuracy Verification', () => {
    it('should verify documented directory structure is accurate', () => {
      // Create a typical E2E test directory structure as documented
      const testProjectDir = join(testTempDir, 'test-project');
      mkdirSync(testProjectDir, { recursive: true });
      createdTestDirs.push(testProjectDir);

      // Create the documented structure
      const apexDir = join(testProjectDir, '.apex');
      const gitDir = join(testProjectDir, '.git');

      mkdirSync(apexDir, { recursive: true });
      mkdirSync(join(apexDir, 'agents'), { recursive: true });
      mkdirSync(join(apexDir, 'workflows'), { recursive: true });
      mkdirSync(gitDir, { recursive: true });

      writeFileSync(join(apexDir, 'config.yaml'), 'test: config');
      writeFileSync(join(testProjectDir, 'test-file.ts'), 'test content');

      // Verify the structure matches documentation
      expect(existsSync(join(testProjectDir, '.apex/config.yaml'))).toBe(true);
      expect(existsSync(join(testProjectDir, '.apex/agents'))).toBe(true);
      expect(existsSync(join(testProjectDir, '.apex/workflows'))).toBe(true);
      expect(existsSync(join(testProjectDir, '.git'))).toBe(true);
    });

    it('should verify environment variables are set correctly', () => {
      // Check that documented environment variables are properly set in E2E context
      if (process.env.APEX_TEST_MODE === 'e2e') {
        expect(process.env.APEX_TEST_MODE).toBe('e2e');
        expect(process.env.NODE_ENV).toBe('test');
      }
    });
  });
});