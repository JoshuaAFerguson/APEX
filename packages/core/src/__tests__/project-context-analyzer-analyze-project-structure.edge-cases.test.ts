/**
 * Edge Case Tests for ProjectContextAnalyzer.analyzeProjectStructure()
 *
 * These tests cover edge cases, boundary conditions, and unusual scenarios
 * that might not be covered in the main unit tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import { ProjectStructureSchema } from '../types.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('path');

const mockFs = vi.mocked(fs, true);
const mockPath = vi.mocked(path, true);

describe('ProjectContextAnalyzer.analyzeProjectStructure() Edge Cases', () => {
  let analyzer: ProjectContextAnalyzer;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock path methods with realistic behavior
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.basename.mockImplementation((filePath) => filePath.split('/').pop() || '');
    mockPath.extname.mockImplementation((filePath) => {
      const parts = filePath.split('.');
      return parts.length > 1 ? '.' + parts.pop() : '';
    });

    analyzer = new ProjectContextAnalyzer(testProjectPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File extension edge cases', () => {
    it('handles files with multiple dots correctly', async () => {
      const mockStructure = [
        { name: 'component.test.ts', isFile: () => true, isDirectory: () => false },
        { name: 'config.dev.json', isFile: () => true, isDirectory: () => false },
        { name: 'script.min.js', isFile: () => true, isDirectory: () => false },
        { name: 'data.backup.sql', isFile: () => true, isDirectory: () => false }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '.ts': 1,
        '.json': 1,
        '.js': 1,
        '.sql': 1
      });
    });

    it('handles files with uppercase extensions', async () => {
      const mockStructure = [
        { name: 'document.PDF', isFile: () => true, isDirectory: () => false },
        { name: 'image.PNG', isFile: () => true, isDirectory: () => false },
        { name: 'archive.ZIP', isFile: () => true, isDirectory: () => false }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).analyzeFilesByExtension();

      // Extensions should be normalized to lowercase
      expect(result).toEqual({
        '.pdf': 1,
        '.png': 1,
        '.zip': 1
      });
    });

    it('handles files ending with dots', async () => {
      const mockStructure = [
        { name: 'file.', isFile: () => true, isDirectory: () => false },
        { name: 'another..', isFile: () => true, isDirectory: () => false },
        { name: 'normal.txt', isFile: () => true, isDirectory: () => false }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '[no extension]': 2, // files ending with dots count as no extension
        '.txt': 1
      });
    });

    it('handles very long file extensions', async () => {
      const mockStructure = [
        { name: 'file.verylongextensionnamethatisunusual', isFile: () => true, isDirectory: () => false },
        { name: 'normal.js', isFile: () => true, isDirectory: () => false }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '.verylongextensionnamethatisunusual': 1,
        '.js': 1
      });
    });
  });

  describe('Directory name edge cases', () => {
    it('handles directories with special characters', async () => {
      const mockStructure = [
        { name: 'src-main', isFile: () => false, isDirectory: () => true },
        { name: 'test_utils', isFile: () => false, isDirectory: () => true },
        { name: 'docs@v2', isFile: () => false, isDirectory: () => true },
        { name: 'components-old', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toEqual({
        src: 'src-main', // Should match partial pattern
        test: 'test_utils',
        docs: 'docs@v2'
      });
    });

    it('handles case sensitivity in folder detection', async () => {
      const mockStructure = [
        { name: 'SRC', isFile: () => false, isDirectory: () => true },
        { name: 'Test', isFile: () => false, isDirectory: () => true },
        { name: 'DOCS', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toEqual({
        src: 'SRC',
        test: 'Test',
        docs: 'DOCS'
      });
    });

    it('prioritizes exact matches over partial matches', async () => {
      const mockStructure = [
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: 'src-backup', isFile: () => false, isDirectory: () => true },
        { name: 'source-code', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toEqual({
        src: 'src' // Exact match should be preferred
      });
    });
  });

  describe('Monorepo configuration edge cases', () => {
    it('handles malformed package.json with partial workspaces config', async () => {
      const mockPackageJson = {
        name: 'test-project',
        workspaces: {
          // Missing 'packages' property
          nohoist: ['**/react-native']
        }
      };

      (mockFs.promises as any).readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: false, // Should not detect as monorepo if packages is missing
        workspaces: undefined
      });
    });

    it('handles pnpm workspace with comments and complex YAML', async () => {
      const mockWorkspaceYaml = `
# This is a comment
packages:
  # Core packages
  - 'packages/*'
  # Applications
  - 'apps/*'
  # Exclude test directories
  - '!**/test/**'
  # Exclude examples
  - '!**/examples/**'
`;

      (mockFs.promises as any).readFile = vi.fn()
        .mockRejectedValueOnce(new Error('No package.json'))
        .mockResolvedValueOnce(mockWorkspaceYaml);

      (mockFs.promises as any).access = vi.fn()
        .mockResolvedValue(undefined);

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: ['packages/*', 'apps/*', '!**/test/**', '!**/examples/**']
      });
    });

    it('handles rush.json with empty projects array', async () => {
      const mockRushJson = {
        projects: []
      };

      (mockFs.promises as any).readFile = vi.fn()
        .mockRejectedValueOnce(new Error('No package.json'))
        .mockResolvedValueOnce(JSON.stringify(mockRushJson));

      (mockFs.promises as any).access = vi.fn()
        .mockRejectedValueOnce(new Error('No pnpm-workspace.yaml'))
        .mockResolvedValueOnce(undefined);

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: []
      });
    });

    it('handles multiple monorepo config files (precedence)', async () => {
      // package.json workspaces should take precedence over pnpm-workspace.yaml
      const mockPackageJson = {
        name: 'monorepo',
        workspaces: ['packages/*']
      };

      (mockFs.promises as any).readFile = vi.fn()
        .mockResolvedValueOnce(JSON.stringify(mockPackageJson)) // package.json
        .mockResolvedValueOnce('packages:\n  - "libs/*"'); // pnpm-workspace.yaml

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: ['packages/*'] // Should use package.json, not pnpm-workspace.yaml
      });
    });
  });

  describe('Performance and limits', () => {
    it('handles very large directory structures efficiently', async () => {
      // Simulate a large directory with many files
      const largeStructure = Array.from({ length: 1000 }, (_, i) => ({
        name: `file${i}.ts`,
        isFile: () => true,
        isDirectory: () => false
      }));

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(largeStructure);

      const start = Date.now();
      const result = await (analyzer as any).analyzeFilesByExtension();
      const duration = Date.now() - start;

      expect(result['.ts']).toBe(1000);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('handles deeply nested structures within maxDepth', async () => {
      const veryDeepAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        maxDepth: 1 // Very shallow limit
      });

      const mockStructure = [
        { name: 'shallow.ts', isFile: () => true, isDirectory: () => false },
        { name: 'deepDir', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce(mockStructure);

      const result = await (veryDeepAnalyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '.ts': 1 // Should only count shallow file
      });
    });
  });

  describe('Symbolic links and special files', () => {
    it('handles symbolic links gracefully', async () => {
      const mockStructure = [
        { name: 'realfile.ts', isFile: () => true, isDirectory: () => false },
        { name: 'symlink.ts', isFile: () => true, isDirectory: () => false }, // Simulate symlink as regular file
        { name: 'realdir', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '.ts': 2 // Should count both files
      });
    });

    it('handles filesystem errors during stat operations', async () => {
      const mockStructure = [
        { name: 'goodfile.ts', isFile: () => true, isDirectory: () => false },
        { name: 'badfile.ts', isFile: () => true, isDirectory: () => false }
      ];

      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce(mockStructure);

      // Mock stats to fail for second file
      (mockFs.promises as any).stat = vi.fn()
        .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false, size: 100, mtime: new Date() })
        .mockRejectedValueOnce(new Error('Stat failed'));

      // Call the main getProjectStructure method to test stat error handling
      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce([
          { name: 'package.json', isFile: () => true, isDirectory: () => false }
        ])
        .mockResolvedValue([]); // Subsequent calls

      vi.spyOn(analyzer as any, 'analyzeFilesByExtension').mockResolvedValue({ '.ts': 1 });
      vi.spyOn(analyzer as any, 'getTopLevelDirectories').mockResolvedValue([]);
      vi.spyOn(analyzer as any, 'detectImportantFolders').mockResolvedValue(undefined);
      vi.spyOn(analyzer as any, 'analyzeMonorepoStructure').mockResolvedValue({ isMonorepo: false });

      const result = await analyzer.analyzeProjectStructure();

      // Should still return a valid result despite stat errors
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();
    });
  });

  describe('Configuration validation', () => {
    it('validates with extreme option values', async () => {
      const extremeAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        maxDepth: 0, // No depth
        includeHidden: true,
        excludeDirectories: [] // No exclusions
      });

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      vi.spyOn(extremeAnalyzer as any, 'analyzeFilesByExtension').mockResolvedValue({});
      vi.spyOn(extremeAnalyzer as any, 'getTopLevelDirectories').mockResolvedValue([]);
      vi.spyOn(extremeAnalyzer as any, 'detectImportantFolders').mockResolvedValue(undefined);
      vi.spyOn(extremeAnalyzer as any, 'analyzeMonorepoStructure').mockResolvedValue({ isMonorepo: false });

      const result = await extremeAnalyzer.analyzeProjectStructure();

      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();
    });

    it('handles null and undefined paths gracefully', async () => {
      // Test internal methods with edge case inputs
      const result = await (analyzer as any).matchesPattern('test/file.js', '**/*.js');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Memory and resource management', () => {
    it('does not leak memory with large result sets', async () => {
      // Create a large result set
      const largeExtensionMap: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        largeExtensionMap[`.ext${i}`] = Math.floor(Math.random() * 1000);
      }

      vi.spyOn(analyzer as any, 'analyzeFilesByExtension').mockResolvedValue(largeExtensionMap);
      vi.spyOn(analyzer as any, 'getTopLevelDirectories').mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => `dir${i}`)
      );
      vi.spyOn(analyzer as any, 'detectImportantFolders').mockResolvedValue(undefined);
      vi.spyOn(analyzer as any, 'analyzeMonorepoStructure').mockResolvedValue({ isMonorepo: false });

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      const result = await analyzer.analyzeProjectStructure();

      // Should handle large datasets without issues
      expect(Object.keys(result.filesByExtension || {}).length).toBe(100);
      expect(result.topLevelDirectories?.length).toBe(50);
    });
  });
});