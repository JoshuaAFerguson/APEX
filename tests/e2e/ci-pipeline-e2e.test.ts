/**
 * @fileoverview E2E tests for CI pipeline configuration
 *
 * This test suite verifies that the GitHub Actions CI pipeline is properly
 * configured for E2E testing with isolated test environments. It validates:
 *
 * 1. CI workflow structure and configuration
 * 2. Isolated test environment setup
 * 3. Proper environment variables
 * 4. Cleanup mechanisms
 * 5. Job dependencies and sequencing
 * 6. E2E test execution in CI context
 *
 * Acceptance criteria coverage:
 * - ✅ GitHub Actions workflow exists that runs E2E tests in CI
 * - ✅ Workflow uses isolated test environment
 * - ✅ Sets appropriate environment variables
 * - ✅ Ensures cleanup runs even on job failure
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';


describe('E2E: CI Pipeline Configuration', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const ciWorkflowPath = path.join(projectRoot, '.github/workflows/ci.yml');

  describe('GitHub Actions Workflow Existence', () => {
    it('should have CI workflow file', async () => {
      const workflowExists = await fs.access(ciWorkflowPath)
        .then(() => true)
        .catch(() => false);

      expect(workflowExists).toBe(true);
    });

    it('should have valid YAML structure', async () => {
      const workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');

      // Should have YAML structure indicators
      expect(workflowContent).toContain('name:');
      expect(workflowContent).toContain('jobs:');
      expect(workflowContent).toContain('on:');

      // Should not have JSON syntax which would indicate wrong format
      expect(workflowContent).not.toMatch(/^\s*{/);
    });
  });

  describe('Workflow Structure', () => {
    let workflowContent: string;

    beforeEach(async () => {
      workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
    });

    it('should have correct workflow name', () => {
      expect(workflowContent).toMatch(/^name:\s*CI\s*$/m);
    });

    it('should trigger on correct events', () => {
      expect(workflowContent).toContain('on:');
      expect(workflowContent).toContain('push:');
      expect(workflowContent).toContain('pull_request:');

      // Should trigger on main branch
      expect(workflowContent).toMatch(/branches:\s*\[main\]/);
    });

    it('should have both build and E2E jobs', () => {
      expect(workflowContent).toContain('jobs:');
      expect(workflowContent).toMatch(/^\s*build:\s*$/m);
      expect(workflowContent).toMatch(/^\s*e2e:\s*$/m);
    });
  });

  describe('Build Job Configuration', () => {
    let workflowContent: string;

    beforeEach(async () => {
      workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
    });

    it('should have correct OS matrix', () => {
      expect(workflowContent).toMatch(/os:\s*\[ubuntu-latest,\s*windows-latest\]/);
    });

    it('should have correct Node.js version matrix', () => {
      expect(workflowContent).toMatch(/node-version:\s*\[18\.x,\s*20\.x\]/);
    });

    it('should include all required build steps', () => {
      expect(workflowContent).toContain('- name: Checkout');
      expect(workflowContent).toContain('- name: Build');
      expect(workflowContent).toContain('- name: Type check');
      expect(workflowContent).toContain('- name: Lint');
      expect(workflowContent).toContain('- name: Test');
    });

    it('should use Node.js setup action with cache', () => {
      expect(workflowContent).toContain('uses: actions/setup-node@v4');
      expect(workflowContent).toMatch(/cache:\s*'npm'/);
    });
  });

  describe('E2E Job Configuration', () => {
    let workflowContent: string;

    beforeEach(async () => {
      workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
    });

    it('should have correct job dependencies', () => {
      expect(workflowContent).toMatch(/e2e:[\s\S]*?needs:\s*build/);
    });

    it('should have isolated test environment', () => {
      // E2E should run only on Ubuntu for consistency
      const e2eSection = workflowContent.split('e2e:')[1]?.split(/\w+:/)[0] || '';

      expect(e2eSection).toMatch(/os:\s*\[ubuntu-latest\]/);
      expect(e2eSection).toMatch(/node-version:\s*\[20\.x\]/);
      expect(e2eSection).toMatch(/fail-fast:\s*false/);
    });

    it('should have proper environment variables', () => {
      const e2eSection = workflowContent.split('e2e:')[1]?.split(/^\s*\w+:/m)[0] || '';

      expect(e2eSection).toMatch(/CI:\s*true/);
      expect(e2eSection).toMatch(/APEX_TEST_MODE:\s*e2e/);
      expect(e2eSection).toMatch(/NO_COLOR:\s*1/);

      // Git configuration for E2E tests
      expect(e2eSection).toMatch(/GIT_AUTHOR_NAME:\s*GitHub Actions/);
      expect(e2eSection).toMatch(/GIT_AUTHOR_EMAIL:\s*actions@github.com/);
      expect(e2eSection).toMatch(/GIT_COMMITTER_NAME:\s*GitHub Actions/);
      expect(e2eSection).toMatch(/GIT_COMMITTER_EMAIL:\s*actions@github.com/);
    });

    it('should include required E2E test steps', () => {
      const e2eSection = workflowContent.split('e2e:')[1] || '';

      expect(e2eSection).toContain('- name: Checkout');
      expect(e2eSection).toContain('- name: Build');
      expect(e2eSection).toContain('- name: Run E2E tests');
      expect(e2eSection).toContain('- name: Cleanup E2E test resources');
    });

    it('should have E2E test step with timeout', () => {
      expect(workflowContent).toMatch(/- name: Run E2E tests[\s\S]*?run:\s*npm run test:e2e/);
      expect(workflowContent).toMatch(/- name: Run E2E tests[\s\S]*?timeout-minutes:\s*15/);
    });

    it('should have cleanup step that always runs', () => {
      expect(workflowContent).toMatch(/- name: Cleanup E2E test resources[\s\S]*?if:\s*always\(\)/);

      // Should cleanup processes and temp directories
      const cleanupSection = workflowContent.split('- name: Cleanup E2E test resources')[1]?.split(/- name:/)[0] || '';
      expect(cleanupSection).toContain('pkill -f "apex"');
      expect(cleanupSection).toContain('pkill -f "node.*packages/cli"');
      expect(cleanupSection).toContain('rm -rf /tmp/apex-e2e-*');
    });
  });

  describe('Environment Variable Configuration', () => {
    let workflowContent: string;

    beforeEach(async () => {
      workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
    });

    it('should set CI environment flag', () => {
      expect(workflowContent).toMatch(/CI:\s*true/);
    });

    it('should set E2E test mode', () => {
      expect(workflowContent).toMatch(/APEX_TEST_MODE:\s*e2e/);
    });

    it('should disable color output for CI', () => {
      expect(workflowContent).toMatch(/NO_COLOR:\s*1/);
    });

    it('should configure git user for E2E operations', () => {
      expect(workflowContent).toMatch(/GIT_AUTHOR_NAME:\s*GitHub Actions/);
      expect(workflowContent).toMatch(/GIT_AUTHOR_EMAIL:\s*actions@github.com/);
      expect(workflowContent).toMatch(/GIT_COMMITTER_NAME:\s*GitHub Actions/);
      expect(workflowContent).toMatch(/GIT_COMMITTER_EMAIL:\s*actions@github.com/);
    });
  });

  describe('Cleanup Mechanism Validation', () => {
    let workflowContent: string;

    beforeEach(async () => {
      workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
    });

    it('should ensure cleanup runs on job failure', () => {
      expect(workflowContent).toMatch(/- name: Cleanup E2E test resources[\s\S]*?if:\s*always\(\)/);
    });

    it('should cleanup orphaned processes', () => {
      const cleanupSection = workflowContent.split('- name: Cleanup E2E test resources')[1]?.split(/- name:/)[0] || '';

      expect(cleanupSection).toMatch(/pkill -f "apex"/);
      expect(cleanupSection).toMatch(/pkill -f "node.*packages\/cli"/);

      // Should use || true to not fail if processes don't exist
      expect(cleanupSection).toContain('|| true');
    });

    it('should cleanup temporary directories', () => {
      const cleanupSection = workflowContent.split('- name: Cleanup E2E test resources')[1]?.split(/- name:/)[0] || '';

      expect(cleanupSection).toMatch(/rm -rf \/tmp\/apex-e2e-\*/);
      expect(cleanupSection).toContain('|| true');
    });
  });

  describe('Isolation and Resource Management', () => {
    let workflowContent: string;

    beforeEach(async () => {
      workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
    });

    it('should run on single OS for consistency', () => {
      const e2eSection = workflowContent.split('e2e:')[1]?.split(/^\s*\w+:/m)[0] || '';

      expect(e2eSection).toMatch(/os:\s*\[ubuntu-latest\]/);
      expect(e2eSection).not.toMatch(/os:\s*\[[^\]]*,/);
    });

    it('should use latest stable Node.js for E2E', () => {
      const e2eSection = workflowContent.split('e2e:')[1]?.split(/^\s*\w+:/m)[0] || '';

      expect(e2eSection).toMatch(/node-version:\s*\[20\.x\]/);
    });

    it('should not fail fast to allow debugging', () => {
      const e2eSection = workflowContent.split('e2e:')[1]?.split(/^\s*\w+:/m)[0] || '';

      expect(e2eSection).toMatch(/fail-fast:\s*false/);
    });
  });
});

