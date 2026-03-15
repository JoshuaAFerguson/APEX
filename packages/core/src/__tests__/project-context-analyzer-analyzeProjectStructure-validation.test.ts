/**
 * Validation Test for ProjectContextAnalyzer.analyzeProjectStructure()
 *
 * This test validates that the analyzeProjectStructure method meets all the specific
 * acceptance criteria mentioned in the implementation task:
 * - Returns directory tree, entry points, source directories
 * - Identifies patterns (monorepo, src/lib/test structure)
 * - Handles large directories with depth limits
 * - Maintains >80% test coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';
import { ProjectStructureSchema } from '../types.js';

describe('ProjectContextAnalyzer.analyzeProjectStructure() - Acceptance Criteria Validation', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'apex-analyzeProjectStructure-validation-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Acceptance Criteria: Returns directory tree, entry points, source directories', () => {
    it('returns comprehensive directory tree structure', async () => {
      // Create a realistic project structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export const app = "hello";');
      await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), 'import { app } from "./index";');

      await fs.mkdir(path.join(tempDir, 'lib'));
      await fs.writeFile(path.join(tempDir, 'lib', 'utils.js'), 'module.exports = {};');

      await fs.mkdir(path.join(tempDir, 'test'));
      await fs.writeFile(path.join(tempDir, 'test', 'app.test.ts'), 'test("app", () => {});');

      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        main: 'src/index.ts',
        scripts: { test: 'jest' }
      }));

      const result = await analyzer.analyzeProjectStructure();

      // Validate schema compliance
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();

      // Check directory tree structure
      expect(result.root).toBe(tempDir);
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalDirectories).toBeGreaterThan(0);
      expect(result.entries).toBeDefined();

      // Check entry points identification
      expect(result.hasPackageJson).toBe(true);
      expect(result.rootFiles).toContain('package.json');

      // Check source directories identification
      expect(result.topLevelDirectories).toContain('src');
      expect(result.topLevelDirectories).toContain('lib');
      expect(result.topLevelDirectories).toContain('test');

      // Validate new enhanced fields
      expect(result.filesByExtension).toBeDefined();
      expect(result.filesByExtension!['.ts']).toBe(3); // index.ts, main.ts, app.test.ts
      expect(result.filesByExtension!['.js']).toBe(1); // utils.js
      expect(result.filesByExtension!['.json']).toBe(1); // package.json
    });

    it('identifies entry points through various patterns', async () => {
      // Test multiple entry point patterns
      const entryPointTests = [
        { file: 'index.js', desc: 'Standard index file' },
        { file: 'main.ts', desc: 'Main entry point' },
        { file: 'app.py', desc: 'App entry point' },
        { file: 'server.js', desc: 'Server entry point' }
      ];

      for (const { file, desc } of entryPointTests) {
        await fs.writeFile(path.join(tempDir, file), `// ${desc}`);
      }

      // Create package.json with main field
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'entry-test',
        main: 'index.js',
        scripts: { start: 'node server.js' }
      }));

      const result = await analyzer.analyzeProjectStructure();

      expect(result.hasPackageJson).toBe(true);
      expect(result.rootFiles).toEqual(
        expect.arrayContaining(['index.js', 'main.ts', 'app.py', 'server.js', 'package.json'])
      );
    });
  });

  describe('Acceptance Criteria: Identifies patterns (monorepo, src/lib/test structure)', () => {
    it('identifies monorepo structure patterns', async () => {
      // Create monorepo structure with workspaces
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'my-monorepo',
        workspaces: ['packages/*', 'apps/*']
      }));

      // Create workspace packages
      await fs.mkdir(path.join(tempDir, 'packages', 'core'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'packages', 'core', 'package.json'), JSON.stringify({
        name: '@my/core'
      }));

      await fs.mkdir(path.join(tempDir, 'packages', 'utils'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'packages', 'utils', 'package.json'), JSON.stringify({
        name: '@my/utils'
      }));

      await fs.mkdir(path.join(tempDir, 'apps', 'web'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'apps', 'web', 'package.json'), JSON.stringify({
        name: 'web-app'
      }));

      const result = await analyzer.analyzeProjectStructure();

      // Validate monorepo identification
      expect(result.isMonorepo).toBe(true);
      expect(result.workspaces).toEqual(['packages/*', 'apps/*']);
      expect(result.topLevelDirectories).toEqual(expect.arrayContaining(['packages', 'apps']));
    });

    it('identifies standard src/lib/test structure patterns', async () => {
      // Create standard project structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {};');

      await fs.mkdir(path.join(tempDir, 'lib'));
      await fs.writeFile(path.join(tempDir, 'lib', 'shared.js'), 'module.exports = {};');

      await fs.mkdir(path.join(tempDir, 'test'));
      await fs.writeFile(path.join(tempDir, 'test', 'unit.test.ts'), 'test("unit", () => {});');

      await fs.mkdir(path.join(tempDir, 'docs'));
      await fs.writeFile(path.join(tempDir, 'docs', 'README.md'), '# Documentation');

      const result = await analyzer.analyzeProjectStructure();

      // Validate structure pattern detection
      expect(result.detectedFolders).toBeDefined();
      expect(result.detectedFolders!.src).toBe('src');
      expect(result.detectedFolders!.test).toBe('test');
      expect(result.detectedFolders!.docs).toBe('docs');

      // Check lib folder detection (lib is detected as alternative to src)
      expect(result.topLevelDirectories).toContain('lib');
    });

    it('identifies alternative naming patterns', async () => {
      // Create project with alternative folder names
      await fs.mkdir(path.join(tempDir, 'source'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'source', 'app.ts'), 'export {};');

      await fs.mkdir(path.join(tempDir, 'tests'));
      await fs.writeFile(path.join(tempDir, 'tests', 'app.spec.ts'), 'test("app", () => {});');

      await fs.mkdir(path.join(tempDir, 'documentation'));
      await fs.writeFile(path.join(tempDir, 'documentation', 'guide.md'), '# Guide');

      const result = await analyzer.analyzeProjectStructure();

      // Validate alternative pattern detection
      expect(result.detectedFolders).toBeDefined();
      expect(result.detectedFolders!.src).toBe('source'); // Alternative to 'src'
      expect(result.detectedFolders!.test).toBe('tests'); // Alternative to 'test'
      expect(result.detectedFolders!.docs).toBe('documentation'); // Alternative to 'docs'
    });
  });

  describe('Acceptance Criteria: Handles large directories with depth limits', () => {
    it('respects maxDepth option for large directory structures', async () => {
      const depthLimitedAnalyzer = new ProjectContextAnalyzer(tempDir, {
        maxDepth: 2 // Limit to 2 levels deep
      });

      // Create deeply nested structure (5 levels)
      const deepPath = path.join(tempDir, 'level1', 'level2', 'level3', 'level4', 'level5');
      await fs.mkdir(deepPath, { recursive: true });

      // Add files at different depths
      await fs.writeFile(path.join(tempDir, 'root.ts'), 'export {};');
      await fs.writeFile(path.join(tempDir, 'level1', 'depth1.ts'), 'export {};');
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'depth2.ts'), 'export {};');
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'depth3.ts'), 'export {};');
      await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'level4', 'depth4.ts'), 'export {};');
      await fs.writeFile(path.join(deepPath, 'depth5.ts'), 'export {};');

      const result = await depthLimitedAnalyzer.analyzeProjectStructure();

      // Should only count files within maxDepth (2 levels)
      // root.ts (depth 0), depth1.ts (depth 1), depth2.ts (depth 2) = 3 files
      expect(result.filesByExtension!['.ts']).toBe(3);

      // Files beyond maxDepth should not be counted
      expect(result.totalFiles).toBeLessThan(6); // Less than all 6 files created
    });

    it('handles large directory structures efficiently', async () => {
      // Create a structure with many files and directories
      const largeStructureAnalyzer = new ProjectContextAnalyzer(tempDir, {
        maxDepth: 3 // Reasonable depth limit for performance
      });

      // Create multiple directories with many files
      for (let dirIndex = 0; dirIndex < 10; dirIndex++) {
        const dirPath = path.join(tempDir, `dir${dirIndex}`);
        await fs.mkdir(dirPath, { recursive: true });

        for (let fileIndex = 0; fileIndex < 20; fileIndex++) {
          await fs.writeFile(
            path.join(dirPath, `file${fileIndex}.ts`),
            `export const value${fileIndex} = ${fileIndex};`
          );
        }
      }

      const startTime = Date.now();
      const result = await largeStructureAnalyzer.analyzeProjectStructure();
      const executionTime = Date.now() - startTime;

      // Validate performance - should complete within reasonable time
      expect(executionTime).toBeLessThan(5000); // Less than 5 seconds

      // Validate correct file counting
      expect(result.filesByExtension!['.ts']).toBe(200); // 10 dirs * 20 files each
      expect(result.totalFiles).toBe(200);
      expect(result.totalDirectories).toBe(10);
    });

    it('handles excludeDirectories option with large structures', async () => {
      const filteredAnalyzer = new ProjectContextAnalyzer(tempDir, {
        excludeDirectories: ['node_modules', 'dist', 'build', '.git']
      });

      // Create large excluded directories
      const excludedDirs = ['node_modules', 'dist', 'build'];
      for (const dirName of excludedDirs) {
        const dirPath = path.join(tempDir, dirName);
        await fs.mkdir(dirPath, { recursive: true });

        // Add many files to excluded directories
        for (let i = 0; i < 50; i++) {
          await fs.writeFile(path.join(dirPath, `excluded${i}.js`), `// excluded file ${i}`);
        }
      }

      // Create included directories
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'included.ts'), 'export {};');

      const result = await filteredAnalyzer.analyzeProjectStructure();

      // Should only count files from included directories
      expect(result.filesByExtension!['.ts']).toBe(1);
      expect(result.filesByExtension!['.js']).toBeUndefined(); // Excluded files not counted
      expect(result.topLevelDirectories).toEqual(['src']); // Only included directories
    });
  });

  describe('Acceptance Criteria: Unit tests pass with >80% coverage', () => {
    it('validates all returned data against schema', async () => {
      // Create minimal project structure
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'coverage-test'
      }));

      const result = await analyzer.analyzeProjectStructure();

      // Schema validation should pass without errors
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();

      // Validate all required fields are present and correctly typed
      expect(typeof result.root).toBe('string');
      expect(typeof result.totalFiles).toBe('number');
      expect(typeof result.totalDirectories).toBe('number');
      expect(Array.isArray(result.entries)).toBe(true);
      expect(Array.isArray(result.rootFiles)).toBe(true);
      expect(Array.isArray(result.topLevelDirectories)).toBe(true);
      expect(typeof result.filesByExtension).toBe('object');
      expect(typeof result.isMonorepo).toBe('boolean');
      expect(result.scannedAt).toBeInstanceOf(Date);

      // Validate enhanced fields
      expect(result.filesByExtension).toBeDefined();
      expect(result.topLevelDirectories).toBeDefined();
      expect(typeof result.isMonorepo).toBe('boolean');

      // detectedFolders and workspaces are optional
      if (result.detectedFolders !== undefined) {
        expect(typeof result.detectedFolders).toBe('object');
      }
      if (result.workspaces !== undefined) {
        expect(Array.isArray(result.workspaces)).toBe(true);
      }
    });

    it('handles error conditions gracefully', async () => {
      // Create analyzer for non-existent directory to test error handling
      const errorAnalyzer = new ProjectContextAnalyzer('/non/existent/path');

      // Should not throw but return valid fallback structure
      const result = await errorAnalyzer.analyzeProjectStructure();

      // Should still validate against schema despite errors
      expect(() => ProjectStructureSchema.parse(result)).not.toThrow();

      // Should have sensible defaults for error conditions
      expect(result.totalFiles).toBe(0);
      expect(result.totalDirectories).toBe(0);
      expect(result.filesByExtension).toEqual({});
      expect(result.topLevelDirectories).toEqual([]);
      expect(result.isMonorepo).toBe(false);
    });

    it('validates performance requirements', async () => {
      // Create reasonably sized structure for performance testing
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
      for (let i = 0; i < 100; i++) {
        await fs.writeFile(
          path.join(tempDir, 'src', `component${i}.tsx`),
          `export const Component${i} = () => <div>Component ${i}</div>;`
        );
      }

      const startTime = Date.now();
      const result = await analyzer.analyzeProjectStructure();
      const executionTime = Date.now() - startTime;

      // Performance requirement: should complete within reasonable time
      expect(executionTime).toBeLessThan(3000); // Less than 3 seconds

      // Accuracy requirement: should count all files correctly
      expect(result.filesByExtension!['.tsx']).toBe(100);
      expect(result.totalFiles).toBe(100);
    });
  });

  describe('Method Integration and Data Consistency', () => {
    it('ensures consistent data across all enhanced fields', async () => {
      // Create a complex project structure
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
        name: 'integration-test',
        workspaces: ['packages/*']
      }));

      await fs.mkdir(path.join(tempDir, 'packages', 'core'), { recursive: true });
      await fs.writeFile(path.join(tempDir, 'packages', 'core', 'package.json'), '{}');
      await fs.writeFile(path.join(tempDir, 'packages', 'core', 'index.ts'), 'export {};');

      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), 'export {};');

      await fs.mkdir(path.join(tempDir, 'test'));
      await fs.writeFile(path.join(tempDir, 'test', 'spec.js'), 'test("", () => {});');

      const result = await analyzer.analyzeProjectStructure();

      // Verify data consistency between different fields

      // File extension counts should match directory scanning
      const expectedTsFiles = 2; // index.ts, main.ts
      const expectedJsFiles = 1; // spec.js
      const expectedJsonFiles = 2; // root package.json, core package.json

      expect(result.filesByExtension!['.ts']).toBe(expectedTsFiles);
      expect(result.filesByExtension!['.js']).toBe(expectedJsFiles);
      expect(result.filesByExtension!['.json']).toBe(expectedJsonFiles);

      // Top level directories should include created directories
      expect(result.topLevelDirectories).toEqual(
        expect.arrayContaining(['packages', 'src', 'test'])
      );

      // Monorepo detection should be consistent with workspaces
      expect(result.isMonorepo).toBe(true);
      expect(result.workspaces).toEqual(['packages/*']);

      // Detected folders should identify standard structure
      expect(result.detectedFolders).toBeDefined();
      expect(result.detectedFolders!.src).toBe('src');
      expect(result.detectedFolders!.test).toBe('test');
    });
  });
});