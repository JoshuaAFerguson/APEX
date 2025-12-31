/**
 * @fileoverview Acceptance criteria validation tests for ApexOrchestrator permission system
 *
 * This test suite directly validates the acceptance criteria:
 * 1. ApexOrchestrator initializes PermissionPresetManager and PermissionManager during initialize()
 * 2. Loads preset configuration from ApexConfig.permissions
 * 3. Exposes methods to get/set current preset
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';

describe('ApexOrchestrator Acceptance Criteria - Permission System', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-orchestrator-ac-test-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create basic config file
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
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('AC1: ApexOrchestrator initializes PermissionPresetManager and PermissionManager during initialize()', () => {
    it('should initialize permission managers without errors', async () => {
      // The initialize() method should complete without throwing
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });

    it('should have functional permission methods after initialization', async () => {
      await orchestrator.initialize();

      // Both permission manager methods should be available and functional
      await expect(orchestrator.getCurrentPreset()).resolves.toBeDefined();
      await expect(orchestrator.setPreset('read-only')).resolves.not.toThrow();
    });

    it('should initialize managers with correct dependencies', async () => {
      await orchestrator.initialize();

      // Methods should work, indicating managers were initialized with permission store
      const preset = await orchestrator.getCurrentPreset();
      expect(typeof preset).toBe('string');
      expect(['autonomous', 'review-all', 'read-only']).toContain(preset);
    });
  });

  describe('AC2: Loads preset configuration from ApexConfig.permissions', () => {
    it('should load preset configuration from ApexConfig.permissions.preset', async () => {
      await orchestrator.initialize();

      // Should load the 'autonomous' preset specified in config
      const loadedPreset = await orchestrator.getCurrentPreset();
      expect(loadedPreset).toBe('autonomous');
    });

    it('should load different preset values from config', async () => {
      // Test with different preset in config
      const configWithReadOnly = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: read-only
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

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithReadOnly);

      // Create fresh orchestrator with updated config
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      const loadedPreset = await orchestrator.getCurrentPreset();
      expect(loadedPreset).toBe('read-only');
    });

    it('should use default preset when not specified in config', async () => {
      // Config without explicit permissions preset
      const configWithoutPreset = `
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

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithoutPreset);

      // Create fresh orchestrator with updated config
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      const loadedPreset = await orchestrator.getCurrentPreset();
      expect(loadedPreset).toBe('review-all'); // Schema default
    });
  });

  describe('AC3: Exposes methods to get/set current preset', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should expose getCurrentPreset method that returns current preset', async () => {
      const currentPreset = await orchestrator.getCurrentPreset();

      // Should return a valid preset string
      expect(typeof currentPreset).toBe('string');
      expect(['autonomous', 'review-all', 'read-only']).toContain(currentPreset);
    });

    it('should expose setPreset method that updates current preset', async () => {
      // Get initial preset
      const initialPreset = await orchestrator.getCurrentPreset();
      expect(initialPreset).toBe('autonomous');

      // Change preset
      await orchestrator.setPreset('read-only');

      // Verify preset was updated
      const updatedPreset = await orchestrator.getCurrentPreset();
      expect(updatedPreset).toBe('read-only');
    });

    it('should allow setting all valid preset values', async () => {
      const validPresets = ['autonomous', 'review-all', 'read-only'] as const;

      for (const preset of validPresets) {
        await orchestrator.setPreset(preset);
        const currentPreset = await orchestrator.getCurrentPreset();
        expect(currentPreset).toBe(preset);
      }
    });

    it('should maintain preset changes across multiple get/set operations', async () => {
      // Set to review-all
      await orchestrator.setPreset('review-all');
      expect(await orchestrator.getCurrentPreset()).toBe('review-all');

      // Set to autonomous
      await orchestrator.setPreset('autonomous');
      expect(await orchestrator.getCurrentPreset()).toBe('autonomous');

      // Set to read-only
      await orchestrator.setPreset('read-only');
      expect(await orchestrator.getCurrentPreset()).toBe('read-only');

      // Final verification
      const finalPreset = await orchestrator.getCurrentPreset();
      expect(finalPreset).toBe('read-only');
    });
  });

  describe('Integration Validation', () => {
    it('should satisfy all acceptance criteria together', async () => {
      // AC1: Initialize without errors
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // AC2: Load preset from config (autonomous was set in config)
      const configPreset = await orchestrator.getCurrentPreset();
      expect(configPreset).toBe('autonomous');

      // AC3: Use exposed methods to change preset
      await orchestrator.setPreset('review-all');
      const changedPreset = await orchestrator.getCurrentPreset();
      expect(changedPreset).toBe('review-all');

      // Verify system remains functional
      await orchestrator.setPreset('read-only');
      const finalPreset = await orchestrator.getCurrentPreset();
      expect(finalPreset).toBe('read-only');
    });
  });
});