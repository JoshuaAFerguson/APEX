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