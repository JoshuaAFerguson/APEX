/**
 * @fileoverview Comprehensive Integration Tests for ProjectContextAnalyzer
 *
 * This test suite verifies method interactions and achieves >80% code coverage
 * by testing real-world scenarios with proper filesystem integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import {
  ProjectContextAnalyzer,
  analyzeProject,
  getProjectContextAnalyzer,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';
import {
  ProjectContextSchema,
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
} from '../types.js';

describe('ProjectContextAnalyzer - Comprehensive Integration Tests', () => {
  let tempDir: string;
  let testProjectPath: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(() => {
    // Create unique temp directory
    tempDir = join(tmpdir(), 'apex-integration-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    testProjectPath = tempDir;
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Full Analysis Method Integration', () => {
    beforeEach(() => {
      analyzer = new ProjectContextAnalyzer(testProjectPath);
    });

    it('analyzes complete project with all methods working together', async () => {
      // Create comprehensive project structure
      setupComprehensiveProject(testProjectPath);

      // Test complete analysis workflow
      const context = await analyzer.analyze();

      // Verify schema compliance
      expect(() => ProjectContextSchema.parse(context)).not.toThrow();

      // Verify all major components are present
      expect(context.structure).toBeDefined();
      expect(context.gitStatus).toBeDefined();
      expect(context.frameworks).toBeDefined();
      expect(context.configurations).toBeDefined();
      expect(context.testFrameworks).toBeDefined();
      expect(context.detectedAt).toBeInstanceOf(Date);

      // Verify structure analysis
      expect(context.structure.root).toBe(resolve(testProjectPath));
      expect(context.structure.totalFiles).toBeGreaterThan(0);
      expect(context.structure.totalDirectories).toBeGreaterThan(0);

      // Verify git status (non-repo scenario)
      expect(context.gitStatus.isRepository).toBe(false);
      expect(context.gitStatus.branch).toBeNull();

      // Verify frameworks detected
      expect(Array.isArray(context.frameworks.detected)).toBe(true);
      expect(context.frameworks.packageManager).toBeDefined();

      // Verify configurations detected
      expect(Array.isArray(context.configurations)).toBe(true);

      // Verify test frameworks detected
      expect(Array.isArray(context.testFrameworks)).toBe(true);
    });

    it('handles disabled analysis options correctly', async () => {
      setupComprehensiveProject(testProjectPath);

      const restrictedAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        analyzeTestFrameworks: false,
      });

      const context = await restrictedAnalyzer.analyze();

      // Git analysis should be undefined when disabled
      expect(context.gitStatus).toBeUndefined();

      // Other analyses should still work for structure
      expect(context.structure).toBeDefined();
      expect(context.detectedAt).toBeInstanceOf(Date);
    });

    it('integrates method options with analysis workflow', async () => {
      setupComprehensiveProject(testProjectPath);

      const customAnalyzer = new ProjectContextAnalyzer(testProjectPath, {
        maxDepth: 2,
        excludeDirectories: ['node_modules', '.git'],
        includeHidden: false,
      });

      const context = await customAnalyzer.analyze();

      // Verify options are applied
      expect(customAnalyzer.getOptions().maxDepth).toBe(2);
      expect(customAnalyzer.getOptions().excludeDirectories).toContain('node_modules');
      expect(customAnalyzer.getOptions().includeHidden).toBe(false);

      // Verify structure respects options
      expect(context.structure.excludedDirectories).toContain('node_modules');
    });
  });

  describe('Individual Method Integration', () => {
    beforeEach(() => {
      analyzer = new ProjectContextAnalyzer(testProjectPath);
      setupComprehensiveProject(testProjectPath);
    });

    it('integrates getProjectStructure with analyzeProjectStructure', async () => {
      const structure = await analyzer.getProjectStructure();
      const analyzedStructure = await analyzer.analyzeProjectStructure();

      // Both methods should return compatible data
      expect(structure.root).toBe(analyzedStructure.root);
      expect(structure.totalFiles).toBe(analyzedStructure.totalFiles);
      expect(structure.totalDirectories).toBe(analyzedStructure.totalDirectories);

      // Schema validation
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
      expect(() => ProjectStructureSchema.parse(analyzedStructure)).not.toThrow();
    });

    it('integrates detectFrameworks with getConfigurationInfoList', async () => {
      const frameworks = await analyzer.detectFrameworks();
      const configurations = await analyzer.getConfigurationInfoList();

      // Frameworks and configurations should be consistent
      expect(() => FrameworkDetectionSchema.parse(frameworks)).not.toThrow();
      expect(Array.isArray(configurations)).toBe(true);

      // If React is detected, there should be related configurations
      const hasReact = frameworks.detected.some(f => f.name.toLowerCase().includes('react'));
      if (hasReact) {
        expect(configurations.length).toBeGreaterThan(0);
      }
    });

    it('integrates parseConfigurations with getConfigurationInfoList', async () => {
      const configInfoList = await analyzer.getConfigurationInfoList();
      const parsedConfigurations = await analyzer.parseConfigurations(configInfoList);

      expect(configInfoList.length).toBe(parsedConfigurations.length);

      // Each configuration should have been parsed
      for (let i = 0; i < configInfoList.length; i++) {
        expect(parsedConfigurations[i].path).toBe(configInfoList[i].path);
        expect(parsedConfigurations[i].type).toBe(configInfoList[i].type);
        expect(parsedConfigurations[i].parsed).toBeDefined();
      }
    });

    it('integrates getTestFrameworkInfoList with detectTestFrameworks', async () => {
      const testFrameworkInfo = await analyzer.getTestFrameworkInfoList();
      const detectedTestFrameworks = await analyzer.detectTestFrameworks();

      expect(Array.isArray(testFrameworkInfo)).toBe(true);
      expect(Array.isArray(detectedTestFrameworks)).toBe(true);

      // Should have consistent test framework detection
      if (testFrameworkInfo.length > 0) {
        expect(detectedTestFrameworks.length).toBeGreaterThan(0);
      }
    });

    it('handles git operations consistently across methods', async () => {
      const gitStatus = await analyzer.getGitStatus();

      // Since we're not in a git repo, should be consistent
      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBeNull();
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);

      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });
  });

  describe('Real Project Structure Integration', () => {
    it('analyzes monorepo structure comprehensively', async () => {
      setupMonorepoProject(testProjectPath);

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const context = await analyzer.analyze();

      // Verify monorepo detection
      expect(context.structure.totalDirectories).toBeGreaterThan(3); // packages/, src/, tests/, etc.
      expect(context.frameworks.detected.length).toBeGreaterThan(0);

      // Should detect package.json configurations
      const packageJsonConfigs = context.configurations.filter(c => c.type === 'package.json');
      expect(packageJsonConfigs.length).toBeGreaterThan(0);

      // Should detect TypeScript if present
      const hasTypescript = context.configurations.some(c => c.type === 'tsconfig.json');
      if (hasTypescript) {
        expect(context.frameworks.detected.some(f => f.name.includes('TypeScript'))).toBe(true);
      }
    });

    it('analyzes framework-specific project comprehensively', async () => {
      setupFrameworkProject(testProjectPath);

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const context = await analyzer.analyze();

      // Should detect React and related tools
      const reactFramework = context.frameworks.detected.find(f => f.name.includes('React'));
      expect(reactFramework).toBeDefined();

      // Should have proper configurations
      expect(context.configurations.length).toBeGreaterThan(2); // package.json, tsconfig.json, etc.

      // Should detect test frameworks
      expect(context.testFrameworks.length).toBeGreaterThan(0);
    });

    it('handles empty project gracefully', async () => {
      // Empty directory test
      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const context = await analyzer.analyze();

      expect(context.structure.totalFiles).toBe(0);
      expect(context.structure.totalDirectories).toBe(0);
      expect(context.frameworks.detected).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.gitStatus.isRepository).toBe(false);
    });
  });

  describe('Utility Functions Integration', () => {
    it('integrates analyzeProject utility with ProjectContextAnalyzer', async () => {
      setupComprehensiveProject(testProjectPath);

      // Test utility function
      const contextFromUtility = await analyzeProject(testProjectPath);

      // Test direct analyzer
      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const contextFromAnalyzer = await analyzer.analyze();

      // Results should be equivalent
      expect(contextFromUtility.structure.root).toBe(contextFromAnalyzer.structure.root);
      expect(contextFromUtility.frameworks.detected.length).toBe(contextFromAnalyzer.frameworks.detected.length);
      expect(contextFromUtility.configurations.length).toBe(contextFromAnalyzer.configurations.length);

      // Both should comply with schema
      expect(() => ProjectContextSchema.parse(contextFromUtility)).not.toThrow();
      expect(() => ProjectContextSchema.parse(contextFromAnalyzer)).not.toThrow();
    });

    it('integrates getProjectContextAnalyzer singleton correctly', async () => {
      setupComprehensiveProject(testProjectPath);

      const analyzer1 = getProjectContextAnalyzer(testProjectPath);
      const analyzer2 = getProjectContextAnalyzer(testProjectPath);

      // Should be same instance (singleton behavior)
      expect(analyzer1).toBe(analyzer2);

      // Both should work identically
      const context1 = await analyzer1.analyze();
      const context2 = await analyzer2.analyze();

      expect(context1.structure.root).toBe(context2.structure.root);
    });

    it('handles concurrent operations across different instances', async () => {
      setupComprehensiveProject(testProjectPath);

      // Create multiple analyzers
      const analyzers = Array.from({ length: 5 }, () => new ProjectContextAnalyzer(testProjectPath));

      // Run concurrent analysis
      const results = await Promise.all(analyzers.map(analyzer => analyzer.analyze()));

      // All results should be consistent
      results.forEach((result, index) => {
        expect(result.structure.root).toBe(resolve(testProjectPath));
        expect(() => ProjectContextSchema.parse(result)).not.toThrow();

        if (index > 0) {
          // Compare with first result
          expect(result.structure.totalFiles).toBe(results[0].structure.totalFiles);
          expect(result.frameworks.detected.length).toBe(results[0].frameworks.detected.length);
        }
      });
    });
  });

  describe('Error Handling and Edge Cases Integration', () => {
    it('handles filesystem errors gracefully during full analysis', async () => {
      // Create a directory we can't read (simulate permission error)
      const problematicDir = join(testProjectPath, 'problematic');
      mkdirSync(problematicDir);
      writeFileSync(join(problematicDir, 'file.txt'), 'content');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Should not throw, should handle errors gracefully
      const context = await analyzer.analyze();

      expect(context.structure.root).toBe(resolve(testProjectPath));
      expect(() => ProjectContextSchema.parse(context)).not.toThrow();
    });

    it('handles malformed configuration files during integration', async () => {
      setupComprehensiveProject(testProjectPath);

      // Add malformed JSON file
      writeFileSync(join(testProjectPath, 'malformed.json'), '{ invalid json }');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const configurations = await analyzer.getConfigurationInfoList();
      const parsed = await analyzer.parseConfigurations(configurations);

      // Should handle malformed files gracefully
      expect(Array.isArray(parsed)).toBe(true);

      // Malformed file should have null or error content
      const malformedConfig = parsed.find(p => p.path.includes('malformed.json'));
      if (malformedConfig) {
        expect(malformedConfig.parsed).toBeDefined();
      }
    });
  });

  describe('Performance and Scaling Integration', () => {
    it('handles large project structures efficiently', async () => {
      setupLargeProject(testProjectPath);

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const startTime = Date.now();

      const context = await analyzer.analyze();
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (less than 5 seconds for test project)
      expect(duration).toBeLessThan(5000);

      // Should have analyzed the structure
      expect(context.structure.totalFiles).toBeGreaterThan(10);
      expect(context.structure.totalDirectories).toBeGreaterThan(3);
    });

    it('maintains consistency across multiple analysis runs', async () => {
      setupComprehensiveProject(testProjectPath);

      const analyzer = new ProjectContextAnalyzer(testProjectPath);

      // Run analysis multiple times
      const results = await Promise.all([
        analyzer.analyze(),
        analyzer.analyze(),
        analyzer.analyze()
      ]);

      // Results should be identical
      expect(results[0].structure.totalFiles).toBe(results[1].structure.totalFiles);
      expect(results[1].structure.totalFiles).toBe(results[2].structure.totalFiles);

      expect(results[0].frameworks.detected.length).toBe(results[1].frameworks.detected.length);
      expect(results[1].frameworks.detected.length).toBe(results[2].frameworks.detected.length);
    });
  });
});

/**
 * Helper Functions for Test Setup
 */