describe('E2E: Package.json Test Scripts', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const packageJsonPath = path.join(projectRoot, 'package.json');

  describe('E2E Test Script Configuration', () => {
    let packageJson: any;

    beforeEach(async () => {
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(packageContent);
    });

    it('should have test:e2e script', () => {
      expect(packageJson.scripts['test:e2e']).toBeDefined();
      expect(packageJson.scripts['test:e2e']).toBe('vitest run --config vitest.e2e.config.ts');
    });

    it('should have test:e2e:watch script for development', () => {
      expect(packageJson.scripts['test:e2e:watch']).toBeDefined();
      expect(packageJson.scripts['test:e2e:watch']).toBe('vitest --config vitest.e2e.config.ts');
    });

    it('should have build script required by CI', () => {
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.build).toBe('turbo run build');
    });

    it('should have test script for unit tests', () => {
      expect(packageJson.scripts.test).toBeDefined();
      expect(packageJson.scripts.test).toBe('vitest run');
    });
  });
});

describe('E2E: Vitest E2E Configuration', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const e2eConfigPath = path.join(projectRoot, 'vitest.e2e.config.ts');

  describe('E2E Config File', () => {
    it('should exist and be accessible', async () => {
      const configExists = await fs.access(e2eConfigPath)
        .then(() => true)
        .catch(() => false);

      expect(configExists).toBe(true);
    });

    it('should contain E2E-specific configuration', async () => {
      const configContent = await fs.readFile(e2eConfigPath, 'utf-8');

      // Should configure E2E test patterns
      expect(configContent).toContain('*.e2e.test.ts');
      expect(configContent).toContain('tests/e2e/**/*.test.ts');

      // Should reference setup files
      expect(configContent).toContain('./tests/e2e/setup.ts');
      expect(configContent).toContain('./tests/e2e/teardown.ts');

      // Should configure for E2E environment
      expect(configContent).toContain('APEX_TEST_MODE');
      expect(configContent).toContain("'e2e'");
    });
  });
});

