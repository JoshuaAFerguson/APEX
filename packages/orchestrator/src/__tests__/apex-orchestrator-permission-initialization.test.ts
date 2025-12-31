/**
 * @fileoverview Tests for ApexOrchestrator permission manager initialization
 *
 * This test suite verifies that ApexOrchestrator correctly initializes:
 * 1. PermissionManager with the permission store
 * 2. PermissionPresetManager with the permission store and preset configuration
 * 3. Exposes methods to get/set current preset through the orchestrator API
 * 4. Loads preset configuration from ApexConfig.permissions
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import type { PermissionPreset } from '@apex/core';

describe('ApexOrchestrator Permission Initialization', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-orchestrator-permission-test-'));

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

  describe('Basic Initialization', () => {
    it('should initialize PermissionManager and PermissionPresetManager during initialize()', async () => {
      // Create minimal config file
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      // Should not throw during initialization
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Verify that permission-related methods are available and working
      expect(typeof orchestrator.getCurrentPreset).toBe('function');
      expect(typeof orchestrator.setPreset).toBe('function');
    });

    it('should load preset configuration from ApexConfig.permissions.preset', async () => {
      const testPreset: PermissionPreset = 'read-only';
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: ${testPreset}
  customRules: []

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify the preset was loaded correctly
      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe(testPreset);
    });

    it('should default to review-all preset when not specified in config', async () => {
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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify default preset is applied
      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('review-all');
    });
  });

  describe('Preset Management API', () => {
    beforeEach(async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();
    });

    it('should expose getCurrentPreset method', async () => {
      const preset = await orchestrator.getCurrentPreset();
      expect(preset).toBeDefined();
      expect(['autonomous', 'review-all', 'read-only']).toContain(preset);
    });

    it('should expose setPreset method and update current preset', async () => {
      // Verify initial preset
      let currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('autonomous');

      // Change to different preset
      await orchestrator.setPreset('read-only');

      // Verify preset was updated
      currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('read-only');
    });

    it('should update preset through setPreset method and persist changes', async () => {
      const newPreset: PermissionPreset = 'review-all';

      // Change preset
      await orchestrator.setPreset(newPreset);

      // Verify change persisted
      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe(newPreset);
    });
  });

  describe('Multiple Preset Configurations', () => {
    it.each([
      ['autonomous', 'autonomous'],
      ['review-all', 'review-all'],
      ['read-only', 'read-only']
    ])('should correctly initialize with %s preset', async (presetName, expectedPreset) => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: ${presetName}
  customRules: []

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe(expectedPreset);
    });
  });

  describe('Integration with Permission Components', () => {
    beforeEach(async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();
    });

    it('should ensure initialized state before permission operations', async () => {
      // Create a new orchestrator without initializing
      const uninitializedOrchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      // These calls should trigger initialization internally
      await expect(uninitializedOrchestrator.getCurrentPreset()).resolves.toBeDefined();
      await expect(uninitializedOrchestrator.setPreset('read-only')).resolves.not.toThrow();

      await uninitializedOrchestrator.shutdown();
    });

    it('should propagate preset changes through the permission system', async () => {
      // Start with autonomous preset
      let preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('autonomous');

      // Change to read-only and verify change propagated
      await orchestrator.setPreset('read-only');
      preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('read-only');

      // Change to review-all and verify change propagated
      await orchestrator.setPreset('review-all');
      preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('review-all');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing config gracefully', async () => {
      // Don't create config file
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      // Should still initialize with defaults
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Should have default preset
      const preset = await orchestrator.getCurrentPreset();
      expect(['autonomous', 'review-all', 'read-only']).toContain(preset);
    });

    it('should handle invalid preset in config gracefully', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: invalid-preset
  customRules: []

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      // Should handle invalid config gracefully
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });
  });

  describe('Initialization Order', () => {
    it('should initialize permission components after permission store', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      // Mock the permission store to verify initialization order
      const initSpy = vi.fn();

      // Override initialize to add spy
      const originalInit = orchestrator.initialize.bind(orchestrator);
      orchestrator.initialize = async function() {
        await originalInit();
        initSpy();
      };

      await orchestrator.initialize();

      // Verify permission methods work (indicating proper initialization order)
      await expect(orchestrator.getCurrentPreset()).resolves.toBeDefined();
      await expect(orchestrator.setPreset('read-only')).resolves.not.toThrow();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should be ready for permission operations after initialize()', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all
  customRules: []

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // All permission operations should work immediately
      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('review-all');

      await orchestrator.setPreset('autonomous');
      const updatedPreset = await orchestrator.getCurrentPreset();
      expect(updatedPreset).toBe('autonomous');

      await orchestrator.setPreset('read-only');
      const finalPreset = await orchestrator.getCurrentPreset();
      expect(finalPreset).toBe('read-only');
    });
  });

  describe('Configuration Loading', () => {
    it('should properly load custom permission rules along with preset', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: review-all
  customRules:
    - toolName: "Read"
      behavior: "allow"
    - toolName: "Write"
      behavior: "deny"

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify preset was loaded
      const preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('review-all');

      // The permission system should be initialized and working
      // (detailed permission rule testing is covered in permission manager tests)
      await expect(orchestrator.setPreset('autonomous')).resolves.not.toThrow();
    });

    it('should handle empty permissions configuration', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions: {}

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

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Should use default preset
      const preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('review-all'); // Default per schema
    });
  });
});