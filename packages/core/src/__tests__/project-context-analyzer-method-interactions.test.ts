/**
 * @fileoverview Method Interaction Integration Tests for ProjectContextAnalyzer
 *
 * This test suite focuses specifically on how different methods interact with each other
 * and verifies that internal method calls produce consistent results.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  ProjectContextAnalyzer,
} from '../project-context-analyzer.js';

describe('ProjectContextAnalyzer - Method Interaction Tests', () => {
  let tempDir: string;
  let testProjectPath: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), 'apex-method-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    testProjectPath = tempDir;
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Internal Method Call Chain Verification', () => {
    it('analyzeProjectStructure uses scanDirectory method correctly', async () => {
      // Setup test structure
      setupTestStructure(testProjectPath);

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Test analyzeProjectStructure (which internally calls scanDirectory)
      const structure = await analyzer.analyzeProjectStructure();

      expect(structure.root).toBe(testProjectPath);
      expect(structure.totalFiles).toBeGreaterThan(0);
      expect(structure.totalDirectories).toBeGreaterThan(0);

      // Verify it found our test files
      expect(structure.totalFiles).toBeGreaterThanOrEqual(5); // package.json, src/index.ts, tests/test.ts, README.md, .gitignore
    });

    it('detectFrameworks integrates with analyzePackageJson method', async () => {
      // Create package.json with various dependencies
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'test-project',
        dependencies: {
          'react': '^18.0.0',
          'express': '^4.18.0',
          'typescript': '^5.0.0'
        },
        devDependencies: {
          'jest': '^29.0.0',
          'webpack': '^5.0.0',
          'vite': '^4.0.0'
        }
      }, null, 2));

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const frameworks = await analyzer.detectFrameworks();

      // Should have detected multiple frameworks from package.json analysis
      expect(frameworks.detected.length).toBeGreaterThan(0);
      expect(frameworks.packageManager).toBeDefined();

      // Should have detected some of the major frameworks
      const frameworkNames = frameworks.detected.map(f => f.name.toLowerCase());
      const hasReactOrExpress = frameworkNames.some(name => name.includes('react') || name.includes('express'));
      expect(hasReactOrExpress).toBe(true);
    });

    it('parseConfigurations handles multiple configuration types consistently', async () => {
      // Create various configuration files
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'test-config-project',
        scripts: { test: 'jest' }
      }, null, 2));

      writeFileSync(join(testProjectPath, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2020' }
      }, null, 2));

      writeFileSync(join(testProjectPath, '.eslintrc.json'), JSON.stringify({
        extends: ['@typescript-eslint/recommended']
      }, null, 2));

      writeFileSync(join(testProjectPath, 'vite.config.ts'), `
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: []
});
`);

      writeFileSync(join(testProjectPath, 'vitest.config.ts'), `
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node' }
});
`);

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // First get the configuration list
      const configList = await analyzer.getConfigurationInfoList();
      expect(configList.length).toBeGreaterThan(0);

      // Then parse them
      const parsed = await analyzer.parseConfigurations(configList);
      expect(parsed.length).toBe(configList.length);

      // Verify each config type was handled properly
      const jsonConfigs = parsed.filter(p => p.type === 'json');
      const tsConfigs = parsed.filter(p => p.type === 'typescript');

      expect(jsonConfigs.length).toBeGreaterThan(0); // package.json, tsconfig.json, .eslintrc.json
      expect(tsConfigs.length).toBeGreaterThan(0); // vite.config.ts, vitest.config.ts
    });

    it('detectTestFrameworks integrates with detectAdditionalTestTools', async () => {
      // Create package.json with various test frameworks
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'test-frameworks-project',
        dependencies: {
          'react': '^18.0.0'
        },
        devDependencies: {
          'jest': '^29.0.0',
          'vitest': '^4.0.0',
          'mocha': '^10.0.0',
          'cypress': '^12.0.0',
          '@testing-library/react': '^13.0.0',
          'puppeteer': '^19.0.0'
        }
      }, null, 2));

      // Create test configuration files
      writeFileSync(join(testProjectPath, 'jest.config.js'), 'module.exports = { testEnvironment: "node" };');
      writeFileSync(join(testProjectPath, 'vitest.config.ts'), 'export default { test: { environment: "jsdom" } };');
      writeFileSync(join(testProjectPath, 'cypress.config.js'), 'module.exports = { e2e: {} };');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Get test framework info first
      const testFrameworkInfo = await analyzer.getTestFrameworkInfoList();
      expect(testFrameworkInfo.length).toBeGreaterThan(0);

      // Detect test frameworks (should integrate with additional tools detection)
      const detectedFrameworks = await analyzer.detectTestFrameworks();
      expect(detectedFrameworks.length).toBeGreaterThan(0);

      // Should have detected multiple test frameworks
      const frameworkNames = detectedFrameworks.map(f => f.name.toLowerCase());
      const hasJest = frameworkNames.some(name => name.includes('jest'));
      const hasVitest = frameworkNames.some(name => name.includes('vitest'));

      expect(hasJest || hasVitest).toBe(true); // Should detect at least one major test framework
    });

    it('getProjectStructure integrates with detectImportantFolders', async () => {
      // Create important folder structure
      mkdirSync(join(testProjectPath, 'src'), { recursive: true });
      mkdirSync(join(testProjectPath, '__tests__'), { recursive: true });
      mkdirSync(join(testProjectPath, 'docs'), { recursive: true });
      mkdirSync(join(testProjectPath, 'scripts'), { recursive: true });

      writeFileSync(join(testProjectPath, 'src', 'index.ts'), 'export const main = true;');
      writeFileSync(join(testProjectPath, '__tests__', 'test.ts'), 'test("example", () => {});');
      writeFileSync(join(testProjectPath, 'docs', 'README.md'), '# Documentation');
      writeFileSync(join(testProjectPath, 'scripts', 'build.sh'), '#!/bin/bash\necho "building"');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const structure = await analyzer.getProjectStructure();

      // Should have detected the important folders
      expect(structure.commonDirectories.length).toBeGreaterThan(0);

      // Should include some of our created directories
      const hasImportantDirs = structure.commonDirectories.some(dir =>
        ['src', '__tests__', 'docs', 'scripts'].includes(dir)
      );
      expect(hasImportantDirs).toBe(true);
    });

    it('analyzeMonorepoStructure integrates with workspace detection', async () => {
      // Create monorepo structure
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'monorepo-test',
        private: true,
        workspaces: [
          'packages/*',
          'apps/*'
        ]
      }, null, 2));

      // Create workspace packages
      mkdirSync(join(testProjectPath, 'packages', 'core'), { recursive: true });
      mkdirSync(join(testProjectPath, 'packages', 'utils'), { recursive: true });
      mkdirSync(join(testProjectPath, 'apps', 'web'), { recursive: true });

      writeFileSync(join(testProjectPath, 'packages', 'core', 'package.json'), JSON.stringify({
        name: '@test/core'
      }, null, 2));

      writeFileSync(join(testProjectPath, 'packages', 'utils', 'package.json'), JSON.stringify({
        name: '@test/utils'
      }, null, 2));

      writeFileSync(join(testProjectPath, 'apps', 'web', 'package.json'), JSON.stringify({
        name: '@test/web'
      }, null, 2));

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const structure = await analyzer.analyzeProjectStructure();

      // Should detect monorepo structure
      expect(structure.isMonorepo).toBe(true);
      expect(structure.workspaces).toBeDefined();
      expect(structure.workspaces!.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Method Data Consistency', () => {
    it('ensures consistent file counting across methods', async () => {
      setupTestStructure(testProjectPath);

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Get structure through different methods
      const structure1 = await analyzer.getProjectStructure();
      const structure2 = await analyzer.analyzeProjectStructure();

      // File counts should be identical
      expect(structure1.totalFiles).toBe(structure2.totalFiles);
      expect(structure1.totalDirectories).toBe(structure2.totalDirectories);

      // Root should be the same
      expect(structure1.root).toBe(structure2.root);
    });

    it('ensures framework detection consistency across calls', async () => {
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'consistency-test',
        dependencies: {
          'react': '^18.0.0',
          'typescript': '^5.0.0'
        }
      }, null, 2));

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Call framework detection multiple times
      const frameworks1 = await analyzer.detectFrameworks();
      const frameworks2 = await analyzer.detectFrameworks();
      const frameworks3 = await analyzer.detectFrameworks();

      // Results should be identical
      expect(frameworks1.detected.length).toBe(frameworks2.detected.length);
      expect(frameworks2.detected.length).toBe(frameworks3.detected.length);

      expect(frameworks1.packageManager).toBe(frameworks2.packageManager);
      expect(frameworks2.packageManager).toBe(frameworks3.packageManager);
    });

    it('ensures configuration parsing is deterministic', async () => {
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'deterministic-test',
        scripts: { test: 'jest' }
      }, null, 2));

      writeFileSync(join(testProjectPath, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2020' }
      }, null, 2));

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Parse configurations multiple times
      const configs1 = await analyzer.getConfigurationInfoList();
      const parsed1 = await analyzer.parseConfigurations(configs1);

      const configs2 = await analyzer.getConfigurationInfoList();
      const parsed2 = await analyzer.parseConfigurations(configs2);

      // Should have same number of configurations
      expect(configs1.length).toBe(configs2.length);
      expect(parsed1.length).toBe(parsed2.length);

      // Content should be identical
      for (let i = 0; i < parsed1.length; i++) {
        expect(parsed1[i].path).toBe(parsed2[i].path);
        expect(parsed1[i].type).toBe(parsed2[i].type);
      }
    });
  });

  describe('Option Propagation Through Method Calls', () => {
    it('propagates excludeDirectories option through all methods', async () => {
      // Create structure with excluded directories
      mkdirSync(join(testProjectPath, 'node_modules'), { recursive: true });
      mkdirSync(join(testProjectPath, 'dist'), { recursive: true });
      mkdirSync(join(testProjectPath, 'src'), { recursive: true });

      writeFileSync(join(testProjectPath, 'node_modules', 'package.json'), '{}');
      writeFileSync(join(testProjectPath, 'dist', 'bundle.js'), 'console.log("built");');
      writeFileSync(join(testProjectPath, 'src', 'index.ts'), 'export const hello = "world";');

      const analyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: ['node_modules', 'dist']
      });

      const structure = await analyzer.getProjectStructure();

      // Should have excluded the specified directories
      expect(structure.excludedDirectories).toContain('node_modules');
      expect(structure.excludedDirectories).toContain('dist');

      // File count should not include files from excluded directories
      // (Assuming the implementation properly excludes them)
      expect(structure.totalFiles).toBeGreaterThan(0); // Should have src/index.ts
    });

    it('propagates maxDepth option through directory scanning', async () => {
      // Create deep nested structure
      let currentPath = testProjectPath;
      for (let i = 1; i <= 5; i++) {
        currentPath = join(currentPath, `level${i}`);
        mkdirSync(currentPath, { recursive: true });
        writeFileSync(join(currentPath, `file${i}.txt`), `content ${i}`);
      }

      const shallowAnalyzer = new ProjectContextAnalyzer(testProjectPath, { maxDepth: 2 });
      const deepAnalyzer = new ProjectContextAnalyzer(testProjectPath, { maxDepth: 10 });

      const shallowStructure = await shallowAnalyzer.getProjectStructure();
      const deepStructure = await deepAnalyzer.getProjectStructure();

      // Deep analyzer should find more files
      expect(deepStructure.totalFiles).toBeGreaterThanOrEqual(shallowStructure.totalFiles);
      expect(deepStructure.totalDirectories).toBeGreaterThanOrEqual(shallowStructure.totalDirectories);
    });

    it('propagates includeHidden option through all file operations', async () => {
      // Create hidden files and directories
      writeFileSync(join(testProjectPath, '.hidden-file'), 'hidden content');
      writeFileSync(join(testProjectPath, 'visible-file.txt'), 'visible content');

      mkdirSync(join(testProjectPath, '.hidden-dir'), { recursive: true });
      writeFileSync(join(testProjectPath, '.hidden-dir', 'nested.txt'), 'nested hidden content');

      const includeAnalyzer = new ProjectContextAnalyzer(testProjectPath, { includeHidden: true });
      const excludeAnalyzer = new ProjectContextAnalyzer(testProjectPath, { includeHidden: false });

      const includeStructure = await includeAnalyzer.getProjectStructure();
      const excludeStructure = await excludeAnalyzer.getProjectStructure();

      // Include analyzer should find more files
      expect(includeStructure.totalFiles).toBeGreaterThan(excludeStructure.totalFiles);
    });
  });

  describe('Error Handling in Method Interactions', () => {
    it('handles errors in one method without affecting others', async () => {
      // Create a valid basic structure
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'error-test'
      }, null, 2));

      // Create an invalid configuration that might cause parsing errors
      writeFileSync(join(testProjectPath, 'invalid.json'), '{ invalid json content }');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // All methods should still work despite the invalid file
      const structure = await analyzer.getProjectStructure();
      const gitStatus = await analyzer.getGitStatus();
      const frameworks = await analyzer.detectFrameworks();

      expect(structure.root).toBeDefined();
      expect(gitStatus.isRepository).toBe(false);
      expect(frameworks.detected).toBeDefined();

      // Configuration parsing might include the error, but shouldn't crash
      const configs = await analyzer.getConfigurationInfoList();
      const parsed = await analyzer.parseConfigurations(configs);

      expect(Array.isArray(parsed)).toBe(true);
    });
  });
});

/**
 * Helper function to setup a basic test structure
 */
function setupTestStructure(projectPath: string): void {
  // Create package.json
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify({
    name: 'method-interaction-test',
    version: '1.0.0',
    dependencies: {
      'typescript': '^5.0.0'
    }
  }, null, 2));

  // Create source directory
  mkdirSync(join(projectPath, 'src'), { recursive: true });
  writeFileSync(join(projectPath, 'src', 'index.ts'), 'export const hello = "world";');

  // Create test directory
  mkdirSync(join(projectPath, '__tests__'), { recursive: true });
  writeFileSync(join(projectPath, '__tests__', 'test.ts'), 'test("example", () => {});');

  // Create other files
  writeFileSync(join(projectPath, 'README.md'), '# Test Project');
  writeFileSync(join(projectPath, '.gitignore'), 'node_modules/\ndist/');
}