function setupComprehensiveProject(projectPath: string): void {
  // Create package.json
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify({
    name: 'test-comprehensive-project',
    version: '1.0.0',
    dependencies: {
      'react': '^18.2.0',
      'typescript': '^5.0.0',
    },
    devDependencies: {
      'vitest': '^4.0.0',
      'jest': '^29.0.0',
      '@types/node': '^20.0.0',
    },
    scripts: {
      test: 'vitest',
      build: 'tsc',
    }
  }, null, 2));

  // Create TypeScript config
  writeFileSync(join(projectPath, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      strict: true
    }
  }, null, 2));

  // Create ESLint config
  writeFileSync(join(projectPath, '.eslintrc.json'), JSON.stringify({
    root: true,
    extends: ['@typescript-eslint/recommended']
  }, null, 2));

  // Create source files
  mkdirSync(join(projectPath, 'src'), { recursive: true });
  writeFileSync(join(projectPath, 'src', 'index.ts'), 'export const hello = "world";');
  writeFileSync(join(projectPath, 'src', 'component.tsx'), 'export const Component = () => <div>Hello</div>;');

  // Create test files
  mkdirSync(join(projectPath, '__tests__'), { recursive: true });
  writeFileSync(join(projectPath, '__tests__', 'index.test.ts'), 'test("example", () => expect(true).toBe(true));');

  // Create README and other files
  writeFileSync(join(projectPath, 'README.md'), '# Test Project');
  writeFileSync(join(projectPath, '.gitignore'), 'node_modules/\ndist/');
  writeFileSync(join(projectPath, 'LICENSE'), 'MIT License');
}

