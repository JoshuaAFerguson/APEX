import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import boxen from 'boxen';

// Mock dependencies before importing CLI code
jest.mock('fs/promises');
jest.mock('child_process');
jest.mock('chalk', () => ({
  cyan: jest.fn((text) => text),
  green: jest.fn((text) => text),
  red: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  blue: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  dim: jest.fn((text) => text),
  bold: jest.fn((text) => text),
}));
jest.mock('boxen');

// Mock the entire @apexcli/core module
jest.mock('@apexcli/core', () => ({
  loadApexConfig: jest.fn(),
  ApexConfigSchema: {
    parse: jest.fn((data) => data),
  },
  createDoctorCheckResult: jest.fn((partial) => ({
    description: `Health check for ${partial.name}`,
    status: 'unknown',
    severity: 'info',
    message: 'Check completed',
    timestamp: new Date(),
    durationMs: 0,
    ...partial,
  })),
  createHealthReport: jest.fn((checks, options) => ({
    id: 'test-health-report',
    timestamp: new Date(),
    overallStatus: checks.some((c: any) => c.status === 'fail') ? 'fail' : 'pass',
    summary: {
      total: checks.length,
      passed: checks.filter((c: any) => c.status === 'pass').length,
      failed: checks.filter((c: any) => c.status === 'fail').length,
      warnings: checks.filter((c: any) => c.severity === 'warning' && c.status !== 'pass').length,
      skipped: checks.filter((c: any) => c.status === 'skip').length,
    },
    checks,
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
    },
    durationMs: 100,
    apexVersion: options?.apexVersion || '0.6.0',
  })),
  satisfiesVersion: jest.fn((current, required) => {
    const parseVersion = (v: string) => v.replace(/[v]/g, '').split('.').map(Number);
    const currentParts = parseVersion(current);
    const requiredParts = parseVersion(required);

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const curr = currentParts[i] || 0;
      const req = requiredParts[i] || 0;
      if (curr > req) return true;
      if (curr < req) return false;
    }
    return true;
  }),
  parseVersionOutput: jest.fn((output) => {
    const match = output.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }),
  queryNpmRegistry: jest.fn(),
  getLatestPackageVersion: jest.fn(),
  compareVersionStrings: jest.fn((a, b) => {
    const parseVersion = (v: string) => v.split('.').map(Number);
    const aParts = parseVersion(a);
    const bParts = parseVersion(b);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    return 0;
  }),
  ApexOrchestrator: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedExec = promisify(exec as jest.Mocked<typeof exec>);
const mockedChalk = chalk as jest.Mocked<typeof chalk>;
const mockedBoxen = boxen as jest.MockedFunction<typeof boxen>;

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleLogs: string[] = [];
let consoleErrors: string[] = [];

describe('Doctor Command Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogs = [];
    consoleErrors = [];

    console.log = jest.fn((message) => {
      consoleLogs.push(message);
    });
    console.error = jest.fn((message) => {
      consoleErrors.push(message);
    });

    // Set up default chalk mocks
    Object.keys(mockedChalk).forEach(method => {
      if (typeof mockedChalk[method as keyof typeof mockedChalk] === 'function') {
        (mockedChalk[method as keyof typeof mockedChalk] as jest.MockedFunction<any>).mockImplementation((text) => text);
      }
    });

    mockedBoxen.mockImplementation((text) => `[BOXED] ${text}`);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Full Doctor Command Flow', () => {
    it('should handle healthy system with all tools available', async () => {
      // Mock a fully working environment
      const { loadApexConfig } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue({
        project: { name: 'test-project', language: 'typescript' },
      });

      // Mock tool availability
      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '9.2.0', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.39.0', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock file system operations
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        dependencies: { '@apexcli/core': '0.6.0' }
      }));

      // Mock update check
      const { getLatestPackageVersion } = await import('@apexcli/core');
      (getLatestPackageVersion as jest.MockedFunction<any>).mockResolvedValue('0.6.0'); // No update

      // Import and run doctor command
      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/project',
        initialized: true,
        config: { project: { name: 'test-project', language: 'typescript' } },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      // Verify diagnostics started
      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');

      // Verify health checks were called
      expect(mockedExec).toHaveBeenCalledWith('npm --version');
      expect(mockedExec).toHaveBeenCalledWith('git --version');

      // Verify permissions check
      expect(mockedFs.access).toHaveBeenCalled();

      // Verify update check
      expect(getLatestPackageVersion).toHaveBeenCalledWith('apex-cli', { timeout: 3000 });
    });

    it('should handle problematic environment with missing tools', async () => {
      // Mock missing tools and permissions issues
      const { loadApexConfig } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue(null);

      // Mock npm available but old, git missing
      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '6.14.0', stderr: '' }; // Old version
        }
        if (command === 'git --version') {
          throw new Error('git: command not found');
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock permission issues
      mockedFs.access.mockRejectedValue(new Error('EACCES: permission denied'));

      // Mock Node.js version as too old
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v14.0.0', // Below minimum
        configurable: true,
      });

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/project',
        initialized: false,
        config: null,
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      // Restore Node version
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle update notification display', async () => {
      // Mock system with update available
      const { loadApexConfig, getLatestPackageVersion } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue({
        project: { name: 'test-project', language: 'typescript' },
      });

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({}));

      // Mock update available
      (getLatestPackageVersion as jest.MockedFunction<any>).mockResolvedValue('0.7.0');

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/project',
        initialized: true,
        config: { project: { name: 'test-project', language: 'typescript' } },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      // Verify update notification was displayed
      expect(mockedBoxen).toHaveBeenCalledWith(
        expect.stringContaining('Update Available'),
        expect.objectContaining({
          borderColor: 'blue',
        })
      );
    });
  });

  describe('Doctor Command Error Handling', () => {
    it('should handle complete check failure gracefully', async () => {
      // Mock all checks to fail
      const originalPromiseAll = Promise.all;
      Promise.all = jest.fn().mockRejectedValue(new Error('All checks failed'));

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/project',
        initialized: false,
        config: null,
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      // Restore Promise.all
      Promise.all = originalPromiseAll;

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
      expect(consoleErrors.length).toBeGreaterThan(0);
    });

    it('should handle update check timeout gracefully', async () => {
      const { loadApexConfig, getLatestPackageVersion } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue({
        project: { name: 'test-project', language: 'typescript' },
      });

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);

      // Mock update check timeout
      (getLatestPackageVersion as jest.MockedFunction<any>).mockRejectedValue(new Error('Request timeout'));

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/project',
        initialized: true,
        config: { project: { name: 'test-project', language: 'typescript' } },
        orchestrator: {} as any,
      };

      // Should not throw despite timeout
      await expect(handleDoctor(mockContext, [])).resolves.not.toThrow();

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle development environment with monorepo setup', async () => {
      const { loadApexConfig } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue({
        project: { name: 'apex-monorepo', language: 'typescript' },
      });

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.39.0', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        workspaces: ['packages/*'],
        devDependencies: { '@apexcli/cli': '0.6.0' }
      }));

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/Users/dev/apex',
        initialized: true,
        config: { project: { name: 'apex-monorepo', language: 'typescript' } },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle CI/CD environment constraints', async () => {
      // Mock CI environment with limited permissions
      const originalEnv = process.env;
      process.env = { ...originalEnv, CI: 'true', GITHUB_ACTIONS: 'true' };

      const { loadApexConfig } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue({
        project: { name: 'ci-project', language: 'javascript' },
      });

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock restricted file access in CI
      mockedFs.access.mockImplementation(async (path: any, mode: any) => {
        if (path.includes('.apex')) {
          throw new Error('EACCES: permission denied');
        }
        return undefined;
      });

      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/github/workspace',
        initialized: false,
        config: null,
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      // Restore environment
      process.env = originalEnv;

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle Windows environment specifics', async () => {
      // Mock Windows-specific scenarios
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      const { loadApexConfig } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue({
        project: { name: 'windows-project', language: 'typescript' },
      });

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2\r\n', stderr: '' }; // Windows line endings
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.39.0.windows.1\r\n', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: 'C:\\Users\\Developer\\project',
        initialized: true,
        config: { project: { name: 'windows-project', language: 'typescript' } },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      // Restore platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete health checks within reasonable time', async () => {
      const startTime = Date.now();

      const { loadApexConfig } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue({
        project: { name: 'test-project', language: 'typescript' },
      });

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        // Add small delay to simulate real execution time
        await new Promise(resolve => setTimeout(resolve, 10));

        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/project',
        initialized: true,
        config: { project: { name: 'test-project', language: 'typescript' } },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      const executionTime = Date.now() - startTime;

      // Health checks should complete in under 5 seconds in test environment
      expect(executionTime).toBeLessThan(5000);
      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle concurrent executions gracefully', async () => {
      const { loadApexConfig } = await import('@apexcli/core');
      (loadApexConfig as jest.MockedFunction<any>).mockResolvedValue({
        project: { name: 'test-project', language: 'typescript' },
      });

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/project',
        initialized: true,
        config: { project: { name: 'test-project', language: 'typescript' } },
        orchestrator: {} as any,
      };

      // Run multiple doctor commands concurrently
      const promises = [
        handleDoctor(mockContext, []),
        handleDoctor(mockContext, []),
        handleDoctor(mockContext, []),
      ];

      // Should all complete without interference
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
});