/**
 * @fileoverview Integration tests for ApexOrchestrator permission system integration
 *
 * This test suite verifies that the permission system components work together correctly
 * when integrated through the ApexOrchestrator:
 * 1. Permission preset changes propagate correctly through the system
 * 2. PermissionManager and PermissionPresetManager work together seamlessly
 * 3. Configuration changes are reflected in permission behavior
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import type { PermissionPreset } from '@apex/core';

describe('ApexOrchestrator Permission Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-orchestrator-permission-integration-test-'));

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

  async function createConfigWithPreset(preset: PermissionPreset) {
    const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: ${preset}
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
  }

  describe('Preset Configuration Integration', () => {
    it('should correctly apply autonomous preset configuration', async () => {
      await createConfigWithPreset('autonomous');

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('autonomous');
    });

    it('should correctly apply review-all preset configuration', async () => {
      await createConfigWithPreset('review-all');

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('review-all');
    });

    it('should correctly apply read-only preset configuration', async () => {
      await createConfigWithPreset('read-only');

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('read-only');
    });
  });

  describe('Runtime Preset Changes', () => {
    beforeEach(async () => {
      await createConfigWithPreset('autonomous');

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();
    });

    it('should allow changing preset at runtime', async () => {
      // Verify initial preset
      let currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('autonomous');

      // Change preset
      await orchestrator.setPreset('read-only');
      currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('read-only');

      // Change to another preset
      await orchestrator.setPreset('review-all');
      currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('review-all');
    });

    it('should maintain preset changes across multiple operations', async () => {
      // Change preset multiple times
      await orchestrator.setPreset('read-only');
      let preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('read-only');

      await orchestrator.setPreset('review-all');
      preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('review-all');

      await orchestrator.setPreset('autonomous');
      preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('autonomous');

      // Final verification
      preset = await orchestrator.getCurrentPreset();
      expect(preset).toBe('autonomous');
    });
  });

  describe('Permission System State Consistency', () => {
    beforeEach(async () => {
      await createConfigWithPreset('review-all');

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();
    });

    it('should maintain consistent state between managers', async () => {
      // Initial state check
      const initialPreset = await orchestrator.getCurrentPreset();
      expect(initialPreset).toBe('review-all');

      // Apply several preset changes
      const presetSequence: PermissionPreset[] = ['autonomous', 'read-only', 'review-all', 'autonomous'];

      for (const preset of presetSequence) {
        await orchestrator.setPreset(preset);
        const currentPreset = await orchestrator.getCurrentPreset();
        expect(currentPreset).toBe(preset);
      }
    });

    it('should handle rapid preset changes correctly', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'read-only', 'review-all'];

      // Rapid preset changes
      for (let i = 0; i < 10; i++) {
        const preset = presets[i % presets.length];
        await orchestrator.setPreset(preset);
        const current = await orchestrator.getCurrentPreset();
        expect(current).toBe(preset);
      }
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle preset initialization with custom rules', async () => {
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

      // Should correctly load the base preset
      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('review-all');

      // Should still allow preset changes
      await orchestrator.setPreset('autonomous');
      const newPreset = await orchestrator.getCurrentPreset();
      expect(newPreset).toBe('autonomous');
    });

    it('should handle initialization without explicit permissions config', async () => {
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

      // Should use default preset
      const currentPreset = await orchestrator.getCurrentPreset();
      expect(currentPreset).toBe('review-all'); // Default from schema

      // Should still allow preset operations
      await orchestrator.setPreset('autonomous');
      const newPreset = await orchestrator.getCurrentPreset();
      expect(newPreset).toBe('autonomous');
    });
  });

  describe('Multiple Orchestrator Instances', () => {
    it('should handle multiple orchestrator instances with same project', async () => {
      await createConfigWithPreset('autonomous');

      // Create first orchestrator
      const orchestrator1 = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator1.initialize();

      // Create second orchestrator (different port)
      const orchestrator2 = new ApexOrchestrator(tempDir, 'localhost:8081');
      await orchestrator2.initialize();

      try {
        // Both should read the same initial config
        const preset1 = await orchestrator1.getCurrentPreset();
        const preset2 = await orchestrator2.getCurrentPreset();

        expect(preset1).toBe('autonomous');
        expect(preset2).toBe('autonomous');

        // Changes in one should be independent
        await orchestrator1.setPreset('read-only');
        const newPreset1 = await orchestrator1.getCurrentPreset();
        expect(newPreset1).toBe('read-only');

        // Other instance should maintain its own state
        const stillPreset2 = await orchestrator2.getCurrentPreset();
        expect(stillPreset2).toBe('autonomous');
      } finally {
        await orchestrator1.shutdown();
        await orchestrator2.shutdown();
      }
    });
  });
});