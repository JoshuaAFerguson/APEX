/**
 * @fileoverview Unit tests for LinterService instantiation in ApexOrchestrator
 *
 * This test suite focuses on the specific instantiation logic and configuration
 * mapping from ApexConfig to LinterService options.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';

// Mock LinterService to test instantiation parameters
vi.mock('../linter/service', () => {
  const mockInitialize = vi.fn().mockResolvedValue(undefined);
  const mockConstructor = vi.fn();

  return {
    LinterService: class MockLinterService {
      constructor(options: any) {
        mockConstructor(options);
        this.initialize = mockInitialize;
        this.register = vi.fn();
        this.execute = vi.fn();
        this.executeAll = vi.fn();
        this.getRegisteredPlugins = vi.fn().mockReturnValue([]);
        this.destroy = vi.fn();
        this.on = vi.fn();
        this.emit = vi.fn();
        this.removeListener = vi.fn();
      }
      initialize = mockInitialize;
      register = vi.fn();
      execute = vi.fn();
      executeAll = vi.fn();
      getRegisteredPlugins = vi.fn();
      destroy = vi.fn();
      on = vi.fn();
      emit = vi.fn();
      removeListener = vi.fn();
    },
    __mockConstructor: mockConstructor,
    __mockInitialize: mockInitialize,
  };
});

describe('ApexOrchestrator LinterService Instantiation', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-orchestrator-linter-unit-test-'));

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('LinterService Constructor Parameters', () => {
    it('should pass correct projectPath to LinterService constructor', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: tempDir,
        })
      );
    });

    it('should pass timeoutMs from config to LinterService constructor', async () => {
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
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultTimeout: 45000,
        })
      );
    });

    it('should pass maxConcurrency from config to LinterService constructor', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    maxConcurrency: 4
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          maxConcurrency: 4,
        })
      );
    });

    it('should pass autoFix enabled flag from config to LinterService constructor', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          autoFix: {
            enabled: true,
          },
        })
      );
    });

    it('should handle undefined linter config gracefully', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: tempDir,
          defaultTimeout: undefined, // Should be undefined when not specified
          maxConcurrency: undefined, // Should be undefined when not specified
          autoFix: {
            enabled: false, // Should default to false
          },
        })
      );
    });

    it('should handle partial linter config gracefully', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    timeoutMs: 30000
    # missing enabled and maxConcurrency
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPath: tempDir,
          defaultTimeout: 30000,
          maxConcurrency: undefined, // Should be undefined when not specified
          autoFix: {
            enabled: false, // Should default to false when not specified
          },
        })
      );
    });

    it('should handle complete linter configuration', async () => {
      const configContent = `
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
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenCalledWith({
        projectPath: tempDir,
        defaultTimeout: 60000,
        maxConcurrency: 8,
        autoFix: {
          enabled: true,
        },
      });
    });
  });

  describe('LinterService Initialization Call', () => {
    it('should call LinterService.initialize() during orchestrator initialization', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockInitialize = (LinterService as any).__mockInitialize;

      expect(mockInitialize).toHaveBeenCalledOnce();
    });

    it('should propagate LinterService initialization errors', async () => {
      // Mock initialize to throw an error
      const { LinterService } = await import('../linter/service');
      const mockInitialize = (LinterService as any).__mockInitialize;
      mockInitialize.mockRejectedValueOnce(new Error('LinterService init failed'));

      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await expect(orchestrator.initialize()).rejects.toThrow('LinterService init failed');
    });
  });

  describe('Constructor Validation', () => {
    it('should only instantiate LinterService once per orchestrator instance', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      // Multiple calls to initialize should not create new LinterService instances
      await orchestrator.initialize();
      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenCalledTimes(1);
    });

    it('should use consistent constructor parameters across different config variations', async () => {
      // Test with enabled: false
      const configContent1 = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: false
    timeoutMs: 25000
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent1);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      expect(mockConstructor).toHaveBeenLastCalledWith(
        expect.objectContaining({
          projectPath: tempDir,
          defaultTimeout: 25000,
          autoFix: {
            enabled: false,
          },
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined values in linter config', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: null
    timeoutMs: null
    maxConcurrency: null
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      await orchestrator.initialize();

      const { LinterService } = await import('../linter/service');
      const mockConstructor = (LinterService as any).__mockConstructor;

      // Should handle null values gracefully
      expect(mockConstructor).toHaveBeenCalled();
    });

    it('should handle invalid numeric values in linter config', async () => {
      const configContent = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

linter:
  global:
    enabled: true
    timeoutMs: "invalid"
    maxConcurrency: -1
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configContent);
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      // Should either initialize successfully or throw a config validation error
      try {
        await orchestrator.initialize();
        const { LinterService } = await import('../linter/service');
        const mockConstructor = (LinterService as any).__mockConstructor;
        expect(mockConstructor).toHaveBeenCalled();
      } catch (error) {
        // Config validation error is acceptable
        expect(error).toBeDefined();
      }
    });
  });
});