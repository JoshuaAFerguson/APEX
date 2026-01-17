import { describe, it, expect } from 'vitest';
import { TDDModeConfigSchema, ApexConfigSchema } from '../types';
import { initializeApex, loadConfig, getEffectiveConfig } from '../config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TDD Configuration Validation', () => {
  describe('TDDModeConfigSchema', () => {
    it('should validate valid TDD configuration', () => {
      const validConfig = {
        enabled: true,
        testCommand: 'npm test',
        watchMode: false,
        maxIterations: 10,
        regressionGuard: true,
      };

      const result = TDDModeConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should apply default values for missing properties', () => {
      const minimalConfig = {};

      const result = TDDModeConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          enabled: false,
          testCommand: 'npm test',
          watchMode: false,
          maxIterations: 5,
          regressionGuard: true,
        });
      }
    });

    it('should validate enabled flag as boolean', () => {
      const invalidConfig = { enabled: 'true' };
      const result = TDDModeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate testCommand as string', () => {
      const invalidConfig = { testCommand: 123 };
      const result = TDDModeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate watchMode as boolean', () => {
      const invalidConfig = { watchMode: 'false' };
      const result = TDDModeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should validate maxIterations as positive integer', () => {
      const configs = [
        { maxIterations: 0 },    // Should fail (min 1)
        { maxIterations: -1 },   // Should fail (min 1)
        { maxIterations: 1.5 },  // Should fail (not integer)
        { maxIterations: '5' },  // Should fail (not number)
      ];

      for (const config of configs) {
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }

      // Valid cases
      const validConfigs = [
        { maxIterations: 1 },
        { maxIterations: 10 },
        { maxIterations: 100 },
      ];

      for (const config of validConfigs) {
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it('should validate regressionGuard as boolean', () => {
      const invalidConfig = { regressionGuard: 1 };
      const result = TDDModeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should allow partial configurations', () => {
      const partialConfigs = [
        { enabled: true },
        { testCommand: 'yarn test' },
        { maxIterations: 3 },
        { enabled: true, testCommand: 'pnpm test' },
        { watchMode: true, regressionGuard: false },
      ];

      for (const config of partialConfigs) {
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('TDD Configuration in ApexConfig', () => {
    it('should include TDD configuration in ApexConfigSchema', () => {
      const configWithTDD = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: {
          level: 'review-before-commit',
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: { enabled: ['planner', 'tester'] },
        models: { planning: 'opus', implementation: 'sonnet', review: 'haiku' },
        git: { branchPrefix: 'apex/', commitFormat: 'conventional', autoPush: true, defaultBranch: 'main' },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
        tdd: {
          enabled: true,
          testCommand: 'npm run test:tdd',
          watchMode: true,
          maxIterations: 8,
          regressionGuard: true,
        },
      };

      const result = ApexConfigSchema.safeParse(configWithTDD);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tdd).toEqual({
          enabled: true,
          testCommand: 'npm run test:tdd',
          watchMode: true,
          maxIterations: 8,
          regressionGuard: true,
        });
      }
    });

    it('should work without TDD configuration (optional field)', () => {
      const configWithoutTDD = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: {
          level: 'review-before-commit',
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: { enabled: ['planner', 'tester'] },
        models: { planning: 'opus', implementation: 'sonnet', review: 'haiku' },
        git: { branchPrefix: 'apex/', commitFormat: 'conventional', autoPush: true, defaultBranch: 'main' },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
      };

      const result = ApexConfigSchema.safeParse(configWithoutTDD);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tdd).toBeUndefined();
      }
    });
  });

  describe('getEffectiveConfig TDD defaults', () => {
    it('should apply TDD defaults when TDD config is missing', () => {
      const baseConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: {
          level: 'review-before-commit' as const,
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: { enabled: ['planner', 'tester'] },
        models: { planning: 'opus' as const, implementation: 'sonnet' as const, review: 'haiku' as const },
        git: { branchPrefix: 'apex/', commitFormat: 'conventional' as const, autoPush: true, defaultBranch: 'main' },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);
      expect(effectiveConfig.tdd).toEqual({
        enabled: false,
        testCommand: 'npm test',
        watchMode: false,
        maxIterations: 5,
        regressionGuard: true,
      });
    });

    it('should use provided TDD config and fill in missing defaults', () => {
      const baseConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: {
          level: 'review-before-commit' as const,
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: { enabled: ['planner', 'tester'] },
        models: { planning: 'opus' as const, implementation: 'sonnet' as const, review: 'haiku' as const },
        git: { branchPrefix: 'apex/', commitFormat: 'conventional' as const, autoPush: true, defaultBranch: 'main' },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
        tdd: {
          enabled: true,
          testCommand: 'yarn test',
        },
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);
      expect(effectiveConfig.tdd).toEqual({
        enabled: true,
        testCommand: 'yarn test',
        watchMode: false,
        maxIterations: 5,
        regressionGuard: true,
      });
    });

    it('should preserve all TDD config when fully specified', () => {
      const baseConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        autonomy: {
          level: 'review-before-commit' as const,
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: { enabled: ['planner', 'tester'] },
        models: { planning: 'opus' as const, implementation: 'sonnet' as const, review: 'haiku' as const },
        git: { branchPrefix: 'apex/', commitFormat: 'conventional' as const, autoPush: true, defaultBranch: 'main' },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
        tdd: {
          enabled: true,
          testCommand: 'npm run test:watch',
          watchMode: true,
          maxIterations: 10,
          regressionGuard: false,
        },
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);
      expect(effectiveConfig.tdd).toEqual({
        enabled: true,
        testCommand: 'npm run test:watch',
        watchMode: true,
        maxIterations: 10,
        regressionGuard: false,
      });
    });

    it('should use project testCommand as fallback for TDD testCommand', () => {
      const baseConfig = {
        version: '1.0',
        project: { name: 'test-project', testCommand: 'jest --watch' },
        autonomy: {
          level: 'review-before-commit' as const,
          limits: {
            maxCost: 10.0,
            maxTokens: 500000,
            maxTurns: 100,
            dailyBudget: 100.0,
            maxConcurrentTasks: 3,
          },
        },
        agents: { enabled: ['planner', 'tester'] },
        models: { planning: 'opus' as const, implementation: 'sonnet' as const, review: 'haiku' as const },
        git: { branchPrefix: 'apex/', commitFormat: 'conventional' as const, autoPush: true, defaultBranch: 'main' },
        limits: {
          maxTokensPerTask: 500000,
          maxCostPerTask: 10.0,
          dailyBudget: 100.0,
          maxTurns: 100,
          maxConcurrentTasks: 3,
        },
      };

      const effectiveConfig = getEffectiveConfig(baseConfig);
      expect(effectiveConfig.tdd.testCommand).toBe('jest --watch');
    });
  });

  describe('Integration with initializeApex', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-test-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should include TDD configuration in default config template', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });
      const config = await loadConfig(tempDir);

      expect(config.tdd).toBeDefined();
      expect(config.tdd).toEqual({
        enabled: false,
        testCommand: 'npm test',
        watchMode: false,
        maxIterations: 5,
        regressionGuard: true,
      });
    });

    it('should validate TDD configuration during config loading', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      // Modify the config file with invalid TDD configuration
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      let configContent = await fs.readFile(configPath, 'utf-8');

      // Add invalid TDD config
      configContent += `
tdd:
  enabled: "true"  # Should be boolean
  maxIterations: -1  # Should be positive
`;

      await fs.writeFile(configPath, configContent);

      // Loading config should fail with validation error
      await expect(loadConfig(tempDir)).rejects.toThrow();
    });

    it('should load and validate custom TDD configuration', async () => {
      await initializeApex(tempDir, { projectName: 'test-project' });

      // Modify the config file with custom TDD configuration
      const configPath = path.join(tempDir, '.apex', 'config.yaml');
      let configContent = await fs.readFile(configPath, 'utf-8');

      // Replace TDD config section
      configContent = configContent.replace(
        /tdd:\s*\n(?:  [^\n]*\n)*/,
        `tdd:
  enabled: true
  testCommand: "yarn test"
  watchMode: true
  maxIterations: 3
  regressionGuard: false
`
      );

      await fs.writeFile(configPath, configContent);

      const config = await loadConfig(tempDir);
      expect(config.tdd).toEqual({
        enabled: true,
        testCommand: 'yarn test',
        watchMode: true,
        maxIterations: 3,
        regressionGuard: false,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null TDD configuration', () => {
      const result = TDDModeConfigSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should handle undefined TDD configuration', () => {
      const result = TDDModeConfigSchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('should handle empty object TDD configuration', () => {
      const result = TDDModeConfigSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          enabled: false,
          testCommand: 'npm test',
          watchMode: false,
          maxIterations: 5,
          regressionGuard: true,
        });
      }
    });

    it('should reject additional unknown properties when using strict parsing', () => {
      const configWithExtra = {
        enabled: true,
        testCommand: 'npm test',
        unknownProperty: 'should-not-be-allowed',
      };

      // Note: Zod by default allows additional properties, but we can test strict parsing
      const strictSchema = TDDModeConfigSchema.strict();
      const result = strictSchema.safeParse(configWithExtra);
      expect(result.success).toBe(false);
    });

    it('should handle very large maxIterations value', () => {
      const config = { maxIterations: Number.MAX_SAFE_INTEGER };
      const result = TDDModeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject non-string testCommand values', () => {
      const invalidCommands = [
        { testCommand: null },
        { testCommand: undefined },
        { testCommand: 123 },
        { testCommand: [] },
        { testCommand: {} },
        { testCommand: true },
      ];

      for (const config of invalidCommands) {
        const result = TDDModeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });
  });
});