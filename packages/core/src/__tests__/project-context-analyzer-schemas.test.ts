/**
 * Comprehensive tests for ProjectContextAnalyzer Zod schemas
 * Tests all schema validation edge cases, error conditions, and boundary values
 */

import { describe, it, expect } from 'vitest';
import {
  GitStatus,
  GitStatusSchema,
  GitChangedFile,
  GitChangedFileSchema,
  GitFileStatus,
  GitFileStatusSchema,
  ProjectStructure,
  ProjectStructureSchema,
  ProjectEntry,
  ProjectEntrySchema,
  ProjectEntryType,
  ProjectEntryTypeSchema,
  FrameworkDetection,
  FrameworkDetectionSchema,
  FrameworkInfo,
  FrameworkInfoSchema,
  FrameworkCategory,
  FrameworkCategorySchema,
  DetectionConfidence,
  DetectionConfidenceSchema,
  ConfigurationInfo,
  ConfigurationInfoSchema,
  ConfigFormat,
  ConfigFormatSchema,
  ConfigPurpose,
  ConfigPurposeSchema,
  TestFrameworkInfo,
  TestFrameworkInfoSchema,
  TestRunnerType,
  TestRunnerTypeSchema,
  ProjectContext,
  ProjectContextSchema,
} from '../types.js';

