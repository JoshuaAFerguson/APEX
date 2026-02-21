import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import {
  ProjectContextAnalyzer,
  analyzeProject,
  getProjectContextAnalyzer
} from './project-context-analyzer';

describe('ProjectContextAnalyzer', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-test-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create an analyzer with default options', () => {
      const analyzer = new ProjectContextAnalyzer('/test/path');
      expect(analyzer.getProjectPath()).toBe('/test/path');
      expect(analyzer.getOptions().maxDepth).toBe(10);
      expect(analyzer.getOptions().includeHidden).toBe(false);
    });

    it('should create an analyzer with custom options', () => {
      const options = { maxDepth: 5, includeHidden: true };
      const analyzer = new ProjectContextAnalyzer('/test/path', options);
      expect(analyzer.getOptions().maxDepth).toBe(5);
      expect(analyzer.getOptions().includeHidden).toBe(true);
    });
  });

  describe('getGitStatus', () => {
    it('should return empty git status for non-git directory', async () => {
      const gitStatus = await analyzer.getGitStatus();
      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBe(null);
      expect(gitStatus.staged).toEqual([]);
      expect(gitStatus.unstaged).toEqual([]);
      expect(gitStatus.untracked).toEqual([]);
    });
  });

  describe('getProjectStructure', () => {
    it('should analyze empty directory structure', async () => {
      const structure = await analyzer.getProjectStructure();
      expect(structure.root).toBe(tempDir);
      expect(structure.totalFiles).toBe(0);
      expect(structure.totalDirectories).toBe(0);
      expect(structure.entries).toEqual([]);
      expect(structure.hasPackageJson).toBe(false);
    });

    it('should detect package.json and basic files', async () => {
      // Create test files
      await fs.promises.writeFile(path.join(tempDir, 'package.json'), '{"name":"test"}');
      await fs.promises.writeFile(path.join(tempDir, 'README.md'), '# Test Project');
      await fs.promises.writeFile(path.join(tempDir, '.gitignore'), 'node_modules/');

      const structure = await analyzer.getProjectStructure();
      expect(structure.hasPackageJson).toBe(true);
      expect(structure.hasReadme).toBe(true);
      expect(structure.hasGitIgnore).toBe(true);
      expect(structure.totalFiles).toBe(3);
      expect(structure.rootFiles).toContain('package.json');
      expect(structure.rootFiles).toContain('README.md');
    });

    it('should detect common directory structures', async () => {
      // Create common directories
      await fs.promises.mkdir(path.join(tempDir, 'src'));
      await fs.promises.mkdir(path.join(tempDir, 'test'));
      await fs.promises.mkdir(path.join(tempDir, 'dist'));

      const structure = await analyzer.getProjectStructure();
      expect(structure.commonDirectories).toContain('src');
      expect(structure.commonDirectories).toContain('test');
      expect(structure.commonDirectories).toContain('dist');
    });
  });

  describe('detectFrameworks', () => {
    it('should detect React from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      expect(detection.frameworks).toHaveLength(1);
      expect(detection.frameworks[0].name).toBe('React');
      expect(detection.frameworks[0].category).toBe('frontend');
      expect(detection.frameworks[0].confidence).toBe('high');
    });

    it('should detect TypeScript from dependencies', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          typescript: '^5.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      const tsFramework = detection.frameworks.find(f => f.name === 'TypeScript');
      expect(tsFramework).toBeDefined();
      expect(tsFramework?.isDevDependency).toBe(true);
    });

    it('should include detectionReasons for all detected frameworks', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
          express: '^4.18.0'
        },
        devDependencies: {
          typescript: '^5.0.0',
          jest: '^29.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      // Check that all frameworks have detectionReasons
      for (const framework of detection.frameworks) {
        expect(framework.detectionReasons).toBeDefined();
        expect(Array.isArray(framework.detectionReasons)).toBe(true);
        expect(framework.detectionReasons!.length).toBeGreaterThan(0);
      }
    });

    it('should detect comprehensive framework coverage (10+ frameworks)', async () => {
      // Create a complex package.json with multiple frameworks
      const packageJson = {
        name: 'comprehensive-test-project',
        dependencies: {
          // Frontend frameworks
          react: '^18.0.0',
          vue: '^3.3.0',
          // Full-stack frameworks
          next: '^14.0.0',
          gatsby: '^5.0.0',
          // Backend frameworks
          express: '^4.18.0',
          fastify: '^4.25.0',
          '@nestjs/core': '^10.0.0',
          // Build tools
          vite: '^5.0.0',
          webpack: '^5.89.0',
          // Testing frameworks
          vitest: '^2.0.0',
          '@playwright/test': '^1.40.0',
          cypress: '^13.0.0',
          // Mobile/Desktop
          'react-native': '^0.72.0',
          electron: '^28.0.0',
          // CSS frameworks
          tailwindcss: '^3.4.0',
          '@mui/material': '^5.15.0',
          // State management
          redux: '^5.0.0',
          // Database ORMs
          prisma: '^5.7.0',
          mongoose: '^8.0.0'
        },
        devDependencies: {
          typescript: '^5.0.0'
        }
      };

      // Create config files for additional frameworks
      const configFiles = [
        { name: 'jest.config.js', content: 'module.exports = {};' },
        { name: 'tailwind.config.js', content: 'module.exports = {};' },
        { name: 'prisma/schema.prisma', content: 'generator client {\n  provider = "prisma-client-js"\n}' },
        { name: '.eslintrc.json', content: '{}' },
        { name: 'docker-compose.yml', content: 'version: "3"' }
      ];

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create config files
      for (const { name, content } of configFiles) {
        const filePath = path.join(tempDir, name);
        const dir = path.dirname(filePath);
        if (dir !== tempDir) {
          await fs.promises.mkdir(dir, { recursive: true });
        }
        await fs.promises.writeFile(filePath, content);
      }

      const detection = await analyzer.detectFrameworks();
      const frameworkNames = detection.frameworks.map(f => f.name.toLowerCase());

      // Verify we detect at least 10 different frameworks
      expect(detection.frameworks.length).toBeGreaterThanOrEqual(10);

      // Test specific framework categories
      const categories = detection.frameworks.map(f => f.category);
      expect(categories).toContain('frontend');
      expect(categories).toContain('backend');
      expect(categories).toContain('fullstack');
      expect(categories).toContain('testing');
      expect(categories).toContain('build');

      // Verify specific popular frameworks are detected
      expect(frameworkNames.some(name => name.includes('react'))).toBe(true);
      expect(frameworkNames.some(name => name.includes('vue'))).toBe(true);
      expect(frameworkNames.some(name => name.includes('express'))).toBe(true);
      expect(frameworkNames.some(name => name.includes('typescript'))).toBe(true);
      expect(frameworkNames.some(name => name.includes('vite'))).toBe(true);
      expect(frameworkNames.some(name => name.includes('tailwind'))).toBe(true);
      expect(frameworkNames.some(name => name.includes('prisma'))).toBe(true);

      // Verify all frameworks have proper confidence levels
      for (const framework of detection.frameworks) {
        expect(['high', 'medium', 'low']).toContain(framework.confidence);
        expect(framework.detectionReasons).toBeDefined();
        expect(framework.detectionReasons!.length).toBeGreaterThan(0);
      }
    });

    it('should detect frameworks from configuration files', async () => {
      // Create config files without package.json dependencies
      const configFiles = [
        { name: 'next.config.js', content: 'module.exports = {};', expected: 'Next.js' },
        { name: 'vue.config.js', content: 'module.exports = {};', expected: 'Vue' },
        { name: 'angular.json', content: '{}', expected: 'Angular' },
        { name: 'svelte.config.js', content: 'module.exports = {};', expected: 'Svelte' },
        { name: 'gatsby-config.js', content: 'module.exports = {};', expected: 'Gatsby' }
      ];

      for (const { name, content } of configFiles) {
        await fs.promises.writeFile(path.join(tempDir, name), content);
      }

      const detection = await analyzer.detectFrameworks();
      const frameworkNames = detection.frameworks.map(f => f.name);

      // Verify config-based detection works
      expect(frameworkNames).toContain('Next.js');
      expect(frameworkNames).toContain('Vue');
      expect(frameworkNames).toContain('Angular');
      expect(frameworkNames).toContain('Svelte');
      expect(frameworkNames).toContain('Gatsby');

      // Check detection reasons mention config files
      for (const framework of detection.frameworks) {
        expect(framework.detectionReasons).toBeDefined();
        expect(framework.detectionReasons!.some(reason =>
          reason.toLowerCase().includes('configuration file') ||
          reason.toLowerCase().includes('config')
        )).toBe(true);
      }
    });

    it('should merge duplicate framework detections with combined reasons', async () => {
      // Create both package.json dependency and config file for the same framework
      const packageJson = {
        name: 'duplicate-test',
        dependencies: {
          next: '^14.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'next.config.js'),
        'module.exports = {};'
      );

      const detection = await analyzer.detectFrameworks();
      const nextFramework = detection.frameworks.find(f => f.name === 'Next.js');

      expect(nextFramework).toBeDefined();
      expect(nextFramework!.detectionReasons).toBeDefined();
      expect(nextFramework!.detectionReasons!.length).toBeGreaterThanOrEqual(2);

      // Should have reasons from both package.json and config file
      const reasons = nextFramework!.detectionReasons!.join(' ');
      expect(reasons).toMatch(/package\.json|dependency/i);
      expect(reasons).toMatch(/configuration|config/i);
    });

    it('should assign correct confidence levels', async () => {
      const packageJson = {
        name: 'confidence-test',
        dependencies: {
          react: '^18.0.0', // Should be high confidence
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create a config file (medium confidence)
      await fs.promises.writeFile(
        path.join(tempDir, 'vite.config.js'),
        'export default {};'
      );

      const detection = await analyzer.detectFrameworks();

      const reactFramework = detection.frameworks.find(f => f.name === 'React');
      expect(reactFramework?.confidence).toBe('high');

      const viteFramework = detection.frameworks.find(f => f.name === 'Vite');
      expect(viteFramework?.confidence).toBe('medium');
    });

    it('should detect primary framework correctly', async () => {
      const packageJson = {
        name: 'primary-test',
        dependencies: {
          react: '^18.0.0',
          lodash: '^4.17.21'
        },
        devDependencies: {
          typescript: '^5.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.primary).toBeDefined();
      expect(detection.primary!.confidence).toBe('high');
      expect(['React', 'TypeScript']).toContain(detection.primary!.name);
    });
  });

  describe('getConfigurationInfoList', () => {
    it('should detect package.json configuration', async () => {
      const packageJson = {
        name: 'test-project',
        scripts: { build: 'tsc', test: 'vitest' }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const configs = await analyzer.getConfigurationInfoList();
      const packageConfig = configs.find(c => c.name === 'package.json');
      expect(packageConfig).toBeDefined();
      expect(packageConfig?.format).toBe('json');
      expect(packageConfig?.purpose).toBe('package-manager');
      expect(packageConfig?.isValid).toBe(true);
    });

    it('should detect TypeScript configuration', async () => {
      const tsConfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify(tsConfig, null, 2)
      );

      const configs = await analyzer.getConfigurationInfoList();
      const tsConfigFile = configs.find(c => c.name === 'tsconfig.json');
      expect(tsConfigFile).toBeDefined();
      expect(tsConfigFile?.purpose).toBe('typescript');
    });
  });

  describe('getTestFrameworkInfoList', () => {
    it('should detect Vitest from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          vitest: '^1.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const testFrameworks = await analyzer.getTestFrameworkInfoList();
      const vitest = testFrameworks.find(f => f.name === 'Vitest');
      expect(vitest).toBeDefined();
      expect(vitest?.type).toBe('unit');
      expect(vitest?.version).toBe('^1.0.0');
    });
  });

  describe('analyze', () => {
    it('should perform complete analysis', async () => {
      // Create a realistic project structure
      const packageJson = {
        name: 'test-project',
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0', vitest: '^1.0.0' }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      await fs.promises.writeFile(path.join(tempDir, 'README.md'), '# Test');
      await fs.promises.mkdir(path.join(tempDir, 'src'));

      const context = await analyzer.analyze();

      expect(context.gitStatus).toBeDefined();
      expect(context.structure).toBeDefined();
      expect(context.frameworks).toBeDefined();
      expect(context.configurations).toBeDefined();
      expect(context.testFrameworks).toBeDefined();
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(context.errors).toEqual([]);
    });
  });

  describe('convenience functions', () => {
    it('should create analyzer via getProjectContextAnalyzer', () => {
      const analyzer1 = getProjectContextAnalyzer('/test/path');
      const analyzer2 = getProjectContextAnalyzer('/test/path');
      expect(analyzer1).toBe(analyzer2); // Should return the same instance
    });

    it('should create new analyzer for different paths', () => {
      const analyzer1 = getProjectContextAnalyzer('/test/path1');
      const analyzer2 = getProjectContextAnalyzer('/test/path2');
      expect(analyzer1).not.toBe(analyzer2);
    });

    it('should analyze project via convenience function', async () => {
      await fs.promises.writeFile(path.join(tempDir, 'package.json'), '{"name":"test"}');

      const context = await analyzeProject(tempDir);
      expect(context.structure?.hasPackageJson).toBe(true);
    });
  });
});