/**
 * @fileoverview Comprehensive tests for configuration loading with permission and autonomy settings
 * Tests config validation, merging, defaults, and permission-related configuration paths
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import {
  loadConfig,
  createDefaultConfig,
  validateConfig,
  mergeConfigs,
  type ApexConfig,
  type AutonomyConfig,
  type PermissionsConfig
} from '../config.js';

describe('Configuration Permission Loading Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'apex-config-test-'));
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Default Configuration Creation', () => {
    it('should create default config with autonomy settings', () => {
      const defaultConfig = createDefaultConfig();

      expect(defaultConfig.autonomy).toBeDefined();
      expect(defaultConfig.autonomy.level).toBe('review-before-commit');
      expect(defaultConfig.autonomy.rejectionBehavior).toBe('abort');
      expect(defaultConfig.autonomy.gates).toEqual([]);
      expect(defaultConfig.autonomy.stageOverrides).toEqual({});
      expect(defaultConfig.autonomy.agentOverrides).toEqual({});
    });

    it('should create default config with permission settings', () => {
      const defaultConfig = createDefaultConfig();

      expect(defaultConfig.permissions).toBeDefined();
      expect(defaultConfig.permissions.preset).toBe('review-all');
      expect(defaultConfig.permissions.customRules).toEqual([]);
    });

    it('should validate the default configuration', () => {
      const defaultConfig = createDefaultConfig();

      // Should not throw any validation errors
      expect(() => validateConfig(defaultConfig)).not.toThrow();
    });
  });

  describe('Autonomy Configuration Loading', () => {
    it('should load minimal autonomy configuration', async () => {
      const configContent = `
autonomy:
  level: supervised
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, configContent);

      const config = await loadConfig(testDir);

      expect(config.autonomy.level).toBe('supervised');
      expect(config.autonomy.rejectionBehavior).toBe('abort'); // Default
      expect(config.autonomy.gates).toEqual([]); // Default
    });

    it('should load full autonomy configuration', async () => {
      const configContent = `
autonomy:
  level: review-before-commit
  rejectionBehavior: prompt
  gates:
    - deployment
    - data-modification
    - external-access
  limits:
    maxTokenUsage: 50000
    maxCost: 25.0
    maxDuration: 3600
    maxParallelTasks: 5
  stageOverrides:
    planning: autonomous
    architecture: supervised
    testing: autonomous
    deployment: manual
  agentOverrides:
    planner: autonomous
    developer:
      level: supervised
      gates:
        - code-review
      limits:
        maxTokenUsage: 10000
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, configContent);

      const config = await loadConfig(testDir);

      expect(config.autonomy.level).toBe('review-before-commit');
      expect(config.autonomy.rejectionBehavior).toBe('prompt');
      expect(config.autonomy.gates).toEqual(['deployment', 'data-modification', 'external-access']);
      expect(config.autonomy.limits).toEqual({
        maxTokenUsage: 50000,
        maxCost: 25.0,
        maxDuration: 3600,
        maxParallelTasks: 5
      });
      expect(config.autonomy.stageOverrides).toEqual({
        planning: 'autonomous',
        architecture: 'supervised',
        testing: 'autonomous',
        deployment: 'manual'
      });
      expect(config.autonomy.agentOverrides?.planner).toBe('autonomous');
      expect(config.autonomy.agentOverrides?.developer).toEqual({
        level: 'supervised',
        gates: ['code-review'],
        limits: {
          maxTokenUsage: 10000
        }
      });
    });

    it('should validate autonomy level values', async () => {
      const invalidConfigs = [
        { level: 'invalid-level', error: 'Invalid enum value' },
        { level: 'AUTONOMOUS', error: 'Invalid enum value' },
        { level: '', error: 'Invalid enum value' },
        { level: 123, error: 'Expected string' }
      ];

      for (const { level, error } of invalidConfigs) {
        const configContent = `
autonomy:
  level: ${level}
`;
        const configPath = join(testDir, `config-${Date.now()}.yaml`);
        await writeFile(configPath, configContent);

        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });

    it('should handle legacy autonomy level conversion', async () => {
      const configContent = `
autonomy:
  level: semi-autonomous
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, configContent);

      const config = await loadConfig(testDir);

      // Should convert legacy value
      expect(config.autonomy.level).toBe('review-before-commit');
    });
  });

  describe('Permission Configuration Loading', () => {
    it('should load minimal permission configuration', async () => {
      const configContent = `
permissions:
  preset: review-all
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, configContent);

      const config = await loadConfig(testDir);

      expect(config.permissions.preset).toBe('review-all');
      expect(config.permissions.customRules).toEqual([]);
    });

    it('should load permission configuration with custom rules', async () => {
      const configContent = `
permissions:
  preset: restricted
  customRules:
    - tool: "Bash"
      behavior: deny
      reason: "Shell access restricted in this environment"
    - tool: "Write"
      behavior: allow-once
      pattern: "src/**/*.ts"
      reason: "Allow writing to source files with confirmation"
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, configContent);

      const config = await loadConfig(testDir);

      expect(config.permissions.preset).toBe('restricted');
      expect(config.permissions.customRules).toHaveLength(2);

      expect(config.permissions.customRules[0]).toEqual({
        tool: 'Bash',
        behavior: 'deny',
        reason: 'Shell access restricted in this environment'
      });

      expect(config.permissions.customRules[1]).toEqual({
        tool: 'Write',
        behavior: 'allow-once',
        pattern: 'src/**/*.ts',
        reason: 'Allow writing to source files with confirmation'
      });
    });

    it('should validate permission preset values', async () => {
      const validPresets = ['unrestricted', 'review-all', 'restricted', 'paranoid'];

      for (const preset of validPresets) {
        const configContent = `
permissions:
  preset: ${preset}
`;
        const configPath = join(testDir, `config-${preset}.yaml`);
        await writeFile(configPath, configContent);

        const config = await loadConfig(testDir);
        expect(config.permissions.preset).toBe(preset);
      }
    });

    it('should reject invalid permission presets', async () => {
      const invalidPresets = ['invalid-preset', 'RESTRICTED', '', 'allow-all'];

      for (const preset of invalidPresets) {
        const configContent = `
permissions:
  preset: ${preset}
`;
        const configPath = join(testDir, `config-invalid-${Date.now()}.yaml`);
        await writeFile(configPath, configContent);

        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });
  });

  describe('Configuration Merging', () => {
    it('should merge autonomy configurations correctly', () => {
      const baseConfig: ApexConfig = {
        projectName: 'test',
        autonomy: {
          level: 'supervised',
          gates: ['deployment']
        },
        permissions: {
          preset: 'review-all',
          customRules: []
        }
      };

      const overrideConfig: Partial<ApexConfig> = {
        autonomy: {
          level: 'autonomous',
          rejectionBehavior: 'continue',
          gates: ['security-check'],
          limits: {
            maxTokenUsage: 20000
          }
        }
      };

      const merged = mergeConfigs(baseConfig, overrideConfig);

      expect(merged.autonomy.level).toBe('autonomous'); // Overridden
      expect(merged.autonomy.rejectionBehavior).toBe('continue'); // Added
      expect(merged.autonomy.gates).toEqual(['security-check']); // Overridden
      expect(merged.autonomy.limits).toEqual({ maxTokenUsage: 20000 }); // Added
    });

    it('should merge permission configurations correctly', () => {
      const baseConfig: ApexConfig = {
        projectName: 'test',
        autonomy: { level: 'supervised' },
        permissions: {
          preset: 'review-all',
          customRules: [
            { tool: 'Read', behavior: 'allow-always' }
          ]
        }
      };

      const overrideConfig: Partial<ApexConfig> = {
        permissions: {
          preset: 'restricted',
          customRules: [
            { tool: 'Write', behavior: 'deny' }
          ]
        }
      };

      const merged = mergeConfigs(baseConfig, overrideConfig);

      expect(merged.permissions.preset).toBe('restricted'); // Overridden
      expect(merged.permissions.customRules).toEqual([
        { tool: 'Write', behavior: 'deny' } // Replaced, not merged
      ]);
    });

    it('should handle deep merging of agent overrides', () => {
      const baseConfig: ApexConfig = {
        projectName: 'test',
        autonomy: {
          level: 'supervised',
          agentOverrides: {
            planner: 'autonomous',
            developer: {
              level: 'review-before-commit',
              gates: ['code-review']
            }
          }
        },
        permissions: { preset: 'review-all', customRules: [] }
      };

      const overrideConfig: Partial<ApexConfig> = {
        autonomy: {
          level: 'autonomous',
          agentOverrides: {
            developer: {
              level: 'supervised',
              limits: { maxTokenUsage: 5000 }
            },
            tester: 'autonomous'
          }
        }
      };

      const merged = mergeConfigs(baseConfig, overrideConfig);

      expect(merged.autonomy.agentOverrides?.planner).toBe('autonomous'); // Preserved
      expect(merged.autonomy.agentOverrides?.developer).toEqual({
        level: 'supervised', // Overridden
        limits: { maxTokenUsage: 5000 } // Added
        // Note: gates are lost in deep merge - this is expected behavior
      });
      expect(merged.autonomy.agentOverrides?.tester).toBe('autonomous'); // Added
    });
  });

  describe('Configuration Validation', () => {
    it('should validate complete permission configurations', () => {
      const validConfigs: ApexConfig[] = [
        {
          projectName: 'test',
          autonomy: { level: 'autonomous' },
          permissions: { preset: 'unrestricted', customRules: [] }
        },
        {
          projectName: 'test',
          autonomy: {
            level: 'supervised',
            gates: ['deployment', 'data-modification'],
            limits: { maxCost: 10.0, maxDuration: 1800 }
          },
          permissions: {
            preset: 'restricted',
            customRules: [
              { tool: 'Bash', behavior: 'deny', reason: 'Security policy' }
            ]
          }
        }
      ];

      validConfigs.forEach(config => {
        expect(() => validateConfig(config)).not.toThrow();
      });
    });

    it('should reject invalid permission configurations', () => {
      const invalidConfigs = [
        {
          projectName: 'test',
          autonomy: { level: 'invalid-level' as any },
          permissions: { preset: 'review-all', customRules: [] }
        },
        {
          projectName: 'test',
          autonomy: { level: 'supervised' },
          permissions: { preset: 'invalid-preset' as any, customRules: [] }
        },
        {
          projectName: 'test',
          autonomy: { level: 'supervised' },
          permissions: {
            preset: 'review-all',
            customRules: [
              { tool: '', behavior: 'deny' } // Empty tool name
            ]
          }
        }
      ];

      invalidConfigs.forEach(config => {
        expect(() => validateConfig(config)).toThrow();
      });
    });

    it('should validate resource limits in autonomy config', () => {
      const configWithLimits: ApexConfig = {
        projectName: 'test',
        autonomy: {
          level: 'supervised',
          limits: {
            maxTokenUsage: 50000,
            maxCost: 25.5,
            maxDuration: 7200,
            maxParallelTasks: 3,
            maxMemoryMB: 2048
          }
        },
        permissions: { preset: 'review-all', customRules: [] }
      };

      expect(() => validateConfig(configWithLimits)).not.toThrow();

      // Test with negative values (should be invalid)
      const invalidLimitsConfig = {
        ...configWithLimits,
        autonomy: {
          ...configWithLimits.autonomy,
          limits: {
            maxTokenUsage: -1000 // Invalid negative value
          }
        }
      };

      expect(() => validateConfig(invalidLimitsConfig)).toThrow();
    });
  });

  describe('Complex Permission Scenarios', () => {
    it('should handle environment-specific permission configurations', async () => {
      const configContent = `
autonomy:
  level: supervised
permissions:
  preset: review-all
  customRules:
    # Development environment - more permissive
    - tool: "Bash"
      behavior: allow-once
      pattern: "npm *"
      reason: "Allow package management commands"
    - tool: "Write"
      behavior: allow-always
      pattern: "src/**/*.ts"
      reason: "Allow source code modifications"

    # Production restrictions
    - tool: "Bash"
      behavior: deny
      pattern: "*production*"
      reason: "Production commands require manual approval"
    - tool: "Write"
      behavior: deny
      pattern: "/etc/**"
      reason: "System configuration changes prohibited"
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, configContent);

      const config = await loadConfig(testDir);

      expect(config.permissions.customRules).toHaveLength(4);

      // Verify each rule
      const rules = config.permissions.customRules;
      expect(rules[0]).toMatchObject({
        tool: 'Bash',
        behavior: 'allow-once',
        pattern: 'npm *',
        reason: 'Allow package management commands'
      });

      expect(rules[3]).toMatchObject({
        tool: 'Write',
        behavior: 'deny',
        pattern: '/etc/**',
        reason: 'System configuration changes prohibited'
      });
    });

    it('should handle multi-agent autonomy configurations', async () => {
      const configContent = `
autonomy:
  level: review-before-commit
  agentOverrides:
    planner:
      level: autonomous
      gates: []
    architect:
      level: supervised
      gates:
        - architecture-review
      limits:
        maxTokenUsage: 15000
        maxDuration: 1800
    developer:
      level: review-before-commit
      gates:
        - code-review
        - security-check
      limits:
        maxTokenUsage: 25000
        maxCost: 15.0
      stageOverrides:
        testing: autonomous
    reviewer:
      level: manual
      gates:
        - human-review
        - compliance-check
permissions:
  preset: restricted
  customRules:
    - tool: "Bash"
      behavior: deny
      reason: "Shell access restricted for all agents"
    - tool: "Write"
      behavior: allow-once
      pattern: "**/*.md"
      reason: "Documentation updates require confirmation"
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, configContent);

      const config = await loadConfig(testDir);

      // Verify agent-specific configurations
      expect(config.autonomy.agentOverrides?.planner).toEqual({
        level: 'autonomous',
        gates: []
      });

      expect(config.autonomy.agentOverrides?.architect).toEqual({
        level: 'supervised',
        gates: ['architecture-review'],
        limits: {
          maxTokenUsage: 15000,
          maxDuration: 1800
        }
      });

      expect(config.autonomy.agentOverrides?.developer).toEqual({
        level: 'review-before-commit',
        gates: ['code-review', 'security-check'],
        limits: {
          maxTokenUsage: 25000,
          maxCost: 15.0
        },
        stageOverrides: {
          testing: 'autonomous'
        }
      });

      expect(config.autonomy.agentOverrides?.reviewer).toEqual({
        level: 'manual',
        gates: ['human-review', 'compliance-check']
      });

      // Verify permission rules
      expect(config.permissions.preset).toBe('restricted');
      expect(config.permissions.customRules).toHaveLength(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing config files gracefully', async () => {
      // Try to load config from empty directory
      const config = await loadConfig(testDir);

      // Should return default configuration
      expect(config.autonomy.level).toBe('review-before-commit');
      expect(config.permissions.preset).toBe('review-all');
    });

    it('should handle malformed YAML files', async () => {
      const malformedContent = `
autonomy:
  level: supervised
  gates: [deployment, # Missing closing bracket
permissions:
  preset: review-all
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, malformedContent);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle partially valid configurations', async () => {
      const partialConfig = `
autonomy:
  level: supervised
  gates:
    - deployment
    - invalid-gate-name
permissions:
  preset: review-all
  customRules:
    - tool: "ValidTool"
      behavior: allow-once
    - tool: ""  # Invalid empty tool name
      behavior: deny
`;
      const configPath = join(testDir, 'config.yaml');
      await writeFile(configPath, partialConfig);

      // Should throw due to validation errors
      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });
});