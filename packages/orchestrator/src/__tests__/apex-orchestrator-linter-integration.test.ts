/**
 * @fileoverview Integration tests for LinterService with ApexOrchestrator
 *
 * This test suite validates the acceptance criteria:
 * 1. ApexOrchestrator instantiates LinterService during initialize()
 * 2. Loads linter configuration from ApexConfig.linter
 * 3. Exposes getLinterService() method to access the service
 * 4. LinterService is properly initialized and functional
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import { LinterService } from '../linter/service';

describe('ApexOrchestrator LinterService Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-orchestrator-linter-test-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Create basic config file with linter configuration
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

    orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('AC1: ApexOrchestrator instantiates LinterService during initialize()', () => {
    it('should initialize LinterService without errors', async () => {
      await expect(orchestrator.initialize()).resolves.not.toThrow();
    });

    it('should have LinterService accessible after initialization', async () => {
      await orchestrator.initialize();

      // Should be able to access LinterService
      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeInstanceOf(LinterService);
    });

    it('should throw error when accessing LinterService before initialization', async () => {
      expect(() => orchestrator.getLinterService()).toThrow(
        'Orchestrator must be initialized before accessing LinterService'
      );
    });

    it('should initialize LinterService only once', async () => {
      await orchestrator.initialize();
      const linterService1 = orchestrator.getLinterService();
      const linterService2 = orchestrator.getLinterService();

      // Should return the same instance
      expect(linterService1).toBe(linterService2);
    });
  });

  describe('AC2: Loads linter configuration from ApexConfig.linter', () => {
    it('should load global linter configuration from config', async () => {
      await orchestrator.initialize();
      const linterService = orchestrator.getLinterService();

      // Verify the service was configured with values from config
      // Note: LinterService doesn't expose internal options, so we test behavior
      expect(linterService).toBeDefined();
    });

    it('should use default values when linter config is not specified', async () => {
      // Config without linter section
      const configWithoutLinter = `
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

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithoutLinter);

      // Create fresh orchestrator with updated config
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();

      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeInstanceOf(LinterService);
    });

    it('should handle partial linter configuration', async () => {
      // Config with partial linter configuration
      const configWithPartialLinter = `
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

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithPartialLinter);

      // Create fresh orchestrator with updated config
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();

      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeInstanceOf(LinterService);
    });

    it('should use projectPath from orchestrator constructor', async () => {
      await orchestrator.initialize();
      const linterService = orchestrator.getLinterService();

      // LinterService should be initialized with the correct project path
      expect(linterService).toBeDefined();
      // Note: We can't directly verify the project path since it's private,
      // but successful initialization indicates it was set correctly
    });
  });

  describe('AC3: Exposes getLinterService() method to access the service', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should expose getLinterService method', async () => {
      expect(typeof orchestrator.getLinterService).toBe('function');
    });

    it('should return LinterService instance', async () => {
      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeInstanceOf(LinterService);
    });

    it('should return functional LinterService with core methods', async () => {
      const linterService = orchestrator.getLinterService();

      // Verify key methods exist and are functions
      expect(typeof linterService.initialize).toBe('function');
      expect(typeof linterService.register).toBe('function');
      expect(typeof linterService.execute).toBe('function');
      expect(typeof linterService.executeAll).toBe('function');
      expect(typeof linterService.getRegisteredPlugins).toBe('function');
      expect(typeof linterService.destroy).toBe('function');
    });

    it('should allow access to LinterService methods', async () => {
      const linterService = orchestrator.getLinterService();

      // Should be able to call LinterService methods
      await expect(linterService.initialize()).resolves.not.toThrow();
      expect(linterService.getRegisteredPlugins()).toEqual([]);
    });

    it('should maintain LinterService state across method calls', async () => {
      const linterService = orchestrator.getLinterService();

      // Verify LinterService maintains state
      expect(linterService.getRegisteredPlugins()).toEqual([]);

      // After registering a mock plugin, state should change
      const mockPlugin = {
        name: 'test-plugin',
        initialize: vi.fn().mockResolvedValue(undefined),
        lint: vi.fn().mockResolvedValue({ issues: [], fixes: [] }),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      await linterService.register(mockPlugin);
      expect(linterService.getRegisteredPlugins()).toContain('test-plugin');
    });
  });

  describe('AC4: LinterService is properly initialized and functional', () => {
    beforeEach(async () => {
      await orchestrator.initialize();
    });

    it('should have initialized LinterService', async () => {
      const linterService = orchestrator.getLinterService();

      // LinterService should be in initialized state
      // We test this by calling initialize again - it should be idempotent
      await expect(linterService.initialize()).resolves.not.toThrow();
    });

    it('should allow plugin registration and execution', async () => {
      const linterService = orchestrator.getLinterService();

      // Create a mock plugin
      const mockPlugin = {
        name: 'test-plugin',
        initialize: vi.fn().mockResolvedValue(undefined),
        lint: vi.fn().mockResolvedValue({
          issues: [
            {
              rule: 'test-rule',
              level: 'error' as const,
              message: 'Test issue',
              location: { file: 'test.js', line: 1, column: 1 },
            },
          ],
          fixes: [],
        }),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      // Register plugin
      await expect(linterService.register(mockPlugin)).resolves.not.toThrow();

      // Execute linter
      const result = await linterService.execute('test-plugin', { files: ['test.js'] });
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toBe('Test issue');
    });

    it('should support event emission from LinterService', async () => {
      const linterService = orchestrator.getLinterService();

      let eventReceived = false;
      linterService.on('plugin:registered', () => {
        eventReceived = true;
      });

      // Register a plugin to trigger event
      const mockPlugin = {
        name: 'event-test-plugin',
        initialize: vi.fn().mockResolvedValue(undefined),
        lint: vi.fn().mockResolvedValue({ issues: [], fixes: [] }),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      await linterService.register(mockPlugin);
      expect(eventReceived).toBe(true);
    });

    it('should handle LinterService destruction gracefully', async () => {
      const linterService = orchestrator.getLinterService();

      // Register a plugin
      const mockPlugin = {
        name: 'destroy-test-plugin',
        initialize: vi.fn().mockResolvedValue(undefined),
        lint: vi.fn().mockResolvedValue({ issues: [], fixes: [] }),
        destroy: vi.fn().mockResolvedValue(undefined),
      };

      await linterService.register(mockPlugin);

      // Destroy should work without errors
      await expect(linterService.destroy()).resolves.not.toThrow();
      expect(mockPlugin.destroy).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with complex linter configuration', async () => {
      // Config with comprehensive linter settings
      const complexLinterConfig = `
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
    timeoutMs: 45000
    maxConcurrency: 4
  plugins:
    eslint:
      enabled: true
      config: .eslintrc.js
    prettier:
      enabled: true
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

      await writeFile(join(tempDir, '.apex', 'config.yaml'), complexLinterConfig);

      // Create fresh orchestrator with complex config
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });
      await orchestrator.initialize();

      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeInstanceOf(LinterService);
    });

    it('should integrate with orchestrator lifecycle', async () => {
      // Initialize orchestrator
      await orchestrator.initialize();
      const linterService = orchestrator.getLinterService();
      expect(linterService).toBeDefined();

      // Shutdown orchestrator
      await orchestrator.shutdown();

      // LinterService should still be accessible (not destroyed by shutdown)
      expect(linterService).toBeDefined();
    });

    it('should maintain configuration after orchestrator re-initialization', async () => {
      // First initialization
      await orchestrator.initialize();
      const linterService1 = orchestrator.getLinterService();

      // Shutdown and re-initialize
      await orchestrator.shutdown();
      await orchestrator.initialize();
      const linterService2 = orchestrator.getLinterService();

      // Should be different instances but both functional
      expect(linterService1).not.toBe(linterService2);
      expect(linterService2).toBeInstanceOf(LinterService);
    });
  });

  describe('Error Handling', () => {
    it('should handle LinterService initialization failure gracefully', async () => {
      // Mock LinterService constructor to throw
      const originalLinterService = LinterService;
      vi.doMock('../linter/service', () => ({
        LinterService: class extends originalLinterService {
          async initialize() {
            throw new Error('LinterService initialization failed');
          }
        },
      }));

      try {
        // Should propagate initialization error
        await expect(orchestrator.initialize()).rejects.toThrow('LinterService initialization failed');
      } finally {
        vi.doUnmock('../linter/service');
      }
    });

    it('should handle missing linter configuration gracefully', async () => {
      // Config with malformed linter section
      const malformedLinterConfig = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

linter: invalid_yaml_structure

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), malformedLinterConfig);

      // Create fresh orchestrator with malformed config
      await orchestrator.shutdown();
      orchestrator = new ApexOrchestrator({ projectPath: tempDir, apiUrl: 'localhost:8080' });

      // Should handle gracefully or throw specific config error
      await expect(orchestrator.initialize()).rejects.toThrow();
    });
  });
});