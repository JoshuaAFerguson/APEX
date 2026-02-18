/**
 * Config Loading Tests for Autonomy Settings
 *
 * These tests specifically focus on the config loading functionality
 * for autonomy settings in .apex/config.yaml, covering:
 * - Loading autonomy section from YAML
 * - Default value application
 * - Validation error handling
 * - Config schema validation
 * - getEffectiveConfig functionality
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  saveConfig,
  getEffectiveConfig,
  initializeApex,
} from '../config';
import { ApexConfig } from '../types';

describe('Config Loading - Autonomy Settings', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autonomy-config-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Loading autonomy section from config.yaml', () => {
    it('should load basic autonomy configuration', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.autonomy).toBeDefined();
      expect(loadedConfig.autonomy!.level).toBe('full-auto');
    });

    it('should load complete autonomy configuration with gates and limits', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-before-commit',
          gates: [
            {
              type: 'before-commit',
              name: 'Code Review',
              required: true,
              minApprovals: 1,
            },
            {
              type: 'before-deploy',
              name: 'Production Gate',
              required: true,
            },
          ],
          limits: {
            maxCost: 50.0,
            maxTokens: 200000,
            maxTimeMs: 3600000,
            maxFilesModified: 100,
            dailyBudget: 150.0,
          },
          stageOverrides: {
            planning: 'full-auto',
            implementation: 'review-before-commit',
          },
          agentOverrides: {
            developer: 'review-before-commit',
            tester: 'full-auto',
          },
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.autonomy).toBeDefined();
      expect(loadedConfig.autonomy!.level).toBe('review-before-commit');
      expect(loadedConfig.autonomy!.gates).toHaveLength(2);
      expect(loadedConfig.autonomy!.gates![0].type).toBe('before-commit');
      expect(loadedConfig.autonomy!.limits!.maxCost).toBe(50.0);
      expect(loadedConfig.autonomy!.stageOverrides!.planning).toBe('full-auto');
      expect(loadedConfig.autonomy!.agentOverrides!.developer).toBe('review-before-commit');
    });

    it('should load config without autonomy section', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.autonomy).toBeUndefined();
    });

    it('should load partial autonomy configuration', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          limits: {
            maxCost: 25.0,
            maxTokens: 100000,
          },
          // level not specified, should remain undefined until getEffectiveConfig
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);

      expect(loadedConfig.autonomy).toBeDefined();
      expect(loadedConfig.autonomy!.level).toBeUndefined();
      expect(loadedConfig.autonomy!.limits!.maxCost).toBe(25.0);
    });
  });

  describe('Default value application in getEffectiveConfig', () => {
    it('should apply autonomy defaults when autonomy section is missing', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.autonomy).toBeDefined();
      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.gates).toEqual([]);
      expect(effectiveConfig.autonomy.limits).toBeUndefined();
      expect(effectiveConfig.autonomy.stageOverrides).toEqual({});
      expect(effectiveConfig.autonomy.agentOverrides).toEqual({});
    });

    it('should apply defaults only for missing autonomy properties', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
          limits: {
            maxCost: 10.0,
          },
          // gates, stageOverrides, agentOverrides not specified
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.autonomy.level).toBe('full-auto'); // preserved
      expect(effectiveConfig.autonomy.limits!.maxCost).toBe(10.0); // preserved
      expect(effectiveConfig.autonomy.gates).toEqual([]); // default
      expect(effectiveConfig.autonomy.stageOverrides).toEqual({}); // default
      expect(effectiveConfig.autonomy.agentOverrides).toEqual({}); // default
    });

    it('should preserve all explicitly set autonomy values', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-all',
          gates: [
            {
              type: 'before-destructive',
              name: 'Destructive Operations Gate',
              required: true,
            },
          ],
          limits: {
            maxCost: 100.0,
            maxTokens: 500000,
            maxTimeMs: 7200000,
          },
          stageOverrides: {
            testing: 'full-auto',
            deployment: 'review-all',
          },
          agentOverrides: {
            planner: 'full-auto',
            devops: 'review-all',
          },
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.autonomy.level).toBe('review-all');
      expect(effectiveConfig.autonomy.gates).toHaveLength(1);
      expect(effectiveConfig.autonomy.gates[0].type).toBe('before-destructive');
      expect(effectiveConfig.autonomy.limits!.maxCost).toBe(100.0);
      expect(effectiveConfig.autonomy.stageOverrides.testing).toBe('full-auto');
      expect(effectiveConfig.autonomy.agentOverrides.devops).toBe('review-all');
    });
  });

  describe('Validation error handling', () => {
    it('should handle invalid autonomy level values', async () => {
      // Create a config with invalid autonomy level by writing YAML directly
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: invalid-level  # Invalid autonomy level
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle invalid approval gate types', async () => {
      // Create a config with invalid gate type
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  gates:
    - type: invalid-checkpoint  # Invalid gate type
      name: Invalid Gate
      required: true
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle invalid resource limit values', async () => {
      // Create a config with invalid resource limits
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  limits:
    maxCost: -5.0  # Invalid negative cost
    maxTokens: -1000  # Invalid negative tokens
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle malformed autonomy configuration', async () => {
      // Create a config with malformed autonomy section
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy: invalid-string  # Should be object, not string
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle invalid stage override values', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  stageOverrides:
    planning: invalid-autonomy-level  # Invalid override value
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle invalid agent override values', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  agentOverrides:
    developer: invalid-level  # Invalid override value
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);

      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should handle enterprise-scale autonomy configuration', async () => {
      const enterpriseConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'enterprise-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-before-commit',
          gates: [
            {
              type: 'before-commit',
              name: 'Peer Review Gate',
              description: 'All code requires peer review',
              required: true,
              approvers: ['tech-lead@company.com', 'senior-dev@company.com'],
              minApprovals: 1,
              timeout: 120,
              tags: ['code-quality'],
            },
            {
              type: 'before-deploy',
              name: 'Production Deploy Gate',
              description: 'Production deploys require ops approval',
              required: true,
              approvers: ['devops-team@company.com'],
              minApprovals: 1,
              timeout: 60,
              tags: ['production', 'deployment'],
            },
            {
              type: 'before-destructive',
              name: 'Destructive Operations Gate',
              description: 'File deletions require additional approval',
              required: true,
              approvers: ['architect@company.com'],
              minApprovals: 1,
              timeout: 240,
              tags: ['destructive', 'safety'],
            },
            {
              type: 'custom',
              name: 'Security Review Gate',
              description: 'High-risk changes require security review',
              required: false,
              trigger: 'security_impact > 0.8',
              approvers: ['security-team@company.com'],
              minApprovals: 2,
              timeout: 300,
              tags: ['security', 'high-risk'],
            },
          ],
          limits: {
            maxCost: 500.0,
            maxTokens: 1000000,
            maxTimeMs: 14400000, // 4 hours
            maxFilesCreated: 200,
            maxFilesModified: 500,
            maxFilesDeleted: 50,
            maxLinesChanged: 20000,
            maxTurns: 500,
            dailyBudget: 2000.0,
            maxConcurrentTasks: 20,
          },
          stageOverrides: {
            planning: 'full-auto',
            architecture: 'review-before-commit',
            implementation: 'review-before-commit',
            testing: 'full-auto',
            review: 'review-before-commit',
            deployment: 'review-all',
          },
          agentOverrides: {
            planner: 'full-auto',
            architect: 'review-before-commit',
            developer: 'review-before-commit',
            tester: 'full-auto',
            reviewer: 'review-before-commit',
            devops: 'review-all',
          },
        },
      };

      await saveConfig(testDir, enterpriseConfig);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      // Verify all aspects of the complex configuration
      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.gates).toHaveLength(4);

      // Verify gate types
      const gateTypes = effectiveConfig.autonomy.gates.map(g => g.type);
      expect(gateTypes).toContain('before-commit');
      expect(gateTypes).toContain('before-deploy');
      expect(gateTypes).toContain('before-destructive');
      expect(gateTypes).toContain('custom');

      // Verify specific gate properties
      const securityGate = effectiveConfig.autonomy.gates.find(g => g.name === 'Security Review Gate');
      expect(securityGate).toBeDefined();
      expect(securityGate!.trigger).toBe('security_impact > 0.8');
      expect(securityGate!.minApprovals).toBe(2);

      // Verify limits
      expect(effectiveConfig.autonomy.limits!.maxCost).toBe(500.0);
      expect(effectiveConfig.autonomy.limits!.maxConcurrentTasks).toBe(20);

      // Verify overrides
      expect(effectiveConfig.autonomy.stageOverrides.deployment).toBe('review-all');
      expect(effectiveConfig.autonomy.agentOverrides.devops).toBe('review-all');
      expect(effectiveConfig.autonomy.stageOverrides.planning).toBe('full-auto');
      expect(effectiveConfig.autonomy.agentOverrides.tester).toBe('full-auto');
    });

    it('should handle mixed autonomy configuration with some sections defined', async () => {
      const mixedConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'mixed-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          // level not specified - should get default
          gates: [
            {
              type: 'before-commit',
              name: 'Basic Review',
              required: true,
            },
          ],
          // limits not specified - should remain undefined
          stageOverrides: {
            testing: 'full-auto',
          },
          // agentOverrides not specified - should get default empty object
        },
      };

      await saveConfig(testDir, mixedConfig);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.autonomy.level).toBe('review-before-commit'); // default
      expect(effectiveConfig.autonomy.gates).toHaveLength(1); // preserved
      expect(effectiveConfig.autonomy.limits).toBeUndefined(); // not specified
      expect(effectiveConfig.autonomy.stageOverrides.testing).toBe('full-auto'); // preserved
      expect(effectiveConfig.autonomy.agentOverrides).toEqual({}); // default
    });
  });

  describe('Initialization with autonomy defaults', () => {
    it('should create project with default autonomy configuration via initializeApex', async () => {
      await initializeApex(testDir, { projectName: 'autonomy-init-test' });
      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      // initializeApex doesn't set autonomy explicitly, so defaults should apply
      expect(config.autonomy).toBeUndefined();
      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.gates).toEqual([]);
      expect(effectiveConfig.autonomy.stageOverrides).toEqual({});
      expect(effectiveConfig.autonomy.agentOverrides).toEqual({});
    });
  });

  describe('Config schema validation edge cases', () => {
    it('should handle empty gates array', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
          gates: [], // explicitly empty
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.autonomy.gates).toEqual([]);
    });

    it('should handle empty override objects', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-all',
          stageOverrides: {}, // explicitly empty
          agentOverrides: {}, // explicitly empty
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.autonomy.stageOverrides).toEqual({});
      expect(effectiveConfig.autonomy.agentOverrides).toEqual({});
    });

    it('should handle minimal autonomy configuration with only level', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-all',
        },
      };

      await saveConfig(testDir, config);
      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.autonomy.level).toBe('review-all');
      expect(effectiveConfig.autonomy.gates).toEqual([]); // default
      expect(effectiveConfig.autonomy.limits).toBeUndefined(); // not set
      expect(effectiveConfig.autonomy.stageOverrides).toEqual({}); // default
      expect(effectiveConfig.autonomy.agentOverrides).toEqual({}); // default
    });
  });
});