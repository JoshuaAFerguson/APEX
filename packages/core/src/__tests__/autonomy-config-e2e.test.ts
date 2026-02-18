/**
 * End-to-End Tests for Autonomy Configuration
 *
 * Tests complete workflows involving config loading, validation,
 * and effective config generation for autonomy settings.
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
  isApexInitialized,
} from '../config';
import { ApexConfig } from '../types';

describe('Autonomy Configuration E2E Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autonomy-e2e-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Complete config lifecycle', () => {
    it('should support full config create -> save -> load -> effective workflow', async () => {
      // 1. Create initial config
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'lifecycle-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      // 2. Save without autonomy settings
      await saveConfig(testDir, initialConfig);

      // 3. Load and verify no autonomy section
      let loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.autonomy).toBeUndefined();

      // 4. Apply effective config and verify defaults
      let effectiveConfig = getEffectiveConfig(loadedConfig);
      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.gates).toEqual([]);

      // 5. Update config with autonomy settings
      const updatedConfig: ApexConfig = {
        ...loadedConfig,
        autonomy: {
          level: 'full-auto',
          gates: [
            {
              type: 'before-deploy',
              name: 'Deploy Gate',
              required: true,
            },
          ],
          limits: {
            maxCost: 75.0,
            maxTokens: 300000,
          },
          stageOverrides: {
            testing: 'full-auto',
            deployment: 'review-all',
          },
        },
      };

      // 6. Save updated config
      await saveConfig(testDir, updatedConfig);

      // 7. Load updated config
      loadedConfig = await loadConfig(testDir);
      expect(loadedConfig.autonomy).toBeDefined();
      expect(loadedConfig.autonomy!.level).toBe('full-auto');
      expect(loadedConfig.autonomy!.gates).toHaveLength(1);

      // 8. Apply effective config and verify preservation
      effectiveConfig = getEffectiveConfig(loadedConfig);
      expect(effectiveConfig.autonomy.level).toBe('full-auto');
      expect(effectiveConfig.autonomy.gates).toHaveLength(1);
      expect(effectiveConfig.autonomy.limits!.maxCost).toBe(75.0);
      expect(effectiveConfig.autonomy.stageOverrides.deployment).toBe('review-all');
    });

    it('should handle config evolution from basic to advanced autonomy', async () => {
      // Start with basic config
      let config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'evolution-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-before-commit',
        },
      };

      await saveConfig(testDir, config);

      // Phase 1: Add gates
      config = await loadConfig(testDir);
      config.autonomy!.gates = [
        {
          type: 'before-commit',
          name: 'Code Review',
          required: true,
          minApprovals: 1,
        },
      ];
      await saveConfig(testDir, config);

      // Phase 2: Add limits
      config = await loadConfig(testDir);
      config.autonomy!.limits = {
        maxCost: 25.0,
        maxTokens: 100000,
        maxTimeMs: 1800000,
      };
      await saveConfig(testDir, config);

      // Phase 3: Add overrides
      config = await loadConfig(testDir);
      config.autonomy!.stageOverrides = {
        planning: 'full-auto',
        testing: 'full-auto',
      };
      config.autonomy!.agentOverrides = {
        planner: 'full-auto',
        tester: 'full-auto',
      };
      await saveConfig(testDir, config);

      // Verify final state
      const finalConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(finalConfig);

      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.gates).toHaveLength(1);
      expect(effectiveConfig.autonomy.gates[0].name).toBe('Code Review');
      expect(effectiveConfig.autonomy.limits!.maxCost).toBe(25.0);
      expect(effectiveConfig.autonomy.stageOverrides.planning).toBe('full-auto');
      expect(effectiveConfig.autonomy.agentOverrides.tester).toBe('full-auto');
    });
  });

  describe('Project initialization scenarios', () => {
    it('should initialize project and then add autonomy configuration', async () => {
      // Initialize empty project
      await initializeApex(testDir, { projectName: 'init-then-autonomy' });

      // Verify initialization
      expect(await isApexInitialized(testDir)).toBe(true);

      // Load initial config
      let config = await loadConfig(testDir);
      expect(config.autonomy).toBeUndefined();

      // Add autonomy configuration
      config.autonomy = {
        level: 'review-before-commit',
        gates: [
          {
            type: 'before-commit',
            name: 'Initial Gate',
            required: true,
          },
        ],
        limits: {
          maxCost: 30.0,
          dailyBudget: 100.0,
        },
      };

      await saveConfig(testDir, config);

      // Verify autonomy config was added
      const updatedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(updatedConfig);

      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.gates).toHaveLength(1);
      expect(effectiveConfig.autonomy.limits!.maxCost).toBe(30.0);
    });

    it('should handle pre-configured autonomy in initialization', async () => {
      // Create config with autonomy before saving
      const configWithAutonomy: ApexConfig = {
        version: '1.0',
        project: {
          name: 'pre-configured-autonomy',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
          limits: {
            maxCost: 100.0,
            maxTokens: 500000,
          },
        },
      };

      await saveConfig(testDir, configWithAutonomy);

      const loadedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(loadedConfig);

      expect(effectiveConfig.autonomy.level).toBe('full-auto');
      expect(effectiveConfig.autonomy.limits!.maxCost).toBe(100.0);
    });
  });

  describe('Multi-environment configuration scenarios', () => {
    it('should handle development vs production autonomy configurations', async () => {
      // Development configuration (more autonomous)
      const devConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'multi-env-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
          gates: [
            {
              type: 'before-commit',
              name: 'Dev Gate',
              required: false, // Relaxed for development
            },
          ],
          limits: {
            maxCost: 10.0, // Lower limits for dev
            maxTokens: 50000,
          },
          stageOverrides: {
            planning: 'full-auto',
            implementation: 'full-auto',
            testing: 'full-auto',
          },
        },
      };

      await saveConfig(testDir, devConfig);

      // Simulate switching to production configuration
      const prodConfig: ApexConfig = {
        ...devConfig,
        autonomy: {
          level: 'review-before-commit',
          gates: [
            {
              type: 'before-commit',
              name: 'Code Review Gate',
              required: true,
              minApprovals: 2,
              timeout: 120,
            },
            {
              type: 'before-deploy',
              name: 'Production Deploy Gate',
              required: true,
              minApprovals: 1,
              timeout: 60,
            },
            {
              type: 'before-destructive',
              name: 'Destructive Operations Gate',
              required: true,
              minApprovals: 1,
            },
          ],
          limits: {
            maxCost: 200.0, // Higher limits for production
            maxTokens: 1000000,
            maxTimeMs: 7200000,
            maxFilesModified: 200,
            dailyBudget: 500.0,
          },
          stageOverrides: {
            planning: 'full-auto',
            implementation: 'review-before-commit',
            testing: 'review-before-commit',
            deployment: 'review-all',
          },
          agentOverrides: {
            devops: 'review-all',
          },
        },
      };

      await saveConfig(testDir, prodConfig);

      const loadedProdConfig = await loadConfig(testDir);
      const effectiveProdConfig = getEffectiveConfig(loadedProdConfig);

      expect(effectiveProdConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveProdConfig.autonomy.gates).toHaveLength(3);
      expect(effectiveProdConfig.autonomy.limits!.maxCost).toBe(200.0);
      expect(effectiveProdConfig.autonomy.stageOverrides.deployment).toBe('review-all');
    });

    it('should handle team-specific autonomy configurations', async () => {
      const teamConfigurations = [
        {
          team: 'frontend',
          config: {
            level: 'review-before-commit' as const,
            stageOverrides: {
              'ui-testing': 'full-auto',
              'css-linting': 'full-auto',
            },
            agentOverrides: {
              'ui-developer': 'review-before-commit',
              'css-specialist': 'full-auto',
            },
          },
        },
        {
          team: 'backend',
          config: {
            level: 'review-before-commit' as const,
            gates: [
              {
                type: 'before-deploy' as const,
                name: 'API Security Review',
                required: true,
                minApprovals: 1,
              },
            ],
            stageOverrides: {
              'api-testing': 'full-auto',
              'database-migration': 'review-all',
            },
            agentOverrides: {
              'api-developer': 'review-before-commit',
              'database-specialist': 'review-all',
            },
          },
        },
        {
          team: 'devops',
          config: {
            level: 'review-all' as const,
            gates: [
              {
                type: 'before-deploy' as const,
                name: 'Infrastructure Review',
                required: true,
                minApprovals: 2,
              },
              {
                type: 'before-destructive' as const,
                name: 'Infrastructure Safety',
                required: true,
                minApprovals: 1,
              },
            ],
            limits: {
              maxFilesDeleted: 0, // No file deletions allowed
              maxFilesModified: 10, // Limited modifications
            },
          },
        },
      ];

      for (const { team, config: autonomyConfig } of teamConfigurations) {
        const teamConfig: ApexConfig = {
          version: '1.0',
          project: {
            name: `${team}-project`,
            testCommand: 'npm test',
            lintCommand: 'npm run lint',
            buildCommand: 'npm run build',
          },
          autonomy: autonomyConfig,
        };

        // Create team-specific directory
        const teamDir = path.join(testDir, team);
        await fs.mkdir(teamDir);
        await fs.mkdir(path.join(teamDir, '.apex'));

        await saveConfig(teamDir, teamConfig);

        const loadedConfig = await loadConfig(teamDir);
        const effectiveConfig = getEffectiveConfig(loadedConfig);

        expect(effectiveConfig.autonomy.level).toBe(autonomyConfig.level);

        if (autonomyConfig.gates) {
          expect(effectiveConfig.autonomy.gates.length).toBeGreaterThanOrEqual(autonomyConfig.gates.length);
        }

        if (autonomyConfig.stageOverrides) {
          for (const [stage, level] of Object.entries(autonomyConfig.stageOverrides)) {
            expect(effectiveConfig.autonomy.stageOverrides[stage]).toBe(level);
          }
        }

        if (autonomyConfig.agentOverrides) {
          for (const [agent, level] of Object.entries(autonomyConfig.agentOverrides)) {
            expect(effectiveConfig.autonomy.agentOverrides[agent]).toBe(level);
          }
        }

        if (autonomyConfig.limits) {
          for (const [key, value] of Object.entries(autonomyConfig.limits)) {
            expect(effectiveConfig.autonomy.limits![key as keyof typeof effectiveConfig.autonomy.limits]).toBe(value);
          }
        }
      }
    });
  });

  describe('Config migration and compatibility', () => {
    it('should handle manual YAML editing followed by loading', async () => {
      // Start with a saved config
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'manual-edit-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
        },
      };

      await saveConfig(testDir, initialConfig);

      // Manually edit the YAML file to add more complex configuration
      const manualConfigYaml = `
version: "1.0"
project:
  name: manual-edit-test
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  gates:
    - type: before-commit
      name: Manually Added Gate
      description: Added via manual YAML editing
      required: true
      approvers:
        - manual-reviewer@example.com
      minApprovals: 1
      timeout: 90
      tags:
        - manual
        - yaml-edit
    - type: custom
      name: Custom Integration Gate
      description: Custom gate for external systems
      required: false
      trigger: "external_system_check == true"
      approvers:
        - external-system@example.com
      minApprovals: 1
      timeout: 300
  limits:
    maxCost: 150.0
    maxTokens: 750000
    maxTimeMs: 5400000
    maxFilesCreated: 75
    maxFilesModified: 150
    maxFilesDeleted: 25
    maxLinesChanged: 7500
    maxTurns: 150
    dailyBudget: 400.0
    maxConcurrentTasks: 8
  stageOverrides:
    planning: full-auto
    architecture: review-before-commit
    implementation: review-before-commit
    testing: full-auto
    review: review-before-commit
    deployment: review-all
  agentOverrides:
    planner: full-auto
    architect: review-before-commit
    developer: review-before-commit
    tester: full-auto
    reviewer: review-before-commit
    devops: review-all
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), manualConfigYaml);

      // Load the manually edited config
      const manuallyEditedConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(manuallyEditedConfig);

      // Verify all manually added settings
      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.gates).toHaveLength(2);

      const commitGate = effectiveConfig.autonomy.gates.find(g => g.type === 'before-commit');
      expect(commitGate).toBeDefined();
      expect(commitGate!.name).toBe('Manually Added Gate');
      expect(commitGate!.approvers).toEqual(['manual-reviewer@example.com']);
      expect(commitGate!.tags).toEqual(['manual', 'yaml-edit']);

      const customGate = effectiveConfig.autonomy.gates.find(g => g.type === 'custom');
      expect(customGate).toBeDefined();
      expect(customGate!.trigger).toBe('external_system_check == true');

      expect(effectiveConfig.autonomy.limits!.maxCost).toBe(150.0);
      expect(effectiveConfig.autonomy.limits!.maxConcurrentTasks).toBe(8);

      expect(effectiveConfig.autonomy.stageOverrides.deployment).toBe('review-all');
      expect(effectiveConfig.autonomy.agentOverrides.devops).toBe('review-all');
    });

    it('should preserve config integrity across multiple save/load cycles', async () => {
      const complexConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'integrity-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-before-commit',
          gates: [
            {
              type: 'before-commit',
              name: 'Integrity Gate',
              description: 'Test config integrity preservation',
              required: true,
              approvers: ['approver1@test.com', 'approver2@test.com'],
              minApprovals: 2,
              timeout: 180,
              autoApproveOnTimeout: false,
              tags: ['integrity', 'test', 'preservation'],
            },
          ],
          limits: {
            maxCost: 250.5, // Decimal precision test
            maxTokens: 999999,
            maxTimeMs: 86400000, // Large number test
            maxFilesCreated: 0, // Zero value test
            maxTurns: 1, // Minimum value test
          },
          stageOverrides: {
            'planning': 'full-auto',
            'implementation': 'review-before-commit',
            'testing': 'full-auto',
            'deployment': 'review-all',
          },
          agentOverrides: {
            'planner': 'full-auto',
            'developer': 'review-before-commit',
            'tester': 'full-auto',
            'devops': 'review-all',
          },
        },
      };

      // Perform multiple save/load cycles
      for (let i = 0; i < 5; i++) {
        await saveConfig(testDir, complexConfig);
        const reloadedConfig = await loadConfig(testDir);
        const effectiveConfig = getEffectiveConfig(reloadedConfig);

        // Verify exact preservation of all values
        expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
        expect(effectiveConfig.autonomy.gates).toHaveLength(1);
        expect(effectiveConfig.autonomy.gates[0].name).toBe('Integrity Gate');
        expect(effectiveConfig.autonomy.gates[0].minApprovals).toBe(2);
        expect(effectiveConfig.autonomy.gates[0].autoApproveOnTimeout).toBe(false);
        expect(effectiveConfig.autonomy.gates[0].tags).toEqual(['integrity', 'test', 'preservation']);

        expect(effectiveConfig.autonomy.limits!.maxCost).toBe(250.5);
        expect(effectiveConfig.autonomy.limits!.maxFilesCreated).toBe(0);
        expect(effectiveConfig.autonomy.limits!.maxTurns).toBe(1);

        expect(effectiveConfig.autonomy.stageOverrides['planning']).toBe('full-auto');
        expect(effectiveConfig.autonomy.agentOverrides['devops']).toBe('review-all');

        // Update config for next iteration to test mutation
        complexConfig.autonomy!.limits!.maxCost = complexConfig.autonomy!.limits!.maxCost! + 0.1;
      }
    });
  });

  describe('Error recovery and resilience', () => {
    it('should recover from corrupted autonomy section by providing defaults', async () => {
      // Start with valid config
      const validConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'recovery-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'full-auto',
          limits: {
            maxCost: 50.0,
          },
        },
      };

      await saveConfig(testDir, validConfig);

      // Corrupt the autonomy section by writing invalid YAML
      const corruptedYaml = `
version: "1.0"
project:
  name: recovery-test
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  gates:
    - type: before-commit
      name: "Corrupted gate with invalid structure
      minApprovals: invalid-number
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), corruptedYaml);

      // Loading should fail
      await expect(loadConfig(testDir)).rejects.toThrow();

      // Restore from backup or reset to minimal config
      const recoveryConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'recovery-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        // No autonomy section - should get defaults
      };

      await saveConfig(testDir, recoveryConfig);
      const recoveredConfig = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(recoveredConfig);

      // Should have sensible defaults
      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.gates).toEqual([]);
      expect(effectiveConfig.autonomy.limits).toBeUndefined();
    });
  });
});