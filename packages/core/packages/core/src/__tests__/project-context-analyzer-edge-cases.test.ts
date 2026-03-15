/**
 * Edge Cases and Schema Validation Tests for ProjectContextAnalyzer
 *
 * This test file focuses on:
 * - Advanced schema validation scenarios
 * - Edge cases not covered in main tests
 * - Boundary condition testing
 * - Data type validation and coercion
 * - Error message validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ProjectContextAnalyzer,
  FrameworkDetectionSchema,
  ConfigFileInfoSchema,
  type FrameworkDetection,
  type ConfigFileInfo,
  type ProjectContextAnalyzerOptions,
} from '../project-context-analyzer.js';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  FrameworkInfoSchema,
  ProjectContextSchema,
  type GitStatus,
  type GitChangedFile,
  type ProjectStructure,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type FrameworkInfo,
  type ProjectContext,
} from '../types.js';
import { getPlatformShell } from '../shell-utils.js';

// Mock external dependencies
vi.mock('child_process');
vi.mock('fs');
vi.mock('path');
vi.mock('../shell-utils.js');

const mockExecAsync = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

const mockGetPlatformShell = vi.mocked(getPlatformShell);

describe('ProjectContextAnalyzer - Edge Cases and Schema Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Schema Validation Edge Cases', () => {
    describe('FrameworkDetectionSchema Advanced Tests', () => {
      it('validates framework with minimum confidence value', () => {
        const minConfidence: FrameworkDetection = {
          primary: {
            name: 'MinFramework',
            confidence: 0.0, // Minimum valid confidence
            indicators: ['minimal.json'],
          },
          frameworks: [],
          languages: [],
        };

        const result = FrameworkDetectionSchema.safeParse(minConfidence);
        expect(result.success).toBe(true);
      });

      it('validates framework with maximum confidence value', () => {
        const maxConfidence: FrameworkDetection = {
          primary: {
            name: 'MaxFramework',
            confidence: 1.0, // Maximum valid confidence
            indicators: ['maximal.json'],
          },
          frameworks: [],
          languages: [],
        };

        const result = FrameworkDetectionSchema.safeParse(maxConfidence);
        expect(result.success).toBe(true);
      });

      it('rejects framework with confidence above 1.0', () => {
        const invalidConfidence = {
          frameworks: [{
            name: 'Invalid',
            confidence: 1.1,
            indicators: ['test'],
          }],
          languages: [],
        };

        const result = FrameworkDetectionSchema.safeParse(invalidConfidence);
        expect(result.success).toBe(false);
      });

      it('rejects framework with negative confidence', () => {
        const negativeConfidence = {
          frameworks: [{
            name: 'Invalid',
            confidence: -0.1,
            indicators: ['test'],
          }],
          languages: [],
        };

        const result = FrameworkDetectionSchema.safeParse(negativeConfidence);
        expect(result.success).toBe(false);
      });

      it('validates empty indicators array', () => {
        const emptyIndicators: FrameworkDetection = {
          frameworks: [{
            name: 'NoIndicators',
            confidence: 0.5,
            indicators: [], // Empty but valid
          }],
          languages: [],
        };

        const result = FrameworkDetectionSchema.safeParse(emptyIndicators);
        expect(result.success).toBe(true);
      });

      it('validates very long framework names', () => {
        const longName = 'Framework' + 'x'.repeat(1000);
        const longFramework: FrameworkDetection = {
          frameworks: [{
            name: longName,
            confidence: 0.8,
            indicators: ['test'],
          }],
          languages: [],
        };

        const result = FrameworkDetectionSchema.safeParse(longFramework);
        expect(result.success).toBe(true);
      });

      it('validates unicode characters in framework data', () => {
        const unicodeFramework: FrameworkDetection = {
          primary: {
            name: 'React⚛️',
            version: '18.2.0-αλφα',
            confidence: 0.95,
            indicators: ['package.json', 'src/App.tsx'],
          },
          frameworks: [],
          primaryLanguage: 'TypeScript☄️',
          languages: [
            {
              name: 'TypeScript☄️',
              extensions: ['.ts', '.tsx'],
              percentage: 85.5,
            },
            {
              name: 'JavaScript⚡',
              extensions: ['.js', '.jsx'],
              percentage: 14.5,
            },
          ],
          runtime: 'Node.js🚀',
          packageManager: 'npm📦',
          error: 'Error occurred: 错误信息 🔥',
        };

        const result = FrameworkDetectionSchema.safeParse(unicodeFramework);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.primary?.name).toBe('React⚛️');
          expect(result.data.error).toBe('Error occurred: 错误信息 🔥');
        }
      });

      it('validates decimal precision in language percentages', () => {
        const precisePercentages: FrameworkDetection = {
          frameworks: [],
          languages: [
            { name: 'Lang1', extensions: ['.l1'], percentage: 33.33333 },
            { name: 'Lang2', extensions: ['.l2'], percentage: 33.33333 },
            { name: 'Lang3', extensions: ['.l3'], percentage: 33.33334 },
          ],
        };

        const result = FrameworkDetectionSchema.safeParse(precisePercentages);
        expect(result.success).toBe(true);
      });

      it('handles very large numbers of frameworks and languages', () => {
        const manyFrameworks = Array.from({ length: 100 }, (_, i) => ({
          name: `Framework${i}`,
          confidence: 0.5,
          indicators: [`file${i}.json`],
        }));

        const manyLanguages = Array.from({ length: 50 }, (_, i) => ({
          name: `Language${i}`,
          extensions: [`.l${i}`],
          percentage: 100 / 50, // 2% each
        }));

        const manyItems: FrameworkDetection = {
          frameworks: manyFrameworks,
          languages: manyLanguages,
        };

        const result = FrameworkDetectionSchema.safeParse(manyItems);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.frameworks).toHaveLength(100);
          expect(result.data.languages).toHaveLength(50);
        }
      });
    });

    describe('ConfigFileInfoSchema Advanced Tests', () => {
      it('validates all possible config file types exhaustively', () => {
        const allTypes = [
          'package', 'typescript', 'eslint', 'prettier', 'babel',
          'webpack', 'vite', 'rollup', 'jest', 'vitest', 'docker',
          'ci', 'git', 'editor', 'environment', 'other'
        ];

        allTypes.forEach(type => {
          const config: ConfigFileInfo = {
            name: `${type}.config`,
            path: `./configs/${type}.config`,
            type: type as any,
            exists: Math.random() > 0.5, // Random boolean
            description: `Configuration for ${type}`,
          };

          const result = ConfigFileInfoSchema.safeParse(config);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.type).toBe(type);
          }
        });
      });

      it('handles very long file paths and descriptions', () => {
        const longPath = '/very/long/path/to/config/files/that/might/exist/in/deeply/nested/project/structures/' + 'segment/'.repeat(20) + 'config.json';
        const longDescription = 'This is a very long description that explains in great detail what this configuration file does and how it affects the project build process. '.repeat(10);

        const longConfig: ConfigFileInfo = {
          name: 'deeply-nested-config.json',
          path: longPath,
          type: 'other',
          exists: true,
          description: longDescription,
        };

        const result = ConfigFileInfoSchema.safeParse(longConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.path).toBe(longPath);
          expect(result.data.description).toBe(longDescription);
        }
      });

      it('validates configs with special characters in paths', () => {
        const specialChars = [
          './config with spaces.json',
          './config-with-dashes.json',
          './config_with_underscores.json',
          './config.with.dots.json',
          './config@with@symbols.json',
          './配置文件.json',
          './конфиг.json',
          './🔧config.json',
        ];

        specialChars.forEach(path => {
          const config: ConfigFileInfo = {
            name: path.split('/').pop() || 'unknown',
            path,
            type: 'other',
            exists: true,
          };

          const result = ConfigFileInfoSchema.safeParse(config);
          expect(result.success).toBe(true);
        });
      });

      it('validates minimal and maximal config structures', () => {
        const minimal: ConfigFileInfo = {
          name: 'min.json',
          path: './min.json',
          type: 'other',
          exists: false,
        };

        const maximal: ConfigFileInfo = {
          name: 'maximal-configuration-file-with-very-long-name.json',
          path: './very/deep/nested/path/to/maximal-configuration-file-with-very-long-name.json',
          type: 'environment',
          exists: true,
          description: 'This is the most comprehensive configuration file description that provides extensive details about every aspect of the configuration.',
        };

        expect(ConfigFileInfoSchema.safeParse(minimal).success).toBe(true);
        expect(ConfigFileInfoSchema.safeParse(maximal).success).toBe(true);
      });
    });

    describe('GitStatusSchema Advanced Tests', () => {
      it('validates git status with maximum realistic values', () => {
        const maxGitStatus: GitStatus = {
          isRepository: true,
          branch: 'feature/very-long-branch-name-with-lots-of-detail-' + 'x'.repeat(200),
          remoteBranch: 'origin/feature/very-long-branch-name-with-lots-of-detail-' + 'x'.repeat(200),
          ahead: 9999,
          behind: 9999,
          staged: Array.from({ length: 1000 }, (_, i) => ({
            path: `src/file${i}.ts`,
            status: 'M' as const,
          })),
          unstaged: Array.from({ length: 1000 }, (_, i) => ({
            path: `test/file${i}.ts`,
            status: 'M' as const,
          })),
          untracked: Array.from({ length: 500 }, (_, i) => `temp/file${i}.tmp`),
          hasConflicts: true,
          isDirty: true,
          stashCount: 100,
          remotes: Array.from({ length: 20 }, (_, i) => ({
            name: `remote${i}`,
            url: `git@github.com:user/repo${i}.git`,
          })),
          lastCommitHash: 'a'.repeat(40), // Full SHA
          lastCommitMessage: 'Commit message with unicode: 测试 🚀 ' + 'more text '.repeat(100),
          lastCommitTimestamp: new Date('2023-01-01T00:00:00.000Z'),
        };

        const result = GitStatusSchema.safeParse(maxGitStatus);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.staged).toHaveLength(1000);
          expect(result.data.unstaged).toHaveLength(1000);
          expect(result.data.untracked).toHaveLength(500);
          expect(result.data.remotes).toHaveLength(20);
        }
      });

      it('validates all possible git file status combinations', () => {
        const allStatuses: GitChangedFile['status'][] = ['M', 'A', 'D', 'R', 'C', 'U'];

        allStatuses.forEach(status => {
          const gitStatus: GitStatus = {
            isRepository: true,
            branch: 'main',
            remoteBranch: null,
            ahead: 0,
            behind: 0,
            staged: [{ path: `file-${status}.ts`, status }],
            unstaged: [{ path: `unstaged-${status}.ts`, status }],
            untracked: [],
            hasConflicts: status === 'U',
            isDirty: true,
            stashCount: 0,
            remotes: [],
          };

          const result = GitStatusSchema.safeParse(gitStatus);
          expect(result.success).toBe(true);
        });
      });

      it('validates edge cases for timestamps', () => {
        const timestampCases = [
          new Date(0), // Unix epoch
          new Date('1970-01-01T00:00:00.000Z'),
          new Date('2099-12-31T23:59:59.999Z'),
          new Date(), // Current time
        ];

        timestampCases.forEach(timestamp => {
          const gitStatus: GitStatus = {
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
            lastCommitTimestamp: timestamp,
          };

          const result = GitStatusSchema.safeParse(gitStatus);
          expect(result.success).toBe(true);
        });
      });

      it('validates complex file paths in git status', () => {
        const complexPaths = [
          'src/components/ComplexComponent.tsx',
          'tests/__tests__/integration/complex.test.ts',
          'docs/README.md',
          'config/environments/production.json',
          'very/deeply/nested/directory/structure/file.js',
          'src/测试文件.ts', // Unicode
          'src/файл.js', // Cyrillic
          'temp/file with spaces.txt',
          'config/file-with-dashes.json',
          'src/file_with_underscores.ts',
          'assets/image@2x.png',
          'scripts/build & deploy.sh',
        ];

        complexPaths.forEach(filePath => {
          const gitStatus: GitStatus = {
            isRepository: true,
            branch: 'main',
            remoteBranch: null,
            ahead: 0,
            behind: 0,
            staged: [{ path: filePath, status: 'M' }],
            unstaged: [],
            untracked: [filePath + '.backup'],
            hasConflicts: false,
            isDirty: true,
            stashCount: 0,
            remotes: [],
          };

          const result = GitStatusSchema.safeParse(gitStatus);
          expect(result.success).toBe(true);
        });
      });
    });
  });

  describe('ProjectContextAnalyzer Boundary Value Testing', () => {
    it('handles extremely small project directories', async () => {
      const analyzer = new ProjectContextAnalyzer('/', {
        maxDepth: 0,
        excludeDirectories: [],
      });

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await analyzer.analyze();

      expect(context.structure.root).toBe('/');
      expect(context.structure.excludedDirectories).toEqual([]);
    });

    it('handles project paths with extreme lengths', async () => {
      const veryLongPath = '/project/' + 'very-long-directory-name-'.repeat(50) + '/final';
      const analyzer = new ProjectContextAnalyzer(veryLongPath);

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await analyzer.analyze();

      expect(context.structure.root).toBe(veryLongPath);
      expect(context.structure.root.length).toBeGreaterThan(1000);
    });

    it('handles option boundaries correctly', () => {
      const boundaryOptions = [
        { maxDepth: 0 },
        { maxDepth: 1 },
        { maxDepth: Number.MAX_SAFE_INTEGER },
        { excludeDirectories: [] },
        { excludeDirectories: Array.from({ length: 1000 }, (_, i) => `dir${i}`) },
      ];

      boundaryOptions.forEach(options => {
        expect(() => {
          new ProjectContextAnalyzer('/test', options);
        }).not.toThrow();
      });
    });

    it('validates analyzer with all boolean combinations', async () => {
      const booleanCombinations = [
        { analyzeGit: false, detectFrameworks: false, analyzeConfiguration: false, detectTests: false },
        { analyzeGit: true, detectFrameworks: false, analyzeConfiguration: false, detectTests: false },
        { analyzeGit: false, detectFrameworks: true, analyzeConfiguration: false, detectTests: false },
        { analyzeGit: false, detectFrameworks: false, analyzeConfiguration: true, detectTests: false },
        { analyzeGit: false, detectFrameworks: false, analyzeConfiguration: false, detectTests: true },
        { analyzeGit: true, detectFrameworks: true, analyzeConfiguration: true, detectTests: true },
      ];

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      for (const options of booleanCombinations) {
        const analyzer = new ProjectContextAnalyzer('/test', options);
        const context = await analyzer.analyze();

        expect(context).toBeDefined();
        expect(() => ProjectContextSchema.parse(context)).not.toThrow();

        // Verify options are respected
        if (!options.analyzeGit) {
          expect(context.gitStatus).toBeUndefined();
        }
      }
    });
  });

  describe('Data Type Coercion and Validation', () => {
    it('handles numeric edge cases in git parsing', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      // Test various number formats
      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'main\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0000000\t0000001\n', stderr: '' }) // Leading zeros
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'abc123|commit|1000000000\n', stderr: '' }) // Large timestamp
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const context = await analyzer.analyze();

      expect(context.gitStatus?.ahead).toBe(0);
      expect(context.gitStatus?.behind).toBe(1);
      expect(context.gitStatus?.lastCommitTimestamp).toEqual(new Date(1000000000 * 1000));
    });

    it('validates string trimming and normalization', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: '  main  \n', stderr: '' }) // Extra whitespace
        .mockResolvedValueOnce({ stdout: '   origin/main   \n', stderr: '' }) // Extra whitespace
        .mockResolvedValueOnce({ stdout: '1\t2\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'M  file.ts   \n', stderr: '' }) // Trailing whitespace
        .mockResolvedValueOnce({ stdout: 'abc123|  commit message  |1640995200\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin\t  git@github.com:user/repo.git  \t(fetch)\n', stderr: '' });

      const context = await analyzer.analyze();

      expect(context.gitStatus?.branch).toBe('main'); // Trimmed
      expect(context.gitStatus?.remoteBranch).toBe('origin/main'); // Trimmed
      expect(context.gitStatus?.lastCommitMessage).toBe('commit message'); // Trimmed
      expect(context.gitStatus?.remotes[0]?.url).toBe('git@github.com:user/repo.git'); // Trimmed
    });

    it('handles empty array scenarios correctly', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await analyzer.analyze();

      // All arrays should be defined and empty
      expect(context.gitStatus?.staged).toEqual([]);
      expect(context.gitStatus?.unstaged).toEqual([]);
      expect(context.gitStatus?.untracked).toEqual([]);
      expect(context.gitStatus?.remotes).toEqual([]);
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.errors).toEqual([]);
      expect(context.structure.entries).toEqual([]);
      expect(context.structure.rootFiles).toEqual([]);
      expect(context.structure.commonDirectories).toEqual([]);
    });
  });

  describe('Schema Error Message Validation', () => {
    it('provides detailed error information for invalid framework detection', () => {
      const invalidData = {
        frameworks: 'not an array',
        languages: 'also not an array',
        primaryLanguage: 123, // Should be string
        runtime: true, // Should be string
        packageManager: [], // Should be string
      };

      const result = FrameworkDetectionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues).toBeDefined();
        expect(result.error.issues.length).toBeGreaterThan(0);

        // Check that error messages contain relevant information
        const errorMessage = result.error.message;
        expect(errorMessage).toContain('Expected array');
      }
    });

    it('provides specific error details for invalid config file types', () => {
      const invalidConfig = {
        name: 'test.config',
        path: './test.config',
        type: 'invalid-type-name', // Not in enum
        exists: 'not a boolean', // Should be boolean
      };

      const result = ConfigFileInfoSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);

      if (!result.success) {
        const issues = result.error.issues;
        const typeIssue = issues.find(issue => issue.path.includes('type'));
        const existsIssue = issues.find(issue => issue.path.includes('exists'));

        expect(typeIssue).toBeDefined();
        expect(existsIssue).toBeDefined();
      }
    });

    it('validates nested schema error reporting', () => {
      const nestedInvalid = {
        frameworks: [
          {
            name: 'React',
            confidence: 'high', // Should be number
            indicators: 'package.json', // Should be array
            version: 123, // Should be string
          }
        ],
        languages: [
          {
            name: 456, // Should be string
            extensions: 'not an array', // Should be array
            percentage: 'fifty percent', // Should be number
          }
        ],
      };

      const result = FrameworkDetectionSchema.safeParse(nestedInvalid);
      expect(result.success).toBe(false);

      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.length).toBeGreaterThan(3); // Multiple nested errors

        // Should have errors for confidence, indicators, version, name, extensions, percentage
        const errorPaths = issues.map(issue => issue.path.join('.'));
        expect(errorPaths.some(path => path.includes('confidence'))).toBe(true);
        expect(errorPaths.some(path => path.includes('indicators'))).toBe(true);
        expect(errorPaths.some(path => path.includes('percentage'))).toBe(true);
      }
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles very large string values efficiently', async () => {
      const analyzer = new ProjectContextAnalyzer('/test');
      const massiveString = 'x'.repeat(100000); // 100KB string

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: massiveString + '\n', stderr: '' }) // Massive branch name
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '0\t0\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({
          stdout: `abc123|${massiveString}|1640995200\n`, // Massive commit message
          stderr: ''
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const startTime = Date.now();
      const context = await analyzer.analyze();
      const endTime = Date.now();

      expect(context.gitStatus?.branch).toBe(massiveString);
      expect(context.gitStatus?.lastCommitMessage).toBe(massiveString);
      expect(endTime - startTime).toBeLessThan(1000); // Should still be fast
    });

    it('handles deep nesting in data structures', () => {
      // Test with deeply nested configuration structures
      const deepConfig: ConfigurationInfo = {
        name: 'DeepConfig',
        type: 'other',
        files: ['deep.config.json'],
        isConfigured: true,
        settings: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    deepValue: 'nested data',
                    deepArray: Array.from({ length: 100 }, (_, i) => ({
                      id: i,
                      value: `item${i}`,
                      nested: {
                        more: 'data',
                        evenMore: Array.from({ length: 10 }, (_, j) => j),
                      },
                    })),
                  },
                },
              },
            },
          },
        },
      };

      const result = ConfigurationInfoSchema.safeParse(deepConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.settings).toBeDefined();
      }
    });
  });

  describe('Real-world Scenario Simulation', () => {
    it('simulates complex monorepo git status', async () => {
      const analyzer = new ProjectContextAnalyzer('/monorepo');

      // Simulate complex monorepo with many packages and changes
      const complexGitStatus = `
M  packages/core/src/analyzer.ts
M  packages/core/package.json
A  packages/new-package/index.ts
A  packages/new-package/package.json
D  packages/deprecated/old.ts
R  packages/renamed/old-name.ts -> packages/renamed/new-name.ts
??  packages/core/temp/debug.log
??  node_modules/.cache/temp.file
M  docs/README.md
M  turbo.json
??  .env.local
`.trim();

      mockExecAsync
        .mockResolvedValueOnce({ stdout: '.git', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'feature/monorepo-improvements\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'origin/feature/monorepo-improvements\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '5\t2\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: complexGitStatus, stderr: '' })
        .mockResolvedValueOnce({
          stdout: 'a1b2c3d|feat: improve monorepo structure and tooling|1640995200\n',
          stderr: ''
        })
        .mockResolvedValueOnce({
          stdout: 'stash@{0}: WIP on feature branch\nstash@{1}: backup before refactor\n',
          stderr: ''
        })
        .mockResolvedValueOnce({
          stdout: 'origin\tgit@github.com:company/monorepo.git\t(fetch)\nupstream\tgit@github.com:upstream/monorepo.git\t(fetch)\n',
          stderr: ''
        });

      const context = await analyzer.analyze();

      expect(context.gitStatus?.isRepository).toBe(true);
      expect(context.gitStatus?.branch).toBe('feature/monorepo-improvements');
      expect(context.gitStatus?.ahead).toBe(5);
      expect(context.gitStatus?.behind).toBe(2);
      expect(context.gitStatus?.staged).toHaveLength(5); // M, M, A, A, D
      expect(context.gitStatus?.untracked).toHaveLength(3); // ??, ??, ??
      expect(context.gitStatus?.isDirty).toBe(true);
      expect(context.gitStatus?.stashCount).toBe(2);
      expect(context.gitStatus?.remotes).toHaveLength(2);

      // Verify specific file changes
      const stagedPaths = context.gitStatus!.staged.map(f => f.path);
      expect(stagedPaths).toContain('packages/core/src/analyzer.ts');
      expect(stagedPaths).toContain('packages/new-package/index.ts');

      const untrackedPaths = context.gitStatus!.untracked;
      expect(untrackedPaths).toContain('packages/core/temp/debug.log');
      expect(untrackedPaths).toContain('.env.local');
    });

    it('simulates framework detection edge cases for real projects', async () => {
      const analyzer = new ProjectContextAnalyzer('/real-project');

      mockExecAsync.mockRejectedValue(new Error('not a git repo'));

      const context = await analyzer.analyze();

      // Even without actual implementation, should handle gracefully
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
    });
  });
});

describe('ProjectContextAnalyzer - Integration with Type System', () => {
  it('ensures all exported types match runtime behavior', async () => {
    const analyzer = new ProjectContextAnalyzer('/type-test');

    mockExecAsync.mockRejectedValue(new Error('not a git repo'));
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });

    const context = await analyzer.analyze();

    // Verify the return type matches ProjectContext interface
    const keys: (keyof ProjectContext)[] = [
      'structure',
      'frameworks',
      'configurations',
      'testFrameworks',
      'detectedAt',
      'errors',
    ];

    keys.forEach(key => {
      expect(context).toHaveProperty(key);
    });

    // Optional properties
    if (context.gitStatus) {
      const gitKeys: (keyof GitStatus)[] = [
        'isRepository',
        'branch',
        'remoteBranch',
        'ahead',
        'behind',
        'staged',
        'unstaged',
        'untracked',
        'hasConflicts',
        'isDirty',
        'stashCount',
        'remotes',
      ];

      gitKeys.forEach(key => {
        expect(context.gitStatus).toHaveProperty(key);
      });
    }

    // Verify array types
    expect(Array.isArray(context.frameworks)).toBe(true);
    expect(Array.isArray(context.configurations)).toBe(true);
    expect(Array.isArray(context.testFrameworks)).toBe(true);
    expect(Array.isArray(context.errors)).toBe(true);

    if (context.gitStatus) {
      expect(Array.isArray(context.gitStatus.staged)).toBe(true);
      expect(Array.isArray(context.gitStatus.unstaged)).toBe(true);
      expect(Array.isArray(context.gitStatus.untracked)).toBe(true);
      expect(Array.isArray(context.gitStatus.remotes)).toBe(true);
    }
  });

  it('validates that all schemas accept valid runtime data', async () => {
    const analyzer = new ProjectContextAnalyzer('/schema-test');

    mockExecAsync.mockRejectedValue(new Error('not a git repo'));
    mockGetPlatformShell.mockReturnValue({
      shell: '/bin/sh',
      shellArgs: ['-c']
    });

    const context = await analyzer.analyze();
    const gitStatus = await analyzer.getGitStatus();
    const structure = await analyzer.getProjectStructure();
    const frameworks = await analyzer.detectFrameworks();
    const configs = await analyzer.getConfigurationInfoList();
    const testFrameworks = await analyzer.getTestFrameworkInfoList();

    // All should pass schema validation
    expect(() => ProjectContextSchema.parse(context)).not.toThrow();
    expect(() => GitStatusSchema.parse(gitStatus)).not.toThrow();
    expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
    expect(() => FrameworkDetectionSchema.parse(frameworks)).not.toThrow();

    configs.forEach(config => {
      expect(() => ConfigurationInfoSchema.parse(config)).not.toThrow();
    });

    testFrameworks.forEach(framework => {
      expect(() => TestFrameworkInfoSchema.parse(framework)).not.toThrow();
    });
  });
});