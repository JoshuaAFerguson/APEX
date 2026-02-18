import { describe, it, expect } from 'vitest';
import {
  GitStatus,
  GitStatusSchema,
  ProjectStructure,
  ProjectStructureSchema,
  FrameworkInfo,
  FrameworkInfoSchema,
  ConfigurationInfo,
  ConfigurationInfoSchema,
  TestFrameworkInfo,
  TestFrameworkInfoSchema,
  ProjectContext,
  ProjectContextSchema,
} from '../types';

describe('Project Context Types (v0.6.0)', () => {
  describe('GitStatus type and schema', () => {
    it('should handle basic git repository status', () => {
      const basicGitStatus: GitStatus = {
        isRepository: true,
        branch: 'main',
        remoteBranch: 'origin/main',
        hasUncommittedChanges: false,
        hasUntrackedFiles: false,
        isClean: true,
        ahead: 0,
        behind: 0,
      };

      expect(basicGitStatus.isRepository).toBe(true);
      expect(basicGitStatus.branch).toBe('main');
      expect(basicGitStatus.remoteBranch).toBe('origin/main');
      expect(basicGitStatus.hasUncommittedChanges).toBe(false);
      expect(basicGitStatus.isClean).toBe(true);

      // Should pass schema validation
      const result = GitStatusSchema.parse(basicGitStatus);
      expect(result).toEqual(basicGitStatus);
    });

    it('should handle non-git directory', () => {
      const nonGitStatus: GitStatus = {
        isRepository: false,
      };

      expect(nonGitStatus.isRepository).toBe(false);
      expect(nonGitStatus.branch).toBeUndefined();
      expect(nonGitStatus.remoteBranch).toBeUndefined();

      // Should pass schema validation
      const result = GitStatusSchema.parse(nonGitStatus);
      expect(result).toEqual(nonGitStatus);
    });

    it('should handle dirty git repository', () => {
      const dirtyGitStatus: GitStatus = {
        isRepository: true,
        branch: 'feature/test-implementation',
        remoteBranch: 'origin/feature/test-implementation',
        hasUncommittedChanges: true,
        hasUntrackedFiles: true,
        isClean: false,
        ahead: 3,
        behind: 1,
        lastCommitHash: 'abc123def456ghi789',
        lastCommitMessage: 'Add new feature implementation',
        lastCommitAuthor: 'Developer Name',
        lastCommitDate: new Date('2024-01-15T10:30:00Z'),
      };

      expect(dirtyGitStatus.isRepository).toBe(true);
      expect(dirtyGitStatus.hasUncommittedChanges).toBe(true);
      expect(dirtyGitStatus.hasUntrackedFiles).toBe(true);
      expect(dirtyGitStatus.isClean).toBe(false);
      expect(dirtyGitStatus.ahead).toBe(3);
      expect(dirtyGitStatus.behind).toBe(1);
      expect(dirtyGitStatus.lastCommitHash).toBe('abc123def456ghi789');

      const result = GitStatusSchema.parse(dirtyGitStatus);
      expect(result).toEqual(dirtyGitStatus);
    });

    it('should validate required fields', () => {
      // isRepository is required
      expect(() => GitStatusSchema.parse({})).toThrow();

      // Valid minimal object should pass
      expect(() => GitStatusSchema.parse({ isRepository: false })).not.toThrow();
      expect(() => GitStatusSchema.parse({ isRepository: true })).not.toThrow();
    });

    it('should validate field types', () => {
      // Boolean fields
      expect(() => GitStatusSchema.parse({ isRepository: 'true' })).toThrow();
      expect(() => GitStatusSchema.parse({ isRepository: true, hasUncommittedChanges: 'false' })).toThrow();

      // Number fields
      expect(() => GitStatusSchema.parse({ isRepository: true, ahead: '5' })).toThrow();
      expect(() => GitStatusSchema.parse({ isRepository: true, behind: 'two' })).toThrow();

      // String fields
      expect(() => GitStatusSchema.parse({ isRepository: true, branch: 123 })).toThrow();
    });
  });

  describe('ProjectStructure type and schema', () => {
    it('should handle basic project structure', () => {
      const basicStructure: ProjectStructure = {
        root: '/path/to/project',
        totalFiles: 150,
        totalDirectories: 25,
        sizeInBytes: 2048000,
        primaryLanguages: ['typescript', 'javascript'],
        packageManager: 'npm',
      };

      expect(basicStructure.root).toBe('/path/to/project');
      expect(basicStructure.totalFiles).toBe(150);
      expect(basicStructure.totalDirectories).toBe(25);
      expect(basicStructure.sizeInBytes).toBe(2048000);
      expect(basicStructure.primaryLanguages).toEqual(['typescript', 'javascript']);
      expect(basicStructure.packageManager).toBe('npm');

      const result = ProjectStructureSchema.parse(basicStructure);
      expect(result).toEqual(basicStructure);
    });

    it('should handle minimal project structure', () => {
      const minimalStructure: ProjectStructure = {
        root: '/simple/project',
        totalFiles: 5,
        totalDirectories: 2,
        primaryLanguages: ['python'],
      };

      expect(minimalStructure.root).toBe('/simple/project');
      expect(minimalStructure.totalFiles).toBe(5);
      expect(minimalStructure.primaryLanguages).toEqual(['python']);

      const result = ProjectStructureSchema.parse(minimalStructure);
      expect(result).toEqual(minimalStructure);
    });

    it('should validate required fields', () => {
      // All fields except sizeInBytes and packageManager are required
      expect(() => ProjectStructureSchema.parse({})).toThrow();

      // Missing root
      expect(() => ProjectStructureSchema.parse({
        totalFiles: 10,
        totalDirectories: 2,
        primaryLanguages: ['js'],
      })).toThrow();

      // Missing totalFiles
      expect(() => ProjectStructureSchema.parse({
        root: '/test',
        totalDirectories: 2,
        primaryLanguages: ['js'],
      })).toThrow();
    });

    it('should validate field types and constraints', () => {
      // Root must be non-empty string
      expect(() => ProjectStructureSchema.parse({
        root: '',
        totalFiles: 10,
        totalDirectories: 2,
        primaryLanguages: ['js'],
      })).toThrow();

      // Numbers must be non-negative
      expect(() => ProjectStructureSchema.parse({
        root: '/test',
        totalFiles: -1,
        totalDirectories: 2,
        primaryLanguages: ['js'],
      })).toThrow();

      expect(() => ProjectStructureSchema.parse({
        root: '/test',
        totalFiles: 10,
        totalDirectories: -1,
        primaryLanguages: ['js'],
      })).toThrow();

      // primaryLanguages must be array of non-empty strings
      expect(() => ProjectStructureSchema.parse({
        root: '/test',
        totalFiles: 10,
        totalDirectories: 2,
        primaryLanguages: [''],
      })).toThrow();

      expect(() => ProjectStructureSchema.parse({
        root: '/test',
        totalFiles: 10,
        totalDirectories: 2,
        primaryLanguages: 'javascript',
      })).toThrow();
    });
  });

  describe('FrameworkInfo type and schema', () => {
    it('should handle frontend framework', () => {
      const reactFramework: FrameworkInfo = {
        name: 'React',
        version: '18.2.0',
        category: 'frontend',
        configFiles: ['package.json'],
        isMainFramework: true,
      };

      expect(reactFramework.name).toBe('React');
      expect(reactFramework.version).toBe('18.2.0');
      expect(reactFramework.category).toBe('frontend');
      expect(reactFramework.configFiles).toEqual(['package.json']);
      expect(reactFramework.isMainFramework).toBe(true);

      const result = FrameworkInfoSchema.parse(reactFramework);
      expect(result).toEqual(reactFramework);
    });

    it('should handle backend framework', () => {
      const expressFramework: FrameworkInfo = {
        name: 'Express',
        version: '4.18.2',
        category: 'backend',
        configFiles: ['package.json', 'app.js'],
        isMainFramework: false,
        features: ['routing', 'middleware', 'templating'],
      };

      expect(expressFramework.name).toBe('Express');
      expect(expressFramework.category).toBe('backend');
      expect(expressFramework.features).toEqual(['routing', 'middleware', 'templating']);

      const result = FrameworkInfoSchema.parse(expressFramework);
      expect(result).toEqual(expressFramework);
    });

    it('should handle testing framework', () => {
      const vitestFramework: FrameworkInfo = {
        name: 'Vitest',
        version: '1.2.0',
        category: 'testing',
        configFiles: ['vitest.config.ts'],
        isMainFramework: true,
      };

      expect(vitestFramework.category).toBe('testing');

      const result = FrameworkInfoSchema.parse(vitestFramework);
      expect(result).toEqual(vitestFramework);
    });

    it('should validate required fields', () => {
      // name, version, and category are required
      expect(() => FrameworkInfoSchema.parse({})).toThrow();

      expect(() => FrameworkInfoSchema.parse({
        version: '1.0.0',
        category: 'frontend',
      })).toThrow();

      expect(() => FrameworkInfoSchema.parse({
        name: 'React',
        category: 'frontend',
      })).toThrow();

      expect(() => FrameworkInfoSchema.parse({
        name: 'React',
        version: '18.0.0',
      })).toThrow();
    });

    it('should validate category enum values', () => {
      const validCategories = ['frontend', 'backend', 'fullstack', 'testing', 'build', 'css', 'database', 'other'];

      for (const category of validCategories) {
        expect(() => FrameworkInfoSchema.parse({
          name: 'Test',
          version: '1.0.0',
          category,
        })).not.toThrow();
      }

      expect(() => FrameworkInfoSchema.parse({
        name: 'Test',
        version: '1.0.0',
        category: 'invalid-category',
      })).toThrow();
    });

    it('should validate array fields', () => {
      // configFiles should be array of strings
      expect(() => FrameworkInfoSchema.parse({
        name: 'Test',
        version: '1.0.0',
        category: 'frontend',
        configFiles: 'single-file.json',
      })).toThrow();

      expect(() => FrameworkInfoSchema.parse({
        name: 'Test',
        version: '1.0.0',
        category: 'frontend',
        configFiles: ['valid.json', 123],
      })).toThrow();
    });
  });

  describe('ConfigurationInfo type and schema', () => {
    it('should handle TypeScript config', () => {
      const tsConfig: ConfigurationInfo = {
        name: 'tsconfig.json',
        path: 'tsconfig.json',
        format: 'json',
        purpose: 'typescript',
        isValid: true,
      };

      expect(tsConfig.name).toBe('tsconfig.json');
      expect(tsConfig.path).toBe('tsconfig.json');
      expect(tsConfig.format).toBe('json');
      expect(tsConfig.purpose).toBe('typescript');
      expect(tsConfig.isValid).toBe(true);

      const result = ConfigurationInfoSchema.parse(tsConfig);
      expect(result).toEqual(tsConfig);
    });

    it('should handle package.json with validation errors', () => {
      const packageJson: ConfigurationInfo = {
        name: 'package.json',
        path: './package.json',
        format: 'json',
        purpose: 'package-manager',
        isValid: false,
        validationErrors: ['Missing required field: description', 'Invalid version format'],
        content: {
          name: 'my-project',
          version: 'invalid',
        },
      };

      expect(packageJson.isValid).toBe(false);
      expect(packageJson.validationErrors).toEqual([
        'Missing required field: description',
        'Invalid version format',
      ]);
      expect(packageJson.content).toEqual({
        name: 'my-project',
        version: 'invalid',
      });

      const result = ConfigurationInfoSchema.parse(packageJson);
      expect(result).toEqual(packageJson);
    });

    it('should handle YAML configuration', () => {
      const yamlConfig: ConfigurationInfo = {
        name: 'docker-compose.yml',
        path: 'docker/docker-compose.yml',
        format: 'yaml',
        purpose: 'containerization',
        isValid: true,
      };

      expect(yamlConfig.format).toBe('yaml');
      expect(yamlConfig.purpose).toBe('containerization');

      const result = ConfigurationInfoSchema.parse(yamlConfig);
      expect(result).toEqual(yamlConfig);
    });

    it('should validate required fields', () => {
      // name, path, format are required
      expect(() => ConfigurationInfoSchema.parse({})).toThrow();

      expect(() => ConfigurationInfoSchema.parse({
        path: 'test.json',
        format: 'json',
      })).toThrow();

      expect(() => ConfigurationInfoSchema.parse({
        name: 'test.json',
        format: 'json',
      })).toThrow();

      expect(() => ConfigurationInfoSchema.parse({
        name: 'test.json',
        path: 'test.json',
      })).toThrow();
    });

    it('should validate format enum values', () => {
      const validFormats = ['json', 'yaml', 'toml', 'xml', 'ini', 'env', 'js', 'ts', 'other'];

      for (const format of validFormats) {
        expect(() => ConfigurationInfoSchema.parse({
          name: 'test',
          path: 'test',
          format,
        })).not.toThrow();
      }

      expect(() => ConfigurationInfoSchema.parse({
        name: 'test',
        path: 'test',
        format: 'invalid-format',
      })).toThrow();
    });

    it('should validate array fields', () => {
      // validationErrors should be array of strings
      expect(() => ConfigurationInfoSchema.parse({
        name: 'test',
        path: 'test',
        format: 'json',
        validationErrors: 'single error',
      })).toThrow();

      expect(() => ConfigurationInfoSchema.parse({
        name: 'test',
        path: 'test',
        format: 'json',
        validationErrors: ['valid error', 123],
      })).toThrow();
    });
  });

  describe('TestFrameworkInfo type and schema', () => {
    it('should handle unit testing framework', () => {
      const vitestFramework: TestFrameworkInfo = {
        name: 'vitest',
        version: '1.2.0',
        type: 'unit',
        configFiles: ['vitest.config.ts'],
        isActive: true,
      };

      expect(vitestFramework.name).toBe('vitest');
      expect(vitestFramework.version).toBe('1.2.0');
      expect(vitestFramework.type).toBe('unit');
      expect(vitestFramework.configFiles).toEqual(['vitest.config.ts']);
      expect(vitestFramework.isActive).toBe(true);

      const result = TestFrameworkInfoSchema.parse(vitestFramework);
      expect(result).toEqual(vitestFramework);
    });

    it('should handle integration testing framework', () => {
      const playwrightFramework: TestFrameworkInfo = {
        name: 'playwright',
        version: '1.40.0',
        type: 'integration',
        configFiles: ['playwright.config.ts'],
        isActive: true,
        features: ['browser-automation', 'cross-browser', 'headless'],
        testPatterns: ['**/*.spec.ts', '**/*.test.ts'],
      };

      expect(playwrightFramework.type).toBe('integration');
      expect(playwrightFramework.features).toEqual([
        'browser-automation',
        'cross-browser',
        'headless',
      ]);
      expect(playwrightFramework.testPatterns).toEqual(['**/*.spec.ts', '**/*.test.ts']);

      const result = TestFrameworkInfoSchema.parse(playwrightFramework);
      expect(result).toEqual(playwrightFramework);
    });

    it('should handle e2e testing framework', () => {
      const cypressFramework: TestFrameworkInfo = {
        name: 'cypress',
        version: '13.6.0',
        type: 'e2e',
        configFiles: ['cypress.config.js'],
        isActive: false,
        features: ['visual-testing', 'time-travel-debugging'],
      };

      expect(cypressFramework.type).toBe('e2e');
      expect(cypressFramework.isActive).toBe(false);

      const result = TestFrameworkInfoSchema.parse(cypressFramework);
      expect(result).toEqual(cypressFramework);
    });

    it('should validate required fields', () => {
      // name, version, type are required
      expect(() => TestFrameworkInfoSchema.parse({})).toThrow();

      expect(() => TestFrameworkInfoSchema.parse({
        version: '1.0.0',
        type: 'unit',
      })).toThrow();

      expect(() => TestFrameworkInfoSchema.parse({
        name: 'vitest',
        type: 'unit',
      })).toThrow();

      expect(() => TestFrameworkInfoSchema.parse({
        name: 'vitest',
        version: '1.0.0',
      })).toThrow();
    });

    it('should validate type enum values', () => {
      const validTypes = ['unit', 'integration', 'e2e', 'performance', 'visual', 'api', 'other'];

      for (const type of validTypes) {
        expect(() => TestFrameworkInfoSchema.parse({
          name: 'test-framework',
          version: '1.0.0',
          type,
        })).not.toThrow();
      }

      expect(() => TestFrameworkInfoSchema.parse({
        name: 'test-framework',
        version: '1.0.0',
        type: 'invalid-type',
      })).toThrow();
    });

    it('should validate array fields', () => {
      // configFiles, features, testPatterns should be arrays of strings
      expect(() => TestFrameworkInfoSchema.parse({
        name: 'test',
        version: '1.0.0',
        type: 'unit',
        configFiles: 'single-config.js',
      })).toThrow();

      expect(() => TestFrameworkInfoSchema.parse({
        name: 'test',
        version: '1.0.0',
        type: 'unit',
        features: 'single-feature',
      })).toThrow();

      expect(() => TestFrameworkInfoSchema.parse({
        name: 'test',
        version: '1.0.0',
        type: 'unit',
        testPatterns: '**/*.test.js',
      })).toThrow();
    });
  });

  describe('ProjectContext aggregate type and schema', () => {
    it('should handle complete project context', () => {
      const fullContext: ProjectContext = {
        gitStatus: {
          isRepository: true,
          branch: 'feature/project-context',
          remoteBranch: 'origin/feature/project-context',
          hasUncommittedChanges: false,
          hasUntrackedFiles: false,
          isClean: true,
          ahead: 0,
          behind: 0,
        },
        structure: {
          root: '/apex/project',
          totalFiles: 250,
          totalDirectories: 50,
          sizeInBytes: 5242880,
          primaryLanguages: ['typescript', 'javascript'],
          packageManager: 'npm',
        },
        frameworks: [
          {
            name: 'React',
            version: '18.2.0',
            category: 'frontend',
            configFiles: ['package.json'],
            isMainFramework: true,
          },
          {
            name: 'Express',
            version: '4.18.2',
            category: 'backend',
            configFiles: ['package.json', 'server.js'],
            isMainFramework: false,
          },
        ],
        configurations: [
          {
            name: 'tsconfig.json',
            path: 'tsconfig.json',
            format: 'json',
            purpose: 'typescript',
            isValid: true,
          },
          {
            name: 'package.json',
            path: 'package.json',
            format: 'json',
            purpose: 'package-manager',
            isValid: true,
          },
        ],
        testFrameworks: [
          {
            name: 'vitest',
            version: '1.2.0',
            type: 'unit',
            configFiles: ['vitest.config.ts'],
            isActive: true,
          },
        ],
        detectedAt: new Date('2024-01-15T14:30:00Z'),
      };

      expect(fullContext.gitStatus?.branch).toBe('feature/project-context');
      expect(fullContext.structure?.totalFiles).toBe(250);
      expect(fullContext.frameworks).toHaveLength(2);
      expect(fullContext.configurations).toHaveLength(2);
      expect(fullContext.testFrameworks).toHaveLength(1);
      expect(fullContext.detectedAt).toBeInstanceOf(Date);

      const result = ProjectContextSchema.parse(fullContext);
      expect(result).toEqual(fullContext);
    });

    it('should handle minimal project context', () => {
      const minimalContext: ProjectContext = {};

      expect(minimalContext.gitStatus).toBeUndefined();
      expect(minimalContext.structure).toBeUndefined();
      expect(minimalContext.frameworks).toBeUndefined();
      expect(minimalContext.configurations).toBeUndefined();
      expect(minimalContext.testFrameworks).toBeUndefined();

      const result = ProjectContextSchema.parse(minimalContext);
      expect(result.frameworks).toEqual([]);
      expect(result.configurations).toEqual([]);
      expect(result.testFrameworks).toEqual([]);
    });

    it('should handle project context without git', () => {
      const noGitContext: ProjectContext = {
        structure: {
          root: '/simple/project',
          totalFiles: 10,
          totalDirectories: 3,
          primaryLanguages: ['python'],
        },
        frameworks: [
          {
            name: 'FastAPI',
            version: '0.104.1',
            category: 'backend',
            configFiles: ['requirements.txt'],
            isMainFramework: true,
          },
        ],
        testFrameworks: [
          {
            name: 'pytest',
            version: '7.4.0',
            type: 'unit',
            configFiles: ['pytest.ini'],
            isActive: true,
          },
        ],
      };

      expect(noGitContext.gitStatus).toBeUndefined();
      expect(noGitContext.structure?.primaryLanguages).toEqual(['python']);
      expect(noGitContext.frameworks?.[0]?.name).toBe('FastAPI');

      const result = ProjectContextSchema.parse(noGitContext);
      expect(result).toEqual({
        ...noGitContext,
        configurations: [],
      });
    });

    it('should validate nested schema constraints', () => {
      // Invalid gitStatus should fail
      expect(() => ProjectContextSchema.parse({
        gitStatus: {
          // Missing required isRepository field
          branch: 'main',
        },
      })).toThrow();

      // Invalid structure should fail
      expect(() => ProjectContextSchema.parse({
        structure: {
          // Missing required totalFiles field
          root: '/test',
          totalDirectories: 5,
          primaryLanguages: ['js'],
        },
      })).toThrow();

      // Invalid framework should fail
      expect(() => ProjectContextSchema.parse({
        frameworks: [
          {
            name: 'React',
            // Missing required version and category
          },
        ],
      })).toThrow();
    });

    it('should apply default values for array fields', () => {
      const contextWithDefaults = ProjectContextSchema.parse({
        structure: {
          root: '/test',
          totalFiles: 10,
          totalDirectories: 2,
          primaryLanguages: ['js'],
        },
      });

      expect(contextWithDefaults.frameworks).toEqual([]);
      expect(contextWithDefaults.configurations).toEqual([]);
      expect(contextWithDefaults.testFrameworks).toEqual([]);
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should support typical web application context', () => {
      const webAppContext: ProjectContext = {
        gitStatus: {
          isRepository: true,
          branch: 'develop',
          remoteBranch: 'origin/develop',
          hasUncommittedChanges: true,
          hasUntrackedFiles: false,
          isClean: false,
          ahead: 2,
          behind: 0,
        },
        structure: {
          root: '/Users/developer/projects/my-web-app',
          totalFiles: 523,
          totalDirectories: 89,
          sizeInBytes: 15728640,
          primaryLanguages: ['typescript', 'css', 'html'],
          packageManager: 'pnpm',
        },
        frameworks: [
          {
            name: 'Next.js',
            version: '14.0.0',
            category: 'fullstack',
            configFiles: ['next.config.js', 'package.json'],
            isMainFramework: true,
            features: ['ssr', 'api-routes', 'image-optimization'],
          },
          {
            name: 'Tailwind CSS',
            version: '3.3.0',
            category: 'css',
            configFiles: ['tailwind.config.js', 'postcss.config.js'],
            isMainFramework: false,
          },
        ],
        configurations: [
          {
            name: 'tsconfig.json',
            path: 'tsconfig.json',
            format: 'json',
            purpose: 'typescript',
            isValid: true,
          },
          {
            name: 'package.json',
            path: 'package.json',
            format: 'json',
            purpose: 'package-manager',
            isValid: true,
          },
          {
            name: '.env.local',
            path: '.env.local',
            format: 'env',
            purpose: 'environment',
            isValid: true,
          },
        ],
        testFrameworks: [
          {
            name: 'vitest',
            version: '1.0.0',
            type: 'unit',
            configFiles: ['vitest.config.ts'],
            isActive: true,
            features: ['coverage', 'mocking'],
            testPatterns: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
          },
          {
            name: 'playwright',
            version: '1.40.0',
            type: 'e2e',
            configFiles: ['playwright.config.ts'],
            isActive: true,
            features: ['browser-testing', 'visual-regression'],
          },
        ],
        detectedAt: new Date(),
      };

      const result = ProjectContextSchema.parse(webAppContext);
      expect(result).toEqual(webAppContext);
      expect(result.frameworks).toHaveLength(2);
      expect(result.testFrameworks).toHaveLength(2);
      expect(result.structure?.packageManager).toBe('pnpm');
    });

    it('should support CLI/library project context', () => {
      const cliContext: ProjectContext = {
        gitStatus: {
          isRepository: true,
          branch: 'main',
          hasUncommittedChanges: false,
          hasUntrackedFiles: false,
          isClean: true,
          ahead: 0,
          behind: 0,
        },
        structure: {
          root: '/projects/apex-cli',
          totalFiles: 127,
          totalDirectories: 23,
          sizeInBytes: 3145728,
          primaryLanguages: ['typescript'],
          packageManager: 'npm',
        },
        frameworks: [
          {
            name: 'Commander.js',
            version: '11.1.0',
            category: 'other',
            configFiles: ['package.json'],
            isMainFramework: true,
          },
        ],
        configurations: [
          {
            name: 'tsconfig.json',
            path: 'tsconfig.json',
            format: 'json',
            purpose: 'typescript',
            isValid: true,
          },
          {
            name: 'package.json',
            path: 'package.json',
            format: 'json',
            purpose: 'package-manager',
            isValid: true,
          },
        ],
        testFrameworks: [
          {
            name: 'vitest',
            version: '1.1.0',
            type: 'unit',
            configFiles: ['vitest.config.ts'],
            isActive: true,
          },
        ],
      };

      const result = ProjectContextSchema.parse(cliContext);
      expect(result.structure?.primaryLanguages).toEqual(['typescript']);
      expect(result.frameworks?.[0]?.name).toBe('Commander.js');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty arrays gracefully', () => {
      const contextWithEmptyArrays: ProjectContext = {
        frameworks: [],
        configurations: [],
        testFrameworks: [],
      };

      const result = ProjectContextSchema.parse(contextWithEmptyArrays);
      expect(result.frameworks).toEqual([]);
      expect(result.configurations).toEqual([]);
      expect(result.testFrameworks).toEqual([]);
    });

    it('should handle large numbers appropriately', () => {
      const contextWithLargeNumbers: ProjectContext = {
        structure: {
          root: '/huge/monorepo',
          totalFiles: 50000,
          totalDirectories: 5000,
          sizeInBytes: 1073741824, // 1GB
          primaryLanguages: ['typescript', 'javascript', 'rust', 'go', 'python'],
        },
      };

      const result = ProjectContextSchema.parse(contextWithLargeNumbers);
      expect(result.structure?.totalFiles).toBe(50000);
      expect(result.structure?.sizeInBytes).toBe(1073741824);
    });

    it('should validate complex nested structures', () => {
      const complexContext = {
        gitStatus: {
          isRepository: true,
          branch: 'feature/complex',
          hasUncommittedChanges: false,
          hasUntrackedFiles: false,
          isClean: true,
          ahead: 0,
          behind: 0,
          lastCommitHash: 'a'.repeat(40),
          lastCommitMessage: 'Very long commit message '.repeat(10),
          lastCommitAuthor: 'Developer with Long Name',
          lastCommitDate: new Date(),
        },
        structure: {
          root: '/very/deeply/nested/project/structure/that/has/many/levels',
          totalFiles: 999999,
          totalDirectories: 99999,
          sizeInBytes: Number.MAX_SAFE_INTEGER,
          primaryLanguages: Array.from({ length: 20 }, (_, i) => `language${i}`),
          packageManager: 'yarn',
        },
        frameworks: Array.from({ length: 10 }, (_, i) => ({
          name: `Framework${i}`,
          version: `${i}.0.0`,
          category: 'other' as const,
          configFiles: [`config${i}.json`],
          isMainFramework: i === 0,
          features: [`feature${i}a`, `feature${i}b`],
        })),
      };

      expect(() => ProjectContextSchema.parse(complexContext)).not.toThrow();
    });
  });

  describe('Type inference and compatibility', () => {
    it('should maintain proper TypeScript type inference', () => {
      // Test that types can be properly inferred
      const inferredContext = {
        gitStatus: {
          isRepository: true,
          branch: 'main',
          hasUncommittedChanges: false,
          hasUntrackedFiles: false,
          isClean: true,
          ahead: 0,
          behind: 0,
        },
        structure: {
          root: '/inferred',
          totalFiles: 100,
          totalDirectories: 10,
          primaryLanguages: ['typescript'],
        },
      };

      // Should be assignable to ProjectContext
      const typedContext: ProjectContext = inferredContext;
      expect(typedContext.gitStatus?.branch).toBe('main');
    });

    it('should support partial updates', () => {
      const baseContext: ProjectContext = {
        structure: {
          root: '/base',
          totalFiles: 50,
          totalDirectories: 5,
          primaryLanguages: ['javascript'],
        },
      };

      const update: Partial<ProjectContext> = {
        gitStatus: {
          isRepository: true,
          branch: 'feature',
          hasUncommittedChanges: false,
          hasUntrackedFiles: false,
          isClean: true,
          ahead: 0,
          behind: 0,
        },
      };

      const mergedContext: ProjectContext = { ...baseContext, ...update };
      expect(mergedContext.gitStatus?.branch).toBe('feature');
      expect(mergedContext.structure?.root).toBe('/base');
    });
  });
});