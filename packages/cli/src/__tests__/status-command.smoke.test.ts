/**
 * Status Command Smoke Test
 * Quick validation that the status command can be imported and basic functionality exists
 */

import { describe, it, expect, vi } from 'vitest';

describe('Status Command Smoke Test', () => {
  it('should be able to import commands from index', async () => {
    try {
      const { commands } = await import('../index.js');
      expect(commands).toBeDefined();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    } catch (error) {
      console.error('Failed to import commands:', error);
      throw error;
    }
  });

  it('should find status command in commands array', async () => {
    try {
      const { commands } = await import('../index.js');
      const statusCommand = commands.find(cmd => cmd.name === 'status');

      expect(statusCommand).toBeDefined();
      expect(statusCommand?.name).toBe('status');
      expect(statusCommand?.aliases).toContain('s');
      expect(typeof statusCommand?.handler).toBe('function');
      expect(statusCommand?.description).toContain('status');
    } catch (error) {
      console.error('Failed to find status command:', error);
      throw error;
    }
  });

  it('should be able to import types from core package', async () => {
    try {
      const { Task, ApprovalState, ApexConfig } = await import('@apexcli/core');
      expect(Task).toBeDefined();
      expect(ApprovalState).toBeDefined();
      expect(ApexConfig).toBeDefined();
    } catch (error) {
      console.error('Failed to import types from core:', error);
      throw error;
    }
  });

  it('should be able to import chalk for console formatting', async () => {
    try {
      const chalk = await import('chalk');
      expect(chalk.default).toBeDefined();
      expect(typeof chalk.default.red).toBe('function');
      expect(typeof chalk.default.green).toBe('function');
      expect(typeof chalk.default.cyan).toBe('function');
    } catch (error) {
      console.error('Failed to import chalk:', error);
      throw error;
    }
  });

  it('should handle status command with basic mocked context', async () => {
    try {
      const { commands } = await import('../index.js');
      const statusCommand = commands.find(cmd => cmd.name === 'status');

      if (!statusCommand) {
        throw new Error('Status command not found');
      }

      // Mock console.log to prevent output during test
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Create minimal mock context that should trigger "not initialized" message
      const mockCtx = {
        initialized: false,
        orchestrator: null,
        config: null,
        cwd: '/test/project',
      };

      // This should not throw an error, just log the "not initialized" message
      await statusCommand.handler(mockCtx, []);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    } catch (error) {
      console.error('Failed to handle status command:', error);
      throw error;
    }
  });
});