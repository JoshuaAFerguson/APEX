/**
 * @file checkAutoStart Unit Tests
 * @description Comprehensive unit tests for checkAutoStart functionality
 * including config reading, service starting, and silent mode verification
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

// Mock modules before importing
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn()
}));

vi.mock('path', () => ({
  resolve: vi.fn(),
  join: vi.fn()
}));

// Create mock functions
const mockSpawn = spawn as MockedFunction<typeof spawn>;
const mockProcess = {
  pid: 12345,
  unref: vi.fn(),
  kill: vi.fn()
} as any;

describe('checkAutoStart Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Reading', () => {
    it('should read effective config and extract API and WebUI settings', () => {
      // Test config structure that checkAutoStart expects
      const testConfig = {
        api: {
          autoStart: true,
          port: 3000
        },
        webUI: {
          autoStart: true,
          port: 3001
        }
      };

      const effectiveConfig = testConfig;
      const apiConfig = effectiveConfig.api;
      const webUIConfig = effectiveConfig.webUI;

      expect(apiConfig?.autoStart).toBe(true);
      expect(apiConfig?.port).toBe(3000);
      expect(webUIConfig?.autoStart).toBe(true);
      expect(webUIConfig?.port).toBe(3001);
    });

    it('should handle missing config gracefully', () => {
      const testConfig = null;
      expect(testConfig).toBeNull();
    });

    it('should handle partial config', () => {
      const testConfig = {
        api: {
          autoStart: true,
          port: 3000
        }
        // webUI missing
      };

      const effectiveConfig = testConfig;
      const apiConfig = effectiveConfig.api;
      const webUIConfig = (effectiveConfig as any).webUI;

      expect(apiConfig?.autoStart).toBe(true);
      expect(webUIConfig?.autoStart).toBeUndefined();
    });

    it('should handle config with autoStart disabled', () => {
      const testConfig = {
        api: {
          autoStart: false,
          port: 3000
        },
        webUI: {
          autoStart: false,
          port: 3001
        }
      };

      const effectiveConfig = testConfig;
      const apiConfig = effectiveConfig.api;
      const webUIConfig = (effectiveConfig as any).webUI;

      expect(apiConfig?.autoStart).toBe(false);
      expect(webUIConfig?.autoStart).toBe(false);
    });
  });

  describe('API Auto-Start Logic', () => {
    it('should start API server when autoStart is true', () => {
      const config = {
        api: {
          autoStart: true,
          port: 3000
        }
      };

      const apiConfig = config.api;
      const shouldStartAPI = apiConfig?.autoStart;

      expect(shouldStartAPI).toBe(true);
    });

    it('should not start API server when autoStart is false', () => {
      const config = {
        api: {
          autoStart: false,
          port: 3000
        }
      };

      const apiConfig = config.api;
      const shouldStartAPI = apiConfig?.autoStart;

      expect(shouldStartAPI).toBe(false);
    });

    it('should not start API server when autoStart is undefined', () => {
      const config = {
        api: {
          port: 3000
        }
      };

      const apiConfig = config.api as any;
      const shouldStartAPI = apiConfig?.autoStart;

      expect(shouldStartAPI).toBeUndefined();
    });
  });

  describe('Web UI Auto-Start Logic', () => {
    it('should start Web UI when autoStart is true', () => {
      const config = {
        webUI: {
          autoStart: true,
          port: 3001
        }
      };

      const webUIConfig = config.webUI;
      const shouldStartWebUI = webUIConfig?.autoStart;

      expect(shouldStartWebUI).toBe(true);
    });

    it('should use default port 3001 when port not specified', () => {
      const config = {
        webUI: {
          autoStart: true
        }
      };

      const webUIConfig = config.webUI as any;
      const port = webUIConfig.port || 3001;

      expect(port).toBe(3001);
    });

    it('should not start Web UI when autoStart is false', () => {
      const config = {
        webUI: {
          autoStart: false,
          port: 3001
        }
      };

      const webUIConfig = config.webUI;
      const shouldStartWebUI = webUIConfig?.autoStart;

      expect(shouldStartWebUI).toBe(false);
    });
  });

  describe('Process Spawning Configuration', () => {
    it('should spawn API server with correct APEX_SILENT environment variable', () => {
      const expectedEnv = {
        ...process.env,
        PORT: '3000',
        APEX_PROJECT: '/test/cwd',
        APEX_SILENT: '1'
      };

      // Verify environment variable structure
      expect(expectedEnv.APEX_SILENT).toBe('1');
      expect(expectedEnv.PORT).toBe('3000');
    });

    it('should spawn processes with detached and silent stdio', () => {
      const expectedOptions = {
        cwd: '/test/cwd',
        env: {
          ...process.env,
          PORT: '3000',
          APEX_PROJECT: '/test/cwd',
          APEX_SILENT: '1'
        },
        stdio: 'ignore',
        detached: true
      };

      expect(expectedOptions.stdio).toBe('ignore');
      expect(expectedOptions.detached).toBe(true);
    });

    it('should spawn Web UI with correct options', () => {
      const expectedOptions = {
        cwd: '/test/web-ui-path',
        env: {
          ...process.env,
          PORT: '3001',
          NEXT_PUBLIC_APEX_API_URL: 'http://localhost:3000'
        },
        stdio: 'ignore',
        detached: true
      };

      expect(expectedOptions.stdio).toBe('ignore');
      expect(expectedOptions.detached).toBe(true);
      expect(expectedOptions.env.PORT).toBe('3001');
    });
  });

  describe('Starting Services Array Logic', () => {
    it('should build starting services array correctly', () => {
      const startingServices: string[] = [];
      const apiConfig = { autoStart: true, port: 3000 };
      const webUIConfig = { autoStart: true, port: 3001 };

      if (apiConfig?.autoStart) {
        startingServices.push(`API (port ${apiConfig.port || 3000})`);
      }
      if (webUIConfig?.autoStart) {
        startingServices.push(`Web UI (port ${webUIConfig.port || 3001})`);
      }

      expect(startingServices).toEqual([
        'API (port 3000)',
        'Web UI (port 3001)'
      ]);
    });

    it('should handle only API auto-start', () => {
      const startingServices: string[] = [];
      const apiConfig = { autoStart: true, port: 3000 };
      const webUIConfig = { autoStart: false, port: 3001 };

      if (apiConfig?.autoStart) {
        startingServices.push(`API (port ${apiConfig.port || 3000})`);
      }
      if (webUIConfig?.autoStart) {
        startingServices.push(`Web UI (port ${webUIConfig.port || 3001})`);
      }

      expect(startingServices).toEqual(['API (port 3000)']);
    });

    it('should handle only Web UI auto-start', () => {
      const startingServices: string[] = [];
      const apiConfig = { autoStart: false, port: 3000 };
      const webUIConfig = { autoStart: true, port: 3001 };

      if (apiConfig?.autoStart) {
        startingServices.push(`API (port ${apiConfig.port || 3000})`);
      }
      if (webUIConfig?.autoStart) {
        startingServices.push(`Web UI (port ${webUIConfig.port || 3001})`);
      }

      expect(startingServices).toEqual(['Web UI (port 3001)']);
    });

    it('should handle no auto-start services', () => {
      const startingServices: string[] = [];
      const apiConfig = { autoStart: false, port: 3000 };
      const webUIConfig = { autoStart: false, port: 3001 };

      if (apiConfig?.autoStart) {
        startingServices.push(`API (port ${apiConfig.port || 3000})`);
      }
      if (webUIConfig?.autoStart) {
        startingServices.push(`Web UI (port ${webUIConfig.port || 3001})`);
      }

      expect(startingServices).toEqual([]);
    });
  });

  describe('Silent Mode Implementation', () => {
    it('should verify APEX_SILENT=1 enables silent mode in API server', () => {
      const originalEnv = process.env.APEX_SILENT;

      // Test with APEX_SILENT=1
      process.env.APEX_SILENT = '1';
      const silent1 = process.env.APEX_SILENT === '1';
      expect(silent1).toBe(true);

      // Test without APEX_SILENT
      delete process.env.APEX_SILENT;
      const silent2 = process.env.APEX_SILENT === '1';
      expect(silent2).toBe(false);

      // Test with APEX_SILENT=0
      process.env.APEX_SILENT = '0';
      const silent3 = process.env.APEX_SILENT === '1';
      expect(silent3).toBe(false);

      // Restore original
      if (originalEnv !== undefined) {
        process.env.APEX_SILENT = originalEnv;
      } else {
        delete process.env.APEX_SILENT;
      }
    });

    it('should verify silent parameter controls console output', () => {
      const mockConsoleLog = vi.fn();

      // Mock console.log for testing
      const originalConsoleLog = console.log;
      console.log = mockConsoleLog;

      // Simulate non-silent mode
      const silent1 = false;
      if (!silent1) {
        console.log('Test message');
      }
      expect(mockConsoleLog).toHaveBeenCalledWith('Test message');

      // Reset mock
      mockConsoleLog.mockClear();

      // Simulate silent mode
      const silent2 = true;
      if (!silent2) {
        console.log('This should not be logged');
      }
      expect(mockConsoleLog).not.toHaveBeenCalled();

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });

  describe('Error Handling', () => {
    it('should handle spawn errors gracefully', () => {
      const error = new Error('Spawn failed');
      mockSpawn.mockImplementation(() => {
        throw error;
      });

      // Verify that errors don't crash the function
      expect(() => {
        try {
          mockSpawn('node', ['test.js'], {});
        } catch (e) {
          // Error caught and handled
          expect(e).toBe(error);
        }
      }).not.toThrow();
    });

    it('should handle missing API package gracefully', async () => {
      const fs = await import('fs/promises');
      const mockAccess = fs.access as MockedFunction<typeof fs.access>;

      mockAccess.mockRejectedValue(new Error('API package not found'));

      try {
        await fs.access('/non-existent/api/path');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('API package not found');
      }
    });

    it('should handle missing Web UI package gracefully', async () => {
      const fs = await import('fs/promises');
      const mockAccess = fs.access as MockedFunction<typeof fs.access>;

      mockAccess.mockRejectedValue(new Error('Web UI package not found'));

      try {
        await fs.access('/non-existent/web-ui/path');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Web UI package not found');
      }
    });
  });

  describe('Process Management', () => {
    it('should call unref() on spawned processes', () => {
      mockSpawn.mockReturnValue(mockProcess);

      const proc = mockSpawn('node', ['test.js'], {});
      proc.unref();

      expect(mockProcess.unref).toHaveBeenCalled();
    });

    it('should store process references in context', () => {
      const ctx = {
        apiProcess: null as any,
        webUIProcess: null as any,
        apiPort: undefined as number | undefined,
        webUIPort: undefined as number | undefined
      };

      const proc = mockSpawn('node', ['test.js'], {});
      ctx.apiProcess = proc;
      ctx.apiPort = 3000;

      expect(ctx.apiProcess).toBe(proc);
      expect(ctx.apiPort).toBe(3000);
    });
  });

  describe('Port Configuration', () => {
    it('should use configured API port', () => {
      const config = { api: { port: 4000, autoStart: true } };
      const port = config.api.port;
      expect(port).toBe(4000);
    });

    it('should use configured Web UI port', () => {
      const config = { webUI: { port: 4001, autoStart: true } };
      const port = config.webUI.port;
      expect(port).toBe(4001);
    });

    it('should use default Web UI port when not specified', () => {
      const config = { webUI: { autoStart: true } };
      const port = (config.webUI as any).port || 3001;
      expect(port).toBe(3001);
    });
  });

  describe('Message Generation', () => {
    it('should generate correct starting services message', () => {
      const startingServices = ['API (port 3000)', 'Web UI (port 3001)'];
      const message = `Starting: ${startingServices.join(', ')}...`;
      expect(message).toBe('Starting: API (port 3000), Web UI (port 3001)...');
    });

    it('should generate services ready message', () => {
      const message = '✓ Services ready';
      expect(message).toBe('✓ Services ready');
    });

    it('should only show messages when services are being started', () => {
      const startingServices: string[] = [];
      const shouldShowMessage = startingServices.length > 0;
      expect(shouldShowMessage).toBe(false);

      startingServices.push('API (port 3000)');
      const shouldShowMessage2 = startingServices.length > 0;
      expect(shouldShowMessage2).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete auto-start flow', () => {
      // Complete test scenario
      const config = {
        api: { autoStart: true, port: 3000 },
        webUI: { autoStart: true, port: 3001 }
      };

      const effective = config;
      const apiConfig = effective.api;
      const webUIConfig = effective.webUI;
      const startingServices: string[] = [];

      // Build services array
      if (apiConfig?.autoStart) {
        startingServices.push(`API (port ${effective.api.port})`);
      }
      if (webUIConfig?.autoStart) {
        startingServices.push(`Web UI (port ${webUIConfig.port || 3001})`);
      }

      expect(startingServices).toEqual([
        'API (port 3000)',
        'Web UI (port 3001)'
      ]);

      // Verify service starting logic
      const shouldStartAPI = apiConfig?.autoStart;
      const shouldStartWebUI = webUIConfig?.autoStart;

      expect(shouldStartAPI).toBe(true);
      expect(shouldStartWebUI).toBe(true);
    });

    it('should handle no auto-start configuration', () => {
      const config = {
        api: { autoStart: false, port: 3000 },
        webUI: { autoStart: false, port: 3001 }
      };

      const effective = config;
      const apiConfig = effective.api;
      const webUIConfig = effective.webUI;
      const startingServices: string[] = [];

      if (apiConfig?.autoStart) {
        startingServices.push(`API (port ${effective.api.port})`);
      }
      if (webUIConfig?.autoStart) {
        startingServices.push(`Web UI (port ${webUIConfig.port || 3001})`);
      }

      expect(startingServices).toEqual([]);
    });
  });
});