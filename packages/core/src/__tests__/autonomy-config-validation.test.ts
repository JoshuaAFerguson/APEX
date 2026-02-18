/**
 * Autonomy Configuration Validation Tests
 *
 * Tests for validation error scenarios and edge cases when loading
 * autonomy configurations from YAML files.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from '../config';

describe('Autonomy Configuration Validation', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-autonomy-validation-test-'));
    await fs.mkdir(path.join(testDir, '.apex'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Autonomy level validation errors', () => {
    it('should reject unknown autonomy level', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: unknown-level
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject empty autonomy level', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: ""
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject autonomy level as number', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: 123
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject case-sensitive level variations', async () => {
      const testCases = [
        'Full-Auto',
        'FULL-AUTO',
        'Review-Before-Commit',
        'REVIEW-BEFORE-COMMIT',
        'Review-All',
        'REVIEW-ALL',
      ];

      for (const level of testCases) {
        const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: ${level}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });
  });

  describe('Approval gate validation errors', () => {
    it('should reject gates with invalid checkpoint types', async () => {
      const invalidGateTypes = [
        'before-test',
        'after-commit',
        'during-deploy',
        'pre-commit', // similar but wrong
        'post-deploy', // similar but wrong
      ];

      for (const gateType of invalidGateTypes) {
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
    - type: ${gateType}
      name: Invalid Gate
      required: true
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });

    it('should reject gates with missing required type field', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  gates:
    - name: Gate Without Type
      required: true
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject gates with invalid required field type', async () => {
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
    - type: before-commit
      name: Gate With Invalid Required
      required: "yes"  # Should be boolean
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject gates with invalid minApprovals values', async () => {
      const invalidMinApprovals = [-1, 0, "2", null];

      for (const minApprovals of invalidMinApprovals) {
        const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  gates:
    - type: before-commit
      name: Gate With Invalid MinApprovals
      minApprovals: ${JSON.stringify(minApprovals)}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });

    it('should reject gates with invalid timeout values', async () => {
      const invalidTimeouts = [-1, 0, "60", null];

      for (const timeout of invalidTimeouts) {
        const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  gates:
    - type: before-deploy
      name: Gate With Invalid Timeout
      timeout: ${JSON.stringify(timeout)}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });

    it('should reject gates with non-array approvers', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-all
  gates:
    - type: before-commit
      name: Gate With Invalid Approvers
      approvers: "single-approver"  # Should be array
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject gates with non-array tags', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  gates:
    - type: before-commit
      name: Gate With Invalid Tags
      tags: "single-tag"  # Should be array
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('Resource limits validation errors', () => {
    it('should reject negative cost limits', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  limits:
    maxCost: -10.0
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject negative token limits', async () => {
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
    maxTokens: -50000
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject zero or negative maxTurns', async () => {
      const invalidValues = [0, -1, -10];

      for (const maxTurns of invalidValues) {
        const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  limits:
    maxTurns: ${maxTurns}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });

    it('should reject negative file operation limits', async () => {
      const limitFields = [
        'maxFilesCreated',
        'maxFilesModified',
        'maxFilesDeleted',
        'maxLinesChanged',
      ];

      for (const field of limitFields) {
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
    ${field}: -5
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });

    it('should reject zero or negative maxConcurrentTasks', async () => {
      const invalidValues = [0, -1, -5];

      for (const value of invalidValues) {
        const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  limits:
    maxConcurrentTasks: ${value}
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });

    it('should reject string values for numeric limits', async () => {
      const numericFields = [
        'maxCost',
        'dailyBudget',
        'maxTokens',
        'maxTurns',
        'maxTimeMs',
        'maxFilesCreated',
        'maxFilesModified',
        'maxFilesDeleted',
        'maxLinesChanged',
        'maxConcurrentTasks',
      ];

      for (const field of numericFields) {
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
    ${field}: "100"  # Should be number, not string
`;

        await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
        await expect(loadConfig(testDir)).rejects.toThrow();
      }
    });
  });

  describe('Override validation errors', () => {
    it('should reject invalid autonomy levels in stage overrides', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  stageOverrides:
    planning: invalid-level
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject invalid autonomy levels in agent overrides', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  agentOverrides:
    developer: bad-level
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject non-object stage overrides', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  stageOverrides: "invalid-string"
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject non-object agent overrides', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-all
  agentOverrides: ["developer", "tester"]  # Should be object, not array
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('Complex validation scenarios', () => {
    it('should reject autonomy configuration with invalid structure', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  - level: full-auto  # Should be object, not array
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should reject deeply nested invalid values', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  gates:
    - type: before-commit
      name: Valid Gate
      required: true
    - type: invalid-type  # Invalid nested value
      name: Invalid Gate
      required: true
  limits:
    maxCost: 50.0
    maxTokens: -1000  # Invalid nested value
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should provide meaningful error messages for validation failures', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: unknown-autonomy-level
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);

      try {
        await loadConfig(testDir);
        fail('Expected loadConfig to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toBeDefined();
        expect(errorMessage.length).toBeGreaterThan(0);
      }
    });

    it('should validate all fields in complex configurations', async () => {
      const invalidConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  gates:
    - type: before-commit
      name: Gate 1
      required: "yes"  # Should be boolean
      minApprovals: 0  # Should be >= 1
      timeout: -5      # Should be >= 1
    - type: invalid-type  # Invalid type
      name: Gate 2
  limits:
    maxCost: -10.0      # Should be >= 0
    maxTokens: "100k"   # Should be number
    maxTurns: 0         # Should be >= 1
  stageOverrides:
    planning: bad-level  # Invalid level
  agentOverrides:
    developer: another-bad-level  # Invalid level
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), invalidConfigYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });
  });

  describe('YAML parsing edge cases', () => {
    it('should handle malformed YAML in autonomy section', async () => {
      const malformedYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: full-auto
  gates:
    - type: before-commit
      name: "Unterminated string
      required: true
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), malformedYaml);
      await expect(loadConfig(testDir)).rejects.toThrow();
    });

    it('should handle null values in autonomy configuration', async () => {
      const nullConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy: null
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), nullConfigYaml);

      // This should not throw - null autonomy section should be treated as undefined
      const config = await loadConfig(testDir);
      expect(config.autonomy).toBeNull();
    });

    it('should handle undefined/missing autonomy properties gracefully', async () => {
      const sparseConfigYaml = `
version: "1.0"
project:
  name: test-project
  testCommand: npm test
  lintCommand: npm run lint
  buildCommand: npm run build
autonomy:
  level: review-before-commit
  # gates, limits, overrides not specified
`;

      await fs.writeFile(path.join(testDir, '.apex', 'config.yaml'), sparseConfigYaml);

      // This should load successfully
      const config = await loadConfig(testDir);
      expect(config.autonomy).toBeDefined();
      expect(config.autonomy!.level).toBe('review-before-commit');
      expect(config.autonomy!.gates).toBeUndefined();
      expect(config.autonomy!.limits).toBeUndefined();
      expect(config.autonomy!.stageOverrides).toBeUndefined();
      expect(config.autonomy!.agentOverrides).toBeUndefined();
    });
  });
});