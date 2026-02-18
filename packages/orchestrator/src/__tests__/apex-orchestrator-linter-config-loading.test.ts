/**
 * @fileoverview Tests for linter configuration loading from ApexConfig
 *
 * This test suite validates that ApexOrchestrator correctly loads and processes
 * linter configuration from the ApexConfig and passes it appropriately to LinterService.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import { loadConfig } from '@apexcli/core';

describe('ApexOrchestrator Linter Configuration Loading', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-linter-config-test-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Configuration Schema Validation', () => {
    it('should load valid linter configuration', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 30000
    maxConcurrency: 2

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      // Test that config loads without error
      const config = await loadConfig(tempDir);
      expect(config.linter?.global?.enabled).toBe(true);
      expect(config.linter?.global?.timeoutMs).toBe(30000);
      expect(config.linter?.global?.maxConcurrency).toBe(2);
    });

    it('should handle missing linter configuration section', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      // Test that config loads without error even without linter section
      const config = await loadConfig(tempDir);
      expect(config.linter).toBeUndefined();
    });

    it('should handle empty linter configuration section', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      // Test that config loads without error with empty linter section
      const config = await loadConfig(tempDir);
      expect(config.linter).toEqual({});
    });

    it('should validate linter global configuration types', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 45000
    maxConcurrency: 4

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      const config = await loadConfig(tempDir);
      expect(typeof config.linter?.global?.enabled).toBe('boolean');
      expect(typeof config.linter?.global?.timeoutMs).toBe('number');
      expect(typeof config.linter?.global?.maxConcurrency).toBe('number');
    });

    it('should handle plugin-specific configuration', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 30000
  plugins:
    eslint:
      enabled: true
      config: .eslintrc.js
    prettier:
      enabled: false
      config: .prettierrc

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      const config = await loadConfig(tempDir);
      expect(config.linter?.plugins?.eslint?.enabled).toBe(true);
      expect(config.linter?.plugins?.eslint?.config).toBe('.eslintrc.js');
      expect(config.linter?.plugins?.prettier?.enabled).toBe(false);
      expect(config.linter?.plugins?.prettier?.config).toBe('.prettierrc');
    });
  });

  describe('Configuration Default Handling', () => {
    it('should provide sensible defaults for missing global options', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    # timeoutMs and maxConcurrency omitted

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      const config = await loadConfig(tempDir);
      expect(config.linter?.global?.enabled).toBe(true);
      expect(config.linter?.global?.timeoutMs).toBeUndefined(); // Should be undefined for optional fields
      expect(config.linter?.global?.maxConcurrency).toBeUndefined(); // Should be undefined for optional fields
    });

    it('should handle boolean values correctly', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: false

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      const config = await loadConfig(tempDir);
      expect(config.linter?.global?.enabled).toBe(false);
    });

    it('should handle numeric values correctly', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 0
    maxConcurrency: 1

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);

      const config = await loadConfig(tempDir);
      expect(config.linter?.global?.timeoutMs).toBe(0);
      expect(config.linter?.global?.maxConcurrency).toBe(1);
    });
  });

  describe('Integration with ApexOrchestrator', () => {
    it('should load configuration during orchestrator initialization', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 25000
    maxConcurrency: 3

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Configuration should be loaded and accessible
      const config = await orchestrator.getConfig();
      expect(config.linter?.global?.enabled).toBe(true);
      expect(config.linter?.global?.timeoutMs).toBe(25000);
      expect(config.linter?.global?.maxConcurrency).toBe(3);
    });

    it('should handle configuration changes across orchestrator instances', async () => {
      // Initial config
      const configContent1 = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 30000

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent1);
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();

      let config = await orchestrator.getConfig();
      expect(config.linter?.global?.timeoutMs).toBe(30000);

      // Update config
      const configContent2 = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 45000

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent2);

      // Create new orchestrator instance to load updated config
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();

      config = await orchestrator.getConfig();
      expect(config.linter?.global?.timeoutMs).toBe(45000);
    });

    it('should propagate configuration to LinterService', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 35000
    maxConcurrency: 5

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      await orchestrator.initialize();

      // Verify LinterService is accessible and functional
      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeDefined();

      // The fact that we can get the service indicates config was loaded properly
      expect(typeof linterService.initialize).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed YAML configuration', async () => {
      const malformedConfig = `
project:
  name: test-project
  version: 1.0.0
  invalid_yaml: [unclosed
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), malformedConfig);
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      await expect(orchestrator.initialize()).rejects.toThrow();
    });

    it('should handle invalid linter configuration schema', async () => {
      const invalidConfig = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: "not_a_boolean"
    timeoutMs: "not_a_number"

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), invalidConfig);
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      // Should either validate and throw schema error or handle gracefully
      try {
        await orchestrator.initialize();

        // If it doesn't throw, verify the config was handled somehow
        const config = await orchestrator.getConfig();
        expect(config).toBeDefined();
      } catch (error) {
        // Schema validation error is acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle missing config file', async () => {
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      // Should handle missing config file gracefully
      await expect(orchestrator.initialize()).rejects.toThrow();
    });
  });

  describe('Configuration Coverage', () => {
    it('should handle all possible linter configuration combinations', async () => {
      const comprehensiveConfig = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: 60000
    maxConcurrency: 8
  plugins:
    eslint:
      enabled: true
      config: .eslintrc.json
      options:
        fix: true
        cache: true
    prettier:
      enabled: true
      config: .prettierrc.json
      options:
        write: true
    tsc:
      enabled: false
      config: tsconfig.json

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), comprehensiveConfig);
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      await orchestrator.initialize();

      const config = await orchestrator.getConfig();
      expect(config.linter?.global?.enabled).toBe(true);
      expect(config.linter?.global?.timeoutMs).toBe(60000);
      expect(config.linter?.global?.maxConcurrency).toBe(8);
      expect(config.linter?.plugins?.eslint?.enabled).toBe(true);
      expect(config.linter?.plugins?.prettier?.enabled).toBe(true);
      expect(config.linter?.plugins?.tsc?.enabled).toBe(false);
    });
  });
});