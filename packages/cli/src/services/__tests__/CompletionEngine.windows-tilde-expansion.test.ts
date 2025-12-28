import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { CompletionEngine, CompletionContext } from '../CompletionEngine.js';

/**
 * Windows-Specific Tilde Expansion Tests for CompletionEngine
 *
 * These tests verify that tilde expansion works correctly on Windows
 * after replacing direct process.env.HOME usage with getHomeDir() from @apexcli/core.
 *
 * ACCEPTANCE CRITERIA VALIDATION:
 * - Tilde expansion works on Windows using cross-platform utilities
 * - No more direct process.env.HOME access in completion logic
 * - CompletionEngine works correctly on Windows platform
 */

// Mock the filesystem and cross-platform utilities
vi.mock('fs/promises');
vi.mock('@apexcli/core', () => ({
  getHomeDir: vi.fn(),
  getConfigDir: vi.fn(),
}));

const mockFs = vi.mocked(fs);
const mockGetHomeDir = vi.mocked((await import('@apexcli/core')).getHomeDir);

describe('CompletionEngine - Windows Tilde Expansion', () => {
  let engine: CompletionEngine;
  let mockContext: CompletionContext;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set Windows platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    // Initialize CompletionEngine
    engine = new CompletionEngine();

    // Create mock completion context
    mockContext = {
      projectPath: 'C:\\Users\\TestUser\\Projects\\apex',
      agents: [],
      workflows: [],
      recentTasks: [],
      inputHistory: [],
    };
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('Windows Home Directory Expansion', () => {
    it('should expand tilde to Windows home directory correctly', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');

      // Mock Windows-style directories
      mockFs.readdir.mockResolvedValue([
        { name: 'Desktop', isDirectory: () => true } as any,
        { name: 'Documents', isDirectory: () => true } as any,
        { name: 'Downloads', isDirectory: () => true } as any,
        { name: 'Pictures', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('edit ~/Doc', 9, mockContext);

      // Verify getHomeDir was called (not process.env.HOME)
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);

      // Verify correct Windows path resolution
      expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\TestUser', { withFileTypes: true });

      // Should return matching completions
      const pathResults = results.filter(r => r.type === 'directory');
      expect(pathResults.some(r => r.displayValue === 'Documents/')).toBe(true);
    });

    it('should handle Windows paths with drive letters in tilde expansion', async () => {
      mockGetHomeDir.mockReturnValue('D:\\Users\\Developer');

      mockFs.readdir.mockResolvedValue([
        { name: 'Projects', isDirectory: () => true } as any,
        { name: 'Code', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('cd ~/Pro', 8, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      expect(mockFs.readdir).toHaveBeenCalledWith('D:\\Users\\Developer', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'directory');
      expect(pathResults.some(r => r.displayValue === 'Projects/')).toBe(true);
    });

    it('should handle nested Windows paths with tilde expansion', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');

      mockFs.readdir.mockResolvedValue([
        { name: 'index.js', isDirectory: () => false } as any,
        { name: 'package.json', isDirectory: () => false } as any,
        { name: 'src', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('view ~/Projects/apex/pack', 25, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      expect(mockFs.readdir).toHaveBeenCalledWith(
        'C:\\Users\\TestUser\\Projects\\apex',
        { withFileTypes: true }
      );

      const pathResults = results.filter(r => r.type === 'file');
      expect(pathResults.some(r => r.displayValue === 'package.json')).toBe(true);
    });
  });

  describe('Windows Path Handling Edge Cases', () => {
    it('should handle Windows usernames with spaces', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\Test User');

      mockFs.readdir.mockResolvedValue([
        { name: 'My Documents', isDirectory: () => true } as any,
        { name: 'My Pictures', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('open ~/My', 9, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\Test User', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'directory');
      expect(pathResults.some(r => r.displayValue === 'My Documents/')).toBe(true);
    });

    it('should handle Windows paths with special characters', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');

      mockFs.readdir.mockResolvedValue([
        { name: 'test-file.txt', isDirectory: () => false } as any,
        { name: 'my_project', isDirectory: () => true } as any,
        { name: 'file (1).doc', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('cat ~/test-', 11, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\TestUser', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'file');
      expect(pathResults.some(r => r.displayValue === 'test-file.txt')).toBe(true);
    });

    it('should handle UNC paths in home directory', async () => {
      mockGetHomeDir.mockReturnValue('\\\\server\\users\\TestUser');

      mockFs.readdir.mockResolvedValue([
        { name: 'shared', isDirectory: () => true } as any,
        { name: 'profile.txt', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('ls ~/sh', 7, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      expect(mockFs.readdir).toHaveBeenCalledWith('\\\\server\\users\\TestUser', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'directory');
      expect(pathResults.some(r => r.displayValue === 'shared/')).toBe(true);
    });
  });

  describe('Error Handling on Windows', () => {
    it('should handle getHomeDir() errors gracefully on Windows', async () => {
      mockGetHomeDir.mockImplementation(() => {
        throw new Error('Unable to determine home directory');
      });

      const results = await engine.getCompletions('edit ~/test', 10, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      expect(mockFs.readdir).not.toHaveBeenCalled();

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults).toHaveLength(0);
    });

    it('should handle Windows filesystem permission errors', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\RestrictedUser');
      mockFs.readdir.mockRejectedValue(new Error('Access denied'));

      const results = await engine.getCompletions('dir ~/', 5, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\RestrictedUser', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults).toHaveLength(0);
    });

    it('should handle empty home directory gracefully', async () => {
      mockGetHomeDir.mockReturnValue('');

      const results = await engine.getCompletions('edit ~/test', 10, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      expect(mockFs.readdir).toHaveBeenCalledWith('', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults).toHaveLength(0);
    });
  });

  describe('Windows Command Compatibility', () => {
    it('should work with Windows-style commands', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');

      mockFs.readdir.mockResolvedValue([
        { name: 'README.txt', isDirectory: () => false } as any,
        { name: 'src', isDirectory: () => true } as any,
      ]);

      // Test with various Windows commands
      const commands = [
        'dir ~/READ',
        'type ~/READ',
        'copy ~/READ',
        'move ~/READ',
      ];

      for (const command of commands) {
        const results = await engine.getCompletions(command, command.length, mockContext);
        const pathResults = results.filter(r => r.type === 'file');
        expect(pathResults.some(r => r.displayValue === 'README.txt')).toBe(true);
      }
    });

    it('should handle PowerShell-style commands', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');

      mockFs.readdir.mockResolvedValue([
        { name: 'script.ps1', isDirectory: () => false } as any,
        { name: 'config.json', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('Get-Content ~/scr', 17, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
      const pathResults = results.filter(r => r.type === 'file');
      expect(pathResults.some(r => r.displayValue === 'script.ps1')).toBe(true);
    });
  });

  describe('Acceptance Criteria Validation', () => {
    it('ACCEPTANCE: Should not use process.env.HOME for tilde expansion', async () => {
      const originalEnv = process.env;

      // Set a fake HOME environment variable
      process.env = { ...originalEnv, HOME: '/fake/unix/path' };

      try {
        mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');
        mockFs.readdir.mockResolvedValue([]);

        await engine.getCompletions('edit ~/', 7, mockContext);

        // Should use getHomeDir(), not process.env.HOME
        expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
        expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\TestUser', { withFileTypes: true });

        // Should NOT use the fake HOME env var
        expect(mockFs.readdir).not.toHaveBeenCalledWith('/fake/unix/path', expect.anything());
      } finally {
        process.env = originalEnv;
      }
    });

    it('ACCEPTANCE: CompletionEngine works correctly on Windows platform', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\Developer');

      mockFs.readdir.mockResolvedValue([
        { name: 'apex', isDirectory: () => true } as any,
        { name: 'node_modules', isDirectory: () => true } as any,
        { name: 'package.json', isDirectory: () => false } as any,
      ]);

      // Should complete file paths correctly
      const results = await engine.getCompletions('edit ~/ape', 9, mockContext);

      expect(results.length).toBeGreaterThan(0);
      const pathResults = results.filter(r => r.type === 'directory');
      expect(pathResults.some(r => r.displayValue === 'apex/')).toBe(true);

      // Should use correct Windows paths
      expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\Developer', { withFileTypes: true });
    });

    it('ACCEPTANCE: Cross-platform path utilities provide Windows compatibility', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');

      // Test multiple completion scenarios
      const scenarios = [
        { input: 'edit ~/', expected: 'C:\\Users\\TestUser' },
        { input: 'view ~/Projects/', expected: 'C:\\Users\\TestUser\\Projects' },
        { input: 'open ~/Documents/', expected: 'C:\\Users\\TestUser\\Documents' },
      ];

      for (const scenario of scenarios) {
        mockFs.readdir.mockResolvedValue([]);
        await engine.getCompletions(scenario.input, scenario.input.length, mockContext);

        expect(mockGetHomeDir).toHaveBeenCalled();
      }

      // Should have called getHomeDir for each scenario
      expect(mockGetHomeDir).toHaveBeenCalledTimes(scenarios.length);
    });
  });

  describe('Backwards Compatibility', () => {
    it('should work when HOME environment variable exists but is ignored', async () => {
      const originalEnv = process.env;

      // Set both Windows and Unix-style HOME variables
      process.env = {
        ...originalEnv,
        HOME: '/home/unixuser',  // Unix-style (should be ignored)
        USERPROFILE: 'C:\\Users\\TestUser',  // Windows-style
      };

      try {
        mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');
        mockFs.readdir.mockResolvedValue([
          { name: 'WindowsFile.txt', isDirectory: () => false } as any,
        ]);

        const results = await engine.getCompletions('edit ~/Wind', 11, mockContext);

        // Should use getHomeDir result, not environment variables
        expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
        expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\TestUser', { withFileTypes: true });

        const pathResults = results.filter(r => r.type === 'file');
        expect(pathResults.some(r => r.displayValue === 'WindowsFile.txt')).toBe(true);
      } finally {
        process.env = originalEnv;
      }
    });

    it('should maintain consistent behavior across multiple calls', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');
      mockFs.readdir.mockResolvedValue([
        { name: 'consistent.txt', isDirectory: () => false } as any,
      ]);

      // Make multiple completion calls
      for (let i = 0; i < 3; i++) {
        const results = await engine.getCompletions('edit ~/cons', 11, mockContext);
        const pathResults = results.filter(r => r.type === 'file');
        expect(pathResults.some(r => r.displayValue === 'consistent.txt')).toBe(true);
      }

      // Should have called getHomeDir for each completion
      expect(mockGetHomeDir).toHaveBeenCalledTimes(3);
      // Should have called readdir for each completion
      expect(mockFs.readdir).toHaveBeenCalledTimes(3);
    });
  });
});