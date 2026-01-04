/**
 * Autonomy Enforcement Configuration Tests
 *
 * Tests for autonomy enforcement configuration options including rejectionBehavior,
 * approvalTimeout, and per-agent override settings to validate acceptance criteria.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, getEffectiveConfig } from '../config';
import { AutonomyConfigSchema, RejectionBehaviorSchema, AgentAutonomyOverrideSchema } from '../types';

describe('Autonomy Enforcement Configuration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autonomy-enforcement-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Rejection Behavior Configuration', () => {
    it('should accept valid rejectionBehavior values', async () => {
      const validValues = ['skip', 'abort'];

      for (const rejectionBehavior of validValues) {
        const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  rejectionBehavior: ${rejectionBehavior}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
        const config = await loadConfig(testDir);

        expect(config.autonomy).toBeDefined();
        expect(config.autonomy!.rejectionBehavior).toBe(rejectionBehavior);
      }
    });

    it('should default rejectionBehavior to abort when not specified', async () => {
      const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
      const config = await loadConfig(testDir);

      expect(config.autonomy).toBeDefined();
      expect(config.autonomy!.rejectionBehavior).toBe('abort');
    });

    it('should reject invalid rejectionBehavior values', async () => {
      const invalidValues = ['pause', 'retry', 'ignore', 'continue', ''];

      for (const rejectionBehavior of invalidValues) {
        const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  rejectionBehavior: ${rejectionBehavior}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });
  });

  describe('Approval Timeout Configuration', () => {
    it('should accept valid approvalTimeout values', async () => {
      const validTimeouts = [1, 5, 30, 60, 120, 1440]; // minutes

      for (const approvalTimeout of validTimeouts) {
        const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  approvalTimeout: ${approvalTimeout}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
        const config = await loadConfig(testDir);

        expect(config.autonomy).toBeDefined();
        expect(config.autonomy!.approvalTimeout).toBe(approvalTimeout);
      }
    });

    it('should allow approvalTimeout to be undefined', async () => {
      const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
      const config = await loadConfig(testDir);

      expect(config.autonomy).toBeDefined();
      expect(config.autonomy!.approvalTimeout).toBeUndefined();
    });

    it('should reject invalid approvalTimeout values', async () => {
      const invalidTimeouts = [0, -1, -30, 'auto', '30', null];

      for (const approvalTimeout of invalidTimeouts) {
        const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  approvalTimeout: ${JSON.stringify(approvalTimeout)}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });
  });

  describe('Per-Agent Override Settings', () => {
    it('should support simple agent override with autonomy level', async () => {
      const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  agentOverrides:
    developer: supervised
    tester: full-auto
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
      const config = await loadConfig(testDir);

      expect(config.autonomy).toBeDefined();
      expect(config.autonomy!.agentOverrides).toBeDefined();
      expect(config.autonomy!.agentOverrides!.developer).toBe('supervised');
      expect(config.autonomy!.agentOverrides!.tester).toBe('full-auto');
    });

    it('should support complex agent overrides with full configuration', async () => {
      const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  rejectionBehavior: abort
  approvalTimeout: 30
  agentOverrides:
    developer:
      level: supervised
      rejectionBehavior: skip
      approvalTimeout: 60
    tester:
      level: full-auto
      approvalTimeout: 15
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
      const config = await loadConfig(testDir);

      expect(config.autonomy).toBeDefined();
      expect(config.autonomy!.agentOverrides).toBeDefined();

      const developerOverride = config.autonomy!.agentOverrides!.developer;
      expect(typeof developerOverride).toBe('object');
      if (typeof developerOverride === 'object') {
        expect(developerOverride.level).toBe('supervised');
        expect(developerOverride.rejectionBehavior).toBe('skip');
        expect(developerOverride.approvalTimeout).toBe(60);
      }

      const testerOverride = config.autonomy!.agentOverrides!.tester;
      expect(typeof testerOverride).toBe('object');
      if (typeof testerOverride === 'object') {
        expect(testerOverride.level).toBe('full-auto');
        expect(testerOverride.approvalTimeout).toBe(15);
        expect(testerOverride.rejectionBehavior).toBeUndefined();
      }
    });

    it('should support mixed simple and complex agent overrides', async () => {
      const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  agentOverrides:
    developer: supervised
    tester:
      level: full-auto
      rejectionBehavior: skip
    reviewer:
      approvalTimeout: 90
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
      const config = await loadConfig(testDir);

      expect(config.autonomy).toBeDefined();
      expect(config.autonomy!.agentOverrides).toBeDefined();

      // Simple override
      expect(config.autonomy!.agentOverrides!.developer).toBe('supervised');

      // Complex override with level and rejectionBehavior
      const testerOverride = config.autonomy!.agentOverrides!.tester;
      expect(typeof testerOverride).toBe('object');
      if (typeof testerOverride === 'object') {
        expect(testerOverride.level).toBe('full-auto');
        expect(testerOverride.rejectionBehavior).toBe('skip');
      }

      // Complex override with only approvalTimeout
      const reviewerOverride = config.autonomy!.agentOverrides!.reviewer;
      expect(typeof reviewerOverride).toBe('object');
      if (typeof reviewerOverride === 'object') {
        expect(reviewerOverride.approvalTimeout).toBe(90);
        expect(reviewerOverride.level).toBeUndefined();
        expect(reviewerOverride.rejectionBehavior).toBeUndefined();
      }
    });

    it('should reject invalid agent override configurations', async () => {
      const invalidConfigs = [
        // Invalid autonomy level in simple override
        `
autonomy:
  level: review-before-commit
  agentOverrides:
    developer: invalid-level
`,
        // Invalid autonomy level in complex override
        `
autonomy:
  level: review-before-commit
  agentOverrides:
    developer:
      level: bad-level
`,
        // Invalid rejectionBehavior in complex override
        `
autonomy:
  level: review-before-commit
  agentOverrides:
    developer:
      rejectionBehavior: invalid-behavior
`,
        // Invalid approvalTimeout in complex override
        `
autonomy:
  level: review-before-commit
  agentOverrides:
    developer:
      approvalTimeout: -5
`,
      ];

      for (const invalidConfig of invalidConfigs) {
        const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
${invalidConfig}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });
  });

  describe('Complete Autonomy Enforcement Configuration', () => {
    it('should support comprehensive autonomy enforcement configuration', async () => {
      const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  rejectionBehavior: skip
  approvalTimeout: 45
  gates:
    - type: before-commit
      name: Code Review Gate
      required: true
      timeout: 60
  limits:
    maxCost: 25.0
    maxTokens: 100000
    maxTurns: 50
  stageOverrides:
    planning: supervised
    implementation: review-before-commit
  agentOverrides:
    planner:
      level: full-auto
      rejectionBehavior: abort
    developer:
      level: supervised
      approvalTimeout: 120
      rejectionBehavior: skip
    tester: review-all
    reviewer:
      approvalTimeout: 30
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
      const config = await loadConfig(testDir);

      expect(config.autonomy).toBeDefined();
      expect(config.autonomy!.level).toBe('review-before-commit');
      expect(config.autonomy!.rejectionBehavior).toBe('skip');
      expect(config.autonomy!.approvalTimeout).toBe(45);

      // Verify gates
      expect(config.autonomy!.gates).toBeDefined();
      expect(config.autonomy!.gates!.length).toBe(1);
      expect(config.autonomy!.gates![0].name).toBe('Code Review Gate');

      // Verify limits
      expect(config.autonomy!.limits).toBeDefined();
      expect(config.autonomy!.limits!.maxCost).toBe(25.0);

      // Verify stage overrides
      expect(config.autonomy!.stageOverrides).toBeDefined();
      expect(config.autonomy!.stageOverrides!.planning).toBe('supervised');
      expect(config.autonomy!.stageOverrides!.implementation).toBe('review-before-commit');

      // Verify agent overrides
      expect(config.autonomy!.agentOverrides).toBeDefined();

      const plannerOverride = config.autonomy!.agentOverrides!.planner;
      expect(typeof plannerOverride).toBe('object');
      if (typeof plannerOverride === 'object') {
        expect(plannerOverride.level).toBe('full-auto');
        expect(plannerOverride.rejectionBehavior).toBe('abort');
      }

      const developerOverride = config.autonomy!.agentOverrides!.developer;
      expect(typeof developerOverride).toBe('object');
      if (typeof developerOverride === 'object') {
        expect(developerOverride.level).toBe('supervised');
        expect(developerOverride.approvalTimeout).toBe(120);
        expect(developerOverride.rejectionBehavior).toBe('skip');
      }

      // Simple override
      expect(config.autonomy!.agentOverrides!.tester).toBe('review-all');

      const reviewerOverride = config.autonomy!.agentOverrides!.reviewer;
      expect(typeof reviewerOverride).toBe('object');
      if (typeof reviewerOverride === 'object') {
        expect(reviewerOverride.approvalTimeout).toBe(30);
        expect(reviewerOverride.level).toBeUndefined();
        expect(reviewerOverride.rejectionBehavior).toBeUndefined();
      }
    });

    it('should work correctly with getEffectiveConfig', async () => {
      const configYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  rejectionBehavior: skip
  approvalTimeout: 30
  agentOverrides:
    developer:
      level: supervised
      rejectionBehavior: abort
      approvalTimeout: 60
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), configYaml);
      const config = await loadConfig(testDir);
      const effectiveConfig = getEffectiveConfig(config);

      expect(effectiveConfig.autonomy).toBeDefined();
      expect(effectiveConfig.autonomy.level).toBe('review-before-commit');
      expect(effectiveConfig.autonomy.rejectionBehavior).toBe('skip');
      expect(effectiveConfig.autonomy.approvalTimeout).toBe(30);

      expect(effectiveConfig.autonomy.agentOverrides).toBeDefined();
      const developerOverride = effectiveConfig.autonomy.agentOverrides!.developer;
      expect(typeof developerOverride).toBe('object');
      if (typeof developerOverride === 'object') {
        expect(developerOverride.level).toBe('supervised');
        expect(developerOverride.rejectionBehavior).toBe('abort');
        expect(developerOverride.approvalTimeout).toBe(60);
      }
    });
  });

  describe('Schema Validation', () => {
    it('should validate RejectionBehaviorSchema directly', () => {
      expect(() => RejectionBehaviorSchema.parse('skip')).not.toThrow();
      expect(() => RejectionBehaviorSchema.parse('abort')).not.toThrow();
      expect(() => RejectionBehaviorSchema.parse('invalid')).toThrow();
    });

    it('should validate AgentAutonomyOverrideSchema directly', () => {
      const validOverride = {
        level: 'supervised',
        rejectionBehavior: 'skip',
        approvalTimeout: 30,
      };

      expect(() => AgentAutonomyOverrideSchema.parse(validOverride)).not.toThrow();

      const invalidOverride = {
        level: 'invalid-level',
        rejectionBehavior: 'skip',
        approvalTimeout: 30,
      };

      expect(() => AgentAutonomyOverrideSchema.parse(invalidOverride)).toThrow();
    });

    it('should validate AutonomyConfigSchema with enforcement options', () => {
      const validConfig = {
        level: 'review-before-commit',
        rejectionBehavior: 'skip',
        approvalTimeout: 30,
        agentOverrides: {
          developer: {
            level: 'supervised',
            rejectionBehavior: 'abort',
            approvalTimeout: 60,
          },
        },
      };

      expect(() => AutonomyConfigSchema.parse(validConfig)).not.toThrow();

      const parsedConfig = AutonomyConfigSchema.parse(validConfig);
      expect(parsedConfig.rejectionBehavior).toBe('skip');
      expect(parsedConfig.approvalTimeout).toBe(30);

      const developerOverride = parsedConfig.agentOverrides!.developer;
      expect(typeof developerOverride).toBe('object');
      if (typeof developerOverride === 'object') {
        expect(developerOverride.rejectionBehavior).toBe('abort');
        expect(developerOverride.approvalTimeout).toBe(60);
      }
    });
  });
});