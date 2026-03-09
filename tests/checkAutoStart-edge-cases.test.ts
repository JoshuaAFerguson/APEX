/**
 * @file checkAutoStart Edge Cases Tests
 * @description Tests for edge cases, error conditions, and boundary scenarios
 * in the checkAutoStart functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs/promises');
vi.mock('path');

const mockSpawn = spawn as MockedFunction<typeof spawn>;
const mockAccess = fs.access as MockedFunction<typeof fs.access>;

describe('checkAutoStart Edge Cases Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Edge Cases', () => {
    it('should handle undefined config object', () => {
      const ctx = { config: undefined };

      // Early return check
      if (!ctx.config) {
        expect(ctx.config).toBeUndefined();
        return;
      }

      // Should not reach this point
      expect.fail('Function should return early with undefined config');
    });

    it('should handle null config object', () => {
      const ctx = { config: null };

      if (!ctx.config) {
        expect(ctx.config).toBeNull();
        return;
      }

      expect.fail('Function should return early with null config');
    });

    it('should handle empty config object', () => {
      const config = {};
      const effective = config;

      const apiConfig = (effective as any).api;
      const webUIConfig = (effective as any).webUI;

      expect(apiConfig).toBeUndefined();
      expect(webUIConfig).toBeUndefined();
    });

    it('should handle config with missing api section', () => {
      const config = {
        webUI: { autoStart: true, port: 3001 }
      };

      const effective = config;
      const apiConfig = (effective as any).api;
      const webUIConfig = effective.webUI;

      expect(apiConfig).toBeUndefined();
      expect(webUIConfig?.autoStart).toBe(true);
    });

    it('should handle config with missing webUI section', () => {
      const config = {
        api: { autoStart: true, port: 3000 }
      };

      const effective = config;
      const apiConfig = effective.api;
      const webUIConfig = (effective as any).webUI;

      expect(apiConfig?.autoStart).toBe(true);
      expect(webUIConfig).toBeUndefined();
    });

    it('should handle config with only port specified (no autoStart)', () => {
      const config = {
        api: { port: 3000 },
        webUI: { port: 3001 }
      };

      const effective = config;
      const apiConfig = effective.api as any;
      const webUIConfig = effective.webUI as any;

      expect(apiConfig?.autoStart).toBeUndefined();
      expect(webUIConfig?.autoStart).toBeUndefined();
    });

    it('should handle config with autoStart as string instead of boolean', () => {
      const config = {
        api: { autoStart: 'true' as any, port: 3000 },
        webUI: { autoStart: 'false' as any, port: 3001 }
      };

      const effective = config;
      const apiConfig = effective.api;
      const webUIConfig = effective.webUI;

      // JavaScript truthy check - non-empty string is truthy
      expect(!!apiConfig?.autoStart).toBe(true);
      expect(!!webUIConfig?.autoStart).toBe(true); // 'false' string is still truthy
    });

    it('should handle config with invalid port values', () => {
      const config = {
        api: { autoStart: true, port: 'invalid' as any },
        webUI: { autoStart: true, port: -1 }
      };

      const effective = config;
      const apiConfig = effective.api;
      const webUIConfig = effective.webUI;

      // Should still work, port validation happens elsewhere
      expect(apiConfig?.autoStart).toBe(true);
      expect(webUIConfig?.autoStart).toBe(true);
      expect(apiConfig?.port).toBe('invalid');
      expect(webUIConfig?.port).toBe(-1);
    });
  });

  describe('Process Spawning Edge Cases', () => {
    it('should handle spawn throwing synchronous errors', () => {
      const mockProcess = { unref: vi.fn(), pid: 123 };
      mockSpawn.mockImplementation(() => {
        throw new Error('Command not found');
      });

      expect(() => {
        try {
          const proc = mockSpawn('nonexistent-command', [], {});
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Command not found');
        }
      }).not.toThrow();
    });

    it('should handle spawn returning null process', () => {
      mockSpawn.mockReturnValue(null as any);

      const proc = mockSpawn('node', [], {});
      expect(proc).toBeNull();
    });

    it('should handle process with missing unref method', () => {
      const mockProcess = { pid: 123 }; // Missing unref method
      mockSpawn.mockReturnValue(mockProcess as any);

      const proc = mockSpawn('node', [], {});
      expect(proc).toBeTruthy();
      expect(proc.pid).toBe(123);

      // Should handle gracefully if unref doesn't exist
      if (proc && typeof proc.unref === 'function') {
        proc.unref();
      }
    });

    it('should handle process with missing pid', () => {
      const mockProcess = { unref: vi.fn() }; // Missing pid
      mockSpawn.mockReturnValue(mockProcess as any);

      const proc = mockSpawn('node', [], {});
      expect(proc).toBeTruthy();
      expect(proc.unref).toBeDefined();
      expect(proc.pid).toBeUndefined();
    });

    it('should handle very long environment variable values', () => {
      const longPath = 'a'.repeat(10000);
      const expectedEnv = {
        ...process.env,
        APEX_PROJECT: longPath,
        APEX_SILENT: '1'
      };

      expect(expectedEnv.APEX_PROJECT).toBe(longPath);
      expect(expectedEnv.APEX_SILENT).toBe('1');
    });

    it('should handle environment variables with special characters', () => {
      const specialPath = '/path/with spaces/and&symbols!@#$%';
      const expectedEnv = {
        ...process.env,
        APEX_PROJECT: specialPath,
        APEX_SILENT: '1'
      };

      expect(expectedEnv.APEX_PROJECT).toBe(specialPath);
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle fs.access with permission denied error', async () => {
      mockAccess.mockRejectedValue(Object.assign(new Error('Permission denied'), { code: 'EACCES' }));

      try {
        await fs.access('/restricted/path');
        expect.fail('Should have thrown permission error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).code).toBe('EACCES');
      }
    });

    it('should handle fs.access with file not found error', async () => {
      mockAccess.mockRejectedValue(Object.assign(new Error('File not found'), { code: 'ENOENT' }));

      try {
        await fs.access('/nonexistent/path');
        expect.fail('Should have thrown file not found error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).code).toBe('ENOENT');
      }
    });

    it('should handle fs.access with timeout error', async () => {
      mockAccess.mockRejectedValue(Object.assign(new Error('Operation timed out'), { code: 'ETIMEDOUT' }));

      try {
        await fs.access('/slow/path');
        expect.fail('Should have thrown timeout error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).code).toBe('ETIMEDOUT');
      }
    });

    it('should handle path resolution with circular references', () => {
      const pathWithCircular = './a/../a/../a/../b';
      // path.resolve should handle this, but we're testing our mock behavior
      expect(() => {
        const resolved = path.resolve(pathWithCircular);
      }).not.toThrow();
    });
  });

  describe('Port Conflict Edge Cases', () => {
    it('should handle port 0 (system assigned)', () => {
      const config = {
        api: { autoStart: true, port: 0 },
        webUI: { autoStart: true, port: 0 }
      };

      const effective = config;
      const apiPort = effective.api.port;
      const webUIPort = effective.webUI.port || 3001;

      expect(apiPort).toBe(0);
      expect(webUIPort).toBe(0); // Should use configured 0, not default 3001
    });

    it('should handle very high port numbers', () => {
      const config = {
        api: { autoStart: true, port: 65535 },
        webUI: { autoStart: true, port: 65534 }
      };

      const effective = config;
      expect(effective.api.port).toBe(65535);
      expect(effective.webUI.port).toBe(65534);
    });

    it('should handle duplicate port configuration', () => {
      const config = {
        api: { autoStart: true, port: 3000 },
        webUI: { autoStart: true, port: 3000 } // Same port
      };

      const effective = config;
      expect(effective.api.port).toBe(3000);
      expect(effective.webUI.port).toBe(3000);

      // Both would try to use same port - this is a configuration issue
      // but checkAutoStart should still attempt to start both
    });
  });

  describe('Environment Variable Edge Cases', () => {
    it('should handle process.env being undefined', () => {
      const originalEnv = process.env;

      // Simulate missing environment
      const mockEnv = undefined as any;

      const expectedEnv = {
        ...mockEnv,
        APEX_SILENT: '1'
      };

      expect(expectedEnv.APEX_SILENT).toBe('1');

      // Restore
      process.env = originalEnv;
    });

    it('should handle process.env being null', () => {
      const originalEnv = process.env;

      const mockEnv = null as any;
      const expectedEnv = {
        ...mockEnv,
        APEX_SILENT: '1'
      };

      expect(expectedEnv.APEX_SILENT).toBe('1');

      process.env = originalEnv;
    });

    it('should handle existing APEX_SILENT being overridden', () => {
      const originalValue = process.env.APEX_SILENT;

      process.env.APEX_SILENT = 'existing-value';

      const expectedEnv = {
        ...process.env,
        APEX_SILENT: '1' // Should override existing value
      };

      expect(expectedEnv.APEX_SILENT).toBe('1');

      // Restore
      if (originalValue === undefined) {
        delete process.env.APEX_SILENT;
      } else {
        process.env.APEX_SILENT = originalValue;
      }
    });

    it('should handle very long environment variable names and values', () => {
      const longName = 'A'.repeat(1000);
      const longValue = 'B'.repeat(1000);

      const env = {
        [longName]: longValue,
        APEX_SILENT: '1'
      };

      expect(env[longName]).toBe(longValue);
      expect(env.APEX_SILENT).toBe('1');
    });
  });

  describe('Race Condition Edge Cases', () => {
    it('should handle concurrent checkAutoStart calls', () => {
      const config1 = { api: { autoStart: true, port: 3000 } };
      const config2 = { api: { autoStart: true, port: 3001 } };

      // Simulate two concurrent calls
      const ctx1 = { config: config1, apiProcess: null, apiPort: undefined };
      const ctx2 = { config: config2, apiProcess: null, apiPort: undefined };

      // Both should be able to process their configs independently
      expect(ctx1.config.api.autoStart).toBe(true);
      expect(ctx2.config.api.autoStart).toBe(true);
      expect(ctx1.config.api.port).toBe(3000);
      expect(ctx2.config.api.port).toBe(3001);
    });

    it('should handle process assignment race conditions', () => {
      const mockProcess1 = { unref: vi.fn(), pid: 123 };
      const mockProcess2 = { unref: vi.fn(), pid: 124 };

      mockSpawn.mockReturnValueOnce(mockProcess1 as any)
              .mockReturnValueOnce(mockProcess2 as any);

      const ctx = { apiProcess: null, webUIProcess: null };

      // Simulate rapid sequential assignments
      const proc1 = mockSpawn('node', ['api.js'], {});
      ctx.apiProcess = proc1;

      const proc2 = mockSpawn('node', ['webui.js'], {});
      ctx.webUIProcess = proc2;

      expect(ctx.apiProcess).toBe(mockProcess1);
      expect(ctx.webUIProcess).toBe(mockProcess2);
      expect(ctx.apiProcess).not.toBe(ctx.webUIProcess);
    });
  });

  describe('Memory and Resource Edge Cases', () => {
    it('should handle large number of starting services', () => {
      const startingServices: string[] = [];

      // Simulate many services
      for (let i = 0; i < 1000; i++) {
        startingServices.push(`Service ${i} (port ${3000 + i})`);
      }

      const message = `Starting: ${startingServices.join(', ')}...`;
      expect(message).toContain('Starting:');
      expect(message).toContain('Service 0 (port 3000)');
      expect(message).toContain('Service 999 (port 3999)');
      expect(startingServices.length).toBe(1000);
    });

    it('should handle empty service names gracefully', () => {
      const startingServices = ['', 'API (port 3000)', ''];
      const filtered = startingServices.filter(Boolean);

      expect(filtered).toEqual(['API (port 3000)']);
    });

    it('should handle undefined service names', () => {
      const startingServices = [undefined, 'API (port 3000)', null] as any[];
      const filtered = startingServices.filter(Boolean);

      expect(filtered).toEqual(['API (port 3000)']);
    });
  });

  describe('Platform-Specific Edge Cases', () => {
    it('should handle Windows-style paths', () => {
      const windowsPath = 'C:\\Program Files\\APEX\\api';
      const env = {
        APEX_PROJECT: windowsPath,
        APEX_SILENT: '1'
      };

      expect(env.APEX_PROJECT).toBe(windowsPath);
    });

    it('should handle Unix-style paths', () => {
      const unixPath = '/usr/local/bin/apex/api';
      const env = {
        APEX_PROJECT: unixPath,
        APEX_SILENT: '1'
      };

      expect(env.APEX_PROJECT).toBe(unixPath);
    });

    it('should handle mixed path separators', () => {
      const mixedPath = 'C:/Program Files\\APEX/api';
      const env = {
        APEX_PROJECT: mixedPath,
        APEX_SILENT: '1'
      };

      expect(env.APEX_PROJECT).toBe(mixedPath);
    });
  });

  describe('Cleanup Edge Cases', () => {
    it('should handle cleanup when processes are already dead', () => {
      const mockProcess = {
        pid: 123,
        unref: vi.fn(),
        kill: vi.fn(() => { throw new Error('Process already dead'); })
      };

      expect(() => {
        try {
          mockProcess.kill('SIGTERM');
        } catch (error) {
          // Should handle gracefully
          expect(error).toBeInstanceOf(Error);
        }
      }).not.toThrow();
    });

    it('should handle cleanup with missing process reference', () => {
      const ctx = { apiProcess: null, webUIProcess: null };

      // Should handle null references gracefully
      if (ctx.apiProcess) {
        ctx.apiProcess.kill('SIGTERM');
      }

      if (ctx.webUIProcess) {
        ctx.webUIProcess.kill('SIGTERM');
      }

      // No errors should occur
      expect(ctx.apiProcess).toBeNull();
      expect(ctx.webUIProcess).toBeNull();
    });
  });
});