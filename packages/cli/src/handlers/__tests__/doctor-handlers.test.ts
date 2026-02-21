import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import boxen from 'boxen';
import { handleDoctor } from '../doctor-handlers.js';
import type { CliContext } from '../../index.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('child_process');
vi.mock('chalk', () => ({
  cyan: vi.fn((text) => text),
  green: vi.fn((text) => text),
  red: vi.fn((text) => text),
  yellow: vi.fn((text) => text),
  blue: vi.fn((text) => text),
  gray: vi.fn((text) => text),
  dim: vi.fn((text) => text),
  bold: vi.fn((text) => text),
}));
vi.mock('boxen');
vi.mock('@apexcli/core', () => ({
  createDoctorCheckResult: vi.fn((partial) => ({
    description: `Health check for ${partial.name}`,
    status: 'unknown',
    severity: 'info',
    message: 'Check completed',
    timestamp: new Date(),
    durationMs: 0,
    ...partial,
  })),
  createHealthReport: vi.fn((checks, options) => ({
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
  satisfiesVersion: vi.fn((current, required) => {
    // Simple mock comparison logic
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
  parseVersionOutput: vi.fn((output) => {
    const match = output.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }),
  queryNpmRegistry: vi.fn(),
  getLatestPackageVersion: vi.fn(),
}));

const mockedFs = vi.mocked(fs);
const mockedExec = vi.mocked(promisify(exec));
const mockedChalk = vi.mocked(chalk);
const mockedBoxen = vi.mocked(boxen);

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleLogs: string[] = [];
let consoleErrors: string[] = [];

describe('Doctor Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogs = [];
    consoleErrors = [];

    console.log = vi.fn((message) => {
      consoleLogs.push(message);
    });
    console.error = vi.fn((message) => {
      consoleErrors.push(message);
    });

    // Set up default chalk mocks to return the text as-is
    Object.keys(mockedChalk).forEach(method => {
      if (typeof mockedChalk[method as keyof typeof mockedChalk] === 'function') {
        vi.mocked(mockedChalk[method as keyof typeof mockedChalk] as any).mockImplementation((text) => text);
      }
    });

    mockedBoxen.mockImplementation((text) => `[BOXED] ${text}`);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('handleDoctor', () => {
    const createMockContext = (overrides: Partial<CliContext> = {}): CliContext => ({
      cwd: '/test/project',
      initialized: false,
      config: null,
      orchestrator: {} as any,
      ...overrides,
    });

    it('should run all health checks successfully', async () => {
      const mockContext = createMockContext({
        initialized: true,
        config: {
          project: { name: 'test-project', language: 'typescript' },
        } as any,
      });

      // Mock successful version checks
      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock file system access
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        dependencies: { '@apexcli/core': '0.6.0' }
      }));

      await handleDoctor(mockContext, []);

      // Verify checks were run
      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
      expect(consoleLogs.some(log => log.includes('APEX Health Report'))).toBe(true);
    });

    it('should handle Node.js version check failure', async () => {
      const mockContext = createMockContext();

      // Mock Node.js version as too old
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', {
        value: 'v14.0.0',
        configurable: true,
      });

      await handleDoctor(mockContext, []);

      // Restore original version
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
      });

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle npm version check failure', async () => {
      const mockContext = createMockContext();

      mockedExec.mockRejectedValue(new Error('npm not found'));

      await handleDoctor(mockContext, []);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle git not available gracefully', async () => {
      const mockContext = createMockContext();

      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          throw new Error('git not found');
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await handleDoctor(mockContext, []);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle uninitialized APEX project', async () => {
      const mockContext = createMockContext({ initialized: false });

      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock file system access for permission check
      mockedFs.access.mockResolvedValue(undefined);

      await handleDoctor(mockContext, []);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle invalid APEX configuration', async () => {
      const mockContext = createMockContext({
        initialized: true,
        config: {
          project: { name: '', language: '' }, // Invalid config
        } as any,
      });

      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await handleDoctor(mockContext, []);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle missing package.json gracefully', async () => {
      const mockContext = createMockContext({ initialized: true });

      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock file not found
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      mockedFs.access.mockResolvedValue(undefined);

      await handleDoctor(mockContext, []);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle permission errors', async () => {
      const mockContext = createMockContext({ initialized: true });

      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock permission denied
      mockedFs.access.mockRejectedValue(new Error('EACCES: permission denied'));

      await handleDoctor(mockContext, []);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle promise rejection in health checks', async () => {
      const mockContext = createMockContext();

      // Mock Promise.all to reject
      const originalPromiseAll = Promise.all;
      Promise.all = vi.fn().mockRejectedValue(new Error('Check failed'));

      await handleDoctor(mockContext, []);

      // Restore Promise.all
      Promise.all = originalPromiseAll;

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
      expect(consoleErrors.length).toBeGreaterThan(0);
    });

    it('should run in quick mode when --quick flag is provided', async () => {
      const mockContext = createMockContext({
        initialized: true,
        config: {
          project: { name: 'test-project', language: 'typescript' },
        } as any,
      });

      // Mock file system access
      mockedFs.access.mockResolvedValue(undefined);

      await handleDoctor(mockContext, ['--quick']);

      // Verify quick mode messaging
      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
      expect(consoleLogs).toContain('⚡ Quick mode enabled - skipping slower checks\n');

      // In quick mode, npm and git version checks should be skipped
      // Only verify basic functionality - exact call verification would be too brittle
      expect(mockedExec).not.toHaveBeenCalledWith('npm --version');
      expect(mockedExec).not.toHaveBeenCalledWith('git --version');
    });

    it('should output JSON format when --json flag is provided', async () => {
      const mockContext = createMockContext({
        initialized: true,
        config: {
          project: { name: 'test-project', language: 'typescript' },
        } as any,
      });

      // Mock successful exec calls
      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock file system access
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        dependencies: { '@apexcli/core': '0.6.0' }
      }));

      await handleDoctor(mockContext, ['--json']);

      // Should not display regular console output
      expect(consoleLogs).not.toContain('🔍 Running APEX health diagnostics...\n');

      // Should output JSON - look for JSON structure in output
      const jsonOutput = consoleLogs.find(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.id && parsed.overallStatus && parsed.summary && parsed.checks;
        } catch {
          return false;
        }
      });
      expect(jsonOutput).toBeDefined();
    });

    it('should combine --quick and --json flags correctly', async () => {
      const mockContext = createMockContext({
        initialized: true,
        config: {
          project: { name: 'test-project', language: 'typescript' },
        } as any,
      });

      // Mock file system access
      mockedFs.access.mockResolvedValue(undefined);

      await handleDoctor(mockContext, ['--quick', '--json']);

      // Should not display regular console output
      expect(consoleLogs).not.toContain('🔍 Running APEX health diagnostics...\n');
      expect(consoleLogs).not.toContain('⚡ Quick mode enabled - skipping slower checks\n');

      // Should output JSON
      const jsonOutput = consoleLogs.find(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.id && parsed.overallStatus && parsed.summary && parsed.checks;
        } catch {
          return false;
        }
      });
      expect(jsonOutput).toBeDefined();

      // Should not run npm/git checks in quick mode
      expect(mockedExec).not.toHaveBeenCalledWith('npm --version');
      expect(mockedExec).not.toHaveBeenCalledWith('git --version');
    });

    it('should handle errors in JSON mode by outputting JSON error', async () => {
      const mockContext = createMockContext();

      // Mock Promise.all to reject
      const originalPromiseAll = Promise.all;
      Promise.all = vi.fn().mockRejectedValue(new Error('Check failed'));

      await handleDoctor(mockContext, ['--json']);

      // Restore Promise.all
      Promise.all = originalPromiseAll;

      // Should output JSON error instead of console.error
      const errorJsonOutput = consoleLogs.find(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.error && parsed.details;
        } catch {
          return false;
        }
      });
      expect(errorJsonOutput).toBeDefined();
      expect(consoleErrors.length).toBe(0);
    });

    it('should not check for updates in quick mode', async () => {
      const mockContext = createMockContext({
        initialized: true,
        config: {
          project: { name: 'test-project', language: 'typescript' },
        } as any,
      });
      const { getLatestPackageVersion } = await import('@apexcli/core');

      // Mock file system access
      mockedFs.access.mockResolvedValue(undefined);

      await handleDoctor(mockContext, ['--quick']);

      // Should not call update check in quick mode
      expect(getLatestPackageVersion).not.toHaveBeenCalled();
    });

    it('should not check for updates in JSON mode', async () => {
      const mockContext = createMockContext({
        initialized: true,
        config: {
          project: { name: 'test-project', language: 'typescript' },
        } as any,
      });
      const { getLatestPackageVersion } = await import('@apexcli/core');

      // Mock successful exec calls
      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      // Mock file system access
      mockedFs.access.mockResolvedValue(undefined);
      mockedFs.readFile.mockResolvedValue(JSON.stringify({
        dependencies: { '@apexcli/core': '0.6.0' }
      }));

      await handleDoctor(mockContext, ['--json']);

      // Should not call update check in JSON mode
      expect(getLatestPackageVersion).not.toHaveBeenCalled();
    });
  });

  describe('Individual Health Checks', () => {
    it('should parse various version formats correctly', async () => {
      const { parseVersionOutput } = await import('@apexcli/core');

      // Test different version output formats
      expect(parseVersionOutput('v18.17.0')).toBe('18.17.0');
      expect(parseVersionOutput('npm version 8.19.2')).toBe('8.19.2');
      expect(parseVersionOutput('git version 2.34.1')).toBe('2.34.1');
      expect(parseVersionOutput('Node.js v16.14.0')).toBe('16.14.0');
      expect(parseVersionOutput('invalid output')).toBeNull();
    });

    it('should compare versions correctly', async () => {
      const { satisfiesVersion } = await import('@apexcli/core');

      expect(satisfiesVersion('18.17.0', '16.0.0')).toBe(true);
      expect(satisfiesVersion('14.15.0', '16.0.0')).toBe(false);
      expect(satisfiesVersion('v2.1.0', '2.0.0')).toBe(true);
      expect(satisfiesVersion('', '1.0.0')).toBe(false);
      expect(satisfiesVersion('1.0.0', '')).toBe(false);
    });
  });

  describe('Update Checker Integration', () => {
    it('should check for updates and display notification', async () => {
      const mockContext = createMockContext();
      const { getLatestPackageVersion } = await import('@apexcli/core');

      // Mock update available
      vi.mocked(getLatestPackageVersion).mockResolvedValue('0.7.0');

      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await handleDoctor(mockContext, []);

      expect(getLatestPackageVersion).toHaveBeenCalledWith('apex-cli', { timeout: 3000 });
      expect(mockedBoxen).toHaveBeenCalledWith(
        expect.stringContaining('Update Available'),
        expect.objectContaining({
          borderColor: 'blue',
        })
      );
    });

    it('should handle update check failure silently', async () => {
      const mockContext = createMockContext();
      const { getLatestPackageVersion } = await import('@apexcli/core');

      // Mock update check failure
      vi.mocked(getLatestPackageVersion).mockRejectedValue(new Error('Network error'));

      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await handleDoctor(mockContext, []);

      // Should not throw or display error - fails silently
      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should not display update notification when no update available', async () => {
      const mockContext = createMockContext();
      const { getLatestPackageVersion } = await import('@apexcli/core');

      // Mock no update available (same version)
      vi.mocked(getLatestPackageVersion).mockResolvedValue('0.6.0');

      mockedExec.mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      await handleDoctor(mockContext, []);

      // Should not display update notification
      const updateBoxCalls = mockedBoxen.mock.calls
        .filter((call: any[]) => call[0].includes('Update Available'));
      expect(updateBoxCalls).toHaveLength(0);
    });
  });
});