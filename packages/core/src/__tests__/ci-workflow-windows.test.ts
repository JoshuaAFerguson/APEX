/**
 * Tests for Windows CI compatibility in GitHub Actions workflow
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

describe('CI Workflow Windows Compatibility', () => {
  const workflowPath = join(process.cwd(), '.github/workflows/ci.yml');

  it('should have a GitHub Actions CI workflow file', () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  describe('GitHub Actions workflow configuration', () => {
    let workflow: any;

    beforeAll(() => {
      const content = readFileSync(workflowPath, 'utf-8');
      workflow = yaml.parse(content);
    });

    it('should include windows-latest in the OS matrix', () => {
      const osMatrix = workflow?.jobs?.build?.strategy?.matrix?.os;
      expect(osMatrix).toBeDefined();
      expect(osMatrix).toContain('windows-latest');
      expect(osMatrix).toContain('ubuntu-latest');
    });

    it('should include multiple Node.js versions in the matrix', () => {
      const nodeVersions = workflow?.jobs?.build?.strategy?.matrix?.['node-version'];
      expect(nodeVersions).toBeDefined();
      expect(nodeVersions.length).toBeGreaterThanOrEqual(2);
      expect(nodeVersions).toContain('18.x');
      expect(nodeVersions).toContain('20.x');
    });

    it('should use actions/checkout@v4 for cross-platform compatibility', () => {
      const checkoutStep = workflow?.jobs?.build?.steps?.find(
        (step: any) => step.name === 'Checkout'
      );
      expect(checkoutStep).toBeDefined();
      expect(checkoutStep.uses).toBe('actions/checkout@v4');
    });

    it('should use actions/setup-node@v4 for Node.js setup', () => {
      const nodeStep = workflow?.jobs?.build?.steps?.find(
        (step: any) => step.name?.includes('Setup Node.js')
      );
      expect(nodeStep).toBeDefined();
      expect(nodeStep.uses).toBe('actions/setup-node@v4');
      expect(nodeStep.with?.cache).toBe('npm');
    });

    it('should include all necessary build steps for Windows', () => {
      const steps = workflow?.jobs?.build?.steps || [];
      const stepNames = steps.map((step: any) => step.name || step.run);

      // Check for essential build steps
      expect(stepNames.some((name: string) => name?.includes('Install dependencies'))).toBe(true);
      expect(stepNames.some((name: string) => name?.includes('Build'))).toBe(true);
      expect(stepNames.some((name: string) => name?.includes('Type check'))).toBe(true);
      expect(stepNames.some((name: string) => name?.includes('Lint'))).toBe(true);
      expect(stepNames.some((name: string) => name?.includes('Test'))).toBe(true);
    });

    it('should use npm ci for consistent dependency installation', () => {
      const installStep = workflow?.jobs?.build?.steps?.find(
        (step: any) => step.name === 'Install dependencies'
      );
      expect(installStep).toBeDefined();
      expect(installStep.run).toBe('npm ci');
    });

    it('should run build step before tests', () => {
      const steps = workflow?.jobs?.build?.steps || [];
      const buildIndex = steps.findIndex((step: any) => step.run === 'npm run build');
      const testIndex = steps.findIndex((step: any) => step.run === 'npm test');

      expect(buildIndex).toBeGreaterThanOrEqual(0);
      expect(testIndex).toBeGreaterThanOrEqual(0);
      expect(buildIndex).toBeLessThan(testIndex);
    });

    it('should have proper matrix configuration for cross-platform builds', () => {
      const strategy = workflow?.jobs?.build?.strategy;
      expect(strategy).toBeDefined();
      expect(strategy.matrix).toBeDefined();

      // Verify the matrix creates combinations of OS and Node versions
      const matrix = strategy.matrix;
      expect(matrix.os).toEqual(['ubuntu-latest', 'windows-latest']);
      expect(matrix['node-version']).toEqual(['18.x', '20.x']);
    });

    it('should have dynamic job naming that includes OS and Node version', () => {
      const setupNodeStep = workflow?.jobs?.build?.steps?.find(
        (step: any) => step.name?.includes('Setup Node.js')
      );
      expect(setupNodeStep?.name).toContain('${{ matrix.node-version }}');
      expect(setupNodeStep?.name).toContain('${{ matrix.os }}');
    });
  });

  describe('Windows-specific considerations', () => {
    it('should not use shell-specific commands that fail on Windows', () => {
      const content = readFileSync(workflowPath, 'utf-8');

      // Check for common Linux-only commands
      expect(content).not.toMatch(/\bls\b/);
      expect(content).not.toMatch(/\bcat\b/);
      expect(content).not.toMatch(/\bgrep\b/);
      expect(content).not.toMatch(/\bsed\b/);
      expect(content).not.toMatch(/\bawk\b/);

      // Should use npm scripts instead of shell commands
      expect(content).toMatch(/npm run build/);
      expect(content).toMatch(/npm test/);
      expect(content).toMatch(/npm ci/);
    });

    it('should not use Unix-specific path separators in the workflow', () => {
      const content = readFileSync(workflowPath, 'utf-8');

      // Check that there are no hardcoded Unix paths
      // GitHub Actions handles path resolution automatically
      expect(content).not.toMatch(/\/usr\/bin/);
      expect(content).not.toMatch(/\/home\//);
      expect(content).not.toMatch(/~\//);
    });
  });
});