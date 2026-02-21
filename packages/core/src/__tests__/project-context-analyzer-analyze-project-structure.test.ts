/**
 * Unit Tests for ProjectContextAnalyzer.analyzeProjectStructure()
 *
 * Tests the new analyzeProjectStructure() method and its helper functions
 * that provide enhanced directory layout analysis including:
 * - File count by extension analysis
 * - Top-level directory identification
 * - Important folder detection (src/test/docs)
 * - Monorepo structure identification
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProjectContextAnalyzer,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';
import {
  ProjectStructureSchema,
  type ProjectStructure,
} from '../types.js';

// Mock external dependencies
vi.mock('fs');
vi.mock('path');

const mockFs = vi.mocked(fs, true);
const mockPath = vi.mocked(path, true);

describe('ProjectContextAnalyzer.analyzeProjectStructure() Unit Tests', () => {
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

  describe('analyzeProjectStructure method', () => {
    it('returns enhanced structure with all new fields', async () => {
      // Mock basic structure method
      const mockBasicStructure = {
        root: testProjectPath,
        totalFiles: 5,
        totalDirectories: 3,
        entries: [],
        rootFiles: ['package.json', 'README.md', 'src'],
        commonDirectories: ['src'],
        hasPackageJson: true,
        hasGitIgnore: false,
        hasReadme: true,
        hasLicense: false,
        excludedDirectories: ['node_modules'],
        scannedAt: new Date()
      };

      // Mock helper method results
      const mockFilesByExtension = { '.ts': 10, '.js': 5, '.json': 3 };
      const mockTopLevelDirectories = ['src', 'test', 'docs'];
      const mockDetectedFolders = { src: 'src', test: 'test', docs: 'docs' };
      const mockMonorepoStructure = { isMonorepo: false, workspaces: undefined };

      // Mock all filesystem operations for the basic getProjectStructure
      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce([
          { name: 'package.json', isFile: () => true, isDirectory: () => false },
          { name: 'README.md', isFile: () => true, isDirectory: () => false },
          { name: 'src', isFile: () => false, isDirectory: () => true }
        ])
        .mockResolvedValue([]); // For subsequent calls

      (mockFs.promises as any).stat = vi.fn().mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1000,
        mtime: new Date()
      });

      // Mock the helper methods by spying on the analyzer
      const analyzeFilesByExtensionSpy = vi.spyOn(analyzer as any, 'analyzeFilesByExtension')
        .mockResolvedValue(mockFilesByExtension);
      const getTopLevelDirectoriesSpy = vi.spyOn(analyzer as any, 'getTopLevelDirectories')
        .mockResolvedValue(mockTopLevelDirectories);
      const detectImportantFoldersSpy = vi.spyOn(analyzer as any, 'detectImportantFolders')
        .mockResolvedValue(mockDetectedFolders);
      const analyzeMonorepoStructureSpy = vi.spyOn(analyzer as any, 'analyzeMonorepoStructure')
        .mockResolvedValue(mockMonorepoStructure);

      const result = await analyzer.analyzeProjectStructure();

      // Verify all helper methods were called
      expect(analyzeFilesByExtensionSpy).toHaveBeenCalledOnce();
      expect(getTopLevelDirectoriesSpy).toHaveBeenCalledOnce();
      expect(detectImportantFoldersSpy).toHaveBeenCalledOnce();
      expect(analyzeMonorepoStructureSpy).toHaveBeenCalledOnce();

      // Verify enhanced structure includes all new fields
      expect(result.filesByExtension).toEqual(mockFilesByExtension);
      expect(result.topLevelDirectories).toEqual(mockTopLevelDirectories);
      expect(result.detectedFolders).toEqual(mockDetectedFolders);
      expect(result.isMonorepo).toBe(false);
      expect(result.workspaces).toBeUndefined();

      // Verify basic structure is preserved
      expect(result.root).toBe(testProjectPath);
      expect(result.hasPackageJson).toBe(true);
      expect(result.hasReadme).toBe(true);

      // Verify schema compliance
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();
    });

    it('handles helper method failures gracefully', async () => {
      // Mock basic structure
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      // Mock helper methods to throw errors
      vi.spyOn(analyzer as any, 'analyzeFilesByExtension')
        .mockRejectedValue(new Error('Failed to analyze files'));
      vi.spyOn(analyzer as any, 'getTopLevelDirectories')
        .mockRejectedValue(new Error('Failed to get directories'));
      vi.spyOn(analyzer as any, 'detectImportantFolders')
        .mockRejectedValue(new Error('Failed to detect folders'));
      vi.spyOn(analyzer as any, 'analyzeMonorepoStructure')
        .mockRejectedValue(new Error('Failed to analyze monorepo'));

      await expect(analyzer.analyzeProjectStructure()).rejects.toThrow();
    });
  });

  describe('analyzeFilesByExtension helper method', () => {
    it('correctly counts files by extension', async () => {
      const mockDirectoryStructure = [
        { name: 'file1.ts', isFile: () => true, isDirectory: () => false },
        { name: 'file2.js', isFile: () => true, isDirectory: () => false },
        { name: 'file3.ts', isFile: () => true, isDirectory: () => false },
        { name: 'config.json', isFile: () => true, isDirectory: () => false },
        { name: 'README', isFile: () => true, isDirectory: () => false }, // no extension
        { name: 'subdir', isFile: () => false, isDirectory: () => true }
      ];

      const mockSubdirectoryStructure = [
        { name: 'nested.css', isFile: () => true, isDirectory: () => false },
        { name: 'another.ts', isFile: () => true, isDirectory: () => false }
      ];

      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce(mockDirectoryStructure)
        .mockResolvedValueOnce(mockSubdirectoryStructure);

      const result = await (analyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '.ts': 3,
        '.js': 1,
        '.json': 1,
        '[no extension]': 1,
        '.css': 1
      });
    });

    it('respects excludeDirectories option', async () => {
      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: ['node_modules', 'dist']
      });

      const mockDirectoryStructure = [
        { name: 'file.ts', isFile: () => true, isDirectory: () => false },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true },
        { name: 'dist', isFile: () => false, isDirectory: () => true },
        { name: 'src', isFile: () => false, isDirectory: () => true }
      ];

      const mockSrcStructure = [
        { name: 'index.js', isFile: () => true, isDirectory: () => false }
      ];

      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce(mockDirectoryStructure)
        .mockResolvedValueOnce(mockSrcStructure); // Only src directory should be scanned

      const result = await (customAnalyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '.ts': 1,
        '.js': 1
      });
    });

    it('respects maxDepth option', async () => {
      const depthLimitedAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        maxDepth: 1
      });

      const mockStructure = [
        { name: 'file.ts', isFile: () => true, isDirectory: () => false },
        { name: 'deep', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce(mockStructure);

      const result = await (depthLimitedAnalyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '.ts': 1
      });
      // readdir should only be called once (for root), not for 'deep' directory
      expect((mockFs.promises as any).readdir).toHaveBeenCalledTimes(1);
    });

    it('handles filesystem errors gracefully', async () => {
      (mockFs.promises as any).readdir = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await (analyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({});
    });

    it('respects includeHidden option', async () => {
      const hiddenAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        includeHidden: true
      });

      const mockStructure = [
        { name: 'visible.ts', isFile: () => true, isDirectory: () => false },
        { name: '.hidden.js', isFile: () => true, isDirectory: () => false },
        { name: '.git', isFile: () => false, isDirectory: () => true }
      ];

      const mockHiddenDirStructure = [
        { name: 'config', isFile: () => true, isDirectory: () => false }
      ];

      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce(mockStructure)
        .mockResolvedValueOnce(mockHiddenDirStructure);

      const result = await (hiddenAnalyzer as any).analyzeFilesByExtension();

      expect(result).toEqual({
        '.ts': 1,
        '.js': 1,
        '[no extension]': 1
      });
    });
  });

  describe('getTopLevelDirectories helper method', () => {
    it('returns sorted list of top-level directories', async () => {
      const mockStructure = [
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: 'package.json', isFile: () => true, isDirectory: () => false },
        { name: 'test', isFile: () => false, isDirectory: () => true },
        { name: 'docs', isFile: () => false, isDirectory: () => true },
        { name: '.git', isFile: () => false, isDirectory: () => true } // hidden
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).getTopLevelDirectories();

      expect(result).toEqual(['docs', 'src', 'test']); // sorted, hidden excluded
    });

    it('includes hidden directories when includeHidden is true', async () => {
      const hiddenAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        includeHidden: true
      });

      const mockStructure = [
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: '.git', isFile: () => false, isDirectory: () => true },
        { name: '.vscode', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (hiddenAnalyzer as any).getTopLevelDirectories();

      expect(result).toEqual(['.git', '.vscode', 'src']); // sorted, hidden included
    });

    it('excludes directories in excludeDirectories option', async () => {
      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: ['node_modules', 'dist']
      });

      const mockStructure = [
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: 'node_modules', isFile: () => false, isDirectory: () => true },
        { name: 'dist', isFile: () => false, isDirectory: () => true },
        { name: 'test', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (customAnalyzer as any).getTopLevelDirectories();

      expect(result).toEqual(['src', 'test']); // excluded directories filtered out
    });

    it('handles filesystem errors gracefully', async () => {
      (mockFs.promises as any).readdir = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await (analyzer as any).getTopLevelDirectories();

      expect(result).toEqual([]);
    });
  });

  describe('detectImportantFolders helper method', () => {
    it('detects exact matches for important folders', async () => {
      const mockStructure = [
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: 'test', isFile: () => false, isDirectory: () => true },
        { name: 'docs', isFile: () => false, isDirectory: () => true },
        { name: 'other', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toEqual({
        src: 'src',
        test: 'test',
        docs: 'docs'
      });
    });

    it('detects alternative naming patterns', async () => {
      const mockStructure = [
        { name: 'source', isFile: () => false, isDirectory: () => true },
        { name: 'tests', isFile: () => false, isDirectory: () => true },
        { name: 'documentation', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toEqual({
        src: 'source',
        test: 'tests',
        docs: 'documentation'
      });
    });

    it('prefers exact matches over partial matches', async () => {
      const mockStructure = [
        { name: 'src', isFile: () => false, isDirectory: () => true },
        { name: 'source-code', isFile: () => false, isDirectory: () => true },
        { name: 'test', isFile: () => false, isDirectory: () => true },
        { name: 'integration-tests', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toEqual({
        src: 'src', // exact match preferred over 'source-code'
        test: 'test' // exact match preferred over 'integration-tests'
      });
    });

    it('detects partial matches when no exact match exists', async () => {
      const mockStructure = [
        { name: 'source-code', isFile: () => false, isDirectory: () => true },
        { name: 'unit-tests', isFile: () => false, isDirectory: () => true },
        { name: 'api-docs', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toEqual({
        src: 'source-code',
        test: 'unit-tests',
        docs: 'api-docs'
      });
    });

    it('returns undefined when no important folders found', async () => {
      const mockStructure = [
        { name: 'random', isFile: () => false, isDirectory: () => true },
        { name: 'other', isFile: () => false, isDirectory: () => true }
      ];

      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue(mockStructure);

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toBeUndefined();
    });

    it('handles filesystem errors gracefully', async () => {
      (mockFs.promises as any).readdir = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await (analyzer as any).detectImportantFolders();

      expect(result).toBeUndefined();
    });
  });

  describe('analyzeMonorepoStructure helper method', () => {
    it('detects npm workspaces in package.json', async () => {
      const mockPackageJson = {
        name: 'my-monorepo',
        workspaces: ['packages/*', 'apps/*']
      };

      (mockFs.promises as any).readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: ['packages/*', 'apps/*']
      });
    });

    it('detects yarn workspaces in package.json with packages object', async () => {
      const mockPackageJson = {
        name: 'my-monorepo',
        workspaces: {
          packages: ['libs/*', 'services/*']
        }
      };

      (mockFs.promises as any).readFile = vi.fn()
        .mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: ['libs/*', 'services/*']
      });
    });

    it('detects pnpm workspace from pnpm-workspace.yaml', async () => {
      const mockWorkspaceYaml = `
packages:
  - 'packages/*'
  - 'apps/*'
  - '!**/test/**'
`;

      (mockFs.promises as any).readFile = vi.fn()
        .mockRejectedValueOnce(new Error('No package.json')) // First call for package.json
        .mockResolvedValueOnce(mockWorkspaceYaml); // Second call for pnpm-workspace.yaml

      (mockFs.promises as any).access = vi.fn()
        .mockResolvedValue(undefined); // pnpm-workspace.yaml exists

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: ['packages/*', 'apps/*', '!**/test/**']
      });
    });

    it('detects rush monorepo from rush.json', async () => {
      const mockRushJson = {
        projects: [
          { projectFolder: 'packages/core' },
          { projectFolder: 'packages/cli' },
          { projectFolder: 'apps/web' }
        ]
      };

      (mockFs.promises as any).readFile = vi.fn()
        .mockRejectedValueOnce(new Error('No package.json'))
        .mockResolvedValueOnce(JSON.stringify(mockRushJson)); // rush.json

      (mockFs.promises as any).access = vi.fn()
        .mockRejectedValueOnce(new Error('No pnpm-workspace.yaml'))
        .mockResolvedValueOnce(undefined); // rush.json exists

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: ['packages/core', 'packages/cli', 'apps/web']
      });
    });

    it('detects lerna monorepo from lerna.json', async () => {
      const mockLernaJson = {
        version: '1.0.0',
        packages: ['packages/*', 'tools/*']
      };

      (mockFs.promises as any).readFile = vi.fn()
        .mockRejectedValueOnce(new Error('No package.json'))
        .mockRejectedValueOnce(new Error('No rush.json'))
        .mockResolvedValueOnce(JSON.stringify(mockLernaJson)); // lerna.json

      (mockFs.promises as any).access = vi.fn()
        .mockRejectedValueOnce(new Error('No pnpm-workspace.yaml'))
        .mockRejectedValueOnce(new Error('No rush.json'))
        .mockResolvedValueOnce(undefined); // lerna.json exists

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: ['packages/*', 'tools/*']
      });
    });

    it('detects monorepo heuristically based on structure', async () => {
      // No config files exist
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('No files'));
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('No config files'));

      // Mock getTopLevelDirectories to return monorepo-like structure
      vi.spyOn(analyzer as any, 'getTopLevelDirectories')
        .mockResolvedValue(['packages', 'apps', 'libs']);

      // Mock directory scanning for package.json detection
      (mockFs.promises as any).readdir = vi.fn()
        .mockResolvedValueOnce([ // packages directory
          { name: 'core', isFile: () => false, isDirectory: () => true },
          { name: 'utils', isFile: () => false, isDirectory: () => true }
        ])
        .mockResolvedValueOnce([ // apps directory
          { name: 'web', isFile: () => false, isDirectory: () => true },
          { name: 'mobile', isFile: () => false, isDirectory: () => true }
        ])
        .mockResolvedValueOnce([]); // libs directory (empty)

      // Mock access calls for package.json files in subdirectories
      (mockFs.promises as any).access = vi.fn()
        .mockRejectedValue(new Error('No config files')) // Default rejection
        .mockImplementation((filePath: string) => {
          if (filePath.includes('packages/core/package.json') ||
              filePath.includes('packages/utils/package.json') ||
              filePath.includes('apps/web/package.json')) {
            return Promise.resolve();
          }
          return Promise.reject(new Error('Not found'));
        });

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: true,
        workspaces: ['packages/*', 'apps/*']
      });
    });

    it('returns false for non-monorepo structure', async () => {
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('No files'));
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('No config files'));

      vi.spyOn(analyzer as any, 'getTopLevelDirectories')
        .mockResolvedValue(['src', 'test', 'docs']); // Regular project structure

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: false,
        workspaces: undefined
      });
    });

    it('handles malformed config files gracefully', async () => {
      // Malformed package.json
      (mockFs.promises as any).readFile = vi.fn()
        .mockResolvedValue('invalid json {');

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: false,
        workspaces: undefined
      });
    });

    it('handles filesystem errors gracefully', async () => {
      (mockFs.promises as any).readFile = vi.fn().mockRejectedValue(new Error('Permission denied'));
      (mockFs.promises as any).access = vi.fn().mockRejectedValue(new Error('Permission denied'));
      vi.spyOn(analyzer as any, 'getTopLevelDirectories')
        .mockRejectedValue(new Error('Permission denied'));

      const result = await (analyzer as any).analyzeMonorepoStructure();

      expect(result).toEqual({
        isMonorepo: false,
        workspaces: undefined
      });
    });
  });

  describe('Schema validation', () => {
    it('validates all enhanced structure fields against schema', async () => {
      // Mock all filesystem operations
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      // Mock helper methods with valid data
      vi.spyOn(analyzer as any, 'analyzeFilesByExtension')
        .mockResolvedValue({ '.ts': 5, '.js': 3, '.json': 2 });
      vi.spyOn(analyzer as any, 'getTopLevelDirectories')
        .mockResolvedValue(['src', 'test', 'docs']);
      vi.spyOn(analyzer as any, 'detectImportantFolders')
        .mockResolvedValue({ src: 'src', test: 'test', docs: 'docs' });
      vi.spyOn(analyzer as any, 'analyzeMonorepoStructure')
        .mockResolvedValue({ isMonorepo: true, workspaces: ['packages/*'] });

      const result = await analyzer.analyzeProjectStructure();

      // Should not throw validation error
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();

      // Verify all new fields are present
      expect(result.filesByExtension).toBeDefined();
      expect(result.topLevelDirectories).toBeDefined();
      expect(result.detectedFolders).toBeDefined();
      expect(result.isMonorepo).toBeDefined();
      expect(result.workspaces).toBeDefined();
    });

    it('validates with minimal data (all optional fields)', async () => {
      (mockFs.promises as any).readdir = vi.fn().mockResolvedValue([]);
      (mockFs.promises as any).stat = vi.fn();

      // Mock helper methods with minimal data
      vi.spyOn(analyzer as any, 'analyzeFilesByExtension')
        .mockResolvedValue({});
      vi.spyOn(analyzer as any, 'getTopLevelDirectories')
        .mockResolvedValue([]);
      vi.spyOn(analyzer as any, 'detectImportantFolders')
        .mockResolvedValue(undefined);
      vi.spyOn(analyzer as any, 'analyzeMonorepoStructure')
        .mockResolvedValue({ isMonorepo: false, workspaces: undefined });

      const result = await analyzer.analyzeProjectStructure();

      // Should not throw validation error
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();

      // Verify defaults are applied
      expect(result.filesByExtension).toEqual({});
      expect(result.topLevelDirectories).toEqual([]);
      expect(result.detectedFolders).toBeUndefined();
      expect(result.isMonorepo).toBe(false);
      expect(result.workspaces).toBeUndefined();
    });
  });
});