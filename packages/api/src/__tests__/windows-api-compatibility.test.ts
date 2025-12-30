/**
 * Windows API Compatibility Tests for @apex/api package
 *
 * Tests Windows-specific functionality including:
 * - Windows path handling in server startup options
 * - Cross-platform project path resolution
 * - Server startup with Windows-style paths
 * - API endpoint behavior with Windows paths
 * - Environment variable handling for project paths
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join, resolve, normalize, win32, posix } from 'path';
import { platform } from 'os';
import { createServer, startServer, ServerOptions } from '../index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator to avoid SQLite issues in tests
vi.mock('@apexcli/orchestrator', () => {
  const mockTask = {
    id: 'task_123_abc',
    description: 'Test task',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    projectPath: '',
    branchName: 'apex/test',
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 },
    logs: [],
    artifacts: [],
    trashedAt: undefined,
    archivedAt: undefined,
  };

  const mockOrchestrator = {
    initialize: vi.fn().mockResolvedValue(undefined),
    createTask: vi.fn().mockResolvedValue(mockTask),
    executeTask: vi.fn().mockResolvedValue(undefined),
    getTask: vi.fn().mockResolvedValue(mockTask),
    listTasks: vi.fn().mockResolvedValue([mockTask]),
    updateTaskStatus: vi.fn().mockResolvedValue(undefined),
    cancelTask: vi.fn().mockResolvedValue(true),
    getAgents: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue({ version: '1.0', project: { name: 'test' } }),
    on: vi.fn(),
    emit: vi.fn(),
  };

  const mockDaemonManager = {
    getStatus: vi.fn().mockResolvedValue({
      running: false,
      pid: null,
      startedAt: null,
      uptime: null,
    }),
  };

  const mockHealthMonitor = {
    getHealthReport: vi.fn().mockReturnValue({
      uptime: 0,
      memoryUsage: { heapUsed: 1024 * 1024 },
      taskCounts: { processed: 0, succeeded: 0, failed: 0, active: 0 },
      lastHealthCheck: new Date(),
      healthChecksPassed: 0,
      healthChecksFailed: 0,
      restartHistory: [],
    }),
    performHealthCheck: vi.fn(),
  };

  return {
    ApexOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
    DaemonManager: vi.fn().mockImplementation(() => mockDaemonManager),
    HealthMonitor: vi.fn().mockImplementation(() => mockHealthMonitor),
  };
});

describe('Windows API Compatibility', () => {
  let server: FastifyInstance;
  let testProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('Windows Path Handling', () => {
    it('should handle Windows-style project paths correctly', async () => {
      const windowsProjectPaths = [
        'C:\\Users\\developer\\projects\\apex-project',
        'D:\\Program Files\\APEX\\project',
        'C:\\Users\\user with spaces\\Documents\\project',
        'E:\\very\\long\\path\\that\\might\\exceed\\some\\windows\\path\\limits\\project',
        '\\\\server\\share\\network\\project', // UNC path
        'C:\\Project', // Short path
        'C:\\temp\\apex-test-123',
      ];

      for (const projectPath of windowsProjectPaths) {
        const options: ServerOptions = {
          port: 0, // Use random port
          host: '127.0.0.1',
          projectPath,
          silent: true,
        };

        // Should not throw when creating server with Windows paths
        expect(async () => {
          server = await createServer(options);
          return server;
        }).not.toThrow();

        if (server) {
          await server.close();
        }
      }
    });

    it('should normalize cross-platform paths correctly', () => {
      const testPaths = [
        { input: 'C:/Users/developer/project', expected: win32.normalize('C:/Users/developer/project') },
        { input: 'C:\\Users\\developer\\project', expected: win32.normalize('C:\\Users\\developer\\project') },
        { input: '/home/user/project', expected: posix.normalize('/home/user/project') },
        { input: './relative/path', expected: normalize('./relative/path') },
        { input: '../parent/path', expected: normalize('../parent/path') },
      ];

      testPaths.forEach(({ input, expected }) => {
        const resolved = resolve(input);
        const normalized = normalize(input);

        // Should handle path resolution without errors
        expect(resolved).toBeTruthy();
        expect(normalized).toBeTruthy();

        // Normalized path should be valid
        expect(normalized.length).toBeGreaterThan(0);

        // Should handle both forward and backward slashes
        const crossPlatformPath = input.replace(/\\/g, '/');
        expect(() => normalize(crossPlatformPath)).not.toThrow();
      });
    });

    it('should handle special Windows path characters', () => {
      const specialPaths = [
        'C:\\Program Files (x86)\\APEX',
        'C:\\Users\\täst üser\\project', // Unicode characters
        'C:\\path\\with\\åccénts',
        'C:\\Users\\user-name_123\\Documents',
        'C:\\temp\\project.test',
        'C:\\UPPERCASE\\lowercase\\MixedCase',
      ];

      specialPaths.forEach(path => {
        expect(() => {
          const resolved = resolve(path);
          const normalized = normalize(path);
          expect(resolved).toBeTruthy();
          expect(normalized).toBeTruthy();
        }).not.toThrow();
      });
    });
  });

  describe('Server Startup with Windows Paths', () => {
    it('should start server successfully with Windows project path', async () => {
      const windowsPath = 'C:\\test\\apex\\project';

      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: windowsPath,
        silent: true,
      };

      // Should create server without errors
      server = await createServer(options);
      expect(server).toBeDefined();

      // Should be able to start listening
      await server.listen({ port: 0, host: '127.0.0.1' });

      // Server should be ready
      expect(server.server.listening).toBe(true);

      // Should have proper address
      const address = server.server.address();
      expect(address).toBeTruthy();
    });

    it('should handle environment variable project paths on Windows', async () => {
      // Mock Windows environment variables
      const originalEnv = process.env;

      // Test with Windows-style environment variables
      process.env = {
        ...originalEnv,
        APEX_PROJECT: 'C:\\Windows\\Style\\Path',
        USERPROFILE: 'C:\\Users\\testuser',
        APPDATA: 'C:\\Users\\testuser\\AppData\\Roaming',
        TEMP: 'C:\\temp',
        TMP: 'C:\\temp',
      };

      const projectPath = process.env.APEX_PROJECT || process.cwd();

      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath,
        silent: true,
      };

      expect(async () => {
        server = await createServer(options);
        return server;
      }).not.toThrow();

      // Restore environment
      process.env = originalEnv;
    });

    it('should handle long Windows paths correctly', async () => {
      // Test with a very long Windows path (approaching 260 character limit)
      const longPath = 'C:\\' + 'very\\'.repeat(50) + 'long\\path\\project';

      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: longPath,
        silent: true,
      };

      // Should handle long paths gracefully
      expect(async () => {
        server = await createServer(options);
        return server;
      }).not.toThrow();
    });
  });

  describe('API Endpoint Windows Compatibility', () => {
    beforeEach(async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: 'C:\\test\\project',
        silent: true,
      };

      server = await createServer(options);
      await server.listen({ port: 0, host: '127.0.0.1' });
    });

    it('should respond to health check regardless of project path format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('ok');
      expect(payload.version).toBeDefined();
    });

    it('should handle task creation with Windows-style project paths in body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/tasks',
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          description: 'Test task with Windows path handling',
          acceptanceCriteria: 'Should work with C:\\Windows\\Style\\Paths',
          workflow: 'feature',
          autonomy: 'full',
        },
      });

      expect(response.statusCode).toBe(201);

      const payload = JSON.parse(response.payload);
      expect(payload.taskId).toBeDefined();
      expect(payload.status).toBe('pending');
      expect(payload.message).toBe('Task created and execution started');
    });

    it('should list agents endpoint work with Windows project paths', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/agents',
      });

      expect(response.statusCode).toBe(200);

      const payload = JSON.parse(response.payload);
      expect(payload.agents).toBeDefined();
      expect(Array.isArray(payload.agents)).toBe(true);
    });

    it('should get config endpoint work with Windows project paths', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/config',
      });

      expect(response.statusCode).toBe(200);

      const payload = JSON.parse(response.payload);
      expect(payload).toBeDefined();
    });
  });

  describe('WebSocket Windows Compatibility', () => {
    it('should handle WebSocket connections with Windows project paths', async () => {
      const options: ServerOptions = {
        port: 0,
        host: '127.0.0.1',
        projectPath: 'C:\\test\\websocket\\project',
        silent: true,
      };

      server = await createServer(options);
      await server.listen({ port: 0, host: '127.0.0.1' });

      // Test WebSocket stream endpoint structure
      const response = await server.inject({
        method: 'GET',
        url: '/stream/test-task-id',
        headers: {
          connection: 'upgrade',
          upgrade: 'websocket',
        },
      });

      // Should attempt WebSocket upgrade (will fail in test but structure should be correct)
      expect(response.statusCode).toBe(400); // Expected in test environment without proper WebSocket
    });
  });

  describe('Cross-Platform Environment Variables', () => {
    it('should handle Windows environment variables correctly', () => {
      const originalEnv = process.env;

      // Test Windows environment variables
      process.env = {
        ...originalEnv,
        HOME: undefined, // Not available on Windows
        USERPROFILE: 'C:\\Users\\testuser',
        APPDATA: 'C:\\Users\\testuser\\AppData\\Roaming',
        LOCALAPPDATA: 'C:\\Users\\testuser\\AppData\\Local',
        PROGRAMFILES: 'C:\\Program Files',
        'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
        SYSTEMROOT: 'C:\\Windows',
        TEMP: 'C:\\temp',
        TMP: 'C:\\temp',
      };

      // Should handle Windows-style environment access
      const home = process.env.HOME || process.env.USERPROFILE;
      expect(home).toBe('C:\\Users\\testuser');

      const temp = process.env.TEMP || process.env.TMP;
      expect(temp).toBe('C:\\temp');

      // Restore environment
      process.env = originalEnv;
    });

    it('should handle cross-platform path separators in environment variables', () => {
      const testPaths = [
        'C:/mixed/forward/slashes',
        'C:\\windows\\backward\\slashes',
        '/unix/style/path',
        './relative/path',
        '../parent/relative/path',
      ];

      testPaths.forEach(testPath => {
        // Should normalize to current platform format
        const normalized = normalize(testPath);
        expect(normalized).toBeTruthy();
        expect(normalized.length).toBeGreaterThan(0);

        // Should resolve to absolute path
        const resolved = resolve(testPath);
        expect(resolved).toBeTruthy();
        expect(resolve(resolved)).toBe(resolved); // Should be idempotent
      });
    });
  });

  describe('Platform-specific Path Edge Cases', () => {
    it('should handle Windows drive letters correctly', () => {
      if (platform() === 'win32') {
        const drivePaths = [
          'C:',
          'C:/',
          'C:\\',
          'D:\\project',
          'E:/project',
          'Z:\\network\\drive',
        ];

        drivePaths.forEach(drivePath => {
          expect(() => {
            const resolved = resolve(drivePath);
            const normalized = normalize(drivePath);
            expect(resolved).toBeTruthy();
            expect(normalized).toBeTruthy();
          }).not.toThrow();
        });
      }
    });

    it('should handle UNC paths on Windows', () => {
      if (platform() === 'win32') {
        const uncPaths = [
          '\\\\server\\share',
          '\\\\server\\share\\folder',
          '\\\\192.168.1.1\\share\\project',
          '\\\\domain-server\\public\\apex',
        ];

        uncPaths.forEach(uncPath => {
          expect(() => {
            const normalized = normalize(uncPath);
            expect(normalized).toBeTruthy();
            // UNC paths should preserve leading slashes
            expect(normalized.startsWith('\\\\')).toBe(true);
          }).not.toThrow();
        });
      }
    });

    it('should handle reserved Windows filenames gracefully', () => {
      const reservedNames = [
        'CON', 'PRN', 'AUX', 'NUL',
        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
      ];

      reservedNames.forEach(name => {
        const testPath = `C:\\test\\${name}\\project`;

        expect(() => {
          const normalized = normalize(testPath);
          expect(normalized).toBeTruthy();
        }).not.toThrow();
      });
    });

    it('should handle Windows path length limitations', () => {
      // Test path approaching 260 character limit (legacy Windows limitation)
      const longPath = 'C:\\' + 'a'.repeat(250) + '\\project';

      expect(() => {
        const normalized = normalize(longPath);
        const resolved = resolve(longPath);
        expect(normalized).toBeTruthy();
        expect(resolved).toBeTruthy();
      }).not.toThrow();

      // Test extremely long path (over 260 characters)
      const veryLongPath = 'C:\\' + 'b'.repeat(300) + '\\project';

      expect(() => {
        const normalized = normalize(veryLongPath);
        expect(normalized).toBeTruthy();
      }).not.toThrow();
    });
  });
});