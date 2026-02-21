/**
 * @fileoverview Integration tests for ProjectContextAnalyzer
 *
 * These tests verify that the ProjectContextAnalyzer works with real file system operations
 * and provides proper integration with the rest of the system.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectContextAnalyzer, analyzeProject } from '../project-context-analyzer';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
} from '../types';

describe('ProjectContextAnalyzer Integration Tests', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(__dirname, '..', '..', '.test-temp-' + Date.now());
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Create a simple project structure
    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          react: '^18.0.0'
        },
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.0.0'
        },
        scripts: {
          test: 'jest',
          build: 'tsc'
        }
      }, null, 2)
    );

    await fs.promises.writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true
        }
      }, null, 2)
    );

    await fs.promises.writeFile(
      path.join(tempDir, 'README.md'),
      '# Test Project\n\nThis is a test project.'
    );

    await fs.promises.writeFile(
      path.join(tempDir, '.gitignore'),
      'node_modules/\n*.log\n'
    );

    // Create src directory with some files
    const srcDir = path.join(tempDir, 'src');
    await fs.promises.mkdir(srcDir);

    await fs.promises.writeFile(
      path.join(srcDir, 'index.ts'),
      'export * from "./components";\n'
    );

    await fs.promises.writeFile(
      path.join(srcDir, 'App.tsx'),
      'import React from "react";\nexport default function App() { return <div>Hello</div>; }\n'
    );

    // Create test directory
    const testDir = path.join(tempDir, '__tests__');
    await fs.promises.mkdir(testDir);

    await fs.promises.writeFile(
      path.join(testDir, 'App.test.tsx'),
      'import { render } from "@testing-library/react";\nimport App from "../src/App";\n'
    );
  });

  afterAll(async () => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should analyze real project structure', async () => {
    const analyzer = new ProjectContextAnalyzer(tempDir);
    const structure = await analyzer.getProjectStructure();

    expect(ProjectStructureSchema.parse(structure)).toEqual(structure);
    expect(structure.root).toBe(tempDir);
    expect(structure.hasPackageJson).toBe(true);
    expect(structure.hasReadme).toBe(true);
    expect(structure.hasGitIgnore).toBe(true);
    expect(structure.totalFiles).toBeGreaterThan(0);
    expect(structure.totalDirectories).toBeGreaterThan(0);
    expect(structure.rootFiles).toContain('package.json');
    expect(structure.rootFiles).toContain('README.md');
    expect(structure.rootFiles).toContain('.gitignore');
    expect(structure.rootFiles).toContain('tsconfig.json');
    expect(structure.commonDirectories).toContain('src');
  });

  it('should detect frameworks from real package.json', async () => {
    const analyzer = new ProjectContextAnalyzer(tempDir);
    const frameworks = await analyzer.detectFrameworks();

    expect(FrameworkDetectionSchema.parse(frameworks)).toEqual(frameworks);
    expect(frameworks.frameworks.length).toBeGreaterThan(0);

    const frameworkNames = frameworks.frameworks.map(f => f.name);
    expect(frameworkNames).toContain('React');
    expect(frameworkNames).toContain('TypeScript');

    const react = frameworks.frameworks.find(f => f.name === 'React');
    expect(react?.category).toBe('frontend');
    expect(react?.confidence).toBe('high');
    expect(react?.version).toBe('^18.0.0');
  });

  it('should detect configuration files from real project', async () => {
    const analyzer = new ProjectContextAnalyzer(tempDir);
    const configs = await analyzer.getConfigurationInfoList();

    // Validate all configs with schema
    for (const config of configs) {
      expect(ConfigurationInfoSchema.parse(config)).toEqual(config);
    }

    expect(configs.length).toBeGreaterThan(0);

    const configNames = configs.map(c => c.name);
    expect(configNames).toContain('package.json');
    expect(configNames).toContain('tsconfig.json');

    const packageConfig = configs.find(c => c.name === 'package.json');
    expect(packageConfig?.format).toBe('json');
    expect(packageConfig?.purpose).toBe('package-manager');
    expect(packageConfig?.isValid).toBe(true);
    expect(packageConfig?.keySettings?.name).toBe('test-project');

    const tsConfig = configs.find(c => c.name === 'tsconfig.json');
    expect(tsConfig?.format).toBe('json');
    expect(tsConfig?.purpose).toBe('typescript');
    expect(tsConfig?.isValid).toBe(true);
  });

  it('should detect test frameworks from real project', async () => {
    const analyzer = new ProjectContextAnalyzer(tempDir);
    const testFrameworks = await analyzer.getTestFrameworkInfoList();

    // Validate all test frameworks with schema
    for (const framework of testFrameworks) {
      expect(TestFrameworkInfoSchema.parse(framework)).toEqual(framework);
    }

    expect(testFrameworks.length).toBeGreaterThan(0);

    const jest = testFrameworks.find(t => t.name === 'Jest');
    expect(jest).toBeDefined();
    expect(jest?.type).toBe('unit');
    expect(jest?.version).toBe('^29.0.0');
    expect(jest?.testFileCount).toBeGreaterThan(0);
  });

  it('should perform complete analysis on real project', async () => {
    const analyzer = new ProjectContextAnalyzer(tempDir);
    const context = await analyzer.analyze();

    // Validate complete context
    expect(context.structure).toBeDefined();
    expect(context.frameworks).toBeDefined();
    expect(context.configurations).toBeDefined();
    expect(context.testFrameworks).toBeDefined();
    expect(context.detectedAt).toBeInstanceOf(Date);
    expect(context.errors).toEqual([]);

    // Git status might be undefined if not in git repo
    if (context.gitStatus) {
      expect(GitStatusSchema.parse(context.gitStatus)).toEqual(context.gitStatus);
    }

    expect(context.structure.hasPackageJson).toBe(true);
    expect(context.frameworks.length).toBeGreaterThan(0);
    expect(context.configurations.length).toBeGreaterThan(0);
    expect(context.testFrameworks.length).toBeGreaterThan(0);
  });

  it('should work with convenience function', async () => {
    const context = await analyzeProject(tempDir);

    expect(context).toBeDefined();
    expect(context.structure.root).toBe(tempDir);
    expect(context.structure.hasPackageJson).toBe(true);
    expect(context.detectedAt).toBeInstanceOf(Date);
  });

  it('should handle custom options', async () => {
    const context = await analyzeProject(tempDir, {
      analyzeGit: false,
      maxDepth: 2,
      includeHidden: false,
    });

    expect(context.gitStatus).toBeUndefined();
    expect(context.structure.maxDepthScanned).toBeLessThanOrEqual(2);
  });

  it('should be consistent across multiple calls', async () => {
    const analyzer = new ProjectContextAnalyzer(tempDir);

    const [context1, context2] = await Promise.all([
      analyzer.analyze(),
      analyzer.analyze()
    ]);

    // Non-timestamp fields should be identical
    expect(context1.structure.root).toBe(context2.structure.root);
    expect(context1.structure.hasPackageJson).toBe(context2.structure.hasPackageJson);
    expect(context1.frameworks.length).toBe(context2.frameworks.length);
    expect(context1.configurations.length).toBe(context2.configurations.length);
    expect(context1.testFrameworks.length).toBe(context2.testFrameworks.length);
  });

  it('should handle project with no frameworks gracefully', async () => {
    // Create minimal project
    const minimalDir = path.join(tempDir, 'minimal');
    await fs.promises.mkdir(minimalDir);

    await fs.promises.writeFile(
      path.join(minimalDir, 'README.md'),
      '# Minimal Project'
    );

    const analyzer = new ProjectContextAnalyzer(minimalDir);
    const context = await analyzer.analyze();

    expect(context.structure.root).toBe(minimalDir);
    expect(context.structure.hasPackageJson).toBe(false);
    expect(context.frameworks).toEqual([]);
    expect(context.configurations.length).toBeGreaterThan(0); // Should find README
    expect(context.testFrameworks).toEqual([]);
  });

  it('should respect exclude directories', async () => {
    // Create node_modules directory
    const nodeModulesDir = path.join(tempDir, 'node_modules');
    await fs.promises.mkdir(nodeModulesDir);
    await fs.promises.writeFile(
      path.join(nodeModulesDir, 'some-package.js'),
      'module.exports = {};'
    );

    const analyzer = new ProjectContextAnalyzer(tempDir, {
      excludeDirectories: ['node_modules']
    });

    const structure = await analyzer.getProjectStructure();

    const nodeModulesEntry = structure.entries.find(e => e.name === 'node_modules');
    expect(nodeModulesEntry).toBeUndefined();
    expect(structure.excludedDirectories).toContain('node_modules');
  });
});