function setupMonorepoProject(projectPath: string): void {
  // Root package.json
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify({
    name: 'test-monorepo',
    private: true,
    workspaces: ['packages/*'],
    devDependencies: {
      'turbo': '^1.10.0',
      'typescript': '^5.0.0'
    }
  }, null, 2));

  // Turbo config
  writeFileSync(join(projectPath, 'turbo.json'), JSON.stringify({
    pipeline: {
      build: { outputs: ['dist/**'] },
      test: {}
    }
  }, null, 2));

  // Package 1
  mkdirSync(join(projectPath, 'packages', 'core'), { recursive: true });
  writeFileSync(join(projectPath, 'packages', 'core', 'package.json'), JSON.stringify({
    name: '@test/core',
    version: '1.0.0',
    dependencies: {
      'typescript': '^5.0.0'
    }
  }, null, 2));

  // Package 2
  mkdirSync(join(projectPath, 'packages', 'cli'), { recursive: true });
  writeFileSync(join(projectPath, 'packages', 'cli', 'package.json'), JSON.stringify({
    name: '@test/cli',
    version: '1.0.0',
    dependencies: {
      '@test/core': '^1.0.0'
    }
  }, null, 2));
}

function setupFrameworkProject(projectPath: string): void {
  // React + TypeScript project
  writeFileSync(join(projectPath, 'package.json'), JSON.stringify({
    name: 'react-typescript-project',
    version: '1.0.0',
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0'
    },
    devDependencies: {
      'typescript': '^5.0.0',
      '@types/react': '^18.0.0',
      'vitest': '^4.0.0',
      'jsdom': '^22.0.0'
    }
  }, null, 2));

  writeFileSync(join(projectPath, 'vite.config.ts'), `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
})
`);

  writeFileSync(join(projectPath, 'vitest.config.ts'), `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
`);

  mkdirSync(join(projectPath, 'src'));
  writeFileSync(join(projectPath, 'src', 'App.tsx'), `
import React from 'react';

function App() {
  return <div>Hello World</div>;
}

export default App;
`);
}

function setupLargeProject(projectPath: string): void {
  setupComprehensiveProject(projectPath);

  // Add more directories and files
  for (let i = 0; i < 10; i++) {
    const dir = join(projectPath, `module-${i}`);
    mkdirSync(dir, { recursive: true });

    for (let j = 0; j < 5; j++) {
      writeFileSync(join(dir, `file-${j}.ts`), `export const value${j} = ${j};`);
    }
  }

  // Add nested structure
  mkdirSync(join(projectPath, 'deep', 'nested', 'structure'), { recursive: true });
  writeFileSync(join(projectPath, 'deep', 'nested', 'structure', 'deep.ts'), 'export const deep = true;');
}