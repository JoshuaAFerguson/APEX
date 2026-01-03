/**
 * @fileoverview Tests for getLinterService() method exposure in ApexOrchestrator
 *
 * This test suite validates that the getLinterService() method is properly exposed,
 * returns the correct instance, and handles edge cases appropriately.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import { LinterService } from '../linter/service';

describe('ApexOrchestrator getLinterService() Method', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-get-linter-service-test-'));

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

  describe('Method Availability and Access', () => {
    it('should expose getLinterService method on orchestrator instance', () => {
      expect(typeof orchestrator.getLinterService).toBe('function');
    });

    it('should be accessible as a public method', () => {
      // The method should be callable
      expect(() => {
        try {
          orchestrator.getLinterService();
        } catch (error) {
          // Expect initialization error, not method access error
          expect((error as Error).message).toContain('must be initialized');
        }
      }).not.toThrow();
    });

    it('should have correct method signature', () => {
      // Method should exist and be a function
      const method = orchestrator.getLinterService;
      expect(method).toBeDefined();
      expect(typeof method).toBe('function');
      expect(method.length).toBe(0); // No parameters expected
    });
  });

  describe('Pre-Initialization Behavior', () => {
    it('should throw meaningful error when called before initialization', () => {
      expect(() => orchestrator.getLinterService()).toThrow(
        'Orchestrator must be initialized before accessing LinterService'
      );
    });

    it('should throw specific error type for uninitialized access', () => {
      expect(() => orchestrator.getLinterService()).toThrow(Error);

      try {
        orchestrator.getLinterService();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/must be initialized/i);
      }
    });

    it('should consistently throw on multiple pre-initialization calls', () => {
      expect(() => orchestrator.getLinterService()).toThrow();
      expect(() => orchestrator.getLinterService()).toThrow();
      expect(() => orchestrator.getLinterService()).toThrow();

      // All should throw the same error
      let error1: Error | null = null;
      let error2: Error | null = null;

      try { orchestrator.getLinterService(); } catch (e) { error1 = e as Error; }
      try { orchestrator.getLinterService(); } catch (e) { error2 = e as Error; }

      expect(error1?.message).toBe(error2?.message);
    });
  });

  describe('Post-Initialization Behavior', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should return LinterService instance after initialization', () => {
      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeInstanceOf(LinterService);
    });

    it('should return the same instance on multiple calls', () => {
      const linterService1 = orchestrator.getLinterService();
      const linterService2 = orchestrator.getLinterService();
      const linterService3 = orchestrator.getLinterService();

      expect(linterService1).toBe(linterService2);
      expect(linterService2).toBe(linterService3);
      expect(linterService1).toBe(linterService3);
    });

    it('should return functional LinterService with all expected methods', () => {
      const linterService = orchestrator.getLinterService();

      // Core LinterService methods
      expect(typeof linterService.initialize).toBe('function');
      expect(typeof linterService.register).toBe('function');
      expect(typeof linterService.execute).toBe('function');
      expect(typeof linterService.executeAll).toBe('function');
      expect(typeof linterService.getRegisteredPlugins).toBe('function');
      expect(typeof linterService.destroy).toBe('function');

      // EventEmitter methods
      expect(typeof linterService.on).toBe('function');
      expect(typeof linterService.emit).toBe('function');
      expect(typeof linterService.removeListener).toBe('function');
    });

    it('should return initialized LinterService', () => {
      const linterService = orchestrator.getLinterService();

      // Should be able to call methods without throwing initialization errors
      expect(() => linterService.getRegisteredPlugins()).not.toThrow();
      expect(Array.isArray(linterService.getRegisteredPlugins())).toBe(true);
    });

    it('should maintain LinterService state across method calls', async () => {
      const linterService = orchestrator.getLinterService();

      // Initial state
      expect(linterService.getRegisteredPlugins()).toEqual([]);

      // Register a mock plugin
      const mockPlugin = {
        name: 'test-plugin',
        initialize: async () => {},
        lint: async () => ({ issues: [], fixes: [] }),
        destroy: async () => {},
      };

      await linterService.register(mockPlugin);

      // State should persist
      expect(linterService.getRegisteredPlugins()).toContain('test-plugin');

      // Get service again and verify state persists
      const linterService2 = orchestrator.getLinterService();
      expect(linterService2.getRegisteredPlugins()).toContain('test-plugin');
    });
  });

  describe('Lifecycle Integration', () => {
    it('should work correctly across orchestrator lifecycle', async () => {
      // Before initialization - should throw
      expect(() => orchestrator.getLinterService()).toThrow();

      // After initialization - should work
      await orchestrator.initialize();
      const linterService1 = orchestrator.getLinterService();
      expect(linterService1).toBeInstanceOf(LinterService);

      // After shutdown - service should still be accessible
      await orchestrator.shutdown();
      const linterService2 = orchestrator.getLinterService();
      expect(linterService2).toBe(linterService1); // Same instance

      // After re-initialization - should work with new instance
      await orchestrator.initialize();
      const linterService3 = orchestrator.getLinterService();
      expect(linterService3).toBeInstanceOf(LinterService);
      expect(linterService3).not.toBe(linterService1); // New instance
    });

    it('should handle multiple initialization cycles correctly', async () => {
      // First cycle
      await orchestrator.initialize();
      const service1 = orchestrator.getLinterService();

      await orchestrator.shutdown();
      await orchestrator.initialize();
      const service2 = orchestrator.getLinterService();

      await orchestrator.shutdown();
      await orchestrator.initialize();
      const service3 = orchestrator.getLinterService();

      // Each initialization should create a new service instance
      expect(service1).not.toBe(service2);
      expect(service2).not.toBe(service3);
      expect(service1).not.toBe(service3);

      // But all should be LinterService instances
      expect(service1).toBeInstanceOf(LinterService);
      expect(service2).toBeInstanceOf(LinterService);
      expect(service3).toBeInstanceOf(LinterService);
    });

    it('should maintain service availability during concurrent access', async () => {
      await orchestrator.initialize();

      // Simulate concurrent access
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() => {
          const service = orchestrator.getLinterService();
          expect(service).toBeInstanceOf(LinterService);
          return service;
        })
      );

      const services = await Promise.all(promises);

      // All should be the same instance
      const firstService = services[0];
      for (const service of services) {
        expect(service).toBe(firstService);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle rapid consecutive calls gracefully', async () => {
      await orchestrator.initialize();

      // Rapid consecutive calls
      const service1 = orchestrator.getLinterService();
      const service2 = orchestrator.getLinterService();
      const service3 = orchestrator.getLinterService();

      expect(service1).toBe(service2);
      expect(service2).toBe(service3);
    });

    it('should work with different orchestrator configurations', async () => {
      // Test with minimal linter config
      const minimalConfig = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), minimalConfig);

      // Create fresh orchestrator
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeInstanceOf(LinterService);
    });

    it('should maintain functionality even with no linter config', async () => {
      // Config without linter section
      const noLinterConfig = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), noLinterConfig);

      // Create fresh orchestrator
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeInstanceOf(LinterService);
    });

    it('should handle method binding correctly', async () => {
      await orchestrator.initialize();

      // Extract method reference
      const { getLinterService } = orchestrator;

      // Should work when called as bound method
      expect(() => getLinterService.call(orchestrator)).not.toThrow();
      const service = getLinterService.call(orchestrator);
      expect(service).toBeInstanceOf(LinterService);
    });
  });

  describe('Documentation and API Consistency', () => {
    it('should return same type as declared in TypeScript definitions', async () => {
      await orchestrator.initialize();
      const linterService = orchestrator.getLinterService();

      // Should match expected interface
      expect(linterService).toBeInstanceOf(LinterService);

      // Should have expected method signatures
      expect(typeof linterService.register).toBe('function');
      expect(typeof linterService.execute).toBe('function');
    });

    it('should support expected LinterService usage patterns', async () => {
      await orchestrator.initialize();
      const linterService = orchestrator.getLinterService();

      // Should support event listening
      let eventFired = false;
      linterService.on('service:initialized', () => {
        eventFired = true;
      });

      // Initialize should be idempotent
      await linterService.initialize();

      // Should support plugin registration
      const mockPlugin = {
        name: 'api-test-plugin',
        initialize: async () => {},
        lint: async () => ({ issues: [], fixes: [] }),
        destroy: async () => {},
      };

      await expect(linterService.register(mockPlugin)).resolves.not.toThrow();
      expect(linterService.getRegisteredPlugins()).toContain('api-test-plugin');
    });
  });
});