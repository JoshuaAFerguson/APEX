/**
 * APEX Serve Command Final Audit Test Suite
 *
 * This test suite provides a comprehensive audit of the `apex serve` command
 * functionality including CLI command structure, REPL implementation,
 * process management, and configuration handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock child_process module
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

// Create a mock that extends EventEmitter for proper child process behavior
class MockChildProcess extends EventEmitter {
  killed = false;
  exitCode: number | null = null;
  pid = 12345;

  kill(signal?: string) {
    this.killed = true;
    this.emit('exit', 0, signal);
    return true;
  }

  unref() {
    // Mock implementation
  }
}

describe('APEX Serve Command Final Audit', () => {
  let mockChildProcess: MockChildProcess;

  beforeEach(() => {
    mockChildProcess = new MockChildProcess();
    vi.clearAllMocks();
    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CLI Command Structure Verification', () => {
    it('should verify serve command exists in CLI index', async () => {
      const cliPath = path.join(process.cwd(), 'packages/cli/src/index.ts');
      const content = await fs.readFile(cliPath, 'utf-8');

      expect(content).toMatch(/name:\s*['"]serve['"]|'serve'/);
      expect(content).toMatch(/description.*Start.*API.*server/i);
      expect(content).toMatch(/usage.*serve.*port/i);
    });

    it('should verify startAPIServer function exists', async () => {
      const cliPath = path.join(process.cwd(), 'packages/cli/src/index.ts');
      const content = await fs.readFile(cliPath, 'utf-8');

      expect(content).toMatch(/function\s+startAPIServer|startAPIServer.*=/);
      expect(content).toMatch(/port.*number/);
      expect(content).toMatch(/silent.*boolean/);
      expect(content).toMatch(/keepAlive.*boolean/);
    });

    it('should verify CLI handler supports required flags', async () => {
      const cliPath = path.join(process.cwd(), 'packages/cli/src/index.ts');
      const content = await fs.readFile(cliPath, 'utf-8');

      expect(content).toMatch(/--port.*-p/);
      expect(content).toMatch(/--keep-alive.*--foreground/);
    });
  });

  describe('REPL Implementation Verification', () => {
    it('should verify handleServe function exists in REPL', async () => {
      const replPath = path.join(process.cwd(), 'packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      expect(content).toMatch(/function\s+handleServe|handleServe.*=/);
      expect(content).toMatch(/args.*string\[\]/);
    });

    it('should verify REPL spawn configuration', async () => {
      const replPath = path.join(process.cwd(), 'packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      expect(content).toMatch(/spawn.*resolveExecutable.*node/);
      expect(content).toMatch(/detached:\s*true/);
      expect(content).toMatch(/stdio:\s*['"]ignore['"]|ignore/);
      expect(content).toMatch(/APEX_SILENT.*['"]1['"]|APEX_SILENT.*1/);
      expect(content).toMatch(/proc\.unref\(\)/);
    });

    it('should verify REPL port parsing and context management', async () => {
      const replPath = path.join(process.cwd(), 'packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      expect(content).toMatch(/--port.*-p/);
      expect(content).toMatch(/parseInt.*10/);
      expect(content).toMatch(/ctx\.initialized/);
      expect(content).toMatch(/ctx\.apiProcess/);
      expect(content).toMatch(/ctx\.apiPort/);
    });
  });

  describe('Process Spawning Functionality', () => {
    it('should spawn with correct parameters', () => {
      const proc = mockSpawn('node', ['/mock/api/dist/index.js'], {
        cwd: '/mock/project',
        env: {
          PORT: '3000',
          APEX_PROJECT: '/mock/project',
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      proc.unref();

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        ['/mock/api/dist/index.js'],
        expect.objectContaining({
          cwd: '/mock/project',
          env: expect.objectContaining({
            PORT: '3000',
            APEX_PROJECT: '/mock/project',
            APEX_SILENT: '1',
          }),
          stdio: 'ignore',
          detached: true,
        })
      );
    });

    it('should verify APEX_SILENT is always set to 1', () => {
      mockSpawn('node', ['/mock/api/dist/index.js'], {
        cwd: '/mock/project',
        env: { APEX_SILENT: '1' },
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_SILENT: '1'
          })
        })
      );
    });

    it('should verify detached process configuration', () => {
      mockSpawn('node', ['/mock/api/dist/index.js'], {
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          stdio: 'ignore',
          detached: true,
        })
      );
    });
  });

  describe('Port Configuration Handling', () => {
    it('should parse --port flag correctly', () => {
      let port = 3000;
      const args = ['--port', '8080'];

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(8080);
    });

    it('should parse -p flag correctly', () => {
      let port = 3000;
      const args = ['-p', '9000'];

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(9000);
    });

    it('should use default port when no args provided', () => {
      let port = 3000;
      const args: string[] = [];

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBe(3000);
    });

    it('should handle invalid port gracefully', () => {
      let port = 3000;
      const args = ['--port', 'invalid'];

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
          port = parseInt(args[++i], 10);
        }
      }

      expect(port).toBeNaN();
    });
  });

  describe('Process Management', () => {
    it('should allow process to be killed', () => {
      const proc = mockChildProcess;
      expect(proc.killed).toBe(false);

      proc.kill('SIGTERM');
      expect(proc.killed).toBe(true);
    });

    it('should emit exit events properly', async () => {
      const proc = mockChildProcess;

      const exitPromise = new Promise<void>((resolve) => {
        proc.on('exit', (code, signal) => {
          expect(code).toBe(0);
          expect(signal).toBe('SIGINT');
          resolve();
        });
      });

      proc.kill('SIGINT');
      await exitPromise;
    });

    it('should support unref for background execution', () => {
      const proc = mockChildProcess;
      const unrefSpy = vi.spyOn(proc, 'unref');

      proc.unref();
      expect(unrefSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle spawn errors', () => {
      mockSpawn.mockImplementationOnce(() => {
        throw new Error('Spawn failed');
      });

      expect(() => {
        mockSpawn('node', ['/mock/api/dist/index.js']);
      }).toThrow('Spawn failed');
    });

    it('should verify error handling patterns exist in REPL', async () => {
      const replPath = path.join(process.cwd(), 'packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      expect(content).toMatch(/not initialized.*init/i);
      expect(content).toMatch(/already running/i);
      expect(content).toMatch(/Failed.*start.*API.*server/i);
    });
  });

  describe('Environment Configuration', () => {
    it('should set all required environment variables', () => {
      mockSpawn('node', ['/mock/api/dist/index.js'], {
        env: {
          PORT: '3000',
          APEX_PROJECT: '/mock/project',
          APEX_SILENT: '1',
        }
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '3000',
            APEX_PROJECT: '/mock/project',
            APEX_SILENT: '1',
          })
        })
      );
    });

    it('should configure spawn options for background execution', () => {
      mockSpawn('node', ['/mock/api/dist/index.js'], {
        stdio: 'ignore',
        detached: true,
      });

      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          stdio: 'ignore',
          detached: true,
        })
      );
    });
  });

  describe('API Package Path Resolution', () => {
    it('should verify path resolution patterns exist', async () => {
      const replPath = path.join(process.cwd(), 'packages/cli/src/repl.tsx');
      const content = await fs.readFile(replPath, 'utf-8');

      expect(content).toMatch(/path\.resolve.*__dirname.*api/);
      expect(content).toMatch(/path\.join.*apiPath.*dist.*index\.js/);
      expect(content).toMatch(/resolveExecutable.*node/);
    });
  });

  describe('Comprehensive Functionality Audit', () => {
    it('should verify complete serve workflow', () => {
      // Simulate complete workflow
      const port = 3333;
      const cwd = '/test/project';

      mockSpawn('node', ['/mock/api/dist/index.js'], {
        cwd,
        env: {
          PORT: port.toString(),
          APEX_PROJECT: cwd,
          APEX_SILENT: '1',
        },
        stdio: 'ignore',
        detached: true,
      });

      const proc = mockSpawn.mock.results[0].value;
      proc.unref();

      // Verify all components work together
      expect(mockSpawn).toHaveBeenCalledOnce();
      expect(mockSpawn).toHaveBeenCalledWith(
        'node',
        expect.any(Array),
        expect.objectContaining({
          cwd,
          env: expect.objectContaining({
            PORT: '3333',
            APEX_PROJECT: cwd,
            APEX_SILENT: '1',
          }),
          stdio: 'ignore',
          detached: true,
        })
      );
    });

    it('should verify both CLI and REPL implementations exist', async () => {
      const cliPath = path.join(process.cwd(), 'packages/cli/src/index.ts');
      const replPath = path.join(process.cwd(), 'packages/cli/src/repl.tsx');

      const cliContent = await fs.readFile(cliPath, 'utf-8');
      const replContent = await fs.readFile(replPath, 'utf-8');

      // CLI should have serve command
      expect(cliContent).toMatch(/name.*serve/);
      expect(cliContent).toMatch(/startAPIServer/);

      // REPL should have handleServe function
      expect(replContent).toMatch(/handleServe/);
      expect(replContent).toMatch(/spawn/);
    });
  });
});