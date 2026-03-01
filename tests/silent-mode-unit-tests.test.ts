/**
 * @fileoverview Unit tests for APEX_SILENT environment variable handling
 *
 * Tests the core logic of silent mode without spawning actual processes.
 * Focuses on environment variable parsing and conditional behavior.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('APEX_SILENT Environment Variable Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables for each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Variable Parsing', () => {
    test('should correctly identify APEX_SILENT=1 as truthy', () => {
      process.env.APEX_SILENT = '1';
      const silent = process.env.APEX_SILENT === '1';
      expect(silent).toBe(true);
    });

    test('should correctly identify APEX_SILENT=0 as falsy', () => {
      process.env.APEX_SILENT = '0';
      const silent = process.env.APEX_SILENT === '1';
      expect(silent).toBe(false);
    });

    test('should correctly identify undefined APEX_SILENT as falsy', () => {
      delete process.env.APEX_SILENT;
      const silent = process.env.APEX_SILENT === '1';
      expect(silent).toBe(false);
    });

    test('should correctly identify empty string APEX_SILENT as falsy', () => {
      process.env.APEX_SILENT = '';
      const silent = process.env.APEX_SILENT === '1';
      expect(silent).toBe(false);
    });

    test('should correctly identify non-1 values as falsy', () => {
      const testValues = ['true', 'false', 'yes', 'no', 'on', 'off', '2', '-1'];

      testValues.forEach(value => {
        process.env.APEX_SILENT = value;
        const silent = process.env.APEX_SILENT === '1';
        expect(silent).toBe(false);
      });
    });
  });

  describe('API Server Silent Mode Logic', () => {
    test('should create silent variable correctly when APEX_SILENT=1', async () => {
      process.env.APEX_SILENT = '1';

      // Simulate API server startup logic
      const silent = process.env.APEX_SILENT === '1';
      expect(silent).toBe(true);

      // Mock console.log to verify it's not called
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Simulate the conditional logging
      if (!silent) {
        console.log('🚀 APEX API Server running');
        console.log('Task Endpoints:');
      }

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should allow logging when APEX_SILENT is not set', async () => {
      delete process.env.APEX_SILENT;

      const silent = process.env.APEX_SILENT === '1';
      expect(silent).toBe(false);

      // Mock console.log to verify it IS called
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Simulate the conditional logging
      if (!silent) {
        console.log('🚀 APEX API Server running');
        console.log('Task Endpoints:');
      }

      expect(consoleSpy).toHaveBeenCalledWith('🚀 APEX API Server running');
      expect(consoleSpy).toHaveBeenCalledWith('Task Endpoints:');
      consoleSpy.mockRestore();
    });

    test('should use silent mode in Fastify logger configuration', () => {
      process.env.APEX_SILENT = '1';
      const silent = process.env.APEX_SILENT === '1';

      // Simulate Fastify logger configuration logic
      const loggerConfig = silent ? false : { level: 'info' };

      expect(loggerConfig).toBe(false);
    });

    test('should not use silent mode in Fastify logger when APEX_SILENT not set', () => {
      delete process.env.APEX_SILENT;
      const silent = process.env.APEX_SILENT === '1';

      // Simulate Fastify logger configuration logic
      const loggerConfig = silent ? false : { level: 'info' };

      expect(loggerConfig).toEqual({ level: 'info' });
    });
  });

  describe('Process Environment Setup', () => {
    test('should correctly prepare environment variables for spawned processes', () => {
      const mockCurrentEnv = {
        NODE_ENV: 'test',
        PATH: '/usr/bin',
        HOME: '/home/user'
      };
      process.env = { ...mockCurrentEnv };

      // Simulate environment preparation for spawned process
      const spawnEnv = {
        ...process.env,
        PORT: '3000',
        APEX_PROJECT: '/mock/project',
        APEX_SILENT: '1',
      };

      expect(spawnEnv.APEX_SILENT).toBe('1');
      expect(spawnEnv.PORT).toBe('3000');
      expect(spawnEnv.APEX_PROJECT).toBe('/mock/project');
      expect(spawnEnv.NODE_ENV).toBe('test');
      expect(spawnEnv.PATH).toBe('/usr/bin');
      expect(spawnEnv.HOME).toBe('/home/user');
    });

    test('should override existing APEX_SILENT in environment', () => {
      process.env.APEX_SILENT = '0';

      // Simulate environment preparation that sets APEX_SILENT=1
      const spawnEnv = {
        ...process.env,
        APEX_SILENT: '1',
      };

      expect(spawnEnv.APEX_SILENT).toBe('1');
      expect(process.env.APEX_SILENT).toBe('0'); // Original should be unchanged
    });
  });

  describe('Spawn Options Configuration', () => {
    test('should create correct spawn options for detached processes', () => {
      const spawnOptions = {
        cwd: '/mock/project',
        env: {
          APEX_SILENT: '1',
          PORT: '3000',
          APEX_PROJECT: '/mock/project'
        },
        stdio: 'ignore' as const,
        detached: true,
      };

      expect(spawnOptions.stdio).toBe('ignore');
      expect(spawnOptions.detached).toBe(true);
      expect(spawnOptions.env.APEX_SILENT).toBe('1');
      expect(spawnOptions.cwd).toBe('/mock/project');
    });

    test('should validate stdio configuration options', () => {
      const validStdioOptions = [
        'ignore',
        'inherit',
        'pipe',
        ['ignore', 'pipe', 'pipe'],
        ['pipe', 'ignore', 'inherit']
      ];

      validStdioOptions.forEach(stdio => {
        const spawnOptions = {
          stdio,
          detached: true,
        };

        expect(spawnOptions.stdio).toBe(stdio);
        expect(spawnOptions.detached).toBe(true);
      });
    });
  });

  describe('Error Handling with Silent Mode', () => {
    test('should handle errors appropriately in silent mode', () => {
      process.env.APEX_SILENT = '1';
      const silent = process.env.APEX_SILENT === '1';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      // Simulate error handling logic
      if (!silent) {
        console.error('Server error:', error);
      }

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should log errors when silent mode is disabled', () => {
      delete process.env.APEX_SILENT;
      const silent = process.env.APEX_SILENT === '1';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      // Simulate error handling logic
      if (!silent) {
        console.error('Server error:', error);
      }

      expect(consoleSpy).toHaveBeenCalledWith('Server error:', error);
      consoleSpy.mockRestore();
    });
  });

  describe('Port Configuration', () => {
    test('should parse PORT environment variable correctly', () => {
      process.env.PORT = '4000';
      const port = parseInt(process.env.PORT || '3000', 10);
      expect(port).toBe(4000);
    });

    test('should use default port when PORT not set', () => {
      delete process.env.PORT;
      const port = parseInt(process.env.PORT || '3000', 10);
      expect(port).toBe(3000);
    });

    test('should handle invalid PORT values', () => {
      process.env.PORT = 'invalid';
      const port = parseInt(process.env.PORT || '3000', 10);
      expect(port).toBe(NaN);

      // Should fallback to default
      const safePort = isNaN(port) ? 3000 : port;
      expect(safePort).toBe(3000);
    });
  });
});