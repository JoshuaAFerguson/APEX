import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CompletionEngine, CompletionContext } from '../CompletionEngine';

/**
 * File Path Completion Integration Tests for CompletionEngine
 *
 * These tests verify the file path completion provider integration with the
 * filesystem and cross-platform path utilities.
 *
 * Acceptance Criteria:
 * AC1: Absolute path completion resolves correct file/directory suggestions
 * AC2: Relative path completion respects project context
 * AC3: Home directory expansion (~/) works correctly using getHomeDir()
 * AC4: Hidden files are handled appropriately based on context
 * AC5: Directory completion appends trailing slash
 * AC6: Error handling for non-existent paths is graceful
 * AC7: Cross-platform path handling works with getHomeDir() from @apexcli/core
 */

// Mock the filesystem and cross-platform utilities
vi.mock('fs/promises');
vi.mock('@apexcli/core', () => ({
  getHomeDir: vi.fn()
}));

const mockFs = vi.mocked(fs);
const mockGetHomeDir = vi.mocked((await import('@apexcli/core')).getHomeDir);

describe('CompletionEngine - File Path Integration Tests', () => {
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

    // Mock cross-platform getHomeDir
    mockGetHomeDir.mockReturnValue('/home/user');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Path Trigger Patterns', () => {
    it('should trigger completion for ./ prefix', async () => {
      // Mock filesystem entries for current directory
      mockFs.readdir.mockResolvedValue([
        { name: 'src', isDirectory: () => true } as any,
        { name: 'package.json', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('edit ./', 7, mockContext);

      // Should call readdir with resolved project path
      expect(mockFs.readdir).toHaveBeenCalledWith(
        path.resolve(mockContext.projectPath, '.'),
        { withFileTypes: true }
      );

      // Should return file completions
      expect(results.some(r => r.type === 'directory' || r.type === 'file')).toBe(true);
    });

    it('should trigger completion for ~/ prefix', async () => {
      // Mock filesystem entries for home directory
      mockFs.readdir.mockResolvedValue([
        { name: 'Documents', isDirectory: () => true } as any,
        { name: '.bashrc', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('edit ~/', 7, mockContext);

      // Should call readdir with home directory
      expect(mockFs.readdir).toHaveBeenCalledWith('/home/user', { withFileTypes: true });

      // Should return file completions
      expect(results.some(r => r.type === 'directory' || r.type === 'file')).toBe(true);
    });

    it('should trigger completion for absolute paths', async () => {
      // Mock filesystem entries for root directory
      mockFs.readdir.mockResolvedValue([
        { name: 'etc', isDirectory: () => true } as any,
        { name: 'var', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('cat /etc/', 9, mockContext);

      // Should call readdir with absolute path
      expect(mockFs.readdir).toHaveBeenCalledWith('/etc', { withFileTypes: true });

      // Should return file completions
      expect(results.some(r => r.type === 'directory' || r.type === 'file')).toBe(true);
    });

    it('should trigger completion for relative paths with subdirectories', async () => {
      // Mock filesystem entries for src directory
      mockFs.readdir.mockResolvedValue([
        { name: 'components', isDirectory: () => true } as any,
        { name: 'index.ts', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('read src/', 8, mockContext);

      // Should call readdir with resolved path
      expect(mockFs.readdir).toHaveBeenCalledWith(
        path.resolve(mockContext.projectPath, 'src'),
        { withFileTypes: true }
      );

      // Should return file completions
      expect(results.some(r => r.type === 'directory' || r.type === 'file')).toBe(true);
    });

    it('should not trigger completion for non-path inputs', async () => {
      const results = await engine.getCompletions('status', 6, mockContext);

      // Should not call readdir for non-path inputs
      expect(mockFs.readdir).not.toHaveBeenCalled();

      // Should not return file completions
      expect(results.filter(r => r.type === 'directory' || r.type === 'file')).toHaveLength(0);
    });
  });

  describe('Directory and File Display', () => {
    beforeEach(() => {
      // Mock mixed filesystem entries
      mockFs.readdir.mockResolvedValue([
        { name: 'src', isDirectory: () => true } as any,
        { name: 'dist', isDirectory: () => true } as any,
        { name: 'package.json', isDirectory: () => false } as any,
        { name: 'README.md', isDirectory: () => false } as any,
      ]);
    });

    it('should show directories with trailing slash', async () => {
      const results = await engine.getCompletions('ls ./', 5, mockContext);

      const directoryResults = results.filter(r => r.type === 'directory');

      directoryResults.forEach(result => {
        expect(result.displayValue).toMatch(/\/$/); // Should end with slash
        expect(result.value).toMatch(/\/$/); // Value should also end with slash
        expect(result.icon).toBe('📁'); // Should have directory icon
        expect(result.description).toBe('Directory');
      });
    });

    it('should show files without trailing slash', async () => {
      const results = await engine.getCompletions('cat ./', 6, mockContext);

      const fileResults = results.filter(r => r.type === 'file');

      fileResults.forEach(result => {
        expect(result.displayValue).not.toMatch(/\/$/); // Should not end with slash
        expect(result.value).not.toMatch(/\/$/); // Value should not end with slash
        expect(result.icon).toBe('📄'); // Should have file icon
        expect(result.description).toBe('File');
      });
    });

    it('should properly format mixed directory and file listings', async () => {
      const results = await engine.getCompletions('edit ./', 7, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should have both directories and files
      const directories = pathResults.filter(r => r.type === 'directory');
      const files = pathResults.filter(r => r.type === 'file');

      expect(directories.length).toBeGreaterThan(0);
      expect(files.length).toBeGreaterThan(0);

      // Directories should end with slash, files should not
      directories.forEach(dir => expect(dir.displayValue).toMatch(/\/$/));
      files.forEach(file => expect(file.displayValue).not.toMatch(/\/$/));
    });

    it('should maintain correct path structure in values', async () => {
      const results = await engine.getCompletions('view ./src/', 10, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      pathResults.forEach(result => {
        if (result.type === 'directory') {
          // Directory values should include the full path with trailing slash
          expect(result.value).toMatch(/^\.\/src\/.*\/$/);
        } else {
          // File values should include the full path without trailing slash
          expect(result.value).toMatch(/^\.\/src\/[^/]*$/);
          expect(result.value).not.toMatch(/\/$/);
        }
      });
    });
  });

  describe('Hidden File Filtering', () => {
    beforeEach(() => {
      // Mock filesystem with hidden files and directories
      mockFs.readdir.mockResolvedValue([
        { name: 'src', isDirectory: () => true } as any,
        { name: '.git', isDirectory: () => true } as any,
        { name: '.gitignore', isDirectory: () => false } as any,
        { name: 'package.json', isDirectory: () => false } as any,
        { name: '.env', isDirectory: () => false } as any,
        { name: '.vscode', isDirectory: () => true } as any,
      ]);
    });

    it('should filter out hidden files (starting with dot)', async () => {
      const results = await engine.getCompletions('ls ./', 5, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should not include any entries starting with dot
      pathResults.forEach(result => {
        expect(result.displayValue).not.toMatch(/^\./);
        expect(result.value).not.toMatch(/[^/]\/\./); // Also check path doesn't contain hidden files
      });
    });

    it('should filter out hidden directories', async () => {
      const results = await engine.getCompletions('cd ./', 5, mockContext);

      const directoryResults = results.filter(r => r.type === 'directory');

      // Should not include .git, .vscode directories
      directoryResults.forEach(result => {
        expect(result.displayValue).not.toBe('.git/');
        expect(result.displayValue).not.toBe('.vscode/');
      });
    });

    it('should include visible files and directories only', async () => {
      const results = await engine.getCompletions('edit ./', 7, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should include visible entries
      const displayValues = pathResults.map(r => r.displayValue);
      expect(displayValues).toContain('src/');
      expect(displayValues).toContain('package.json');

      // Should not include hidden entries
      expect(displayValues).not.toContain('.git/');
      expect(displayValues).not.toContain('.gitignore');
      expect(displayValues).not.toContain('.env');
      expect(displayValues).not.toContain('.vscode/');
    });

    it('should maintain filtering with partial matches', async () => {
      const results = await engine.getCompletions('read ./p', 7, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should include package.json (starts with 'p')
      const packageFile = pathResults.find(r => r.displayValue === 'package.json');
      expect(packageFile).toBeDefined();
      expect(packageFile?.type).toBe('file');

      // Should not include any hidden files even if they start with 'p'
      pathResults.forEach(result => {
        expect(result.displayValue).not.toMatch(/^\./);
      });
    });
  });

  describe('Mocked Filesystem Behavior', () => {
    it('should return proper entries when filesystem returns directories and files', async () => {
      const mockEntries = [
        { name: 'components', isDirectory: () => true } as any,
        { name: 'utils', isDirectory: () => true } as any,
        { name: 'index.js', isDirectory: () => false } as any,
        { name: 'config.json', isDirectory: () => false } as any,
      ];

      mockFs.readdir.mockResolvedValue(mockEntries);

      const results = await engine.getCompletions('open ./', 7, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should return suggestions for all entries
      expect(pathResults).toHaveLength(4);

      // Verify each type is correctly identified
      const components = pathResults.find(r => r.displayValue === 'components/');
      expect(components?.type).toBe('directory');
      expect(components?.icon).toBe('📁');

      const indexFile = pathResults.find(r => r.displayValue === 'index.js');
      expect(indexFile?.type).toBe('file');
      expect(indexFile?.icon).toBe('📄');
    });

    it('should handle empty directory gracefully', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const results = await engine.getCompletions('list ./', 8, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should return no path completions for empty directory
      expect(pathResults).toHaveLength(0);

      // Should have called readdir
      expect(mockFs.readdir).toHaveBeenCalledTimes(1);
    });

    it('should handle filesystem errors by returning no suggestions', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock filesystem error (permission denied, path doesn't exist, etc.)
      mockFs.readdir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const results = await engine.getCompletions('read ./nonexistent/', 18, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should return no path completions on error
      expect(pathResults).toHaveLength(0);

      // Should have attempted readdir
      expect(mockFs.readdir).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockRestore();
    });

    it('should respect file name filtering based on input prefix', async () => {
      const mockEntries = [
        { name: 'app.js', isDirectory: () => false } as any,
        { name: 'api.js', isDirectory: () => false } as any,
        { name: 'test.js', isDirectory: () => false } as any,
        { name: 'admin', isDirectory: () => true } as any,
      ];

      mockFs.readdir.mockResolvedValue(mockEntries);

      const results = await engine.getCompletions('edit ./a', 7, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should only include entries starting with 'a'
      const expectedEntries = ['app.js', 'api.js', 'admin/'];
      pathResults.forEach(result => {
        expect(expectedEntries).toContain(result.displayValue);
      });

      // Should not include entries that don't start with 'a'
      expect(pathResults.find(r => r.displayValue === 'test.js')).toBeUndefined();
    });

    it('should properly handle different path types in mock calls', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'file.txt', isDirectory: () => false } as any,
      ]);

      // Test various path formats
      await engine.getCompletions('cat ./', 6, mockContext);
      await engine.getCompletions('view ~/', 7, mockContext);
      await engine.getCompletions('edit /tmp/', 10, mockContext);

      // Should have called readdir with correct paths
      expect(mockFs.readdir).toHaveBeenNthCalledWith(
        1,
        path.resolve(mockContext.projectPath, '.'),
        { withFileTypes: true }
      );
      expect(mockFs.readdir).toHaveBeenNthCalledWith(
        2,
        '/home/user',
        { withFileTypes: true }
      );
      expect(mockFs.readdir).toHaveBeenNthCalledWith(
        3,
        '/tmp',
        { withFileTypes: true }
      );
    });
  });

  describe('Path Resolution Edge Cases', () => {
    it('should handle nested relative paths correctly', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'components', isDirectory: () => true } as any,
        { name: 'index.ts', isDirectory: () => false } as any,
      ]);

      const results = await engine.getCompletions('edit ../src/ui/', 13, mockContext);

      // Should resolve relative path correctly
      expect(mockFs.readdir).toHaveBeenCalledWith(
        path.resolve(mockContext.projectPath, '../src/ui'),
        { withFileTypes: true }
      );
    });

    it('should expand tilde paths to home directory', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'Documents', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('backup ~/Documents/', 17, mockContext);

      // Should expand ~ to home directory
      expect(mockFs.readdir).toHaveBeenCalledWith(
        '/home/user/Documents',
        { withFileTypes: true }
      );
    });

    it('should handle partial file names with directory navigation', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'config.json', isDirectory: () => false } as any,
        { name: 'constants.js', isDirectory: () => false } as any,
        { name: 'components', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('open ./src/con', 12, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Should match files starting with 'con'
      const matchedFiles = pathResults.map(r => r.displayValue);
      expect(matchedFiles).toContain('config.json');
      expect(matchedFiles).toContain('constants.js');

      // Should not include files that don't match prefix
      expect(matchedFiles).not.toContain('index.js');
    });
  });

  describe('Integration with Other Completion Providers', () => {
    it('should work alongside command completion', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'src', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('./s', 3, mockContext);

      // Should include both file path completions and other types
      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');
      const otherResults = results.filter(r => r.type !== 'directory' && r.type !== 'file');

      expect(pathResults.length).toBeGreaterThan(0);
      // May have other completion types as well depending on the input pattern
    });

    it('should maintain proper scoring relative to other providers', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: 'source', isDirectory: () => true } as any,
      ]);

      const results = await engine.getCompletions('./s', 3, mockContext);

      const pathResults = results.filter(r => r.type === 'directory' || r.type === 'file');

      // Path completion should have reasonable scores (not too high, not too low)
      pathResults.forEach(result => {
        expect(result.score).toBeGreaterThan(0);
        expect(result.score).toBeLessThanOrEqual(100);
      });
    });
  });
});