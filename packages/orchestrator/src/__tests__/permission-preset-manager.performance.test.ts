import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  PermissionPreset,
  Permission,
} from '@apexcli/core';
import { PermissionStore } from '../permission-store';
import { PermissionPresetManager } from '../permission-preset-manager';

describe('PermissionPresetManager Performance Tests', () => {
  let tempDir: string;
  let permissionStore: PermissionStore;
  let presetManager: PermissionPresetManager;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-preset-perf-test-'));
    permissionStore = new PermissionStore(tempDir);
    await permissionStore.initialize();
    presetManager = new PermissionPresetManager(permissionStore);
  });

  afterEach(() => {
    if (permissionStore) {
      permissionStore.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Preset Application Performance', () => {
    it('should apply presets quickly', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      for (const preset of presets) {
        const startTime = performance.now();
        await presetManager.applyPreset(preset);
        const endTime = performance.now();

        const duration = endTime - startTime;
        expect(duration).toBeLessThan(100); // Should complete within 100ms
        expect(presetManager.getCurrentPreset()).toBe(preset);
      }
    });

    it('should handle rapid preset switching efficiently', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];
      const iterations = 50;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const preset = presets[i % presets.length];
        await presetManager.applyPreset(preset);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerSwitch = totalTime / iterations;

      expect(avgTimePerSwitch).toBeLessThan(20); // Average < 20ms per switch
      expect(totalTime).toBeLessThan(1000); // Total < 1 second
    });

    it('should maintain performance with large numbers of existing permissions', async () => {
      // Pre-populate with many permissions
      const numPermissions = 500;
      for (let i = 0; i < numPermissions; i++) {
        await permissionStore.savePermission({
          tool: `Tool${i}`,
          scope: i % 2 === 0 ? `/scope/${i}/**` : undefined,
          level: i % 3 === 0 ? 'allow-always' : i % 3 === 1 ? 'allow-once' : 'deny',
          createdAt: new Date(),
        });
      }

      // Now test preset application performance
      const startTime = performance.now();
      await presetManager.applyPreset('read-only');
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // Should complete within 500ms even with many existing permissions
    });
  });

  describe('Permission Query Performance', () => {
    it('should query effective permissions quickly', async () => {
      await presetManager.applyPreset('review-all');

      const tools = Array.from({ length: 100 }, (_, i) => `Tool${i}`);

      const startTime = performance.now();

      for (const tool of tools) {
        await presetManager.getEffectivePermissionLevel(tool);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerQuery = totalTime / tools.length;

      expect(avgTimePerQuery).toBeLessThan(5); // Average < 5ms per query
      expect(totalTime).toBeLessThan(500); // Total < 500ms
    });

    it('should handle bulk permission checks efficiently', async () => {
      await presetManager.applyPreset('autonomous');

      const tools = Array.from({ length: 200 }, (_, i) => `Tool${i}`);

      const startTime = performance.now();

      const results = await Promise.all([
        ...tools.map(tool => presetManager.getEffectivePermissionLevel(tool)),
        ...tools.map(tool => presetManager.isToolAllowed(tool)),
        ...tools.map(tool => presetManager.isConfirmationRequired(tool)),
        ...tools.map(tool => presetManager.isToolDenied(tool)),
      ]);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results.length).toBe(800); // 200 tools * 4 checks each
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results.every(result => result !== undefined)).toBe(true);
    });

    it('should maintain performance with mixed permission sources', async () => {
      await presetManager.applyPreset('read-only');

      // Add some stored permissions that override preset behavior
      for (let i = 0; i < 50; i++) {
        await permissionStore.savePermission({
          tool: `Override${i}`,
          level: 'allow-always',
          createdAt: new Date(),
        });
      }

      const tools = [
        // Tools with stored permissions
        ...Array.from({ length: 50 }, (_, i) => `Override${i}`),
        // Tools that will use preset behavior
        ...Array.from({ length: 50 }, (_, i) => `Preset${i}`),
      ];

      const startTime = performance.now();

      for (const tool of tools) {
        await presetManager.getEffectivePermissionLevel(tool);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(500); // Should complete within 500ms
    });
  });

  describe('Concurrent Access Performance', () => {
    it('should handle concurrent preset applications gracefully', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      const startTime = performance.now();

      // Try to apply different presets concurrently (should serialize)
      const promises = presets.map(preset => presetManager.applyPreset(preset));
      await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(['autonomous', 'review-all', 'read-only']).toContain(presetManager.getCurrentPreset());
    });

    it('should handle concurrent permission queries efficiently', async () => {
      await presetManager.applyPreset('review-all');

      const numConcurrentQueries = 100;
      const tools = Array.from({ length: numConcurrentQueries }, (_, i) => `Tool${i}`);

      const startTime = performance.now();

      const promises = tools.flatMap(tool => [
        presetManager.getEffectivePermissionLevel(tool),
        presetManager.isToolAllowed(tool),
        presetManager.isConfirmationRequired(tool),
        presetManager.isToolDenied(tool),
      ]);

      const results = await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results.length).toBe(400); // 100 tools * 4 operations each
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results.every(result => result !== undefined)).toBe(true);
    });

    it('should handle mixed concurrent operations efficiently', async () => {
      await presetManager.applyPreset('autonomous');

      const startTime = performance.now();

      const operations = [];

      // Mix of different operations
      for (let i = 0; i < 20; i++) {
        operations.push(presetManager.getEffectivePermissionLevel(`Tool${i}`));
        operations.push(presetManager.isToolAllowed(`Tool${i}`));
        operations.push(presetManager.getPresetConfig());
        operations.push(presetManager.getCurrentPreset());
      }

      // Add some preset switches in the mix
      operations.push(presetManager.applyPreset('review-all'));
      operations.push(presetManager.resetToPreset());

      const results = await Promise.all(operations);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results.length).toBe(82); // 20 * 4 + 2
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory with repeated preset applications', async () => {
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];

      // Get initial memory usage (rough estimate)
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many preset applications
      for (let i = 0; i < 100; i++) {
        const preset = presets[i % presets.length];
        await presetManager.applyPreset(preset);

        // Do some operations
        await presetManager.getEffectivePermissionLevel('TestTool');
        await presetManager.isToolAllowed('TestTool');
        await presetManager.getPresetConfig();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle large result sets efficiently', async () => {
      await presetManager.applyPreset('review-all');

      const largeToolSet = Array.from({ length: 1000 }, (_, i) => `LargeTool${i}`);

      const startTime = performance.now();
      const initialMemory = process.memoryUsage().heapUsed;

      const results = await Promise.all(
        largeToolSet.map(tool => presetManager.getEffectivePermissionLevel(tool))
      );

      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed;

      const duration = endTime - startTime;
      const memoryIncrease = finalMemory - initialMemory;

      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should not use more than 50MB
      expect(results.length).toBe(1000);
      expect(results.every(result => result === 'allow-once')).toBe(true);
    });
  });

  describe('Database Operation Performance', () => {
    it('should handle database operations efficiently during preset application', async () => {
      // Measure time for each preset application
      const presets: PermissionPreset[] = ['autonomous', 'review-all', 'read-only'];
      const timings: Record<PermissionPreset, number> = {} as any;

      for (const preset of presets) {
        const startTime = performance.now();
        await presetManager.applyPreset(preset);
        const endTime = performance.now();

        timings[preset] = endTime - startTime;
        expect(timings[preset]).toBeLessThan(200); // Each should be < 200ms
      }

      // Verify all presets perform similarly
      const times = Object.values(timings);
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // No preset should take more than 3x the average
      expect(maxTime).toBeLessThan(avgTime * 3);
      expect(minTime).toBeGreaterThan(avgTime * 0.1);
    });

    it('should handle reset operations efficiently', async () => {
      await presetManager.applyPreset('read-only');

      // Add some permissions to reset
      for (let i = 0; i < 20; i++) {
        await permissionStore.savePermission({
          tool: `Manual${i}`,
          level: 'deny',
          createdAt: new Date(),
        });
      }

      const startTime = performance.now();
      await presetManager.resetToPreset();
      const endTime = performance.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(200); // Should complete within 200ms

      // Verify reset worked
      expect(presetManager.getCurrentPreset()).toBe('read-only');
      const level = await presetManager.getEffectivePermissionLevel('Read');
      expect(level).toBe('allow-always');
    });
  });
});