describe('ProjectContextAnalyzer Schema Validation', () => {
  describe('GitFileStatusSchema', () => {
    it('should accept all valid git file statuses', () => {
      const validStatuses: GitFileStatus[] = ['M', 'A', 'D', 'R', 'C', 'U', '?', '!'];

      validStatuses.forEach(status => {
        expect(() => GitFileStatusSchema.parse(status)).not.toThrow();
      });
    });

    it('should reject invalid git file statuses', () => {
      const invalidStatuses = ['X', 'Y', 'modified', 'added', '', null, undefined, 1, {}, []];

      invalidStatuses.forEach(status => {
        expect(() => GitFileStatusSchema.parse(status)).toThrow();
      });
    });
  });

  describe('GitChangedFileSchema', () => {
    it('should validate complete git changed file', () => {
      const validFile: GitChangedFile = {
        path: 'src/index.ts',
        status: 'M',
        oldPath: 'src/old.ts',
      };

      expect(() => GitChangedFileSchema.parse(validFile)).not.toThrow();
    });

    it('should validate minimal git changed file', () => {
      const minimalFile: GitChangedFile = {
        path: 'src/file.js',
        status: 'A',
      };

      expect(() => GitChangedFileSchema.parse(minimalFile)).not.toThrow();
    });

    it('should reject empty path', () => {
      const invalidFile = {
        path: '',
        status: 'M',
      };

      expect(() => GitChangedFileSchema.parse(invalidFile)).toThrow();
    });

    it('should reject invalid status', () => {
      const invalidFile = {
        path: 'valid/path.ts',
        status: 'INVALID',
      };

      expect(() => GitChangedFileSchema.parse(invalidFile)).toThrow();
    });

    it('should handle various path formats', () => {
      const validPaths = [
        'simple.js',
        'path/to/file.ts',
        'very/deep/nested/path/to/file.tsx',
        'file with spaces.js',
        'file-with-dashes.ts',
        'file_with_underscores.tsx',
        '@scoped/package/file.js',
        'old.js -> new.js', // Rename format
        '中文文件.js', // Unicode
      ];

      validPaths.forEach(path => {
        const file = { path, status: 'M' as const };
        expect(() => GitChangedFileSchema.parse(file)).not.toThrow();
      });
    });
  });

  describe('GitStatusSchema', () => {
    it('should validate complete git status', () => {
      const completeStatus: GitStatus = {
        isRepository: true,
        branch: 'feature/new-feature',
        remoteBranch: 'origin/feature/new-feature',
        ahead: 3,
        behind: 1,
        staged: [
          { path: 'src/index.ts', status: 'M' },
          { path: 'src/new-file.ts', status: 'A' },
        ],
        unstaged: [
          { path: 'README.md', status: 'M' },
        ],
        untracked: ['temp.log', 'debug.txt'],
        hasConflicts: true,
        isDirty: true,
        lastCommitHash: 'abc1234',
        lastCommitMessage: 'Implement new feature',
        lastCommitTimestamp: new Date('2023-12-25T10:30:00Z'),
        stashCount: 2,
        remotes: [
          { name: 'origin', url: 'https://github.com/user/repo.git' },
          { name: 'upstream', url: 'https://github.com/original/repo.git' },
        ],
      };

      expect(() => GitStatusSchema.parse(completeStatus)).not.toThrow();
    });

    it('should apply default values correctly', () => {
      const minimalStatus = {
        isRepository: true,
        branch: 'main',
      };

      const parsed = GitStatusSchema.parse(minimalStatus);

      expect(parsed.ahead).toBe(0);
      expect(parsed.behind).toBe(0);
      expect(parsed.staged).toEqual([]);
      expect(parsed.unstaged).toEqual([]);
      expect(parsed.untracked).toEqual([]);
      expect(parsed.hasConflicts).toBe(false);
      expect(parsed.isDirty).toBe(false);
      expect(parsed.stashCount).toBe(0);
      expect(parsed.remotes).toEqual([]);
    });

    it('should handle null branch (detached HEAD)', () => {
      const detachedStatus = {
        isRepository: true,
        branch: null,
      };

      expect(() => GitStatusSchema.parse(detachedStatus)).not.toThrow();
    });

    it('should validate negative counts as invalid', () => {
      const invalidCounts = [
        { isRepository: true, branch: 'main', ahead: -1 },
        { isRepository: true, branch: 'main', behind: -1 },
        { isRepository: true, branch: 'main', stashCount: -1 },
      ];

      invalidCounts.forEach(status => {
        expect(() => GitStatusSchema.parse(status)).toThrow();
      });
    });

    it('should handle large numbers correctly', () => {
      const largeNumbers = {
        isRepository: true,
        branch: 'main',
        ahead: 9999,
        behind: 9999,
        stashCount: 100,
      };

      expect(() => GitStatusSchema.parse(largeNumbers)).not.toThrow();
    });

    it('should handle various remote URL formats', () => {
      const remoteFormats = [
        'https://github.com/user/repo.git',
        'git@github.com:user/repo.git',
        'https://gitlab.com/user/repo.git',
        'ssh://git@server.com:user/repo.git',
        'file:///local/path/to/repo',
      ];

      remoteFormats.forEach(url => {
        const status = {
          isRepository: true,
          branch: 'main',
          remotes: [{ name: 'origin', url }],
        };
        expect(() => GitStatusSchema.parse(status)).not.toThrow();
      });
    });
  });

  describe('ProjectEntryTypeSchema', () => {
    it('should accept valid entry types', () => {
      const validTypes: ProjectEntryType[] = ['file', 'directory'];

      validTypes.forEach(type => {
        expect(() => ProjectEntryTypeSchema.parse(type)).not.toThrow();
      });
    });

    it('should reject invalid entry types', () => {
      const invalidTypes = ['folder', 'link', 'symlink', '', null, undefined, 1];

      invalidTypes.forEach(type => {
        expect(() => ProjectEntryTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('ProjectEntrySchema', () => {
    it('should validate file entry', () => {
      const fileEntry: ProjectEntry = {
        name: 'index.ts',
        path: 'src/index.ts',
        type: 'file',
        size: 2048,
        modifiedAt: new Date('2023-12-25T10:30:00Z'),
      };

      expect(() => ProjectEntrySchema.parse(fileEntry)).not.toThrow();
    });

    it('should validate directory entry with children', () => {
      const directoryEntry: ProjectEntry = {
        name: 'src',
        path: 'src',
        type: 'directory',
        modifiedAt: new Date('2023-12-25T10:30:00Z'),
        children: [
          {
            name: 'index.ts',
            path: 'src/index.ts',
            type: 'file',
            size: 1024,
            modifiedAt: new Date('2023-12-25T10:30:00Z'),
          },
        ],
      };

      expect(() => ProjectEntrySchema.parse(directoryEntry)).not.toThrow();
    });

    it('should handle nested directory structures', () => {
      const nestedEntry: ProjectEntry = {
        name: 'root',
        path: 'root',
        type: 'directory',
        modifiedAt: new Date(),
        children: [
          {
            name: 'level1',
            path: 'root/level1',
            type: 'directory',
            modifiedAt: new Date(),
            children: [
              {
                name: 'level2',
                path: 'root/level1/level2',
                type: 'directory',
                modifiedAt: new Date(),
                children: [
                  {
                    name: 'deep-file.ts',
                    path: 'root/level1/level2/deep-file.ts',
                    type: 'file',
                    size: 512,
                    modifiedAt: new Date(),
                  },
                ],
              },
            ],
          },
        ],
      };

      expect(() => ProjectEntrySchema.parse(nestedEntry)).not.toThrow();
    });

    it('should reject empty name or path', () => {
      const invalidEntries = [
        { name: '', path: 'valid', type: 'file' },
        { name: 'valid', path: '', type: 'file' },
        { name: '', path: '', type: 'file' },
      ];

      invalidEntries.forEach(entry => {
        expect(() => ProjectEntrySchema.parse(entry)).toThrow();
      });
    });

    it('should handle zero file size', () => {
      const emptyFile = {
        name: 'empty.txt',
        path: 'empty.txt',
        type: 'file',
        size: 0,
      };

      expect(() => ProjectEntrySchema.parse(emptyFile)).not.toThrow();
    });

    it('should reject negative file size', () => {
      const invalidFile = {
        name: 'invalid.txt',
        path: 'invalid.txt',
        type: 'file',
        size: -100,
      };

      expect(() => ProjectEntrySchema.parse(invalidFile)).toThrow();
    });
  });

  describe('ProjectStructureSchema', () => {
    it('should validate complete project structure', () => {
      const completeStructure: ProjectStructure = {
        root: '/project/root',
        totalFiles: 50,
        totalDirectories: 10,
        entries: [
          {
            name: 'src',
            path: 'src',
            type: 'directory',
            modifiedAt: new Date(),
            children: [],
          },
        ],
        rootFiles: ['package.json', '.gitignore', 'README.md'],
        commonDirectories: ['src', 'lib', 'test'],
        hasPackageJson: true,
        hasGitIgnore: true,
        hasReadme: true,
        hasLicense: false,
        maxDepthScanned: 5,
        excludedDirectories: ['node_modules', '.git'],
        scannedAt: new Date('2023-12-25T10:30:00Z'),
      };

      expect(() => ProjectStructureSchema.parse(completeStructure)).not.toThrow();
    });

    it('should apply default values correctly', () => {
      const minimalStructure = {
        root: '/test/root',
      };

      const parsed = ProjectStructureSchema.parse(minimalStructure);

      expect(parsed.totalFiles).toBe(0);
      expect(parsed.totalDirectories).toBe(0);
      expect(parsed.entries).toEqual([]);
      expect(parsed.rootFiles).toEqual([]);
      expect(parsed.commonDirectories).toEqual([]);
      expect(parsed.hasPackageJson).toBe(false);
      expect(parsed.hasGitIgnore).toBe(false);
      expect(parsed.hasReadme).toBe(false);
      expect(parsed.hasLicense).toBe(false);
      expect(parsed.excludedDirectories).toEqual([]);
    });

    it('should reject empty root path', () => {
      const invalidStructure = {
        root: '',
      };

      expect(() => ProjectStructureSchema.parse(invalidStructure)).toThrow();
    });

    it('should reject negative counts', () => {
      const invalidCounts = [
        { root: '/valid', totalFiles: -1 },
        { root: '/valid', totalDirectories: -1 },
        { root: '/valid', maxDepthScanned: -1 },
      ];

      invalidCounts.forEach(structure => {
        expect(() => ProjectStructureSchema.parse(structure)).toThrow();
      });
    });
  });

  describe('FrameworkCategorySchema', () => {
    it('should accept all valid framework categories', () => {
      const validCategories: FrameworkCategory[] = [
        'frontend', 'backend', 'fullstack', 'testing', 'build', 'mobile', 'desktop', 'other'
      ];

      validCategories.forEach(category => {
        expect(() => FrameworkCategorySchema.parse(category)).not.toThrow();
      });
    });

    it('should reject invalid framework categories', () => {
      const invalidCategories = ['client', 'server', 'ui', 'api', '', null, undefined];

      invalidCategories.forEach(category => {
        expect(() => FrameworkCategorySchema.parse(category)).toThrow();
      });
    });
  });

  describe('DetectionConfidenceSchema', () => {
    it('should accept all valid confidence levels', () => {
      const validConfidences: DetectionConfidence[] = ['high', 'medium', 'low'];

      validConfidences.forEach(confidence => {
        expect(() => DetectionConfidenceSchema.parse(confidence)).not.toThrow();
      });
    });

    it('should reject invalid confidence levels', () => {
      const invalidConfidences = ['very-high', 'none', 0.9, 100, '', null, undefined];

      invalidConfidences.forEach(confidence => {
        expect(() => DetectionConfidenceSchema.parse(confidence)).toThrow();
      });
    });
  });

  describe('FrameworkInfoSchema', () => {
    it('should validate complete framework info', () => {
      const completeFramework: FrameworkInfo = {
        name: 'React',
        version: '18.2.0',
        category: 'frontend',
        confidence: 'high',
        detectedVia: 'package.json dependency analysis',
        language: 'TypeScript',
        configFiles: ['tsconfig.json', 'webpack.config.js'],
        isDevDependency: false,
        metadata: {
          installSize: '2.5MB',
          lastUpdated: '2023-12-01',
          dependencies: ['react-dom'],
        },
      };

      expect(() => FrameworkInfoSchema.parse(completeFramework)).not.toThrow();
    });

    it('should apply default values correctly', () => {
      const minimalFramework = {
        name: 'Vue',
        category: 'frontend' as const,
      };

      const parsed = FrameworkInfoSchema.parse(minimalFramework);

      expect(parsed.confidence).toBe('medium');
      expect(parsed.configFiles).toEqual([]);
      expect(parsed.isDevDependency).toBe(false);
    });

    it('should reject empty name', () => {
      const invalidFramework = {
        name: '',
        category: 'frontend',
      };

      expect(() => FrameworkInfoSchema.parse(invalidFramework)).toThrow();
    });

    it('should handle complex metadata', () => {
      const complexFramework = {
        name: 'Next.js',
        category: 'fullstack' as const,
        metadata: {
          features: ['SSR', 'SSG', 'API Routes'],
          config: {
            experimental: true,
            settings: {
              enableTurbo: false,
            },
          },
          stats: {
            bundleSize: 1024000,
            buildTime: 45.6,
          },
        },
      };

      expect(() => FrameworkInfoSchema.parse(complexFramework)).not.toThrow();
    });
  });

  describe('FrameworkDetectionSchema', () => {
    it('should validate complete framework detection', () => {
      const completeDetection: FrameworkDetection = {
        primary: {
          name: 'React',
          version: '18.2.0',
          category: 'frontend',
          confidence: 'high',
        },
        frameworks: [
          {
            name: 'React',
            version: '18.2.0',
            category: 'frontend',
            confidence: 'high',
          },
          {
            name: 'TypeScript',
            version: '5.0.0',
            category: 'other',
            confidence: 'high',
          },
        ],
        primaryLanguage: 'TypeScript',
        languages: [
          {
            name: 'TypeScript',
            extensions: ['.ts', '.tsx'],
            percentage: 85,
          },
          {
            name: 'JavaScript',
            extensions: ['.js', '.jsx'],
            percentage: 15,
          },
        ],
        runtime: 'browser',
        packageManager: 'npm',
        error: undefined,
      };

      expect(() => FrameworkDetectionSchema.parse(completeDetection)).not.toThrow();
    });

    it('should validate minimal framework detection', () => {
      const minimalDetection = {
        frameworks: [],
        languages: [],
      };

      expect(() => FrameworkDetectionSchema.parse(minimalDetection)).not.toThrow();
    });

    it('should validate detection with error', () => {
      const errorDetection = {
        frameworks: [],
        languages: [],
        error: 'Failed to analyze package.json: Permission denied',
      };

      expect(() => FrameworkDetectionSchema.parse(errorDetection)).not.toThrow();
    });

    it('should reject invalid language percentages', () => {
      const invalidDetections = [
        {
          frameworks: [],
          languages: [{ name: 'Test', extensions: ['.test'], percentage: -1 }],
        },
        {
          frameworks: [],
          languages: [{ name: 'Test', extensions: ['.test'], percentage: 101 }],
        },
        {
          frameworks: [],
          languages: [{ name: 'Test', extensions: ['.test'], percentage: 150 }],
        },
      ];

      invalidDetections.forEach(detection => {
        expect(() => FrameworkDetectionSchema.parse(detection)).toThrow();
      });
    });

    it('should validate boundary language percentages', () => {
      const boundaryDetections = [
        {
          frameworks: [],
          languages: [{ name: 'Test', extensions: ['.test'], percentage: 0 }],
        },
        {
          frameworks: [],
          languages: [{ name: 'Test', extensions: ['.test'], percentage: 100 }],
        },
        {
          frameworks: [],
          languages: [{ name: 'Test', extensions: ['.test'], percentage: 50.5 }],
        },
      ];

      boundaryDetections.forEach(detection => {
        expect(() => FrameworkDetectionSchema.parse(detection)).not.toThrow();
      });
    });
  });

  describe('ConfigFormatSchema', () => {
    it('should accept all valid config formats', () => {
      const validFormats: ConfigFormat[] = [
        'json', 'yaml', 'toml', 'javascript', 'typescript', 'ini', 'env', 'xml', 'other'
      ];

      validFormats.forEach(format => {
        expect(() => ConfigFormatSchema.parse(format)).not.toThrow();
      });
    });

    it('should reject invalid config formats', () => {
      const invalidFormats = ['yml', 'js', 'ts', 'config', 'properties', '', null, undefined];

      invalidFormats.forEach(format => {
        expect(() => ConfigFormatSchema.parse(format)).toThrow();
      });
    });
  });

  describe('ConfigPurposeSchema', () => {
    it('should accept all valid config purposes', () => {
      const validPurposes: ConfigPurpose[] = [
        'package-manager', 'typescript', 'linting', 'testing', 'build',
        'ci-cd', 'containerization', 'environment', 'git', 'editor',
        'documentation', 'security', 'other'
      ];

      validPurposes.forEach(purpose => {
        expect(() => ConfigPurposeSchema.parse(purpose)).not.toThrow();
      });
    });

    it('should reject invalid config purposes', () => {
      const invalidPurposes = ['deployment', 'monitoring', 'logging', '', null, undefined];

      invalidPurposes.forEach(purpose => {
        expect(() => ConfigPurposeSchema.parse(purpose)).toThrow();
      });
    });
  });

  describe('ConfigurationInfoSchema', () => {
    it('should validate complete configuration info', () => {
      const completeConfig: ConfigurationInfo = {
        name: 'tsconfig.json',
        path: 'tsconfig.json',
        format: 'json',
        purpose: 'typescript',
        isValid: true,
        validationError: undefined,
        keySettings: {
          strict: true,
          target: 'ES2022',
          moduleResolution: 'node',
        },
        extends: '@tsconfig/node18/tsconfig.json',
        size: 1024,
        modifiedAt: new Date('2023-12-25T10:30:00Z'),
        metadata: {
          parsed: true,
          compilerOptions: 15,
        },
      };

      expect(() => ConfigurationInfoSchema.parse(completeConfig)).not.toThrow();
    });

    it('should apply default values correctly', () => {
      const minimalConfig = {
        name: 'webpack.config.js',
        path: 'webpack.config.js',
        format: 'javascript' as const,
        purpose: 'build' as const,
      };

      const parsed = ConfigurationInfoSchema.parse(minimalConfig);

      expect(parsed.isValid).toBe(true);
    });

    it('should validate configuration with error', () => {
      const errorConfig: ConfigurationInfo = {
        name: 'invalid.json',
        path: 'invalid.json',
        format: 'json',
        purpose: 'other',
        isValid: false,
        validationError: 'Unexpected token } in JSON at position 15',
        size: 50,
        modifiedAt: new Date(),
      };

      expect(() => ConfigurationInfoSchema.parse(errorConfig)).not.toThrow();
    });

    it('should reject empty name or path', () => {
      const invalidConfigs = [
        {
          name: '',
          path: 'valid.json',
          format: 'json',
          purpose: 'other',
        },
        {
          name: 'valid.json',
          path: '',
          format: 'json',
          purpose: 'other',
        },
      ];

      invalidConfigs.forEach(config => {
        expect(() => ConfigurationInfoSchema.parse(config)).toThrow();
      });
    });

    it('should reject negative size', () => {
      const invalidConfig = {
        name: 'test.json',
        path: 'test.json',
        format: 'json' as const,
        purpose: 'other' as const,
        size: -100,
      };

      expect(() => ConfigurationInfoSchema.parse(invalidConfig)).toThrow();
    });
  });

  describe('TestRunnerTypeSchema', () => {
    it('should accept all valid test runner types', () => {
      const validTypes: TestRunnerType[] = [
        'unit', 'integration', 'e2e', 'component', 'visual', 'performance', 'accessibility', 'other'
      ];

      validTypes.forEach(type => {
        expect(() => TestRunnerTypeSchema.parse(type)).not.toThrow();
      });
    });

    it('should reject invalid test runner types', () => {
      const invalidTypes = ['acceptance', 'smoke', 'regression', 'api', '', null, undefined];

      invalidTypes.forEach(type => {
        expect(() => TestRunnerTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('TestFrameworkInfoSchema', () => {
    it('should validate complete test framework info', () => {
      const completeTestFramework: TestFrameworkInfo = {
        name: 'Jest',
        version: '29.5.0',
        type: 'unit',
        configFile: 'jest.config.js',
        testPatterns: ['**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.js'],
        testDirectory: 'tests',
        runCommand: 'npm test',
        coverageEnabled: true,
        coverageTool: 'jest',
        watchModeAvailable: true,
        plugins: ['babel-jest', 'ts-jest'],
        testFileCount: 45,
        assertionLibrary: 'jest',
        mockingLibrary: 'jest',
        metadata: {
          setupFiles: ['<rootDir>/test-setup.js'],
          testEnvironment: 'jsdom',
          collectCoverageFrom: ['src/**/*.{js,ts}'],
        },
      };

      expect(() => TestFrameworkInfoSchema.parse(completeTestFramework)).not.toThrow();
    });

    it('should apply default values correctly', () => {
      const minimalTestFramework = {
        name: 'Vitest',
        type: 'unit' as const,
      };

      const parsed = TestFrameworkInfoSchema.parse(minimalTestFramework);

      expect(parsed.testPatterns).toEqual([]);
      expect(parsed.coverageEnabled).toBe(false);
      expect(parsed.watchModeAvailable).toBe(false);
      expect(parsed.plugins).toEqual([]);
    });

    it('should reject empty name', () => {
      const invalidTestFramework = {
        name: '',
        type: 'unit',
      };

      expect(() => TestFrameworkInfoSchema.parse(invalidTestFramework)).toThrow();
    });

    it('should reject negative test file count', () => {
      const invalidTestFramework = {
        name: 'Jest',
        type: 'unit' as const,
        testFileCount: -5,
      };

      expect(() => TestFrameworkInfoSchema.parse(invalidTestFramework)).toThrow();
    });

    it('should handle zero test file count', () => {
      const zeroTestFramework = {
        name: 'Mocha',
        type: 'unit' as const,
        testFileCount: 0,
      };

      expect(() => TestFrameworkInfoSchema.parse(zeroTestFramework)).not.toThrow();
    });
  });

  describe('ProjectContextSchema', () => {
    it('should validate complete project context', () => {
      const completeContext: ProjectContext = {
        gitStatus: {
          isRepository: true,
          branch: 'main',
          remoteBranch: null,
          ahead: 0,
          behind: 0,
          staged: [],
          unstaged: [],
          untracked: [],
          hasConflicts: false,
          isDirty: false,
          stashCount: 0,
          remotes: [],
        },
        structure: {
          root: '/project/root',
          totalFiles: 25,
          totalDirectories: 8,
          entries: [],
          rootFiles: ['package.json'],
          commonDirectories: ['src'],
          hasPackageJson: true,
          hasGitIgnore: false,
          hasReadme: false,
          hasLicense: false,
          excludedDirectories: ['node_modules'],
          scannedAt: new Date(),
        },
        frameworks: [
          {
            name: 'React',
            category: 'frontend',
            confidence: 'high',
          },
        ],
        configurations: [
          {
            name: 'package.json',
            path: 'package.json',
            format: 'json',
            purpose: 'package-manager',
          },
        ],
        testFrameworks: [
          {
            name: 'Jest',
            type: 'unit',
          },
        ],
        detectedAt: new Date('2023-12-25T10:30:00Z'),
        errors: [
          {
            component: 'git-analysis',
            message: 'Unable to determine remote tracking branch',
          },
        ],
      };

      expect(() => ProjectContextSchema.parse(completeContext)).not.toThrow();
    });

    it('should apply default values correctly', () => {
      const minimalContext = {};

      const parsed = ProjectContextSchema.parse(minimalContext);

      expect(parsed.frameworks).toEqual([]);
      expect(parsed.configurations).toEqual([]);
      expect(parsed.testFrameworks).toEqual([]);
      expect(parsed.errors).toEqual([]);
    });

    it('should validate context with only structure', () => {
      const structureOnlyContext = {
        structure: {
          root: '/test',
        },
      };

      expect(() => ProjectContextSchema.parse(structureOnlyContext)).not.toThrow();
    });

    it('should handle context with errors', () => {
      const contextWithErrors = {
        errors: [
          {
            component: 'framework-detection',
            message: 'package.json parsing failed',
          },
          {
            component: 'git-status',
            message: 'Not a git repository',
          },
        ],
      };

      expect(() => ProjectContextSchema.parse(contextWithErrors)).not.toThrow();
    });

    it('should validate empty arrays for all list fields', () => {
      const emptyListsContext = {
        frameworks: [],
        configurations: [],
        testFrameworks: [],
        errors: [],
      };

      expect(() => ProjectContextSchema.parse(emptyListsContext)).not.toThrow();
    });
  });

  describe('Schema Integration', () => {
    it('should handle large nested data structures', () => {
      const largeContext: ProjectContext = {
        gitStatus: {
          isRepository: true,
          branch: 'feature/large-test',
          remoteBranch: 'origin/feature/large-test',
          ahead: 0,
          behind: 0,
          staged: Array.from({ length: 50 }, (_, i) => ({
            path: `src/file-${i}.ts`,
            status: 'M' as const,
          })),
          unstaged: Array.from({ length: 30 }, (_, i) => ({
            path: `test/test-${i}.spec.ts`,
            status: 'A' as const,
          })),
          untracked: Array.from({ length: 10 }, (_, i) => `temp-${i}.log`),
          hasConflicts: false,
          isDirty: true,
          stashCount: 5,
          remotes: [
            { name: 'origin', url: 'https://github.com/user/repo.git' },
            { name: 'upstream', url: 'https://github.com/original/repo.git' },
          ],
        },
        structure: {
          root: '/large/project',
          totalFiles: 500,
          totalDirectories: 50,
          entries: Array.from({ length: 20 }, (_, i) => ({
            name: `dir-${i}`,
            path: `dir-${i}`,
            type: 'directory' as const,
            modifiedAt: new Date(),
            children: Array.from({ length: 5 }, (_, j) => ({
              name: `file-${j}.ts`,
              path: `dir-${i}/file-${j}.ts`,
              type: 'file' as const,
              size: 1024 + j * 100,
              modifiedAt: new Date(),
            })),
          })),
          rootFiles: ['package.json', '.gitignore', 'README.md', 'LICENSE'],
          commonDirectories: ['src', 'lib', 'test', 'docs'],
          hasPackageJson: true,
          hasGitIgnore: true,
          hasReadme: true,
          hasLicense: true,
          excludedDirectories: ['node_modules', '.git', 'dist', 'build'],
          scannedAt: new Date(),
        },
        frameworks: Array.from({ length: 10 }, (_, i) => ({
          name: `Framework-${i}`,
          version: `${i}.0.0`,
          category: (i % 2 === 0 ? 'frontend' : 'backend') as FrameworkCategory,
          confidence: (i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low') as DetectionConfidence,
          configFiles: [`config-${i}.json`],
        })),
        configurations: Array.from({ length: 15 }, (_, i) => ({
          name: `config-${i}.json`,
          path: `config-${i}.json`,
          format: 'json' as const,
          purpose: 'other' as const,
          size: 100 + i * 50,
          modifiedAt: new Date(),
        })),
        testFrameworks: Array.from({ length: 3 }, (_, i) => ({
          name: `TestFramework-${i}`,
          type: (i === 0 ? 'unit' : i === 1 ? 'e2e' : 'component') as TestRunnerType,
          testFileCount: 10 + i * 5,
          plugins: [`plugin-${i}-1`, `plugin-${i}-2`],
        })),
        detectedAt: new Date(),
        errors: [],
      };

      expect(() => ProjectContextSchema.parse(largeContext)).not.toThrow();
    });

    it('should preserve type safety across nested schemas', () => {
      const complexContext = {
        gitStatus: {
          isRepository: true,
          branch: 'main',
          staged: [
            { path: 'complex/path/with/unicode/文件.ts', status: 'M' },
          ],
          remotes: [
            { name: 'origin', url: 'ssh://git@complex-server.example.com:2222/user/repo.git' },
          ],
        },
        structure: {
          root: '/complex/project/with spaces/and-symbols/@scope',
          entries: [
            {
              name: 'complex.dir',
              path: 'complex.dir',
              type: 'directory',
              children: [
                {
                  name: 'nested.file.with.dots.ts',
                  path: 'complex.dir/nested.file.with.dots.ts',
                  type: 'file',
                  size: 0, // Empty file
                },
              ],
            },
          ],
        },
        frameworks: [
          {
            name: '@scoped/package-name',
            category: 'other',
            metadata: {
              complex: {
                nested: {
                  data: ['array', 'of', 'strings'],
                  numbers: [1, 2, 3],
                  boolean: true,
                },
              },
            },
          },
        ],
      };

      expect(() => ProjectContextSchema.parse(complexContext)).not.toThrow();
    });
  });
});