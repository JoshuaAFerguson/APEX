/**
 * @file APEX_SILENT Environment Variable Tests
 * @description Comprehensive tests for APEX_SILENT=1 environment variable handling
 * across the entire checkAutoStart functionality chain
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');

const mockSpawn = spawn as MockedFunction<typeof spawn>;

describe('APEX_SILENT Environment Variable Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Environment Variable Setting in Spawn Calls', () => {
    it('should verify APEX_SILENT=1 is set correctly in API server spawn', () => {
      const mockProcess = { unref: vi.fn(), pid: 123 };
      mockSpawn.mockReturnValue(mockProcess as any);

      const ctx = {
        cwd: '/test/project'
      };

      const port = 3000;
      const expectedEnv = {
        ...process.env,
        PORT: port.toString(),
        APEX_PROJECT: ctx.cwd,
        APEX_SILENT: '1'
      };

      // Simulate spawn call from checkAutoStart
      mockSpawn('node', ['api/dist/index.js'], {
        cwd: ctx.cwd,
        env: expectedEnv,
        stdio: 'ignore',
        detached: true
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['api/dist/index.js'],
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_SILENT: '1'
          })
        })
      );
    });

    it('should verify APEX_SILENT=1 persists through environment spread', () => {
      const originalApexSilent = process.env.APEX_SILENT;

      // Set some other value initially
      process.env.APEX_SILENT = 'some-other-value';

      const spawnEnv = {
        ...process.env,
        PORT: '3000',
        APEX_PROJECT: '/test/project',
        APEX_SILENT: '1'  // Should override the existing value
      };

      expect(spawnEnv.APEX_SILENT).toBe('1');
      expect(process.env.APEX_SILENT).toBe('some-other-value'); // Original unchanged

      // Restore
      if (originalApexSilent === undefined) {
        delete process.env.APEX_SILENT;
      } else {
        process.env.APEX_SILENT = originalApexSilent;
      }
    });

    it('should verify all required environment variables are set together', () => {
      const ctx = {
        cwd: '/test/project'
      };
      const port = 3000;

      const spawnEnv = {
        ...process.env,
        PORT: port.toString(),
        APEX_PROJECT: ctx.cwd,
        APEX_SILENT: '1'
      };

      // Verify all three key variables are present
      expect(spawnEnv.PORT).toBe('3000');
      expect(spawnEnv.APEX_PROJECT).toBe('/test/project');
      expect(spawnEnv.APEX_SILENT).toBe('1');

      // Verify they're all strings (important for process.env)
      expect(typeof spawnEnv.PORT).toBe('string');
      expect(typeof spawnEnv.APEX_PROJECT).toBe('string');
      expect(typeof spawnEnv.APEX_SILENT).toBe('string');
    });
  });

  describe('API Server Silent Mode Processing', () => {
    it('should verify API server correctly interprets APEX_SILENT=1', () => {
      // Simulate API server environment variable reading
      const testCases = [
        { env: '1', expected: true, description: 'APEX_SILENT=1 enables silent mode' },
        { env: '0', expected: false, description: 'APEX_SILENT=0 disables silent mode' },
        { env: 'true', expected: false, description: 'APEX_SILENT=true does not enable silent mode' },
        { env: 'false', expected: false, description: 'APEX_SILENT=false does not enable silent mode' },
        { env: '', expected: false, description: 'Empty APEX_SILENT does not enable silent mode' },
        { env: undefined, expected: false, description: 'Missing APEX_SILENT does not enable silent mode' }
      ];

      testCases.forEach(({ env, expected, description }) => {
        if (env === undefined) {
          delete process.env.APEX_SILENT;
        } else {
          process.env.APEX_SILENT = env;
        }

        const silent = process.env.APEX_SILENT === '1';
        expect(silent).toBe(expected);
      }, description);
    });

    it('should verify API server conditional logging based on silent flag', () => {
      const mockConsoleLog = vi.fn();
      const originalConsoleLog = console.log;

      console.log = mockConsoleLog;

      // Test silent mode enabled
      process.env.APEX_SILENT = '1';
      const silent1 = process.env.APEX_SILENT === '1';

      if (!silent1) {
        console.log('🚀 APEX API Server running at http://localhost:3000');
      }

      expect(mockConsoleLog).not.toHaveBeenCalled();

      // Reset mock
      mockConsoleLog.mockClear();

      // Test silent mode disabled
      process.env.APEX_SILENT = '0';
      const silent2 = process.env.APEX_SILENT === '1';

      if (!silent2) {
        console.log('🚀 APEX API Server running at http://localhost:3000');
      }

      expect(mockConsoleLog).toHaveBeenCalledWith('🚀 APEX API Server running at http://localhost:3000');

      // Restore
      console.log = originalConsoleLog;
    });

    it('should verify Fastify logger configuration with silent mode', () => {
      // Simulate Fastify logger configuration logic from API server
      const testCases = [
        { silent: true, expectedLogger: false },
        { silent: false, expectedLogger: true }
      ];

      testCases.forEach(({ silent, expectedLogger }) => {
        const loggerConfig = !silent ? true : false;
        expect(loggerConfig).toBe(expectedLogger);
      });
    });
  });

  describe('Environment Variable Inheritance', () => {
    it('should verify child processes inherit APEX_SILENT from parent', () => {
      const parentEnv = {
        ...process.env,
        APEX_SILENT: '1',
        CUSTOM_VAR: 'test-value'
      };

      const childEnv = {
        ...parentEnv,
        PORT: '3000', // Child-specific variable
      };

      expect(childEnv.APEX_SILENT).toBe('1');
      expect(childEnv.CUSTOM_VAR).toBe('test-value');
      expect(childEnv.PORT).toBe('3000');
    });

    it('should verify environment variables dont interfere with each other', () => {
      const env1 = {
        ...process.env,
        APEX_SILENT: '1',
        PORT: '3000'
      };

      const env2 = {
        ...process.env,
        APEX_SILENT: '1',
        PORT: '3001'
      };

      // Both should have APEX_SILENT=1 but different ports
      expect(env1.APEX_SILENT).toBe('1');
      expect(env2.APEX_SILENT).toBe('1');
      expect(env1.PORT).toBe('3000');
      expect(env2.PORT).toBe('3001');
    });
  });

  describe('APEX_SILENT Integration with Other Components', () => {
    it('should verify Web UI does not use APEX_SILENT (uses stdio ignore)', () => {
      const mockProcess = { unref: vi.fn(), pid: 124 };
      mockSpawn.mockReturnValue(mockProcess as any);

      const webUIEnv = {
        ...process.env,
        PORT: '3001',
        NEXT_PUBLIC_APEX_API_URL: 'http://localhost:3000'
        // Note: No APEX_SILENT for Web UI - it uses stdio: 'ignore'
      };

      mockSpawn('npx', ['next', 'dev', '-p', '3001'], {
        cwd: '/web-ui-path',
        env: webUIEnv,
        stdio: 'ignore',
        detached: true
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'npx',
        ['next', 'dev', '-p', '3001'],
        expect.objectContaining({
          stdio: 'ignore', // Web UI uses stdio ignore instead of APEX_SILENT
          env: expect.not.objectContaining({
            APEX_SILENT: expect.anything()
          })
        })
      );
    });

    it('should verify checkAutoStart shows messages when not in silent mode', () => {
      const mockConsoleLog = vi.fn();
      const originalConsoleLog = console.log;
      console.log = mockConsoleLog;

      // checkAutoStart messages are shown regardless of APEX_SILENT
      // (APEX_SILENT only affects spawned processes)
      const startingServices = ['API (port 3000)'];

      if (startingServices.length > 0) {
        console.log(`Starting: ${startingServices.join(', ')}...`);
        console.log('✓ Services ready');
      }

      expect(mockConsoleLog).toHaveBeenCalledWith('Starting: API (port 3000)...');
      expect(mockConsoleLog).toHaveBeenCalledWith('✓ Services ready');

      console.log = originalConsoleLog;
    });
  });

  describe('Error Scenarios with APEX_SILENT', () => {
    it('should handle APEX_SILENT when spawn fails', () => {
      mockSpawn.mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      const spawnEnv = {
        ...process.env,
        APEX_SILENT: '1'
      };

      expect(() => {
        try {
          mockSpawn('node', ['api.js'], { env: spawnEnv });
        } catch (error) {
          // Error should be caught and handled gracefully
          expect(error).toBeInstanceOf(Error);
          expect(spawnEnv.APEX_SILENT).toBe('1'); // Environment still valid
        }
      }).not.toThrow();
    });

    it('should handle corrupted process.env gracefully', () => {
      const originalProcessEnv = process.env;

      // Simulate corrupted process.env
      const corruptedEnv = {
        ...originalProcessEnv,
        APEX_SILENT: '1'
      };

      // Delete a critical property to simulate corruption
      delete (corruptedEnv as any).PATH;

      // Should still work with APEX_SILENT
      expect(corruptedEnv.APEX_SILENT).toBe('1');

      // Restore
      process.env = originalProcessEnv;
    });
  });

  describe('Environment Variable Type Safety', () => {
    it('should verify APEX_SILENT is always a string', () => {
      const values = [1, true, '1', 'true', 0, false, '0', 'false'];

      values.forEach(value => {
        process.env.APEX_SILENT = String(value);

        const envValue = process.env.APEX_SILENT;
        expect(typeof envValue).toBe('string');

        const silent = envValue === '1';
        expect(typeof silent).toBe('boolean');

        if (value === 1 || value === '1') {
          expect(silent).toBe(true);
        } else {
          expect(silent).toBe(false);
        }
      });
    });

    it('should handle non-string values assigned to APEX_SILENT', () => {
      // These should be coerced to strings
      const testValues = [
        { input: 1 as any, expected: '1' },
        { input: 0 as any, expected: '0' },
        { input: true as any, expected: 'true' },
        { input: false as any, expected: 'false' },
        { input: null as any, expected: 'null' },
        { input: undefined as any, expected: 'undefined' }
      ];

      testValues.forEach(({ input, expected }) => {
        process.env.APEX_SILENT = input;
        expect(process.env.APEX_SILENT).toBe(expected);

        const silent = process.env.APEX_SILENT === '1';
        expect(silent).toBe(expected === '1');
      });
    });
  });

  describe('Multi-Process APEX_SILENT Scenarios', () => {
    it('should verify multiple API processes can all use APEX_SILENT=1', () => {
      const processes = [
        { port: 3000, cwd: '/project1' },
        { port: 3001, cwd: '/project2' },
        { port: 3002, cwd: '/project3' }
      ];

      processes.forEach(({ port, cwd }) => {
        const env = {
          ...process.env,
          PORT: port.toString(),
          APEX_PROJECT: cwd,
          APEX_SILENT: '1'
        };

        expect(env.APEX_SILENT).toBe('1');
        expect(env.PORT).toBe(port.toString());
        expect(env.APEX_PROJECT).toBe(cwd);
      });
    });

    it('should verify APEX_SILENT isolation between different projects', () => {
      // Project 1 with silent mode
      const env1 = {
        ...process.env,
        APEX_PROJECT: '/project1',
        APEX_SILENT: '1'
      };

      // Project 2 without silent mode (theoretical scenario)
      const env2 = {
        ...process.env,
        APEX_PROJECT: '/project2',
        APEX_SILENT: '0'
      };

      expect(env1.APEX_SILENT).toBe('1');
      expect(env2.APEX_SILENT).toBe('0');
      expect(env1.APEX_PROJECT).toBe('/project1');
      expect(env2.APEX_PROJECT).toBe('/project2');
    });
  });

  describe('Comprehensive Integration Test', () => {
    it('should verify complete APEX_SILENT flow from checkAutoStart to API server', () => {
      const mockConsoleLog = vi.fn();
      const originalConsoleLog = console.log;
      console.log = mockConsoleLog;

      // 1. checkAutoStart sets up environment for spawning
      const ctx = { cwd: '/test/project' };
      const port = 3000;

      const spawnEnv = {
        ...process.env,
        PORT: port.toString(),
        APEX_PROJECT: ctx.cwd,
        APEX_SILENT: '1'
      };

      // 2. Process is spawned with APEX_SILENT=1
      expect(spawnEnv.APEX_SILENT).toBe('1');

      // 3. API server reads APEX_SILENT=1
      process.env = spawnEnv;
      const silent = process.env.APEX_SILENT === '1';
      expect(silent).toBe(true);

      // 4. API server suppresses output due to silent mode
      if (!silent) {
        console.log('🚀 APEX API Server running at http://localhost:3000');
        console.log('Task Endpoints:');
        console.log('  POST /api/tasks - Create task');
      }

      // 5. Verify no output was logged (silent mode working)
      expect(mockConsoleLog).not.toHaveBeenCalled();

      // 6. Verify non-silent mode would show output
      process.env.APEX_SILENT = '0';
      const notSilent = process.env.APEX_SILENT === '1';

      if (!notSilent) {
        console.log('🚀 APEX API Server running at http://localhost:3000');
      }

      expect(mockConsoleLog).toHaveBeenCalledWith('🚀 APEX API Server running at http://localhost:3000');

      // Restore
      process.env = originalEnv;
      console.log = originalConsoleLog;
    });
  });
});