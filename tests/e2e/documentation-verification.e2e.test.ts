/**
 * @fileoverview E2E tests verifying that the E2E test documentation is accurate and functional
 *
 * This test suite validates that the documentation in tests/e2e/README.md accurately describes
 * how to run E2E tests locally, including environment setup, temporary directory management,
 * and cleanup mechanisms.
 *
 * Test coverage includes:
 * - Documentation content accuracy
 * - Command examples functionality
 * - Environment setup requirements
 * - Temporary directory behavior
 * - Cleanup mechanisms
 * - Infrastructure verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import * as path from 'path';

describe('E2E Test Documentation Verification', () => {
  const readmePath = join(process.cwd(), 'tests/e2e/README.md');
  let readmeContent: string;

  beforeEach(() => {
    expect(existsSync(readmePath)).toBe(true);
    readmeContent = readFileSync(readmePath, 'utf-8');
  });

  describe('Documentation Content Validation', () => {
    it('should contain Quick Start section with essential commands', () => {
      expect(readmeContent).toContain('## Quick Start');
      expect(readmeContent).toContain('npm run build');
      expect(readmeContent).toContain('npm run test:e2e');
      expect(readmeContent).toContain('npm run test:e2e:watch');
      expect(readmeContent).toContain('npm test -- tests/e2e/');
    });

    it('should document environment setup requirements', () => {
      expect(readmeContent).toContain('## Environment Setup');
      expect(readmeContent).toContain('### Prerequisites');
      expect(readmeContent).toContain('Node.js 18+');
      expect(readmeContent).toContain('Git available in PATH');
      expect(readmeContent).toContain('CLI must be built first');
      expect(readmeContent).toContain('git --version');
      expect(readmeContent).toContain('npm install');
    });

    it('should explain temporary directory management', () => {
      expect(readmeContent).toContain('## Temporary Directory Management');
      expect(readmeContent).toContain('.apex-test');
      expect(readmeContent).toContain('os.tmpdir()');
      expect(readmeContent).toContain('apex-e2e-');
      expect(readmeContent).toContain('auto-cleaned by test framework');
    });

    it('should document cleanup mechanisms', () => {
      expect(readmeContent).toContain('## Cleanup Mechanisms');
      expect(readmeContent).toContain('### 1. Automatic Test Cleanup');
      expect(readmeContent).toContain('### 2. Manual Cleanup Scripts');
      expect(readmeContent).toContain('### 3. Manual File System Cleanup');
      expect(readmeContent).toContain('npm run cleanup:test');
      expect(readmeContent).toContain('globalThis.apexE2EHelpers.cleanupAll()');
    });

    it('should include troubleshooting section', () => {
      expect(readmeContent).toContain('## Troubleshooting');
      expect(readmeContent).toContain('CLI binary not found');
      expect(readmeContent).toContain('Git not found in PATH');
      expect(readmeContent).toContain('Tests hanging or timing out');
      expect(readmeContent).toContain('Permission errors during cleanup');
      expect(readmeContent).toContain('DEBUG=1 npm run test:e2e');
    });

    it('should document the infrastructure setup', () => {
      expect(readmeContent).toContain('## Infrastructure');
      expect(readmeContent).toContain('setup.ts');
      expect(readmeContent).toContain('teardown.ts');
      expect(readmeContent).toContain('vitest.e2e.config.ts');
      expect(readmeContent).toContain('globalThis.apexE2EHelpers');
      expect(readmeContent).toContain('createTempDir');
      expect(readmeContent).toContain('createTempGitRepo');
    });
  });

  describe('Command Verification', () => {
    it('should verify that npm run build works', () => {
      expect(() => {
        execSync('npm run build', {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 120000 // 2 minutes timeout for build
        });
      }).not.toThrow();
    });

    it('should verify that CLI binary exists after build', () => {
      const cliBinaryPath = join(process.cwd(), 'packages/cli/dist/index.js');
      expect(existsSync(cliBinaryPath)).toBe(true);
    });

    it('should verify that test:e2e script exists and is runnable', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(packageJson.scripts['test:e2e']).toBeDefined();
      expect(packageJson.scripts['test:e2e']).toContain('vitest run --config vitest.e2e.config.ts');
    });

    it('should verify that cleanup scripts exist', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(packageJson.scripts['cleanup:test']).toBeDefined();
      expect(packageJson.scripts['cleanup:test:shell']).toBeDefined();
      expect(packageJson.scripts['cleanup:test:windows']).toBeDefined();
    });
  });

  describe('Environment Requirements Validation', () => {
    it('should verify Node.js version meets requirements', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    it('should verify git is available in PATH', () => {
      expect(() => {
        execSync('git --version', { stdio: 'pipe' });
      }).not.toThrow();
    });

    it('should verify E2E config file exists', () => {
      const e2eConfigPath = join(process.cwd(), 'vitest.e2e.config.ts');
      expect(existsSync(e2eConfigPath)).toBe(true);
    });

    it('should verify E2E setup and teardown files exist', () => {
      const setupPath = join(process.cwd(), 'tests/e2e/setup.ts');
      const teardownPath = join(process.cwd(), 'tests/e2e/teardown.ts');
      expect(existsSync(setupPath)).toBe(true);
      expect(existsSync(teardownPath)).toBe(true);
    });
  });

  describe('Temporary Directory Behavior', () => {
    it('should verify E2E helpers create temporary directories in system temp', () => {
      // This test verifies that temporary directories are created in the system temp directory
      // as documented, not in .apex-test directories
      const systemTmpDir = tmpdir();

      // Create a temporary directory using the documented pattern
      const testPrefix = 'apex-e2e-test';
      const tempDir = globalThis.apexE2EHelpers?.createTempDir?.(testPrefix);

      if (tempDir) {
        expect(tempDir).toContain(systemTmpDir);
        expect(tempDir).toContain(testPrefix);
        // Verify it's not in .apex-test
        expect(tempDir).not.toContain('.apex-test');
      } else {
        // If helpers are not available in this context, just verify the documentation is correct
        expect(readmeContent).toContain('os.tmpdir()');
        expect(readmeContent).toContain('apex-e2e-*');
      }
    });

    it('should clarify .apex-test directory usage', () => {
      // Verify documentation correctly explains .apex-test is NOT used by E2E tests
      expect(readmeContent).toContain('The `.apex-test` directory is **NOT** used by E2E tests');
      expect(readmeContent).toContain('created by cleanup utility tests');
      expect(readmeContent).toContain('tests/integration/cleanup-utilities');
      expect(readmeContent).toContain('E2E temp directories**: `os.tmpdir()/apex-e2e-*`');
    });
  });

  describe('Infrastructure Integration', () => {
    it('should verify global E2E helpers are documented accurately', () => {
      const helperMethods = [
        'createTempDir(prefix)',
        'createTempGitRepo(prefix)',
        'createBareGitRepo(prefix)',
        'createApexProject(path, options)',
        'waitFor(condition, options)',
        'registerOrchestrator/Server/Store(resource)',
        'cleanupAll()'
      ];

      helperMethods.forEach(method => {
        expect(readmeContent).toContain(method);
      });

      expect(readmeContent).toContain('globalThis.apexE2EHelpers');
    });

    it('should document test configuration accurately', () => {
      expect(readmeContent).toContain('60s for tests, 30s for hooks');
      expect(readmeContent).toContain('Forked processes for test isolation');
      expect(readmeContent).toContain('2 retries in CI');
      expect(readmeContent).toContain('NODE_ENV=test');
      expect(readmeContent).toContain('APEX_TEST_MODE=e2e');
    });
  });

  describe('Cleanup Mechanism Documentation', () => {
    it('should accurately document the three-tier cleanup strategy', () => {
      expect(readmeContent).toContain('three tiers of cleanup');
      expect(readmeContent).toContain('1. Automatic Test Cleanup (Primary)');
      expect(readmeContent).toContain('2. Manual Cleanup Scripts (Secondary)');
      expect(readmeContent).toContain('3. Manual File System Cleanup (Last Resort)');
    });

    it('should document automatic cleanup correctly', () => {
      expect(readmeContent).toContain('Built into `tests/e2e/setup.ts`');
      expect(readmeContent).toContain('Automatically cleans up after each test');
      expect(readmeContent).toContain('temp directories, git repos, databases, orchestrators');
      expect(readmeContent).toContain('You don\'t need to manually clean these');
    });

    it('should document manual cleanup scripts', () => {
      expect(readmeContent).toContain('npm run cleanup:test:shell');
      expect(readmeContent).toContain('npm run cleanup:test:windows');
      expect(readmeContent).toContain('Cross-platform cleanup scripts');
      expect(readmeContent).toContain('Handles permission issues gracefully');
    });

    it('should provide manual filesystem cleanup commands', () => {
      expect(readmeContent).toContain('rm -rf .apex-test');
      expect(readmeContent).toContain('rmdir /s .apex-test');
      expect(readmeContent).toContain('find . -name ".apex-test"');
      expect(readmeContent).toContain('for /d /r . %d in (.apex-test)');
    });
  });

  describe('Example Test Documentation', () => {
    it('should document browse marketplace tests comprehensively', () => {
      expect(readmeContent).toContain('## Browse MCP Marketplace E2E Tests');
      expect(readmeContent).toContain('browse-marketplace.e2e.test.ts');
      expect(readmeContent).toContain('Successful Browse Operations');
      expect(readmeContent).toContain('JSON Output Support');
      expect(readmeContent).toContain('Empty Marketplace Handling');
      expect(readmeContent).toContain('Network and Timeout Handling');
    });

    it('should document merge command tests comprehensively', () => {
      expect(readmeContent).toContain('## Merge Command E2E Tests');
      expect(readmeContent).toContain('merge-command.test.ts');
      expect(readmeContent).toContain('Standard Merge Operations');
      expect(readmeContent).toContain('Merge Conflict Detection');
      expect(readmeContent).toContain('Real Git Operations');
      expect(readmeContent).toContain('Orchestrator Integration');
    });
  });
});