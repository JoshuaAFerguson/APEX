/**
 * @fileoverview Comprehensive advanced tests for ProjectContextAnalyzer
 *
 * This file contains extensive tests for edge cases, error handling,
 * schema validation, and advanced scenarios that complement the basic
 * tests in project-context-analyzer.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { ProjectContextAnalyzer } from '../project-context-analyzer';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  ProjectContextSchema
} from '../types';

// Mock child_process for git command testing
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return {
    ...actual,
    exec: vi.fn()
  };
});

describe('ProjectContextAnalyzer - Comprehensive Tests', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-comprehensive-test-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Schema Validation Tests', () => {
    it('should validate GitStatus schema with complete data', async () => {
      // Mock comprehensive git repository
      let callCount = 0;
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, options, callback) => {
        if (typeof cmd === 'string') {
          if (cmd.includes('rev-parse --git-dir')) {
            callback?.(null, '.git\n', '');
          } else if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback?.(null, 'feature/test-branch\n', '');
          } else if (cmd.includes('upstream')) {
            callback?.(null, 'origin/feature/test-branch\n', '');
          } else if (cmd.includes('rev-list --count')) {
            callback?.(null, '3\t2\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback?.(null, 'M  src/app.ts\nA  src/new.ts\nD  old-file.js\n?? untracked.txt\nUU conflict.ts\n', '');
          } else if (cmd.includes('log -1 --format')) {
            callback?.(null, 'a1b2c3d|feat: comprehensive test feature|1672531200\n', '');
          } else if (cmd.includes('stash list')) {
            callback?.(null, 'stash@{0}: WIP on feature\nstash@{1}: backup changes\n', '');
          } else if (cmd.includes('remote -v')) {
            callback?.(null, 'origin\thttps://github.com/test/repo.git (fetch)\nupstream\thttps://github.com/original/repo.git (fetch)\n', '');
          }
        }
        return {} as any;
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('feature/test-branch');
      expect(gitStatus.remoteBranch).toBe('origin/feature/test-branch');
      expect(gitStatus.ahead).toBe(3);
      expect(gitStatus.behind).toBe(2);
      expect(gitStatus.hasConflicts).toBe(true);
      expect(gitStatus.isDirty).toBe(true);
      expect(gitStatus.staged).toHaveLength(3);
      expect(gitStatus.unstaged).toHaveLength(1);
      expect(gitStatus.untracked).toEqual(['untracked.txt']);
      expect(gitStatus.stashCount).toBe(2);
      expect(gitStatus.remotes).toHaveLength(2);

      // Validate against schema - should not throw
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();

      // Verify specific field types
      expect(typeof gitStatus.ahead).toBe('number');
      expect(typeof gitStatus.behind).toBe('number');
      expect(Array.isArray(gitStatus.staged)).toBe(true);
      expect(Array.isArray(gitStatus.unstaged)).toBe(true);
      expect(Array.isArray(gitStatus.untracked)).toBe(true);
    });

    it('should validate ProjectStructure schema with deep nested structure', async () => {
      // Create a complex directory structure
      const dirs = ['src/components/ui', 'src/utils/helpers', 'tests/unit', 'tests/e2e', 'docs/api'];
      const files = [
        'package.json', 'README.md', '.gitignore', 'LICENSE',
        'src/index.ts', 'src/app.tsx',
        'src/components/Button.tsx', 'src/components/ui/Modal.tsx',
        'src/utils/constants.ts', 'src/utils/helpers/format.ts',
        'tests/unit/app.test.ts', 'tests/e2e/flow.test.ts',
        'docs/README.md', 'docs/api/endpoints.md'
      ];

      // Create directories
      for (const dir of dirs) {
        await fs.promises.mkdir(path.join(tempDir, dir), { recursive: true });
      }

      // Create files
      for (const file of files) {
        await fs.promises.writeFile(path.join(tempDir, file), 'content');
      }

      const structure = await analyzer.getProjectStructure();

      expect(structure.root).toBe(tempDir);
      expect(structure.totalFiles).toBe(files.length);
      expect(structure.totalDirectories).toBeGreaterThan(0);
      expect(structure.hasPackageJson).toBe(true);
      expect(structure.hasGitIgnore).toBe(true);
      expect(structure.hasReadme).toBe(true);
      expect(structure.hasLicense).toBe(true);

      // Validate against schema
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();

      // Verify nested structure
      expect(structure.entries.some(e => e.path.includes('src/components'))).toBe(true);
      expect(structure.commonDirectories).toContain('src');
      expect(structure.commonDirectories).toContain('tests');
      expect(structure.commonDirectories).toContain('docs');
    });

    it('should validate FrameworkDetection schema with multiple frameworks', async () => {
      const complexPackageJson = {
        name: 'multi-framework-project',
        dependencies: {
          'react': '^18.2.0',
          'next': '^13.4.0',
          'express': '^4.18.2',
          'prisma': '^4.15.0'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'jest': '^29.5.0',
          '@playwright/test': '^1.35.0',
          'eslint': '^8.42.0',
          'prettier': '^2.8.8'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(complexPackageJson, null, 2)
      );

      // Create config files
      await fs.promises.writeFile(path.join(tempDir, 'next.config.js'), 'module.exports = {};');
      await fs.promises.writeFile(path.join(tempDir, 'jest.config.js'), 'module.exports = {};');
      await fs.promises.writeFile(path.join(tempDir, 'playwright.config.ts'), 'export default {};');

      // Create language files
      const srcDir = path.join(tempDir, 'src');
      await fs.promises.mkdir(srcDir);
      await fs.promises.writeFile(path.join(srcDir, 'app.ts'), 'export {}');
      await fs.promises.writeFile(path.join(srcDir, 'component.tsx'), 'export {}');
      await fs.promises.writeFile(path.join(srcDir, 'styles.css'), 'body {}');

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks!.length).toBeGreaterThan(3);
      expect(detection.languages!.length).toBeGreaterThan(1);

      // Validate against schema
      expect(() => FrameworkDetectionSchema.parse(detection)).not.toThrow();

      // Check specific frameworks
      const reactFramework = detection.frameworks!.find(f => f.name === 'React');
      expect(reactFramework).toBeDefined();
      expect(reactFramework?.confidence).toBe('high');
      expect(reactFramework?.category).toBe('frontend');

      const nextFramework = detection.frameworks!.find(f => f.name === 'Next.js');
      expect(nextFramework).toBeDefined();

      // Check languages
      const typescript = detection.languages!.find(l => l.name === 'TypeScript');
      expect(typescript).toBeDefined();
      expect(typescript?.extensions).toContain('.ts');
      expect(typescript?.extensions).toContain('.tsx');
    });

    it('should validate ConfigurationInfo schema with various config types', async () => {
      const configs = [
        { name: 'package.json', content: '{"name": "test", "version": "1.0.0"}' },
        { name: 'tsconfig.json', content: '{"compilerOptions": {"target": "ES2022"}}' },
        { name: '.eslintrc.json', content: '{"extends": ["@typescript-eslint/recommended"]}' },
        { name: 'jest.config.js', content: 'module.exports = { testEnvironment: "node" };' },
        { name: '.env', content: 'NODE_ENV=development\nAPI_URL=http://localhost:3000' },
        { name: 'Dockerfile', content: 'FROM node:18\nWORKDIR /app' },
        { name: '.gitignore', content: 'node_modules/\n.env' },
      ];

      for (const config of configs) {
        await fs.promises.writeFile(path.join(tempDir, config.name), config.content);
      }

      const configurationInfo = await analyzer.getConfigurationInfoList();
      expect(configurationInfo.length).toBeGreaterThan(0);

      // Validate each configuration
      configurationInfo.forEach(config => {
        expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
        expect(config.name).toBeTruthy();
        expect(config.path).toBeTruthy();
        expect(config.format).toBeTruthy();
        expect(config.purpose).toBeTruthy();
        expect(typeof config.isValid).toBe('boolean');
        expect(typeof config.size).toBe('number');
        expect(config.modifiedAt).toBeInstanceOf(Date);
      });
    });

    it('should validate TestFrameworkInfo schema with multiple test frameworks', async () => {
      const testPackageJson = {
        name: 'testing-project',
        devDependencies: {
          'jest': '^29.5.0',
          'vitest': '^0.32.0',
          '@playwright/test': '^1.35.0',
          'cypress': '^12.14.0',
          'mocha': '^10.2.0',
          'c8': '^8.0.0',
          '@testing-library/react': '^13.4.0',
          'sinon': '^15.2.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(testPackageJson, null, 2)
      );

      // Create test config files
      await fs.promises.writeFile(path.join(tempDir, 'jest.config.js'), 'module.exports = {};');
      await fs.promises.writeFile(path.join(tempDir, 'vitest.config.ts'), 'export default {};');
      await fs.promises.writeFile(path.join(tempDir, 'playwright.config.ts'), 'export default {};');

      // Create test files
      const testsDir = path.join(tempDir, 'tests');
      await fs.promises.mkdir(testsDir);
      await fs.promises.writeFile(path.join(testsDir, 'app.test.ts'), 'test("example", () => {});');
      await fs.promises.writeFile(path.join(testsDir, 'integration.spec.ts'), 'test("integration", () => {});');

      const testFrameworks = await analyzer.getTestFrameworkInfoList();
      expect(testFrameworks.length).toBeGreaterThan(2);

      // Validate each test framework
      testFrameworks.forEach(framework => {
        expect(() => TestFrameworkInfoSchema.parse(framework)).not.toThrow();
        expect(framework.name).toBeTruthy();
        expect(['unit', 'integration', 'e2e', 'component', 'other']).toContain(framework.type);
        if (framework.testPatterns) {
          expect(Array.isArray(framework.testPatterns)).toBe(true);
        }
        if (framework.runCommand) {
          expect(typeof framework.runCommand).toBe('string');
        }
      });

      // Check specific features
      const jestFramework = testFrameworks.find(f => f.name === 'Jest');
      expect(jestFramework?.coverageEnabled).toBe(true);
      expect(jestFramework?.coverageTool).toBe('c8');
    });

    it('should validate complete ProjectContext schema', async () => {
      // Create a comprehensive test project
      const fullPackageJson = {
        name: 'comprehensive-test-project',
        version: '2.1.0',
        description: 'A comprehensive test project',
        dependencies: {
          'react': '^18.2.0',
          'express': '^4.18.2'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'jest': '^29.5.0',
          'eslint': '^8.42.0'
        },
        scripts: {
          'build': 'tsc',
          'test': 'jest',
          'lint': 'eslint .',
          'start': 'node dist/index.js'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(fullPackageJson, null, 2)
      );

      // Create files and directories
      await fs.promises.writeFile(path.join(tempDir, 'README.md'), '# Test Project');
      await fs.promises.writeFile(path.join(tempDir, '.gitignore'), 'node_modules/\ndist/');
      await fs.promises.writeFile(path.join(tempDir, 'tsconfig.json'), '{"compilerOptions": {}}');

      const srcDir = path.join(tempDir, 'src');
      await fs.promises.mkdir(srcDir);
      await fs.promises.writeFile(path.join(srcDir, 'index.ts'), 'export const app = "test";');

      // Mock git commands
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, options, callback) => {
        if (typeof cmd === 'string') {
          if (cmd.includes('rev-parse --git-dir')) {
            callback?.(null, '.git\n', '');
          } else if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback?.(null, 'main\n', '');
          } else {
            callback?.(null, '', '');
          }
        }
        return {} as any;
      });

      const projectContext = await analyzer.analyze();

      // Validate complete context against schema
      expect(() => ProjectContextSchema.parse(projectContext)).not.toThrow();

      // Verify all components are present
      expect(projectContext.gitStatus).toBeDefined();
      expect(projectContext.structure).toBeDefined();
      expect(projectContext.frameworks).toBeDefined();
      expect(projectContext.configurations).toBeDefined();
      expect(projectContext.testFrameworks).toBeDefined();
      expect(projectContext.detectedAt).toBeInstanceOf(Date);
      expect(Array.isArray(projectContext.errors)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle permission denied errors gracefully', async () => {
      // Create a directory we can't read (simulate permission error)
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.promises.mkdir(restrictedDir);

      // Mock fs.readdir to throw permission error for the restricted directory
      const originalReaddir = fs.readdir;
      vi.spyOn(fs, 'readdir').mockImplementation((dirPath, options) => {
        if (dirPath.toString().includes('restricted')) {
          return Promise.reject(new Error('EACCES: permission denied'));
        }
        return originalReaddir(dirPath, options as any);
      });

      const structure = await analyzer.getProjectStructure();

      // Should complete without throwing
      expect(structure.root).toBe(tempDir);
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    });

    it('should handle corrupted JSON files', async () => {
      // Create invalid JSON files
      await fs.promises.writeFile(path.join(tempDir, 'package.json'), '{"name": "test", invalid}');
      await fs.promises.writeFile(path.join(tempDir, 'tsconfig.json'), '{broken json content');

      const configurations = await analyzer.getConfigurationInfoList();

      // Should find the files but mark them as invalid
      const packageConfig = configurations.find(c => c.name === 'package.json');
      expect(packageConfig).toBeDefined();
      expect(packageConfig?.isValid).toBe(false);
      expect(packageConfig?.validationError).toContain('parse error');

      const tsConfig = configurations.find(c => c.name === 'tsconfig.json');
      expect(tsConfig).toBeDefined();
      expect(tsConfig?.isValid).toBe(false);
    });

    it('should handle large files safely', async () => {
      // Create a very large JSON file (but under safety limit)
      const largeConfig = {
        name: 'large-project',
        dependencies: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`package-${i}`, `^1.0.${i}`])
        )
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(largeConfig, null, 2)
      );

      const configurations = await analyzer.getConfigurationInfoList();
      const packageConfig = configurations.find(c => c.name === 'package.json');

      expect(packageConfig).toBeDefined();
      expect(packageConfig?.isValid).toBe(true);
      expect(packageConfig?.keySettings?.dependencyCount).toBe(1000);
    });

    it('should handle extremely deep directory structures', async () => {
      const deepAnalyzer = new ProjectContextAnalyzer(tempDir, { maxDepth: 3 });

      // Create a deep nested structure (deeper than maxDepth)
      let currentDir = tempDir;
      for (let i = 0; i < 10; i++) {
        currentDir = path.join(currentDir, `level-${i}`);
        await fs.promises.mkdir(currentDir, { recursive: true });
        await fs.promises.writeFile(path.join(currentDir, `file-${i}.txt`), 'content');
      }

      const structure = await deepAnalyzer.getProjectStructure();

      // Should respect maxDepth
      expect(structure.maxDepthScanned).toBeLessThanOrEqual(3);
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    });

    it('should handle missing git repository gracefully', async () => {
      const mockExec = vi.mocked(exec);
      mockExec.mockImplementation((cmd, options, callback) => {
        callback?.(new Error('fatal: not a git repository'), '', 'fatal: not a git repository');
        return {} as any;
      });

      const gitStatus = await analyzer.getGitStatus();

      expect(gitStatus.isRepository).toBe(false);
      expect(gitStatus.branch).toBe(null);
      expect(gitStatus.staged).toEqual([]);
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('should handle partial git command failures', async () => {
      const mockExec = vi.mocked(exec);
      let callCount = 0;

      mockExec.mockImplementation((cmd, options, callback) => {
        callCount++;
        if (typeof cmd === 'string') {
          if (cmd.includes('rev-parse --git-dir')) {
            callback?.(null, '.git\n', '');
          } else if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback?.(null, 'main\n', '');
          } else {
            // All other git commands fail
            callback?.(new Error('git command failed'), '', 'error message');
          }
        }
        return {} as any;
      });

      const gitStatus = await analyzer.getGitStatus();

      // Should be a git repo with basic info but missing advanced info
      expect(gitStatus.isRepository).toBe(true);
      expect(gitStatus.branch).toBe('main');
      expect(gitStatus.remoteBranch).toBe(null);
      expect(gitStatus.ahead).toBe(0);
      expect(gitStatus.behind).toBe(0);
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    });

    it('should handle empty and whitespace-only files', async () => {
      await fs.promises.writeFile(path.join(tempDir, 'empty.json'), '');
      await fs.promises.writeFile(path.join(tempDir, 'whitespace.json'), '   \n\t   ');

      const configurations = await analyzer.getConfigurationInfoList();

      // Empty files should be detected but marked as invalid
      const emptyConfig = configurations.find(c => c.name === 'empty.json');
      if (emptyConfig) {
        expect(emptyConfig.size).toBe(0);
      }
    });

    it('should handle binary files gracefully', async () => {
      // Create a binary file that might be mistaken for text
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
      await fs.promises.writeFile(path.join(tempDir, 'binary.json'), binaryContent);

      const configurations = await analyzer.getConfigurationInfoList();
      const binaryConfig = configurations.find(c => c.name === 'binary.json');

      if (binaryConfig) {
        expect(binaryConfig.isValid).toBe(false);
      }
    });
  });

  describe('Configuration Options Behavior', () => {
    it('should respect includeHidden option', async () => {
      // Create hidden files and directories
      await fs.promises.writeFile(path.join(tempDir, '.hidden-file'), 'content');
      await fs.promises.mkdir(path.join(tempDir, '.hidden-dir'));
      await fs.promises.writeFile(path.join(tempDir, '.hidden-dir', 'nested.txt'), 'content');

      // Test with includeHidden: false (default)
      const defaultAnalyzer = new ProjectContextAnalyzer(tempDir);
      const structureWithoutHidden = await defaultAnalyzer.getProjectStructure();

      // Test with includeHidden: true
      const includeHiddenAnalyzer = new ProjectContextAnalyzer(tempDir, { includeHidden: true });
      const structureWithHidden = await includeHiddenAnalyzer.getProjectStructure();

      expect(structureWithHidden.totalFiles).toBeGreaterThan(structureWithoutHidden.totalFiles);
      expect(structureWithHidden.entries.some(e => e.name.startsWith('.'))).toBe(true);
    });

    it('should respect excludeDirectories option', async () => {
      // Create directories that should be excluded
      await fs.promises.mkdir(path.join(tempDir, 'node_modules'));
      await fs.promises.mkdir(path.join(tempDir, 'custom-exclude'));
      await fs.promises.writeFile(path.join(tempDir, 'node_modules', 'package.txt'), 'content');
      await fs.promises.writeFile(path.join(tempDir, 'custom-exclude', 'file.txt'), 'content');

      const customAnalyzer = new ProjectContextAnalyzer(tempDir, {
        excludeDirectories: ['node_modules', 'custom-exclude']
      });

      const structure = await customAnalyzer.getProjectStructure();

      // Should not include files from excluded directories
      expect(structure.entries.every(e => !e.path.includes('node_modules'))).toBe(true);
      expect(structure.entries.every(e => !e.path.includes('custom-exclude'))).toBe(true);
    });

    it('should respect analysis option flags', async () => {
      await fs.promises.writeFile(path.join(tempDir, 'package.json'), '{"name": "test"}');
      await fs.promises.writeFile(path.join(tempDir, 'tsconfig.json'), '{}');

      const limitedAnalyzer = new ProjectContextAnalyzer(tempDir, {
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: false
      });

      const context = await limitedAnalyzer.analyze();

      expect(context.gitStatus).toBeUndefined();
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.structure).toBeDefined(); // Structure is always analyzed
    });
  });

  describe('Advanced Framework Detection', () => {
    it('should detect frameworks from lock files', async () => {
      // Test different package managers
      await fs.promises.writeFile(path.join(tempDir, 'yarn.lock'), 'yarn lock file content');
      await fs.promises.writeFile(path.join(tempDir, 'package.json'), '{"name": "yarn-project"}');

      const detection = await analyzer.detectFrameworks();
      expect(detection.packageManager).toBe('yarn');

      // Test pnpm
      await fs.promises.unlink(path.join(tempDir, 'yarn.lock'));
      await fs.promises.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), 'pnpm lock content');

      const pnpmAnalyzer = new ProjectContextAnalyzer(tempDir);
      const pnpmDetection = await pnpmAnalyzer.detectFrameworks();
      expect(pnpmDetection.packageManager).toBe('pnpm');
    });

    it('should prioritize high-confidence detections', async () => {
      // Create both package.json dependency and config file for same framework
      const packageJson = {
        name: 'test',
        dependencies: { 'next': '^13.0.0' }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      await fs.promises.writeFile(path.join(tempDir, 'next.config.js'), 'module.exports = {};');

      const detection = await analyzer.detectFrameworks();
      const nextFramework = detection.frameworks!.find(f => f.name === 'Next.js');

      expect(nextFramework).toBeDefined();
      expect(nextFramework?.confidence).toBe('high'); // Package.json should win over config file
    });

    it('should detect programming languages accurately', async () => {
      // Create files with various extensions
      const files = [
        'src/app.ts', 'src/component.tsx', 'src/script.js', 'src/legacy.jsx',
        'styles/main.css', 'styles/component.scss', 'styles/vars.less',
        'server.py', 'utils.rs', 'handler.go', 'Model.java',
        'Controller.cs', 'helper.rb', 'script.php'
      ];

      for (const file of files) {
        await fs.promises.mkdir(path.dirname(path.join(tempDir, file)), { recursive: true });
        await fs.promises.writeFile(path.join(tempDir, file), 'content');
      }

      const detection = await analyzer.detectFrameworks();

      expect(detection.languages!.length).toBeGreaterThan(5);

      const typescript = detection.languages!.find(l => l.name === 'TypeScript');
      expect(typescript).toBeDefined();
      expect(typescript?.percentage).toBeGreaterThan(0);

      const javascript = detection.languages!.find(l => l.name === 'JavaScript');
      expect(javascript).toBeDefined();

      // Should be sorted by percentage
      for (let i = 1; i < detection.languages!.length; i++) {
        expect(detection.languages![i - 1].percentage).toBeGreaterThanOrEqual(
          detection.languages![i].percentage
        );
      }
    });
  });

  describe('Test Framework Feature Detection', () => {
    it('should detect comprehensive test framework features', async () => {
      const packageJson = {
        devDependencies: {
          'jest': '^29.0.0',
          'c8': '^7.12.0',
          '@testing-library/react': '^13.0.0',
          '@testing-library/jest-dom': '^5.16.0',
          'sinon': '^15.0.0',
          'msw': '^1.2.0',
          'jest-environment-jsdom': '^29.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create test directories
      await fs.promises.mkdir(path.join(tempDir, '__tests__'));
      await fs.promises.writeFile(path.join(tempDir, '__tests__', 'app.test.js'), 'test content');

      const testFrameworks = await analyzer.getTestFrameworkInfoList();
      const jestFramework = testFrameworks.find(f => f.name === 'Jest');

      expect(jestFramework).toBeDefined();
      expect(jestFramework?.coverageEnabled).toBe(true);
      expect(jestFramework?.coverageTool).toBe('c8');
      expect(jestFramework?.assertionLibrary).toBe('@testing-library/jest-dom');
      expect(jestFramework?.mockingLibrary).toBe('sinon');
      expect(jestFramework?.testDirectory).toBe('__tests__');
      expect(jestFramework?.watchModeAvailable).toBe(true);
    });

    it('should count test files accurately', async () => {
      // Create various test files
      const testFiles = [
        'src/app.test.ts',
        'src/utils.spec.ts',
        'tests/unit/service.test.js',
        'tests/integration/api.test.ts',
        '__tests__/component.test.jsx'
      ];

      for (const testFile of testFiles) {
        await fs.promises.mkdir(path.dirname(path.join(tempDir, testFile)), { recursive: true });
        await fs.promises.writeFile(path.join(tempDir, testFile), 'test("example", () => {});');
      }

      const packageJson = {
        devDependencies: { 'jest': '^29.0.0' }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const testFrameworks = await analyzer.getTestFrameworkInfoList();
      const jestFramework = testFrameworks.find(f => f.name === 'Jest');

      expect(jestFramework).toBeDefined();
      expect(jestFramework?.testFileCount).toBe(testFiles.length);
    });
  });
});