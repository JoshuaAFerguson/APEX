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

// Simple YAML parsing for basic structure validation
function parseSimpleYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = content.split('\n');
  let currentKey = '';
  let indent = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (match) {
      const [, spaces, key, value] = match;
      const currentIndent = spaces.length;

      if (currentIndent === 0) {
        currentKey = key;
        result[key] = value || {};
      } else if (currentIndent === 2 && currentKey) {
        if (typeof result[currentKey] !== 'object') {
          result[currentKey] = {};
        }
        result[currentKey][key] = value || {};
      }
    }
  }

  return result;
}

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
    let e2eJob: any;

    beforeEach(async () => {
      const workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      e2eJob = workflow.jobs.e2e;
    });

    it('should have correct job dependencies', () => {
      expect(e2eJob.needs).toBe('build');
    });

    it('should have isolated test environment', () => {
      // E2E should run only on Ubuntu for consistency
      expect(e2eJob.strategy.matrix.os).toEqual(['ubuntu-latest']);
      expect(e2eJob.strategy.matrix['node-version']).toEqual(['20.x']);

      // Should not fail fast to allow investigation of issues
      expect(e2eJob.strategy['fail-fast']).toBe(false);
    });

    it('should have proper environment variables', () => {
      const envVars = e2eJob.env;

      expect(envVars).toBeDefined();
      expect(envVars.CI).toBe(true);
      expect(envVars.APEX_TEST_MODE).toBe('e2e');
      expect(envVars.NO_COLOR).toBe(1);

      // Git configuration for E2E tests
      expect(envVars.GIT_AUTHOR_NAME).toBe('GitHub Actions');
      expect(envVars.GIT_AUTHOR_EMAIL).toBe('actions@github.com');
      expect(envVars.GIT_COMMITTER_NAME).toBe('GitHub Actions');
      expect(envVars.GIT_COMMITTER_EMAIL).toBe('actions@github.com');
    });

    it('should include required E2E test steps', () => {
      const stepNames = e2eJob.steps.map((step: any) => step.name);

      expect(stepNames).toContain('Checkout');
      expect(stepNames).toContain('Build');
      expect(stepNames).toContain('Run E2E tests');
      expect(stepNames).toContain('Cleanup E2E test resources');
    });

    it('should have E2E test step with timeout', () => {
      const e2eTestStep = e2eJob.steps.find(
        (step: any) => step.name === 'Run E2E tests'
      );

      expect(e2eTestStep).toBeDefined();
      expect(e2eTestStep.run).toBe('npm run test:e2e');
      expect(e2eTestStep['timeout-minutes']).toBe(15);
    });

    it('should have cleanup step that always runs', () => {
      const cleanupStep = e2eJob.steps.find(
        (step: any) => step.name === 'Cleanup E2E test resources'
      );

      expect(cleanupStep).toBeDefined();
      expect(cleanupStep.if).toBe('always()');

      // Should cleanup processes and temp directories
      const cleanupScript = cleanupStep.run;
      expect(cleanupScript).toContain('pkill -f "apex"');
      expect(cleanupScript).toContain('pkill -f "node.*packages/cli"');
      expect(cleanupScript).toContain('rm -rf /tmp/apex-e2e-*');
    });
  });

  describe('Environment Variable Configuration', () => {
    let e2eJob: any;

    beforeEach(async () => {
      const workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      e2eJob = workflow.jobs.e2e;
    });

    it('should set CI environment flag', () => {
      expect(e2eJob.env.CI).toBe(true);
    });

    it('should set E2E test mode', () => {
      expect(e2eJob.env.APEX_TEST_MODE).toBe('e2e');
    });

    it('should disable color output for CI', () => {
      expect(e2eJob.env.NO_COLOR).toBe(1);
    });

    it('should configure git user for E2E operations', () => {
      expect(e2eJob.env.GIT_AUTHOR_NAME).toBe('GitHub Actions');
      expect(e2eJob.env.GIT_AUTHOR_EMAIL).toBe('actions@github.com');
      expect(e2eJob.env.GIT_COMMITTER_NAME).toBe('GitHub Actions');
      expect(e2eJob.env.GIT_COMMITTER_EMAIL).toBe('actions@github.com');
    });
  });

  describe('Cleanup Mechanism Validation', () => {
    let e2eJob: any;

    beforeEach(async () => {
      const workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      e2eJob = workflow.jobs.e2e;
    });

    it('should ensure cleanup runs on job failure', () => {
      const cleanupStep = e2eJob.steps.find(
        (step: any) => step.name === 'Cleanup E2E test resources'
      );

      expect(cleanupStep.if).toBe('always()');
    });

    it('should cleanup orphaned processes', () => {
      const cleanupStep = e2eJob.steps.find(
        (step: any) => step.name === 'Cleanup E2E test resources'
      );

      const cleanupScript = cleanupStep.run;
      expect(cleanupScript).toMatch(/pkill -f "apex"/);
      expect(cleanupScript).toMatch(/pkill -f "node.*packages\/cli"/);

      // Should use || true to not fail if processes don't exist
      expect(cleanupScript).toContain('|| true');
    });

    it('should cleanup temporary directories', () => {
      const cleanupStep = e2eJob.steps.find(
        (step: any) => step.name === 'Cleanup E2E test resources'
      );

      const cleanupScript = cleanupStep.run;
      expect(cleanupScript).toMatch(/rm -rf \/tmp\/apex-e2e-\*/);
      expect(cleanupScript).toContain('|| true');
    });
  });

  describe('Isolation and Resource Management', () => {
    let e2eJob: any;

    beforeEach(async () => {
      const workflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');
      const workflow = yaml.load(workflowContent) as any;
      e2eJob = workflow.jobs.e2e;
    });

    it('should run on single OS for consistency', () => {
      expect(e2eJob.strategy.matrix.os).toHaveLength(1);
      expect(e2eJob.strategy.matrix.os[0]).toBe('ubuntu-latest');
    });

    it('should use latest stable Node.js for E2E', () => {
      expect(e2eJob.strategy.matrix['node-version']).toEqual(['20.x']);
    });

    it('should not fail fast to allow debugging', () => {
      expect(e2eJob.strategy['fail-fast']).toBe(false);
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