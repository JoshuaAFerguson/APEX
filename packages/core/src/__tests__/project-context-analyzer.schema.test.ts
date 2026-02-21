/**
 * Project Context Analyzer Schema Validation Tests
 *
 * Tests specifically for validating Zod schemas used by ProjectContextAnalyzer
 * to ensure all TypeScript types and schemas are properly defined and work correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  ProjectContextSchema,
  FrameworkInfoSchema,
  ConfigFileInfoSchema,
  type GitStatus,
  type ProjectStructure,
  type FrameworkDetection,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type ProjectContext,
  type FrameworkInfo,
  type ConfigFileInfo,
} from '../types';

describe('ProjectContextAnalyzer Schema Validation', () => {
  describe('GitStatusSchema', () => {
    it('validates minimal valid git status', () => {
      const minimalGitStatus: GitStatus = {
        isRepository: false,
        branch: null,
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
      };

      expect(() => GitStatusSchema.parse(minimalGitStatus)).not.toThrow();
    });

    it('validates complete git status with all fields', () => {
      const completeGitStatus: GitStatus = {
        isRepository: true,
        branch: 'main',
        remoteBranch: 'origin/main',
        ahead: 2,
        behind: 1,
        staged: [
          { path: 'file1.ts', status: 'M' },
          { path: 'file2.ts', status: 'A' },
        ],
        unstaged: [
          { path: 'file3.ts', status: 'M' },
        ],
        untracked: ['new-file.ts'],
        hasConflicts: false,
        isDirty: true,
        stashCount: 3,
        lastCommitHash: 'abc123',
        lastCommitMessage: 'Initial commit',
        lastCommitTimestamp: new Date('2023-01-01'),
        remotes: [
          { name: 'origin', url: 'https://github.com/user/repo.git' },
        ],
      };

      expect(() => GitStatusSchema.parse(completeGitStatus)).not.toThrow();
    });

    it('validates git status with all change types', () => {
      const changeTypes: Array<'M' | 'A' | 'D' | 'R' | 'C' | 'U'> = ['M', 'A', 'D', 'R', 'C', 'U'];

      for (const status of changeTypes) {
        const gitStatus: GitStatus = {
          isRepository: true,
          branch: 'main',
          remoteBranch: null,
          ahead: 0,
          behind: 0,
          staged: [{ path: 'test.ts', status }],
          unstaged: [],
          untracked: [],
          hasConflicts: false,
          isDirty: true,
          stashCount: 0,
          remotes: [],
        };

        expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
      }
    });

    it('rejects invalid git status change type', () => {
      const invalidGitStatus = {
        isRepository: true,
        branch: 'main',
        remoteBranch: null,
        ahead: 0,
        behind: 0,
        staged: [{ path: 'test.ts', status: 'INVALID' }],
        unstaged: [],
        untracked: [],
        hasConflicts: false,
        isDirty: true,
        stashCount: 0,
        remotes: [],
      };

      expect(() => GitStatusSchema.parse(invalidGitStatus)).toThrow();
    });

    it('rejects negative ahead/behind counts', () => {
      const invalidCounts = [-1, -10, -100];

      for (const count of invalidCounts) {
        const invalidGitStatus = {
          isRepository: true,
          branch: 'main',
          remoteBranch: null,
          ahead: count,
          behind: 0,
          staged: [],
          unstaged: [],
          untracked: [],
          hasConflicts: false,
          isDirty: false,
          stashCount: 0,
          remotes: [],
        };

        expect(() => GitStatusSchema.parse(invalidGitStatus)).toThrow();
      }
    });
  });

  describe('ProjectStructureSchema', () => {
    it('validates minimal project structure', () => {
      const minimalStructure: ProjectStructure = {
        root: '/test/path',
        totalFiles: 0,
        totalDirectories: 0,
        entries: [],
        rootFiles: [],
        commonDirectories: [],
        hasPackageJson: false,
        hasGitIgnore: false,
        hasReadme: false,
        hasLicense: false,
        excludedDirectories: [],
        scannedAt: new Date(),
      };

      expect(() => ProjectStructureSchema.parse(minimalStructure)).not.toThrow();
    });

    it('validates complete project structure with entries', () => {
      const completeStructure: ProjectStructure = {
        root: '/test/path',
        totalFiles: 5,
        totalDirectories: 2,
        entries: [
          {
            name: 'src',
            path: 'src',
            type: 'directory',
            modifiedAt: new Date('2023-01-01'),
            children: [
              {
                name: 'index.ts',
                path: 'src/index.ts',
                type: 'file',
                size: 1024,
                modifiedAt: new Date('2023-01-02'),
              },
            ],
          },
          {
            name: 'package.json',
            path: 'package.json',
            type: 'file',
            size: 500,
            modifiedAt: new Date('2023-01-01'),
          },
        ],
        rootFiles: ['package.json', 'README.md'],
        commonDirectories: ['src', 'test'],
        hasPackageJson: true,
        hasGitIgnore: true,
        hasReadme: true,
        hasLicense: false,
        excludedDirectories: ['node_modules', 'dist'],
        maxDepthScanned: 5,
        scannedAt: new Date(),
      };

      expect(() => ProjectStructureSchema.parse(completeStructure)).not.toThrow();
    });

    it('rejects negative file/directory counts', () => {
      const invalidStructure = {
        root: '/test',
        totalFiles: -1,
        totalDirectories: 0,
        entries: [],
        rootFiles: [],
        commonDirectories: [],
        hasPackageJson: false,
        hasGitIgnore: false,
        hasReadme: false,
        hasLicense: false,
        excludedDirectories: [],
        scannedAt: new Date(),
      };

      expect(() => ProjectStructureSchema.parse(invalidStructure)).toThrow();
    });

    it('validates project entry types', () => {
      const validTypes: Array<'file' | 'directory'> = ['file', 'directory'];

      for (const type of validTypes) {
        const structure: ProjectStructure = {
          root: '/test',
          totalFiles: 1,
          totalDirectories: 0,
          entries: [{
            name: 'test',
            path: 'test',
            type,
            modifiedAt: new Date(),
          }],
          rootFiles: [],
          commonDirectories: [],
          hasPackageJson: false,
          hasGitIgnore: false,
          hasReadme: false,
          hasLicense: false,
          excludedDirectories: [],
          scannedAt: new Date(),
        };

        expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
      }
    });
  });

  describe('FrameworkDetectionSchema', () => {
    it('validates empty framework detection', () => {
      const emptyDetection: FrameworkDetection = {
        frameworks: [],
        languages: [],
      };

      expect(() => FrameworkDetectionSchema.parse(emptyDetection)).not.toThrow();
    });

    it('validates complete framework detection', () => {
      const completeDetection: FrameworkDetection = {
        primary: {
          name: 'React',
          version: '18.0.0',
          category: 'frontend',
          confidence: 'high',
          detectedVia: 'package.json dependency',
          language: 'javascript',
          isDevDependency: false,
        },
        frameworks: [
          {
            name: 'React',
            version: '18.0.0',
            category: 'frontend',
            confidence: 'high',
            detectedVia: 'package.json dependency',
            language: 'javascript',
            isDevDependency: false,
          },
          {
            name: 'TypeScript',
            version: '5.0.0',
            category: 'other',
            confidence: 'high',
            detectedVia: 'package.json dependency',
            language: 'typescript',
            isDevDependency: true,
          },
        ],
        primaryLanguage: 'typescript',
        languages: [
          {
            name: 'TypeScript',
            extensions: ['.ts', '.tsx'],
            percentage: 80,
          },
          {
            name: 'JavaScript',
            extensions: ['.js', '.jsx'],
            percentage: 20,
          },
        ],
        runtime: 'node',
        packageManager: 'npm',
      };

      expect(() => FrameworkDetectionSchema.parse(completeDetection)).not.toThrow();
    });

    it('validates all framework categories', () => {
      const categories: Array<'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'build' | 'testing' | 'other'> = [
        'frontend', 'backend', 'fullstack', 'mobile', 'desktop', 'build', 'testing', 'other'
      ];

      for (const category of categories) {
        const framework: FrameworkInfo = {
          name: 'Test Framework',
          category,
          confidence: 'medium',
          detectedVia: 'test',
        };

        expect(() => FrameworkInfoSchema.parse(framework)).not.toThrow();
      }
    });

    it('validates all confidence levels', () => {
      const confidenceLevels: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];

      for (const confidence of confidenceLevels) {
        const framework: FrameworkInfo = {
          name: 'Test Framework',
          category: 'other',
          confidence,
          detectedVia: 'test',
        };

        expect(() => FrameworkInfoSchema.parse(framework)).not.toThrow();
      }
    });

    it('rejects invalid language percentages', () => {
      const invalidPercentages = [-1, 101, -50, 200];

      for (const percentage of invalidPercentages) {
        const detection = {
          frameworks: [],
          languages: [
            {
              name: 'Test',
              extensions: ['.test'],
              percentage,
            },
          ],
        };

        expect(() => FrameworkDetectionSchema.parse(detection)).toThrow();
      }
    });

    it('validates boundary language percentages', () => {
      const validPercentages = [0, 0.1, 50, 99.9, 100];

      for (const percentage of validPercentages) {
        const detection: FrameworkDetection = {
          frameworks: [],
          languages: [
            {
              name: 'Test',
              extensions: ['.test'],
              percentage,
            },
          ],
        };

        expect(() => FrameworkDetectionSchema.parse(detection)).not.toThrow();
      }
    });
  });

  describe('ConfigurationInfoSchema', () => {
    it('validates minimal configuration info', () => {
      const minimalConfig: ConfigurationInfo = {
        name: 'test.json',
        path: './test.json',
        format: 'json',
        purpose: 'other',
        isValid: true,
        size: 100,
        modifiedAt: new Date(),
      };

      expect(() => ConfigurationInfoSchema.parse(minimalConfig)).not.toThrow();
    });

    it('validates complete configuration info', () => {
      const completeConfig: ConfigurationInfo = {
        name: 'package.json',
        path: './package.json',
        format: 'json',
        purpose: 'package-manager',
        isValid: true,
        size: 1500,
        modifiedAt: new Date(),
        keySettings: {
          name: 'test-project',
          scripts: ['test', 'build'],
          dependencyCount: 10,
        },
        validationError: undefined,
      };

      expect(() => ConfigurationInfoSchema.parse(completeConfig)).not.toThrow();
    });

    it('validates all configuration formats', () => {
      const formats: Array<'json' | 'yaml' | 'toml' | 'ini' | 'env' | 'javascript' | 'other'> = [
        'json', 'yaml', 'toml', 'ini', 'env', 'javascript', 'other'
      ];

      for (const format of formats) {
        const config: ConfigurationInfo = {
          name: `test.${format}`,
          path: `./test.${format}`,
          format,
          purpose: 'other',
          isValid: true,
          size: 100,
          modifiedAt: new Date(),
        };

        expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
      }
    });

    it('validates all configuration purposes', () => {
      const purposes: Array<'package-manager' | 'typescript' | 'linting' | 'build' | 'testing' | 'ci-cd' | 'containerization' | 'environment' | 'git' | 'editor' | 'documentation' | 'security' | 'other'> = [
        'package-manager', 'typescript', 'linting', 'build', 'testing', 'ci-cd',
        'containerization', 'environment', 'git', 'editor', 'documentation', 'security', 'other'
      ];

      for (const purpose of purposes) {
        const config: ConfigurationInfo = {
          name: 'test.json',
          path: './test.json',
          format: 'json',
          purpose,
          isValid: true,
          size: 100,
          modifiedAt: new Date(),
        };

        expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
      }
    });

    it('validates invalid configuration with error', () => {
      const invalidConfig: ConfigurationInfo = {
        name: 'invalid.json',
        path: './invalid.json',
        format: 'json',
        purpose: 'other',
        isValid: false,
        size: 50,
        modifiedAt: new Date(),
        validationError: 'JSON parse error: Unexpected token',
      };

      expect(() => ConfigurationInfoSchema.parse(invalidConfig)).not.toThrow();
    });
  });

  describe('TestFrameworkInfoSchema', () => {
    it('validates minimal test framework info', () => {
      const minimalFramework: TestFrameworkInfo = {
        name: 'Jest',
        type: 'unit',
        testPatterns: ['**/*.test.js'],
        runCommand: 'npm test',
      };

      expect(() => TestFrameworkInfoSchema.parse(minimalFramework)).not.toThrow();
    });

    it('validates complete test framework info', () => {
      const completeFramework: TestFrameworkInfo = {
        name: 'Jest',
        version: '29.0.0',
        type: 'unit',
        configFile: 'jest.config.js',
        testPatterns: ['**/*.test.js', '**/*.spec.js'],
        runCommand: 'npm test',
        testFileCount: 25,
        coverageEnabled: true,
        coverageTool: 'c8',
        watchModeAvailable: true,
        assertionLibrary: 'expect',
        mockingLibrary: 'jest',
        plugins: ['babel-jest', 'ts-jest'],
        testDirectory: 'test',
      };

      expect(() => TestFrameworkInfoSchema.parse(completeFramework)).not.toThrow();
    });

    it('validates all test framework types', () => {
      const types: Array<'unit' | 'integration' | 'e2e' | 'component' | 'other'> = [
        'unit', 'integration', 'e2e', 'component', 'other'
      ];

      for (const type of types) {
        const framework: TestFrameworkInfo = {
          name: 'Test Framework',
          type,
          testPatterns: ['**/*.test.js'],
          runCommand: 'npm test',
        };

        expect(() => TestFrameworkInfoSchema.parse(framework)).not.toThrow();
      }
    });

    it('rejects negative test file count', () => {
      const invalidFramework = {
        name: 'Jest',
        type: 'unit',
        testPatterns: ['**/*.test.js'],
        runCommand: 'npm test',
        testFileCount: -1,
      };

      expect(() => TestFrameworkInfoSchema.parse(invalidFramework)).toThrow();
    });
  });

  describe('ProjectContextSchema', () => {
    it('validates minimal project context', () => {
      const minimalContext: ProjectContext = {
        structure: {
          root: '/test',
          totalFiles: 0,
          totalDirectories: 0,
          entries: [],
          rootFiles: [],
          commonDirectories: [],
          hasPackageJson: false,
          hasGitIgnore: false,
          hasReadme: false,
          hasLicense: false,
          excludedDirectories: [],
          scannedAt: new Date(),
        },
        frameworks: [],
        configurations: [],
        testFrameworks: [],
        detectedAt: new Date(),
        errors: [],
      };

      expect(() => ProjectContextSchema.parse(minimalContext)).not.toThrow();
    });

    it('validates complete project context', () => {
      const completeContext: ProjectContext = {
        gitStatus: {
          isRepository: true,
          branch: 'main',
          remoteBranch: 'origin/main',
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
          root: '/test',
          totalFiles: 10,
          totalDirectories: 3,
          entries: [],
          rootFiles: ['package.json'],
          commonDirectories: ['src'],
          hasPackageJson: true,
          hasGitIgnore: true,
          hasReadme: true,
          hasLicense: true,
          excludedDirectories: ['node_modules'],
          scannedAt: new Date(),
        },
        frameworks: [
          {
            name: 'React',
            category: 'frontend',
            confidence: 'high',
            detectedVia: 'package.json',
          },
        ],
        configurations: [
          {
            name: 'package.json',
            path: './package.json',
            format: 'json',
            purpose: 'package-manager',
            isValid: true,
            size: 1000,
            modifiedAt: new Date(),
          },
        ],
        testFrameworks: [
          {
            name: 'Jest',
            type: 'unit',
            testPatterns: ['**/*.test.js'],
            runCommand: 'npm test',
          },
        ],
        detectedAt: new Date(),
        errors: [],
      };

      expect(() => ProjectContextSchema.parse(completeContext)).not.toThrow();
    });

    it('validates project context with errors', () => {
      const contextWithErrors: ProjectContext = {
        structure: {
          root: '/test',
          totalFiles: 0,
          totalDirectories: 0,
          entries: [],
          rootFiles: [],
          commonDirectories: [],
          hasPackageJson: false,
          hasGitIgnore: false,
          hasReadme: false,
          hasLicense: false,
          excludedDirectories: [],
          scannedAt: new Date(),
        },
        frameworks: [],
        configurations: [],
        testFrameworks: [],
        detectedAt: new Date(),
        errors: [
          'Git analysis failed: not a git repository',
          'Framework detection failed: package.json not found',
        ],
      };

      expect(() => ProjectContextSchema.parse(contextWithErrors)).not.toThrow();
    });
  });

  describe('Schema compatibility', () => {
    it('ensures TypeScript types match Zod schemas', () => {
      // This test ensures that TypeScript types inferred from Zod schemas
      // are compatible with the actual types used in the application

      // These should compile without errors
      const gitStatus: GitStatus = {
        isRepository: false,
        branch: null,
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
      };

      const structure: ProjectStructure = {
        root: '/test',
        totalFiles: 0,
        totalDirectories: 0,
        entries: [],
        rootFiles: [],
        commonDirectories: [],
        hasPackageJson: false,
        hasGitIgnore: false,
        hasReadme: false,
        hasLicense: false,
        excludedDirectories: [],
        scannedAt: new Date(),
      };

      const detection: FrameworkDetection = {
        frameworks: [],
        languages: [],
      };

      const config: ConfigurationInfo = {
        name: 'test.json',
        path: './test.json',
        format: 'json',
        purpose: 'other',
        isValid: true,
        size: 100,
        modifiedAt: new Date(),
      };

      const testFramework: TestFrameworkInfo = {
        name: 'Jest',
        type: 'unit',
        testPatterns: ['**/*.test.js'],
        runCommand: 'npm test',
      };

      const context: ProjectContext = {
        structure,
        frameworks: [],
        configurations: [],
        testFrameworks: [],
        detectedAt: new Date(),
        errors: [],
      };

      // These should all validate successfully
      expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
      expect(() => FrameworkDetectionSchema.parse(detection)).not.toThrow();
      expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
      expect(() => TestFrameworkInfoSchema.parse(testFramework)).not.toThrow();
      expect(() => ProjectContextSchema.parse(context)).not.toThrow();
    });

    it('validates cross-schema consistency', () => {
      // Create a project context that uses all schemas together
      const projectContext: ProjectContext = {
        gitStatus: {
          isRepository: true,
          branch: 'main',
          remoteBranch: null,
          ahead: 1,
          behind: 0,
          staged: [{ path: 'test.ts', status: 'M' }],
          unstaged: [],
          untracked: ['new.ts'],
          hasConflicts: false,
          isDirty: true,
          stashCount: 0,
          remotes: [{ name: 'origin', url: 'git@github.com:user/repo.git' }],
        },
        structure: {
          root: '/project',
          totalFiles: 5,
          totalDirectories: 2,
          entries: [
            {
              name: 'src',
              path: 'src',
              type: 'directory',
              modifiedAt: new Date(),
              children: [
                {
                  name: 'index.ts',
                  path: 'src/index.ts',
                  type: 'file',
                  size: 500,
                  modifiedAt: new Date(),
                },
              ],
            },
          ],
          rootFiles: ['package.json'],
          commonDirectories: ['src'],
          hasPackageJson: true,
          hasGitIgnore: false,
          hasReadme: true,
          hasLicense: false,
          excludedDirectories: ['node_modules'],
          scannedAt: new Date(),
        },
        frameworks: [
          {
            name: 'TypeScript',
            category: 'other',
            confidence: 'high',
            detectedVia: 'file extensions',
            language: 'typescript',
          },
        ],
        configurations: [
          {
            name: 'tsconfig.json',
            path: './tsconfig.json',
            format: 'json',
            purpose: 'typescript',
            isValid: true,
            size: 300,
            modifiedAt: new Date(),
            keySettings: { compilerOptions: { strict: true } },
          },
        ],
        testFrameworks: [
          {
            name: 'Vitest',
            type: 'unit',
            version: '1.0.0',
            testPatterns: ['**/*.test.ts'],
            runCommand: 'vitest run',
            testFileCount: 3,
            coverageEnabled: true,
          },
        ],
        detectedAt: new Date(),
        errors: [],
      };

      // Should validate as a complete, consistent project context
      expect(() => ProjectContextSchema.parse(projectContext)).not.toThrow();
    });
  });
});