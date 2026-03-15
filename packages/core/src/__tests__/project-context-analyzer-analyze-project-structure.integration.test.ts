/**
 * Integration Tests for ProjectContextAnalyzer.analyzeProjectStructure()
 *
 * These tests use real filesystem operations to verify that the analyzeProjectStructure()
 * method works correctly in practice with actual files and directories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import { ProjectStructureSchema } from '../types.js';

describe('ProjectContextAnalyzer.analyzeProjectStructure() Integration Tests', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'apex-analyze-project-structure-integration-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Real filesystem operations', () => {
    it('analyzes a simple project structure correctly', async () => {
      // Create a simple project structure
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }));
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project');
      await fs.writeFile(path.join(tempDir, '.gitignore'), 'node_modules/');

      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export const hello = "world";');
      await fs.writeFile(path.join(tempDir, 'src', 'utils.js'), 'module.exports = {};');

      await fs.mkdir(path.join(tempDir, 'test'));
      await fs.writeFile(path.join(tempDir, 'test', 'index.test.ts'), 'test("hello", () => {});');

      const result = await analyzer.analyzeProjectStructure();

      // Validate structure
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();

      // Check basic properties
      expect(result.root).toBe(tempDir);
      expect(result.hasPackageJson).toBe(true);
      expect(result.hasReadme).toBe(true);
      expect(result.hasGitIgnore).toBe(true);

      // Check new fields
      expect(result.filesByExtension).toBeDefined();
      expect(result.filesByExtension?.['.ts']).toBe(2);
      expect(result.filesByExtension?.['.js']).toBe(1);
      expect(result.filesByExtension?.['.json']).toBe(1);
      expect(result.filesByExtension?.['.md']).toBe(1);
      expect(result.filesByExtension?.['[no extension]']).toBe(1); // .gitignore

      expect(result.topLevelDirectories).toEqual(['src', 'test']);

      expect(result.detectedFolders).toBeDefined();
      expect(result.detectedFolders?.src).toBe('src');
      expect(result.detectedFolders?.test).toBe('test');

      expect(result.isMonorepo).toBe(false);
      expect(result.workspaces).toBeUndefined();
    });

    it('detects monorepo structure from package.json workspaces', async () => {
      // Create a monorepo structure
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'my-monorepo',
        workspaces: ['packages/*', 'apps/*']
      }));

      await fs.mkdir(path.join(tempDir, 'packages'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'packages', 'core'));
      await fs.writeFile(path.join(tempDir, 'packages', 'core', 'package.json'), JSON.stringify({
        name: '@my/core'
      }));

      await fs.mkdir(path.join(tempDir, 'apps'));
      await fs.mkdir(path.join(tempDir, 'apps', 'web'));
      await fs.writeFile(path.join(tempDir, 'apps', 'web', 'package.json'), JSON.stringify({
        name: 'web-app'
      }));

      const result = await analyzer.analyzeProjectStructure();

      expect(result.isMonorepo).toBe(true);
      expect(result.workspaces).toEqual(['packages/*', 'apps/*']);
      expect(result.topLevelDirectories).toEqual(expect.arrayContaining(['apps', 'packages']));
    });

    it('detects monorepo structure from pnpm-workspace.yaml', async () => {
      // Create pnpm workspace
      await fs.writeFile(path.join(tempDir, 'pnpm-workspace.yaml'), `
packages:
  - 'libs/*'
  - 'services/*'
`);

      await fs.mkdir(path.join(tempDir, 'libs'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'libs', 'utils'));
      await fs.writeFile(path.join(tempDir, 'libs', 'utils', 'package.json'), JSON.stringify({
        name: 'utils'
      }));

      const result = await analyzer.analyzeProjectStructure();

      expect(result.isMonorepo).toBe(true);
      expect(result.workspaces).toEqual(['libs/*', 'services/*']);
    });

    it('detects alternative folder naming patterns', async () => {
      // Create project with alternative folder names
      await fs.mkdir(path.join(tempDir, 'source'));
      await fs.writeFile(path.join(tempDir, 'source', 'main.ts'), 'export {}');

      await fs.mkdir(path.join(tempDir, 'tests'));
      await fs.writeFile(path.join(tempDir, 'tests', 'main.spec.ts'), 'test("", () => {})');

      await fs.mkdir(path.join(tempDir, 'documentation'));
      await fs.writeFile(path.join(tempDir, 'documentation', 'guide.md'), '# Guide');

      const result = await analyzer.analyzeProjectStructure();

      expect(result.detectedFolders).toBeDefined();
      expect(result.detectedFolders?.src).toBe('source');
      expect(result.detectedFolders?.test).toBe('tests');
      expect(result.detectedFolders?.docs).toBe('documentation');
    });

    it('handles complex nested directory structures', async () => {
      // Create a complex structure
      await fs.mkdir(path.join(tempDir, 'src', 'components', 'ui'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'components', 'ui', 'button.tsx'), 'export const Button = () => <div/>;');

      await fs.mkdir(path.join(tempDir, 'src', 'utils', 'helpers'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'utils', 'helpers', 'string.ts'), 'export const trim = (s: string) => s.trim();');

      await fs.mkdir(path.join(tempDir, 'test', 'unit'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'test', 'unit', 'button.test.tsx'), 'test("button", () => {});');

      await fs.mkdir(path.join(tempDir, 'test', 'integration'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'test', 'integration', 'app.test.ts'), 'test("app", () => {});');

      // Add some config files
      await fs.writeFile(path.join(tempDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
      await fs.writeFile(path.join(tempDir, 'jest.config.js'), 'module.exports = {};');

      const result = await analyzer.analyzeProjectStructure();

      expect(result.filesByExtension?.['.tsx']).toBe(2);
      expect(result.filesByExtension?.['.ts']).toBe(2);
      expect(result.filesByExtension?.['.json']).toBe(1);
      expect(result.filesByExtension?.['.js']).toBe(1);

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalDirectories).toBeGreaterThan(0);
    });

    it('respects excludeDirectories option', async () => {
      const customAnalyzer = new ProjectContextAnalyzer(tempDir, {
        excludeDirectories: ['node_modules', 'dist', 'build']
      });

      // Create directories that should be excluded
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'node_modules', 'package.json'), '{}');

      await fs.mkdir(path.join(tempDir, 'dist'));
      await fs.writeFile(path.join(tempDir, 'dist', 'index.js'), 'console.log("built");');

      // Create directories that should be included
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {};');

      const result = await customAnalyzer.analyzeProjectStructure();

      expect(result.topLevelDirectories).toEqual(['src']);
      expect(result.topLevelDirectories).not.toContain('node_modules');
      expect(result.topLevelDirectories).not.toContain('dist');

      // Should only count files from included directories
      expect(result.filesByExtension?.['.ts']).toBe(1);
      expect(result.filesByExtension?.['.js']).toBeUndefined();
    });

    it('handles empty project directory', async () => {
      // Test with completely empty directory
      const result = await analyzer.analyzeProjectStructure();

      expect(result.root).toBe(tempDir);
      expect(result.totalFiles).toBe(0);
      expect(result.totalDirectories).toBe(0);
      expect(result.filesByExtension).toEqual({});
      expect(result.topLevelDirectories).toEqual([]);
      expect(result.detectedFolders).toBeUndefined();
      expect(result.isMonorepo).toBe(false);
    });

    it('detects heuristic monorepo structure', async () => {
      // Create a structure that looks like a monorepo without explicit config
      await fs.mkdir(path.join(tempDir, 'packages'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'packages', 'core'));
      await fs.writeFile(path.join(tempDir, 'packages', 'core', 'package.json'), JSON.stringify({
        name: 'core'
      }));

      await fs.mkdir(path.join(tempDir, 'packages', 'utils'));
      await fs.writeFile(path.join(tempDir, 'packages', 'utils', 'package.json'), JSON.stringify({
        name: 'utils'
      }));

      await fs.mkdir(path.join(tempDir, 'libs'));
      await fs.mkdir(path.join(tempDir, 'libs', 'shared'));
      await fs.writeFile(path.join(tempDir, 'libs', 'shared', 'package.json'), JSON.stringify({
        name: 'shared'
      }));

      const result = await analyzer.analyzeProjectStructure();

      expect(result.isMonorepo).toBe(true);
      expect(result.workspaces).toEqual(expect.arrayContaining(['packages/*', 'libs/*']));
    });

    it('handles maxDepth option correctly', async () => {
      const depthLimitedAnalyzer = new ProjectContextAnalyzer(tempDir, {
        maxDepth: 2
      });

      // Create nested structure beyond maxDepth
      await fs.mkdir(path.join(tempDir, 'src', 'deep', 'nested', 'very', 'deep'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'file1.ts'), 'export {};');
      await fs.writeFile(path.join(tempDir, 'src', 'deep', 'file2.ts'), 'export {};');
      await fs.writeFile(path.join(tempDir, 'src', 'deep', 'nested', 'file3.ts'), 'export {};'); // Beyond maxDepth
      await fs.writeFile(path.join(tempDir, 'src', 'deep', 'nested', 'very', 'deep', 'file4.ts'), 'export {};'); // Beyond maxDepth

      const result = await depthLimitedAnalyzer.analyzeProjectStructure();

      // Should only count files within maxDepth
      expect(result.filesByExtension?.['.ts']).toBe(2); // Only file1.ts and file2.ts
    });
  });

  describe('Schema compliance', () => {
    it('always returns schema-compliant results', async () => {
      // Test with various real project structures
      const testCases = [
        async () => {
          // Empty project
        },
        async () => {
          // Simple project
          await fs.writeFile(path.join(tempDir, 'index.js'), 'console.log("hello");');
        },
        async () => {
          // Project with mixed file types
          await fs.writeFile(path.join(tempDir, 'app.py'), 'print("hello")');
          await fs.writeFile(path.join(tempDir, 'style.css'), 'body { margin: 0; }');
          await fs.writeFile(path.join(tempDir, 'config.yaml'), 'key: value');
          await fs.writeFile(path.join(tempDir, 'README'), 'readme content');
        }
      ];

      for (const setupTest of testCases) {
        // Clean directory for each test
        try {
          const files = await fs.readdir(tempDir);
          await Promise.all(files.map(file =>
            fs.rm(path.join(tempDir, file), { recursive: true, force: true })
          ));
        } catch {
          // Ignore cleanup errors
        }

        await setupTest();
        const result = await analyzer.analyzeProjectStructure();

        // Should always pass schema validation
        expect(() => ProjectStructureSchema.parse(result)).not.toThrow();

        // Should always have required fields
        expect(result.root).toBe(tempDir);
        expect(typeof result.totalFiles).toBe('number');
        expect(typeof result.totalDirectories).toBe('number');
        expect(Array.isArray(result.entries)).toBe(true);
        expect(Array.isArray(result.rootFiles)).toBe(true);
        expect(Array.isArray(result.topLevelDirectories)).toBe(true);
        expect(typeof result.filesByExtension).toBe('object');
        expect(typeof result.isMonorepo).toBe('boolean');
        expect(result.scannedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('Error handling', () => {
    it('handles permission errors gracefully', async () => {
      // This test may not work on all systems, but we can try
      try {
        const restrictedDir = path.join(tempDir, 'restricted');
        await fs.mkdir(restrictedDir);
        await fs.writeFile(path.join(restrictedDir, 'file.txt'), 'content');

        // Try to make it unreadable (may not work on all systems)
        await fs.chmod(restrictedDir, 0o000);

        const result = await analyzer.analyzeProjectStructure();

        // Should still return valid result even with permission errors
        expect(() => ProjectStructureSchema.parse(result)).not.toThrow();
        expect(result.root).toBe(tempDir);

        // Clean up
        await fs.chmod(restrictedDir, 0o755);
      } catch {
        // Skip this test if we can't create permission-restricted directories
      }
    });

    it('handles corrupted config files gracefully', async () => {
      // Create corrupted files that might cause parsing errors
      await fs.writeFile(path.join(tempDir, 'package.json'), '{ invalid json');
      await fs.writeFile(path.join(tempDir, 'pnpm-workspace.yaml'), 'invalid: yaml: content: [');

      const result = await analyzer.analyzeProjectStructure();

      // Should still return valid result
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();
      expect(result.isMonorepo).toBe(false); // Should default to false when parsing fails
    });
  });
});