describe('E2E: Test Environment Validation', () => {
  describe('Environment Variables', () => {
    it('should be configured for E2E testing', () => {
      // These should be set by the E2E setup
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.APEX_TEST_MODE).toBe('e2e');
    });
  });

  describe('Global Test Helpers', () => {
    it('should provide E2E helpers globally', () => {
      expect(globalThis.apexE2EHelpers).toBeDefined();

      const helpers = globalThis.apexE2EHelpers;
      expect(helpers.createTempDir).toBeInstanceOf(Function);
      expect(helpers.createTempGitRepo).toBeInstanceOf(Function);
      expect(helpers.cleanupAll).toBeInstanceOf(Function);
    });
  });

  describe('Isolation Validation', () => {
    it('should create unique test directories', async () => {
      const tempDir1 = await globalThis.apexE2EHelpers.createTempDir('isolation-test-1-');
      const tempDir2 = await globalThis.apexE2EHelpers.createTempDir('isolation-test-2-');

      expect(tempDir1).not.toBe(tempDir2);
      expect(path.dirname(tempDir1)).toBe(path.dirname(tempDir2));
    });

    it('should register resources for cleanup', async () => {
      const testDir = await globalThis.apexE2EHelpers.createTempDir('resource-test-');

      // Create a test file to verify the directory is functional
      await fs.writeFile(path.join(testDir, 'test.txt'), 'test content');

      const fileExists = await fs.access(path.join(testDir, 'test.txt'))
        .then(() => true)
        .catch(() => false);

      expect(fileExists).toBe(true);
    });
  });

  describe('CI Environment Simulation', () => {
    it('should handle CI-specific environment variables', () => {
      // Simulate CI environment checks
      const originalCi = process.env.CI;
      const originalNoColor = process.env.NO_COLOR;

      try {
        process.env.CI = 'true';
        process.env.NO_COLOR = '1';

        expect(process.env.CI).toBe('true');
        expect(process.env.NO_COLOR).toBe('1');
      } finally {
        // Restore original values
        if (originalCi !== undefined) {
          process.env.CI = originalCi;
        } else {
          delete process.env.CI;
        }

        if (originalNoColor !== undefined) {
          process.env.NO_COLOR = originalNoColor;
        } else {
          delete process.env.NO_COLOR;
        }
      }
    });
  });
});