/**
 * Tests for CI matrix validation and Windows compatibility coverage
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

describe('CI Matrix Coverage and Windows Support', () => {
  const workflowPath = join(process.cwd(), '.github/workflows/ci.yml');

  describe('Matrix Configuration Validation', () => {
    let workflow: any;

    beforeAll(() => {
      if (!existsSync(workflowPath)) {
        throw new Error('GitHub Actions CI workflow not found');
      }

      const content = readFileSync(workflowPath, 'utf-8');
      workflow = yaml.parse(content);
    });

    it('should provide full cross-platform coverage', () => {
      const matrix = workflow?.jobs?.build?.strategy?.matrix;
      expect(matrix).toBeDefined();

      const osArray = matrix.os;
      const nodeArray = matrix['node-version'];

      // Calculate total combinations
      const totalCombinations = osArray.length * nodeArray.length;
      expect(totalCombinations).toBeGreaterThanOrEqual(4); // At least 2 OS × 2 Node versions

      // Verify specific combinations that include Windows
      const windowsCombinations = osArray.filter((os: string) => os.includes('windows')).length * nodeArray.length;
      expect(windowsCombinations).toBeGreaterThanOrEqual(2); // Windows with multiple Node versions
    });

    it('should use latest stable operating system versions', () => {
      const osMatrix = workflow?.jobs?.build?.strategy?.matrix?.os;

      osMatrix.forEach((os: string) => {
        // Should use latest versions
        expect(os).toMatch(/-latest$/);

        // Should not use deprecated versions
        expect(os).not.toMatch(/-18\.04$|-20\.04$/); // No old Ubuntu LTS
        expect(os).not.toMatch(/-2019$|-2016$/); // No old Windows Server
      });
    });

    it('should test supported Node.js LTS versions', () => {
      const nodeVersions = workflow?.jobs?.build?.strategy?.matrix?.['node-version'];

      // Should test current LTS versions
      expect(nodeVersions).toContain('18.x'); // Node 18 LTS
      expect(nodeVersions).toContain('20.x'); // Node 20 LTS

      // Should not test EOL versions
      expect(nodeVersions).not.toContain('16.x');
      expect(nodeVersions).not.toContain('14.x');
      expect(nodeVersions).not.toContain('12.x');
    });

    it('should ensure Windows gets full test coverage', () => {
      const steps = workflow?.jobs?.build?.steps || [];

      // All test steps should run on all matrix combinations (including Windows)
      const testSteps = ['Build', 'Type check', 'Lint', 'Test'];

      testSteps.forEach(stepName => {
        const step = steps.find((s: any) => s.name === stepName);
        expect(step).toBeDefined();

        // Should not have OS-specific conditions that exclude Windows
        expect(step.if).not.toMatch(/matrix\.os.*!=.*windows/);
        expect(step.if).not.toMatch(/runner\.os.*!=.*Windows/);
      });
    });

    it('should handle Windows path and environment differences', () => {
      const steps = workflow?.jobs?.build?.steps || [];

      steps.forEach((step: any) => {
        if (step.run) {
          // Should not use Unix-specific commands
          expect(step.run).not.toMatch(/\bls\b/);
          expect(step.run).not.toMatch(/\bcat\b/);
          expect(step.run).not.toMatch(/\bgrep\b/);
          expect(step.run).not.toMatch(/\bsed\b/);
          expect(step.run).not.toMatch(/\bawk\b/);

          // Should not use shell-specific operators
          expect(step.run).not.toMatch(/&&.*rm/);
          expect(step.run).not.toMatch(/\|\|.*exit/);
        }
      });
    });
  });

  describe('Windows-specific Build Requirements', () => {
    let workflow: any;

    beforeAll(() => {
      const content = readFileSync(workflowPath, 'utf-8');
      workflow = yaml.parse(content);
    });

    it('should install dependencies with npm ci for consistent package resolution', () => {
      const installStep = workflow?.jobs?.build?.steps?.find(
        (step: any) => step.name === 'Install dependencies'
      );

      expect(installStep).toBeDefined();
      expect(installStep.run).toBe('npm ci');

      // npm ci is preferred over npm install for CI environments
      // as it provides faster, reliable, reproducible builds
      expect(installStep.run).not.toBe('npm install');
    });

    it('should cache npm dependencies for faster builds', () => {
      const nodeSetupStep = workflow?.jobs?.build?.steps?.find(
        (step: any) => step.uses?.includes('setup-node')
      );

      expect(nodeSetupStep).toBeDefined();
      expect(nodeSetupStep.with?.cache).toBe('npm');
    });

    it('should handle native module compilation requirements', () => {
      // Windows native compilation requires specific tools
      // The workflow should not explicitly install build tools
      // as GitHub Actions Windows runners come with them pre-installed

      const steps = workflow?.jobs?.build?.steps || [];

      // Should not try to install Windows-specific build tools
      // (they're already available on the runner)
      const hasManualBuildToolsInstall = steps.some((step: any) =>
        step.run?.includes('choco install') ||
        step.run?.includes('windows-build-tools') ||
        step.run?.includes('vs-build-tools')
      );

      expect(hasManualBuildToolsInstall).toBe(false);
    });

    it('should test actual npm script execution that Windows will use', () => {
      const steps = workflow?.jobs?.build?.steps || [];

      // Build step should use npm run build
      const buildStep = steps.find((step: any) => step.name === 'Build');
      expect(buildStep?.run).toBe('npm run build');

      // Test step should use npm test
      const testStep = steps.find((step: any) => step.name === 'Test');
      expect(testStep?.run).toBe('npm test');

      // Other steps should also use npm scripts
      const typecheckStep = steps.find((step: any) => step.name === 'Type check');
      expect(typecheckStep?.run).toBe('npm run typecheck');

      const lintStep = steps.find((step: any) => step.name === 'Lint');
      expect(lintStep?.run).toBe('npm run lint');
    });
  });

  describe('Cross-platform Compatibility Verification', () => {
    it('should use GitHub Actions that work on all platforms', () => {
      const workflow = yaml.parse(readFileSync(workflowPath, 'utf-8'));
      const steps = workflow?.jobs?.build?.steps || [];

      steps.forEach((step: any) => {
        if (step.uses) {
          // Should use action versions that support all platforms
          if (step.uses.includes('checkout')) {
            expect(step.uses).toBe('actions/checkout@v4');
          }
          if (step.uses.includes('setup-node')) {
            expect(step.uses).toBe('actions/setup-node@v4');
          }

          // Should not use actions that are platform-specific
          expect(step.uses).not.toMatch(/linux-only/);
          expect(step.uses).not.toMatch(/ubuntu-only/);
          expect(step.uses).not.toMatch(/windows-only/);
        }
      });
    });

    it('should provide meaningful job names that include platform info', () => {
      const workflow = yaml.parse(readFileSync(workflowPath, 'utf-8'));

      // Should use matrix variables in step names for clarity
      const nodeSetupStep = workflow?.jobs?.build?.steps?.find(
        (step: any) => step.uses?.includes('setup-node')
      );

      expect(nodeSetupStep?.name).toContain('${{ matrix.node-version }}');
      expect(nodeSetupStep?.name).toContain('${{ matrix.os }}');
    });

    it('should run the same steps on all platforms without conditions', () => {
      const workflow = yaml.parse(readFileSync(workflowPath, 'utf-8'));
      const steps = workflow?.jobs?.build?.steps || [];

      // Essential steps should not have platform-specific conditions
      const essentialSteps = ['Install dependencies', 'Build', 'Test'];

      essentialSteps.forEach(stepName => {
        const step = steps.find((s: any) => s.name === stepName);
        expect(step).toBeDefined();

        // Should not exclude any platform
        expect(step.if).toBeUndefined();
      });
    });

    it('should validate that the workflow syntax is correct', () => {
      // YAML parsing should succeed without errors
      const content = readFileSync(workflowPath, 'utf-8');
      expect(() => yaml.parse(content)).not.toThrow();

      const workflow = yaml.parse(content);

      // Basic workflow structure validation
      expect(workflow.name).toBeDefined();
      expect(workflow.on).toBeDefined();
      expect(workflow.jobs).toBeDefined();
      expect(workflow.jobs.build).toBeDefined();

      // Matrix strategy should be valid
      const matrix = workflow.jobs.build.strategy?.matrix;
      expect(matrix).toBeDefined();
      expect(Array.isArray(matrix.os)).toBe(true);
      expect(Array.isArray(matrix['node-version'])).toBe(true);
    });
  });
});