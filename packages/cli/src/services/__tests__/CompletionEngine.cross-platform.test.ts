import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CompletionEngine, CompletionContext } from '../CompletionEngine';

/**
 * Cross-Platform Path Handling Tests for CompletionEngine
 *
 * These tests specifically verify the cross-platform path handling changes
 * where getHomeDir() from @apexcli/core replaced direct os.homedir() usage.
 *
 * Test Focus:
 * 1. Verify getHomeDir() is properly used for tilde expansion
 * 2. Test error handling when getHomeDir() throws
 * 3. Test path completion with various home directory paths (Windows/Unix)
 * 4. Verify mocking works correctly for cross-platform testing
 */

// Mock the filesystem and cross-platform utilities
vi.mock('fs/promises');
vi.mock('@apexcli/core', () => ({
  getHomeDir: vi.fn()
}));

const mockFs = vi.mocked(fs);
const mockGetHomeDir = vi.mocked((await import('@apexcli/core')).getHomeDir);

describe('CompletionEngine - Cross-Platform Path Handling', () => {
  let engine: CompletionEngine;
  let mockContext: CompletionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Initialize CompletionEngine
    engine = new CompletionEngine();

    // Create mock completion context
    mockContext = {
      projectPath: '/test/project',
      agents: [],
      workflows: [],
      recentTasks: [],
      inputHistory: []
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHomeDir() Integration', () => {
    it('should use getHomeDir() for tilde expansion on Unix-like systems', async () => {
      // Mock Unix-style home directory
      mockGetHomeDir.mockReturnValue('/home/user');

      // Mock filesystem entries for home directory
      mockFs.readdir.mockResolvedValue([
        { name: 'Documents', isDirectory: () => true } as any,
        { name: 'config.txt', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('edit ~/Doc', 9, mockContext);

      // Verify getHomeDir was called
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);

      // Verify correct path resolution
      expect(mockFs.readdir).toHaveBeenCalledWith('/home/user', { withFileTypes: true });

      // Should return matching completions
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults.some(r => r.displayValue === 'Documents/')).toBe(true);
    });

    it('should use getHomeDir() for tilde expansion on Windows systems', async () => {
      // Mock Windows-style home directory
      mockGetHomeDir.mockReturnValue('C:\\Users\\User');

      // Mock filesystem entries for home directory
      mockFs.readdir.mockResolvedValue([
        { name: 'Desktop', isDirectory: () => true } as any,
        { name: 'Documents', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('view ~/Des', 9, mockContext);

      // Verify getHomeDir was called
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);

      // Verify correct path resolution (Windows path)
      expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\User', { withFileTypes: true });

      // Should return matching completions
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults.some(r => r.displayValue === 'Desktop/')).toBe(true);
    });

    it('should handle getHomeDir() throwing an error gracefully', async () => {
      // Mock getHomeDir to throw an error
      mockGetHomeDir.mockImplementation(() => {
        throw new Error('Unable to determine home directory');
      });

      const results = await engine.getCompletions('edit ~/test', 10, mockContext);

      // Verify getHomeDir was called and error was handled gracefully
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);

      // Should not call readdir due to error
      expect(mockFs.readdir).not.toHaveBeenCalled();

      // Should return no path completions
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults).toHaveLength(0);
    });

    it('should handle nested tilde paths correctly', async () => {
      // Mock home directory
      mockGetHomeDir.mockReturnValue('/Users/testuser');

      // Mock filesystem entries for nested path
      mockFs.readdir.mockResolvedValue([
        { name: 'project.js', isDirectory: () => false } as any,
        { name: 'config.json', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('cat ~/projects/myapp/src/pro', 28, mockContext);

      // Verify getHomeDir was called
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);

      // Verify correct path resolution with nested structure
      expect(mockFs.readdir).toHaveBeenCalledWith('/Users/testuser/projects/myapp/src', { withFileTypes: true });

      // Should return matching completions
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults.some(r => r.displayValue === 'project.js')).toBe(true);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty home directory gracefully', async () => {
      // Mock empty home directory
      mockGetHomeDir.mockReturnValue('');

      const results = await engine.getCompletions('edit ~/test', 10, mockContext);

      // Verify getHomeDir was called
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);

      // Should handle empty path gracefully (likely fail to readdir)
      expect(mockFs.readdir).toHaveBeenCalledWith('', { withFileTypes: true });
    });

    it('should handle filesystem errors when accessing home directory', async () => {
      // Mock valid home directory
      mockGetHomeDir.mockReturnValue('/home/user');

      // Mock filesystem error
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const results = await engine.getCompletions('ls ~/', 5, mockContext);

      // Verify getHomeDir was called
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);

      // Should attempt to read directory but fail gracefully
      expect(mockFs.readdir).toHaveBeenCalledWith('/home/user', { withFileTypes: true });

      // Should return no path completions due to error
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults).toHaveLength(0);
    });

    it('should handle multiple tilde expansions in same session', async () => {
      // Mock home directory
      mockGetHomeDir.mockReturnValue('/home/user');

      // Mock different filesystem entries for different calls
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'Documents', isDirectory: () => true } as any,
        ])
        .mockResolvedValueOnce([
          { name: 'Downloads', isDirectory: () => true } as any,
        ]);

      // Make two different completions with tilde
      await engine.getCompletions('edit ~/Doc', 9, mockContext);
      await engine.getCompletions('view ~/Down', 10, mockContext);

      // Verify getHomeDir was called twice (once per completion)
      expect(mockGetHomeDir).toHaveBeenCalledTimes(2);

      // Verify both readdir calls used correct home path
      expect(mockFs.readdir).toHaveBeenNthCalledWith(
        1,
        '/home/user',
        { withFileTypes: true }
      );
      expect(mockFs.readdir).toHaveBeenNthCalledWith(
        2,
        '/home/user',
        { withFileTypes: true }
      );
    });
  });

  describe('Path Construction and Resolution', () => {
    it('should construct correct completion values with tilde paths', async () => {
      // Mock home directory
      mockGetHomeDir.mockReturnValue('/home/user');

      // Mock filesystem entries
      mockFs.readdir.mockResolvedValue([
        { name: 'Documents', isDirectory: () => true } as any,
        { name: 'notes.txt', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('edit ~/', 7, mockContext);

      // Should return properly formatted completion values
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Check directory completion has proper tilde prefix and trailing slash
      const documentsResult = pathResults.find(r => r.displayValue === 'Documents/');
      expect(documentsResult).toBeDefined();
      expect(documentsResult?.value).toMatch(/^~.*Documents\/$/);

      // Check file completion has proper tilde prefix but no trailing slash
      const notesResult = pathResults.find(r => r.displayValue === 'notes.txt');
      expect(notesResult).toBeDefined();
      expect(notesResult?.value).toMatch(/^~.*notes\.txt$/);
      expect(notesResult?.value).not.toMatch(/\/$/);
    });

    it('should handle subdirectory completion within tilde paths', async () => {
      // Mock home directory
      mockGetHomeDir.mockReturnValue('/home/user');

      // Mock filesystem entries in Documents subdirectory
      mockFs.readdir.mockResolvedValue([
        { name: 'work', isDirectory: () => true } as any,
        { name: 'personal', isDirectory: () => true } as any,
        { name: 'readme.md', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('open ~/Documents/', 16, mockContext);

      // Verify path resolution for subdirectory
      expect(mockFs.readdir).toHaveBeenCalledWith('/home/user/Documents', { withFileTypes: true });

      // Should return proper completion values for subdirectory
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults.length).toBeGreaterThan(0);

      // Check that completion values maintain tilde prefix structure
      const workResult = pathResults.find(r => r.displayValue === 'work/');
      expect(workResult?.value).toMatch(/Documents.*work\/$/);
    });

    it('should maintain correct path separators across platforms', async () => {
      // Test with Windows-style path
      mockGetHomeDir.mockReturnValue('C:\\Users\\TestUser');

      // Mock filesystem entries
      mockFs.readdir.mockResolvedValue([
        { name: 'folder', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('cd ~/', 5, mockContext);

      // Verify getHomeDir was called
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);

      // Should call readdir with Windows path
      expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\TestUser', { withFileTypes: true });

      // Should return valid completions regardless of platform
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      expect(pathResults.length).toBeGreaterThan(0);
    });
  });

  describe('Mock Verification', () => {
    it('should verify mocks are properly configured', () => {
      // Verify mocks are functions
      expect(typeof mockGetHomeDir).toBe('function');
      expect(typeof mockFs.readdir).toBe('function');

      // Verify mocks can be configured
      mockGetHomeDir.mockReturnValue('/test/home');
      expect(mockGetHomeDir()).toBe('/test/home');
    });

    it('should reset mocks between tests', () => {
      // Set mock return value
      mockGetHomeDir.mockReturnValue('/previous/test');

      // Clear mocks (simulating beforeEach)
      vi.clearAllMocks();

      // Configure new return value
      mockGetHomeDir.mockReturnValue('/new/test');

      // Should use new value
      expect(mockGetHomeDir()).toBe('/new/test');
      expect(mockGetHomeDir).toHaveBeenCalledTimes(1);
    });
  });

  describe('Real-world Cross-Platform Scenarios', () => {
    it('should handle macOS-style home paths', async () => {
      mockGetHomeDir.mockReturnValue('/Users/testuser');
      mockFs.readdir.mockResolvedValue([
        { name: 'Applications', isDirectory: () => true } as any,
        { name: '.bash_profile', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('backup ~/App', 11, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalled();
      expect(mockFs.readdir).toHaveBeenCalledWith('/Users/testuser', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'directory');
      expect(pathResults.some(r => r.displayValue === 'Applications/')).toBe(true);
    });

    it('should handle Linux-style home paths', async () => {
      mockGetHomeDir.mockReturnValue('/home/testuser');
      mockFs.readdir.mockResolvedValue([
        { name: 'Documents', isDirectory: () => true } as any,
        { name: '.bashrc', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('sync ~/Doc', 9, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalled();
      expect(mockFs.readdir).toHaveBeenCalledWith('/home/testuser', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'directory');
      expect(pathResults.some(r => r.displayValue === 'Documents/')).toBe(true);
    });

    it('should handle Windows-style home paths with spaces', async () => {
      mockGetHomeDir.mockReturnValue('C:\\Users\\Test User');
      mockFs.readdir.mockResolvedValue([
        { name: 'My Documents', isDirectory: () => true } as any,
        { name: 'config.ini', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('import ~/My', 10, mockContext);

      expect(mockGetHomeDir).toHaveBeenCalled();
      expect(mockFs.readdir).toHaveBeenCalledWith('C:\\Users\\Test User', { withFileTypes: true });

      const pathResults = results.filter(r => r.type === 'directory');
      expect(pathResults.some(r => r.displayValue === 'My Documents/')).toBe(true);
    });
  });
});