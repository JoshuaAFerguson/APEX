/**
 * Idle Enable/Disable Commands Unit Tests
 *
 * Tests the 'apex idle enable' and 'apex idle disable' commands functionality
 * to verify proper config persistence and user feedback.
 *
 * Acceptance Criteria Covered:
 * 1. Running 'apex idle enable' sets daemon.idleProcessing.enabled=true in config.yaml
 * 2. Running 'apex idle disable' sets daemon.idleProcessing.enabled=false in config.yaml
 * 3. Changes persist across CLI restarts
 * 4. Current status is shown after change
 * 5. Proper error handling for config load/save failures
 * 6. Commands work even when daemon/idleProcessing sections don't exist initially
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';
import type { ApexConfig, DaemonConfig } from '@apexcli/core';

// Mock chalk to make output testing deterministic
vi.mock('chalk', () => ({
  default: {
    green: vi.fn().mockImplementation((text) => `GREEN(${text})`),
    red: vi.fn().mockImplementation((text) => `RED(${text})`),
    cyan: vi.fn().mockImplementation((text) => `CYAN(${text})`),
    gray: vi.fn().mockImplementation((text) => `GRAY(${text})`),
  }
}));

// Mock the core functions
vi.mock('@apexcli/core', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

describe('Idle Enable/Disable Commands', () => {
  let mockLoadConfig: any;
  let mockSaveConfig: any;
  let consoleSpy: any;
  let mockContext: any;

  const createMockConfig = (idleEnabled?: boolean): ApexConfig => ({
    version: '1.0',
    project: { name: 'test-project' },
    daemon: idleEnabled !== undefined ? {
      idleProcessing: {
        enabled: idleEnabled,
      }
    } : undefined
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked functions
    const core = await import('@apexcli/core');
    mockLoadConfig = core.loadConfig;
    mockSaveConfig = core.saveConfig;

    // Mock console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create mock context
    mockContext = {
      cwd: '/test/project',
      initialized: true,
      orchestrator: {
        initialize: vi.fn(),
      }
    };

    // Default mock setup
    mockSaveConfig.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('idle enable command', () => {
    it('should enable idle processing when daemon section exists', async () => {
      // Setup: config with daemon but idle processing disabled
      const initialConfig = createMockConfig(false);
      mockLoadConfig.mockResolvedValue(initialConfig);

      // Import the handler function
      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');
      expect(idleCommand).toBeDefined();

      // Execute the enable command
      await idleCommand!.handler(mockContext, ['enable']);

      // Verify config was loaded
      expect(mockLoadConfig).toHaveBeenCalledWith('/test/project');

      // Verify config was saved with idle processing enabled
      expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', expect.objectContaining({
        daemon: expect.objectContaining({
          idleProcessing: expect.objectContaining({
            enabled: true
          })
        })
      }));

      // Verify console output
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('✅ Idle processing enabled'))).toBe(true);
      expect(calls.some(call => call.includes('APEX will now generate improvement suggestions'))).toBe(true);
      expect(calls.some(call => call.includes('Current status: GREEN(ENABLED)'))).toBe(true);
    });

    it('should enable idle processing when daemon section does not exist', async () => {
      // Setup: config without daemon section
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Verify config was saved with new daemon section
      expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', expect.objectContaining({
        daemon: expect.objectContaining({
          idleProcessing: expect.objectContaining({
            enabled: true
          })
        })
      }));

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('✅ Idle processing enabled'))).toBe(true);
    });

    it('should enable idle processing when idleProcessing section does not exist', async () => {
      // Setup: config with daemon but no idleProcessing
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        daemon: {}
      };
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Verify config was saved with new idleProcessing section
      expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', expect.objectContaining({
        daemon: expect.objectContaining({
          idleProcessing: expect.objectContaining({
            enabled: true
          })
        })
      }));

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('✅ Idle processing enabled'))).toBe(true);
    });

    it('should handle config loading errors gracefully', async () => {
      // Setup: loadConfig throws an error
      const loadError = new Error('Failed to load config');
      mockLoadConfig.mockRejectedValue(loadError);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Verify error message is displayed
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
      expect(calls.some(call => call.includes('Failed to load config'))).toBe(true);

      // Verify saveConfig was not called
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle config saving errors gracefully', async () => {
      // Setup: loadConfig succeeds but saveConfig fails
      const initialConfig = createMockConfig(false);
      mockLoadConfig.mockResolvedValue(initialConfig);
      const saveError = new Error('Failed to save config');
      mockSaveConfig.mockRejectedValue(saveError);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Verify error message is displayed
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to enable idle processing'))).toBe(true);
      expect(calls.some(call => call.includes('Failed to save config'))).toBe(true);
    });
  });

  describe('idle disable command', () => {
    it('should disable idle processing when currently enabled', async () => {
      // Setup: config with idle processing enabled
      const initialConfig = createMockConfig(true);
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['disable']);

      // Verify config was saved with idle processing disabled
      expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', expect.objectContaining({
        daemon: expect.objectContaining({
          idleProcessing: expect.objectContaining({
            enabled: false
          })
        })
      }));

      // Verify console output
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('✅ Idle processing disabled'))).toBe(true);
      expect(calls.some(call => call.includes('APEX will no longer generate improvement suggestions'))).toBe(true);
      expect(calls.some(call => call.includes('Current status: RED(DISABLED)'))).toBe(true);
    });

    it('should disable idle processing when daemon section does not exist', async () => {
      // Setup: config without daemon section
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' }
      };
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['disable']);

      // Verify config was saved with new daemon section and disabled idle processing
      expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', expect.objectContaining({
        daemon: expect.objectContaining({
          idleProcessing: expect.objectContaining({
            enabled: false
          })
        })
      }));

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('✅ Idle processing disabled'))).toBe(true);
    });

    it('should handle config loading errors gracefully', async () => {
      // Setup: loadConfig throws an error
      const loadError = new Error('Config file not found');
      mockLoadConfig.mockRejectedValue(loadError);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['disable']);

      // Verify error message is displayed
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to disable idle processing'))).toBe(true);
      expect(calls.some(call => call.includes('Config file not found'))).toBe(true);

      // Verify saveConfig was not called
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should handle config saving errors gracefully', async () => {
      // Setup: loadConfig succeeds but saveConfig fails
      const initialConfig = createMockConfig(true);
      mockLoadConfig.mockResolvedValue(initialConfig);
      const saveError = new Error('Permission denied');
      mockSaveConfig.mockRejectedValue(saveError);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['disable']);

      // Verify error message is displayed
      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('❌ Failed to disable idle processing'))).toBe(true);
      expect(calls.some(call => call.includes('Permission denied'))).toBe(true);
    });
  });

  describe('config mutations', () => {
    it('should preserve existing daemon configuration when enabling', async () => {
      // Setup: config with existing daemon configuration
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        daemon: {
          pollInterval: 10000,
          autoStart: true,
          logLevel: 'debug',
          idleProcessing: {
            enabled: false,
            idleThreshold: 600000,
            taskGenerationInterval: 1800000,
            maxIdleTasks: 5
          }
        }
      };
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Verify all existing config is preserved
      expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', expect.objectContaining({
        daemon: expect.objectContaining({
          pollInterval: 10000,
          autoStart: true,
          logLevel: 'debug',
          idleProcessing: expect.objectContaining({
            enabled: true, // Only this should change
            idleThreshold: 600000, // These should be preserved
            taskGenerationInterval: 1800000,
            maxIdleTasks: 5
          })
        })
      }));
    });

    it('should preserve existing idle processing configuration when disabling', async () => {
      // Setup: config with existing idle processing configuration
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: { name: 'test-project' },
        daemon: {
          idleProcessing: {
            enabled: true,
            idleThreshold: 120000,
            taskGenerationInterval: 900000,
            maxIdleTasks: 10,
            strategyWeights: {
              maintenance: 0.4,
              refactoring: 0.3,
              docs: 0.2,
              tests: 0.1
            }
          }
        }
      };
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['disable']);

      // Verify all existing config is preserved except enabled flag
      expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', expect.objectContaining({
        daemon: expect.objectContaining({
          idleProcessing: expect.objectContaining({
            enabled: false, // Only this should change
            idleThreshold: 120000, // These should be preserved
            taskGenerationInterval: 900000,
            maxIdleTasks: 10,
            strategyWeights: {
              maintenance: 0.4,
              refactoring: 0.3,
              docs: 0.2,
              tests: 0.1
            }
          })
        })
      }));
    });

    it('should not affect other top-level config sections', async () => {
      // Setup: config with multiple sections
      const initialConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          language: 'typescript',
          framework: 'node'
        },
        autonomy: {
          default: 'review-before-merge'
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku'
        },
        api: {
          port: 4000,
          autoStart: true
        },
        daemon: {
          idleProcessing: {
            enabled: false
          }
        }
      };
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      // Verify all other sections are unchanged
      expect(mockSaveConfig).toHaveBeenCalledWith('/test/project', expect.objectContaining({
        version: '1.0',
        project: {
          name: 'test-project',
          language: 'typescript',
          framework: 'node'
        },
        autonomy: {
          default: 'review-before-merge'
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku'
        },
        api: {
          port: 4000,
          autoStart: true
        },
        daemon: expect.objectContaining({
          idleProcessing: expect.objectContaining({
            enabled: true // Only this should change
          })
        })
      }));
    });
  });

  describe('status display', () => {
    it('should show ENABLED status after enabling', async () => {
      const initialConfig = createMockConfig(false);
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Current status: GREEN(ENABLED)'))).toBe(true);
    });

    it('should show DISABLED status after disabling', async () => {
      const initialConfig = createMockConfig(true);
      mockLoadConfig.mockResolvedValue(initialConfig);

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(mockContext, ['disable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('Current status: RED(DISABLED)'))).toBe(true);
    });
  });

  describe('command validation', () => {
    it('should require initialized context for enable command', async () => {
      const uninitializedContext = {
        ...mockContext,
        initialized: false,
        orchestrator: null
      };

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(uninitializedContext, ['enable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('APEX not initialized. Run /init first.'))).toBe(true);

      // Verify config operations were not called
      expect(mockLoadConfig).not.toHaveBeenCalled();
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });

    it('should require initialized context for disable command', async () => {
      const uninitializedContext = {
        ...mockContext,
        initialized: false,
        orchestrator: null
      };

      const { commands } = await import('../index.js');
      const idleCommand = commands.find(cmd => cmd.name === 'idle');

      await idleCommand!.handler(uninitializedContext, ['disable']);

      const calls = consoleSpy.mock.calls.map(call => call[0]);
      expect(calls.some(call => call.includes('APEX not initialized. Run /init first.'))).toBe(true);

      // Verify config operations were not called
      expect(mockLoadConfig).not.toHaveBeenCalled();
      expect(mockSaveConfig).not.toHaveBeenCalled();
    });
  });
});