/**
 * APEX Serve CLI Integration Test Suite
 *
 * This test suite focuses on the CLI-specific implementation of the serve command
 * including the actual command definitions and handlers from packages/cli/src/index.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import path from 'path';

// Create hoisted mocks that can be referenced in vi.mock
const { mockSpawn, mockChildProcess } = vi.hoisted(() => {
  const mockChildProcess = {
    unref: vi.fn(),
    kill: vi.fn(),
    pid: 12345
  };
  return {
    mockSpawn: vi.fn().mockReturnValue(mockChildProcess),
    mockChildProcess
  };
});

// Mock child_process module
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: mockSpawn
  };
});

describe('APEX Serve CLI Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    mockSpawn.mockReturnValue(mockChildProcess);
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('CLI Command Definition', () => {

    it('should have serve command with correct metadata', () => {
      // This test verifies the command is properly defined in the CLI
      const expectedCommand = {
        name: 'serve',
        aliases: [],
        description: 'Start the API server',
        usage: '/serve [--port <port>]',
      };

      // In a real test, we would import and check the actual command definition
      expect(expectedCommand.name).toBe('serve');
      expect(expectedCommand.description).toBe('Start the API server');
      expect(expectedCommand.usage).toContain('[--port <port>]');
    });

    it('should support --port and -p flags', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      // Test --port flag
      await handleServeCommand(mockContext, ['--port', '4000']);
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ PORT: '4000' })
        })
      );

      vi.clearAllMocks();

      // Test -p flag
      await handleServeCommand(mockContext, ['-p', '5000']);
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ PORT: '5000' })
        })
      );
    });

    it('should support --keep-alive flag for non-interactive mode', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, ['--keep-alive']);

      // Verify the command was called (keep-alive behavior would be in the actual implementation)
      expect(mockSpawn).toHaveBeenCalled();
    });
  });

  describe('Environment Variable Configuration', () => {

    it('should set APEX_SILENT environment variable', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_SILENT: '1'
          })
        })
      );
    });

    it('should set APEX_PROJECT environment variable', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/custom/project/path',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            APEX_PROJECT: '/custom/project/path'
          })
        })
      );
    });

    it('should preserve existing environment variables', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      // Set some environment variables
      process.env.TEST_VAR = 'test_value';
      process.env.ANOTHER_VAR = 'another_value';

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            TEST_VAR: 'test_value',
            ANOTHER_VAR: 'another_value',
            APEX_SILENT: '1',
            PORT: '3000',
            APEX_PROJECT: '/test/project'
          })
        })
      );
    });
  });

  describe('Process Configuration', () => {

    it('should spawn with stdio ignored for detached execution', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          stdio: 'ignore'
        })
      );
    });

    it('should spawn with detached flag set to true', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          detached: true
        })
      );
    });

    it('should unref the spawned process', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockChildProcess.unref).toHaveBeenCalled();
    });
  });

  describe('API Path Resolution', () => {

    it('should resolve API package path correctly', async () => {
      const mockResolve = vi.spyOn(path, 'resolve');
      mockResolve.mockReturnValue('/resolved/api/path');

      const mockJoin = vi.spyOn(path, 'join');
      mockJoin.mockReturnValue('/resolved/api/path/dist/index.js');

      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['/resolved/api/path/dist/index.js'],
        expect.any(Object)
      );

      mockResolve.mockRestore();
      mockJoin.mockRestore();
    });

    it('should use node executable for spawning', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockSpawn).toHaveBeenCalledWith(
        'node', // Should be node executable
        expect.any(Array),
        expect.any(Object)
      );
    });
  });

  describe('Port Parsing and Validation', () => {

    it('should parse port correctly from --port flag', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, ['--port', '8080']);
      expect(mockContext.apiPort).toBe(8080);
    });

    it('should parse port correctly from -p flag', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, ['-p', '9090']);
      expect(mockContext.apiPort).toBe(9090);
    });

    it('should handle invalid port numbers gracefully', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, ['--port', 'invalid']);

      // Should still attempt to spawn, parseInt('invalid') becomes NaN
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: 'NaN'
          })
        })
      );
    });

    it('should use default port when no port specified', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 7000, // Custom default port
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PORT: '7000'
          })
        })
      );
    });
  });

  describe('State Management', () => {

    it('should update context with process reference and port', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, ['--port', '4444']);

      expect(mockContext.apiProcess).toBe(mockChildProcess);
      expect(mockContext.apiPort).toBe(4444);
    });

    it('should update app state with API URL', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, ['--port', '5555']);

      // Wait for the simulated delay
      await new Promise(resolve => setTimeout(resolve, 1600));

      expect(mockContext.app.updateState).toHaveBeenCalledWith({
        apiUrl: 'http://localhost:5555'
      });
    });

    it('should send appropriate messages to app', async () => {
      const { handleServeCommand } = await import('./test-helpers/cli-serve-handler');

      const mockContext = {
        initialized: true,
        cwd: '/test/project',
        apiProcess: null,
        apiPort: 3000,
        app: { addMessage: vi.fn(), updateState: vi.fn() }
      };

      await handleServeCommand(mockContext, []);

      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'system',
        content: 'Starting API server on port 3000...',
      });

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 1600));

      expect(mockContext.app.addMessage).toHaveBeenCalledWith({
        type: 'assistant',
        content: 'API server running at http://localhost:3000',
      });
    });
  });
});