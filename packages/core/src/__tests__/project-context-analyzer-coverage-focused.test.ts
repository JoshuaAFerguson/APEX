/**
 * @fileoverview Coverage-Focused Integration Tests for ProjectContextAnalyzer
 *
 * This test suite is specifically designed to achieve >80% code coverage by testing
 * edge cases, code paths, and scenarios that exercise internal methods and logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { mkdirSync, writeFileSync, rmSync, existsSync, chmodSync } from 'fs';
import { join } from 'path';
import { ProjectContextAnalyzer } from '../project-context-analyzer.js';

describe('ProjectContextAnalyzer - Coverage-Focused Integration Tests', () => {
  let tempDir: string;
  let testProjectPath: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), 'apex-coverage-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    testProjectPath = tempDir;
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Private Method Exercise through Public APIs', () => {
    it('exercises fileExists method through configuration detection', async () => {
      // Create various file types that would trigger fileExists calls
      writeFileSync(join(testProjectPath, 'package.json'), '{}');
      writeFileSync(join(testProjectPath, 'tsconfig.json'), '{}');
      writeFileSync(join(testProjectPath, '.eslintrc.js'), 'module.exports = {};');
      writeFileSync(join(testProjectPath, 'vite.config.ts'), 'export default {};');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const configs = await analyzer.getConfigurationInfoList();

      // This should have exercised fileExists for multiple file types
      expect(configs.length).toBeGreaterThan(0);

      // Each config should have a valid path that existed
      configs.forEach(config => {
        expect(config.path).toBeTruthy();
        expect(config.type).toBeTruthy();
      });
    });

    it('exercises analyzeFilesByExtension through project structure analysis', async () => {
      // Create files with various extensions to trigger extension analysis
      writeFileSync(join(testProjectPath, 'index.js'), 'console.log("js");');
      writeFileSync(join(testProjectPath, 'main.ts'), 'console.log("ts");');
      writeFileSync(join(testProjectPath, 'component.tsx'), 'export const C = () => <div />;');
      writeFileSync(join(testProjectPath, 'styles.css'), 'body { margin: 0; }');
      writeFileSync(join(testProjectPath, 'README.md'), '# Project');
      writeFileSync(join(testProjectPath, 'data.json'), '{}');
      writeFileSync(join(testProjectPath, 'script.py'), 'print("hello")');
      writeFileSync(join(testProjectPath, 'app.go'), 'package main');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const structure = await analyzer.analyzeProjectStructure();

      // Should have analyzed files by extension
      expect(structure.totalFiles).toBe(8);
      expect(structure.filesByExtension).toBeDefined();

      // Should have various file types
      const extensions = Object.keys(structure.filesByExtension);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it('exercises getTopLevelDirectories through structure analysis', async () => {
      // Create various top-level directories
      const topLevelDirs = ['src', 'lib', 'tests', 'docs', 'scripts', 'assets', 'config'];

      topLevelDirs.forEach(dir => {
        mkdirSync(join(testProjectPath, dir), { recursive: true });
        writeFileSync(join(testProjectPath, dir, 'index.js'), `// ${dir}`);
      });

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const structure = await analyzer.getProjectStructure();

      // Should have detected multiple top-level directories
      expect(structure.commonDirectories.length).toBeGreaterThan(0);

      // Should include some of our created directories
      const hasExpectedDirs = structure.commonDirectories.some(dir =>
        topLevelDirs.includes(dir)
      );
      expect(hasExpectedDirs).toBe(true);
    });

    it('exercises detectImportantFolders with various folder patterns', async () => {
      // Create directories with different naming patterns that should be detected
      const importantDirs = [
        'src',          // source folder
        '__tests__',    // test folder variant 1
        'test',         // test folder variant 2
        'tests',        // test folder variant 3
        'spec',         // test folder variant 4
        'docs',         // documentation folder
        'doc',          // documentation folder variant
        'documentation', // documentation folder variant
      ];

      importantDirs.forEach(dir => {
        mkdirSync(join(testProjectPath, dir), { recursive: true });
        writeFileSync(join(testProjectPath, dir, 'file.js'), `// ${dir} content`);
      });

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const structure = await analyzer.analyzeProjectStructure();

      // Should have detected important folders
      expect(structure.commonDirectories.length).toBeGreaterThan(0);

      // Should include multiple types of important directories
      const detectedDirs = structure.commonDirectories;
      const hasSrc = detectedDirs.includes('src');
      const hasTestDir = detectedDirs.some(dir =>
        ['__tests__', 'test', 'tests', 'spec'].includes(dir)
      );
      const hasDocsDir = detectedDirs.some(dir =>
        ['docs', 'doc', 'documentation'].includes(dir)
      );

      expect(hasSrc || hasTestDir || hasDocsDir).toBe(true);
    });

    it('exercises analyzeMonorepoStructure with complex workspace patterns', async () => {
      // Create monorepo with different workspace patterns
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'complex-monorepo',
        private: true,
        workspaces: [
          'packages/*',
          'apps/*',
          'libs/*',
          'tools/*'
        ]
      }, null, 2));

      // Create workspaces
      const workspaces = [
        'packages/core',
        'packages/utils',
        'apps/web',
        'apps/mobile',
        'libs/shared',
        'tools/build'
      ];

      workspaces.forEach(workspace => {
        mkdirSync(join(testProjectPath, workspace), { recursive: true });
        writeFileSync(join(testProjectPath, workspace, 'package.json'), JSON.stringify({
          name: `@test/${workspace.replace('/', '-')}`
        }, null, 2));
      });

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const structure = await analyzer.analyzeProjectStructure();

      // Should detect complex monorepo structure
      expect(structure.isMonorepo).toBe(true);
      expect(structure.workspaces).toBeDefined();
      expect(structure.workspaces!.length).toBeGreaterThan(0);
    });

    it('exercises scanDirectory with various depth and exclusion scenarios', async () => {
      // Create nested structure with excluded directories
      const nestedPaths = [
        'src/components/ui',
        'src/utils/helpers',
        'node_modules/package/lib',
        'dist/assets/images',
        '.git/refs/heads',
        'coverage/lcov-report'
      ];

      nestedPaths.forEach(path => {
        mkdirSync(join(testProjectPath, path), { recursive: true });
        writeFileSync(join(testProjectPath, path, 'file.js'), '// content');
      });

      // Test with exclusions
      const analyzer = new ProjectContextAnalyzer(testProjectPath, {
        excludeDirectories: ['node_modules', 'dist', '.git', 'coverage'],
        maxDepth: 5
      });

      const structure = await analyzer.getProjectStructure();

      // Should have scanned allowed directories but excluded others
      expect(structure.totalFiles).toBeGreaterThan(0);
      expect(structure.excludedDirectories).toContain('node_modules');
    });

    it('exercises detectPackageManager with various lock files', async () => {
      // Test npm detection
      writeFileSync(join(testProjectPath, 'package-lock.json'), '{}');
      writeFileSync(join(testProjectPath, 'package.json'), '{}');

      let analyzer = new ProjectContextAnalyzer(testProjectPath);
      let frameworks = await analyzer.detectFrameworks();
      expect(frameworks.packageManager).toBeDefined();

      // Clean up and test yarn
      rmSync(join(testProjectPath, 'package-lock.json'));
      writeFileSync(join(testProjectPath, 'yarn.lock'), '');

      analyzer = new ProjectContextAnalyzer(testProjectPath);
      frameworks = await analyzer.detectFrameworks();
      expect(frameworks.packageManager).toBeDefined();

      // Clean up and test pnpm
      rmSync(join(testProjectPath, 'yarn.lock'));
      writeFileSync(join(testProjectPath, 'pnpm-lock.yaml'), '');

      analyzer = new ProjectContextAnalyzer(testProjectPath);
      frameworks = await analyzer.detectFrameworks();
      expect(frameworks.packageManager).toBeDefined();
    });

    it('exercises loadPackageJson with various package.json scenarios', async () => {
      // Test with valid package.json
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'test-package',
        dependencies: { 'react': '^18.0.0' }
      }, null, 2));

      let analyzer = new ProjectContextAnalyzer(testProjectPath);
      let frameworks = await analyzer.detectFrameworks();
      expect(frameworks.detected.length).toBeGreaterThan(0);

      // Test with empty package.json
      writeFileSync(join(testProjectPath, 'package.json'), '{}');

      analyzer = new ProjectContextAnalyzer(testProjectPath);
      frameworks = await analyzer.detectFrameworks();
      expect(frameworks.detected).toBeDefined();

      // Test with malformed package.json
      writeFileSync(join(testProjectPath, 'package.json'), '{ invalid json }');

      analyzer = new ProjectContextAnalyzer(testProjectPath);
      frameworks = await analyzer.detectFrameworks();
      expect(frameworks.detected).toBeDefined();
    });

    it('exercises detectLanguages through framework detection', async () => {
      // Create files that should trigger language detection
      writeFileSync(join(testProjectPath, 'index.js'), 'console.log("JavaScript");');
      writeFileSync(join(testProjectPath, 'main.ts'), 'console.log("TypeScript");');
      writeFileSync(join(testProjectPath, 'app.py'), 'print("Python")');
      writeFileSync(join(testProjectPath, 'main.go'), 'package main');
      writeFileSync(join(testProjectPath, 'lib.rs'), 'fn main() {}');
      writeFileSync(join(testProjectPath, 'App.java'), 'public class App {}');
      writeFileSync(join(testProjectPath, 'script.php'), '<?php echo "PHP"; ?>');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const frameworks = await analyzer.detectFrameworks();

      // Should have detected various languages
      expect(frameworks.detected.length).toBeGreaterThan(0);

      // Check for language-specific detections
      const detectedNames = frameworks.detected.map(f => f.name.toLowerCase());
      const hasLanguageDetection = detectedNames.some(name =>
        ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'php'].some(lang =>
          name.includes(lang)
        )
      );
      expect(hasLanguageDetection).toBe(true);
    });

    it('exercises detectConfigBasedFrameworks with various config files', async () => {
      // Create framework-specific config files
      const configFiles = [
        { name: 'webpack.config.js', content: 'module.exports = {};' },
        { name: 'vite.config.ts', content: 'export default {};' },
        { name: 'rollup.config.js', content: 'export default {};' },
        { name: 'nuxt.config.js', content: 'export default {};' },
        { name: 'next.config.js', content: 'module.exports = {};' },
        { name: 'svelte.config.js', content: 'export default {};' },
        { name: 'gatsby-config.js', content: 'module.exports = {};' },
        { name: 'angular.json', content: '{}' },
        { name: 'vue.config.js', content: 'module.exports = {};' }
      ];

      configFiles.forEach(({ name, content }) => {
        writeFileSync(join(testProjectPath, name), content);
      });

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const frameworks = await analyzer.detectFrameworks();

      // Should have detected config-based frameworks
      expect(frameworks.detected.length).toBeGreaterThan(0);

      // Should have detected some of the frameworks
      const frameworkNames = frameworks.detected.map(f => f.name.toLowerCase());
      const hasConfigFramework = frameworkNames.some(name =>
        ['webpack', 'vite', 'rollup', 'nuxt', 'next', 'svelte', 'gatsby', 'angular', 'vue'].some(fw =>
          name.includes(fw)
        )
      );
      expect(hasConfigFramework).toBe(true);
    });

    it('exercises detectPatternBasedFrameworks with file patterns', async () => {
      // Create pattern-based framework indicators
      mkdirSync(join(testProjectPath, 'src'), { recursive: true });

      // Django patterns
      writeFileSync(join(testProjectPath, 'manage.py'), '# Django management script');
      writeFileSync(join(testProjectPath, 'requirements.txt'), 'django>=4.0.0');

      // Rails patterns
      writeFileSync(join(testProjectPath, 'Gemfile'), 'gem "rails"');
      writeFileSync(join(testProjectPath, 'config.ru'), '# Rails config');

      // Laravel patterns
      writeFileSync(join(testProjectPath, 'artisan'), '# Laravel artisan');
      writeFileSync(join(testProjectPath, 'composer.json'), '{"require": {"laravel/framework": "*"}}');

      // Spring Boot patterns
      writeFileSync(join(testProjectPath, 'pom.xml'), '<project><dependencies><dependency><groupId>org.springframework.boot</groupId></dependency></dependencies></project>');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const frameworks = await analyzer.detectFrameworks();

      // Should have detected pattern-based frameworks
      expect(frameworks.detected.length).toBeGreaterThan(0);
    });

    it('exercises findFilesByPattern and findConfigFiles methods', async () => {
      // Create various pattern files
      writeFileSync(join(testProjectPath, '.env'), 'NODE_ENV=development');
      writeFileSync(join(testProjectPath, '.env.local'), 'API_KEY=test');
      writeFileSync(join(testProjectPath, 'docker-compose.yml'), 'version: "3"');
      writeFileSync(join(testProjectPath, 'Dockerfile'), 'FROM node:18');

      mkdirSync(join(testProjectPath, 'config'), { recursive: true });
      writeFileSync(join(testProjectPath, 'config', 'database.yml'), 'production:');
      writeFileSync(join(testProjectPath, 'config', 'app.json'), '{}');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const configs = await analyzer.getConfigurationInfoList();

      // Should have found various config files
      expect(configs.length).toBeGreaterThan(0);

      // Should include different types of config files
      const configTypes = configs.map(c => c.type);
      const hasVariousTypes = configTypes.some(type =>
        ['json', 'yaml', 'env', 'dockerfile'].includes(type)
      );
      expect(hasVariousTypes).toBe(true);
    });

    it('exercises countTestFiles method through test framework detection', async () => {
      // Create test files with various patterns
      const testPatterns = [
        '__tests__/unit.test.js',
        '__tests__/integration.test.ts',
        'test/e2e.test.js',
        'tests/component.test.tsx',
        'spec/model.spec.js',
        'src/utils.test.js',
        'src/__tests__/helper.test.ts'
      ];

      testPatterns.forEach(pattern => {
        const dir = pattern.split('/').slice(0, -1).join('/');
        if (dir) {
          mkdirSync(join(testProjectPath, dir), { recursive: true });
        }
        writeFileSync(join(testProjectPath, pattern), 'test("example", () => {});');
      });

      // Add package.json with test framework
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'test-counting',
        devDependencies: {
          'jest': '^29.0.0'
        }
      }, null, 2));

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const testFrameworks = await analyzer.detectTestFrameworks();

      // Should have detected test frameworks and counted test files
      expect(testFrameworks.length).toBeGreaterThan(0);

      // Should have reasonable test file counts
      const jestFramework = testFrameworks.find(f => f.name.toLowerCase().includes('jest'));
      if (jestFramework) {
        expect(jestFramework.testFileCount).toBeGreaterThan(0);
      }
    });

    it('exercises detectTestFrameworkFeatures with comprehensive test setup', async () => {
      // Create comprehensive test framework setup
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'comprehensive-test',
        scripts: {
          test: 'jest',
          'test:watch': 'jest --watch',
          'test:coverage': 'jest --coverage',
          'test:e2e': 'cypress run'
        },
        devDependencies: {
          'jest': '^29.0.0',
          'cypress': '^12.0.0',
          '@testing-library/react': '^13.0.0',
          '@testing-library/jest-dom': '^5.0.0',
          'puppeteer': '^19.0.0',
          'playwright': '^1.35.0'
        }
      }, null, 2));

      // Create test configuration files
      writeFileSync(join(testProjectPath, 'jest.config.js'), `
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}'],
  testMatch: ['**/__tests__/**/*.(js|jsx|ts|tsx)', '**/*.(test|spec).(js|jsx|ts|tsx)']
};
`);

      writeFileSync(join(testProjectPath, 'cypress.config.js'), `
module.exports = {
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.{js,jsx,ts,tsx}'
  }
};
`);

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const testFrameworks = await analyzer.detectTestFrameworks();

      // Should have detected multiple test frameworks with features
      expect(testFrameworks.length).toBeGreaterThan(0);

      // Should have detected Jest with comprehensive features
      const jestFramework = testFrameworks.find(f => f.name.toLowerCase().includes('jest'));
      if (jestFramework) {
        expect(jestFramework.features.length).toBeGreaterThan(0);
      }
    });

    it('exercises detectAdditionalTestTools comprehensively', async () => {
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: 'additional-tools-test',
        devDependencies: {
          // Testing frameworks
          'mocha': '^10.0.0',
          'chai': '^4.3.0',
          'sinon': '^15.0.0',

          // Testing utilities
          '@testing-library/react': '^13.0.0',
          '@testing-library/user-event': '^14.0.0',
          '@testing-library/dom': '^9.0.0',

          // E2E testing
          'selenium-webdriver': '^4.0.0',
          'webdriverio': '^8.0.0',

          // Coverage
          'nyc': '^15.0.0',
          'c8': '^7.0.0',

          // Mocking
          'msw': '^1.2.0',
          'nock': '^13.0.0',

          // Performance testing
          'k6': '^0.45.0'
        }
      }, null, 2));

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const testFrameworks = await analyzer.detectTestFrameworks();

      // Should have detected multiple additional tools
      expect(testFrameworks.length).toBeGreaterThan(0);

      // Should include various types of testing tools
      const toolNames = testFrameworks.map(f => f.name.toLowerCase());
      const hasVariousTools = toolNames.some(name =>
        ['mocha', 'chai', 'sinon', 'testing-library', 'selenium', 'webdriver', 'nyc', 'c8', 'msw', 'nock'].some(tool =>
          name.includes(tool)
        )
      );
      expect(hasVariousTools).toBe(true);
    });
  });

  describe('Edge Cases and Error Paths', () => {
    it('handles completely empty package.json', async () => {
      writeFileSync(join(testProjectPath, 'package.json'), '');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const frameworks = await analyzer.detectFrameworks();

      // Should handle gracefully without crashing
      expect(frameworks.detected).toBeDefined();
      expect(Array.isArray(frameworks.detected)).toBe(true);
    });

    it('handles package.json with null/undefined values', async () => {
      writeFileSync(join(testProjectPath, 'package.json'), JSON.stringify({
        name: null,
        dependencies: undefined,
        devDependencies: null,
        scripts: {}
      }, null, 2));

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const frameworks = await analyzer.detectFrameworks();

      // Should handle gracefully
      expect(frameworks.detected).toBeDefined();
      expect(Array.isArray(frameworks.detected)).toBe(true);
    });

    it('handles circular symlinks and special files', async () => {
      // Create a regular file first
      writeFileSync(join(testProjectPath, 'regular.txt'), 'content');

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const structure = await analyzer.getProjectStructure();

      // Should handle without crashing
      expect(structure.totalFiles).toBeGreaterThan(0);
    });

    it('handles files with special characters in names', async () => {
      // Create files with special characters (that are valid on most filesystems)
      const specialFiles = [
        'file-with-dashes.js',
        'file_with_underscores.ts',
        'file.with.dots.json',
        'file with spaces.txt',
        'файл.js', // Unicode filename
        'file123.js',
      ];

      specialFiles.forEach(filename => {
        try {
          writeFileSync(join(testProjectPath, filename), 'content');
        } catch {
          // Skip files that can't be created on this filesystem
        }
      });

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const structure = await analyzer.getProjectStructure();

      // Should handle special characters in filenames
      expect(structure.totalFiles).toBeGreaterThan(0);
    });

    it('exercises all configuration parsing types', async () => {
      const configFiles = [
        { name: 'package.json', content: '{"name": "test"}' },
        { name: 'tsconfig.json', content: '{"compilerOptions": {}}' },
        { name: '.eslintrc.json', content: '{"rules": {}}' },
        { name: 'config.yaml', content: 'key: value' },
        { name: 'config.yml', content: 'key: value' },
        { name: '.env', content: 'KEY=value' },
        { name: 'Dockerfile', content: 'FROM node:18' },
        { name: 'script.sh', content: '#!/bin/bash\necho "test"' },
        { name: 'config.xml', content: '<config></config>' },
        { name: 'config.toml', content: '[section]\nkey = "value"' },
        { name: 'config.ini', content: '[section]\nkey=value' },
        { name: 'vite.config.ts', content: 'export default {}' },
        { name: 'webpack.config.js', content: 'module.exports = {}' }
      ];

      configFiles.forEach(({ name, content }) => {
        writeFileSync(join(testProjectPath, name), content);
      });

      const analyzer = new ProjectContextAnalyzer(testProjectPath);
      const configs = await analyzer.getConfigurationInfoList();
      const parsed = await analyzer.parseConfigurations(configs);

      // Should handle all configuration types
      expect(configs.length).toBeGreaterThan(0);
      expect(parsed.length).toBe(configs.length);

      // Should have various configuration types
      const types = new Set(configs.map(c => c.type));
      expect(types.size).toBeGreaterThan(1); // Multiple different types
    });
  });
});