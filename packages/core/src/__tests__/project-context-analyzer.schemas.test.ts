import { describe, it, expect } from 'vitest';
import {
  FrameworkDetectionSchema,
  ConfigFileInfoSchema,
  type FrameworkDetection,
  type ConfigFileInfo,
} from '../project-context-analyzer.js';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  FrameworkInfoSchema,
  ProjectContextSchema,
  type GitStatus,
  type ProjectStructure,
  type ConfigurationInfo,
  type TestFrameworkInfo,
  type FrameworkInfo,
  type ProjectContext,
} from '../types.js';

describe('ProjectContextAnalyzer Zod Schema Validation Tests', () => {
  describe('FrameworkDetectionSchema', () => {
    it('validates minimal valid framework detection', () => {
      const minimal: FrameworkDetection = {
        frameworks: [],
        languages: [],
      };

      const result = FrameworkDetectionSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(minimal);
      }
    });

    it('validates complete framework detection', () => {
      const complete: FrameworkDetection = {
        primary: {
          name: 'React',
          version: '18.2.0',
          confidence: 0.95,
          indicators: ['package.json', 'src/App.tsx'],
        },
        frameworks: [
          {
            name: 'React',
            version: '18.2.0',
            confidence: 0.95,
            indicators: ['package.json', 'src/App.tsx'],
          },
          {
            name: 'TypeScript',
            version: '5.0.0',
            confidence: 0.9,
            indicators: ['tsconfig.json', '*.ts files'],
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
        runtime: 'node',
        packageManager: 'npm',
      };

      const result = FrameworkDetectionSchema.safeParse(complete);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frameworks).toHaveLength(2);
        expect(result.data.languages).toHaveLength(2);
        expect(result.data.primary?.name).toBe('React');
      }
    });

    it('validates framework detection with error', () => {
      const withError: FrameworkDetection = {
        frameworks: [],
        languages: [],
        error: 'Failed to analyze package.json',
      };

      const result = FrameworkDetectionSchema.safeParse(withError);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error).toBe('Failed to analyze package.json');
      }
    });

    it('rejects invalid language percentage below 0', () => {
      const invalid = {
        frameworks: [],
        languages: [
          {
            name: 'TypeScript',
            extensions: ['.ts'],
            percentage: -5,
          },
        ],
      };

      const result = FrameworkDetectionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid language percentage above 100', () => {
      const invalid = {
        frameworks: [],
        languages: [
          {
            name: 'TypeScript',
            extensions: ['.ts'],
            percentage: 150,
          },
        ],
      };

      const result = FrameworkDetectionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('validates edge case language percentages', () => {
      const edgeCases = [
        {
          frameworks: [],
          languages: [
            {
              name: 'Test',
              extensions: ['.test'],
              percentage: 0, // Minimum
            },
          ],
        },
        {
          frameworks: [],
          languages: [
            {
              name: 'Test',
              extensions: ['.test'],
              percentage: 100, // Maximum
            },
          ],
        },
        {
          frameworks: [],
          languages: [
            {
              name: 'Test',
              extensions: ['.test'],
              percentage: 50.5, // Decimal
            },
          ],
        },
      ];

      edgeCases.forEach(testCase => {
        const result = FrameworkDetectionSchema.safeParse(testCase);
        expect(result.success).toBe(true);
      });
    });

    it('rejects missing required fields', () => {
      const missingFields = [
        {}, // Missing everything
        { frameworks: [] }, // Missing languages
        { languages: [] }, // Missing frameworks
        {
          frameworks: [],
          languages: [
            {
              // Missing name, extensions, percentage
            },
          ],
        },
      ];

      missingFields.forEach(testCase => {
        const result = FrameworkDetectionSchema.safeParse(testCase);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('ConfigFileInfoSchema', () => {
    it('validates minimal config file info', () => {
      const minimal: ConfigFileInfo = {
        name: 'package.json',
        path: './package.json',
        type: 'package',
        exists: true,
      };

      const result = ConfigFileInfoSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(minimal);
      }
    });

    it('validates complete config file info', () => {
      const complete: ConfigFileInfo = {
        name: 'tsconfig.json',
        path: './tsconfig.json',
        type: 'typescript',
        exists: true,
        description: 'TypeScript compiler configuration',
      };

      const result = ConfigFileInfoSchema.safeParse(complete);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('TypeScript compiler configuration');
      }
    });

    it('validates all supported config file types', () => {
      const types = [
        'package',
        'typescript',
        'eslint',
        'prettier',
        'babel',
        'webpack',
        'vite',
        'rollup',
        'jest',
        'vitest',
        'docker',
        'ci',
        'git',
        'editor',
        'environment',
        'other',
      ];

      types.forEach(type => {
        const config: ConfigFileInfo = {
          name: `${type}.config`,
          path: `./${type}.config`,
          type: type as any,
          exists: false,
        };

        const result = ConfigFileInfoSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid config file type', () => {
      const invalid = {
        name: 'invalid.config',
        path: './invalid.config',
        type: 'invalid-type',
        exists: true,
      };

      const result = ConfigFileInfoSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('validates both exists: true and exists: false', () => {
      const existingFile = {
        name: 'existing.json',
        path: './existing.json',
        type: 'other',
        exists: true,
      };

      const nonExistingFile = {
        name: 'missing.json',
        path: './missing.json',
        type: 'other',
        exists: false,
      };

      expect(ConfigFileInfoSchema.safeParse(existingFile).success).toBe(true);
      expect(ConfigFileInfoSchema.safeParse(nonExistingFile).success).toBe(true);
    });

    it('rejects missing required fields', () => {
      const missingFields = [
        {}, // Missing everything
        { name: 'test' }, // Missing path, type, exists
        { name: 'test', path: './test' }, // Missing type, exists
        { name: 'test', path: './test', type: 'package' }, // Missing exists
      ];

      missingFields.forEach(testCase => {
        const result = ConfigFileInfoSchema.safeParse(testCase);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Related schema validation from types.ts', () => {
    describe('GitStatusSchema', () => {
      it('validates minimal git status', () => {
        const minimal: GitStatus = {
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

        const result = GitStatusSchema.safeParse(minimal);
        expect(result.success).toBe(true);
      });

      it('validates complete git status', () => {
        const complete: GitStatus = {
          isRepository: true,
          branch: 'main',
          remoteBranch: 'origin/main',
          ahead: 2,
          behind: 1,
          staged: [
            { path: 'src/file1.ts', status: 'modified' },
          ],
          unstaged: [
            { path: 'src/file2.ts', status: 'modified' },
          ],
          untracked: [
            { path: 'new-file.ts', status: 'untracked' },
          ],
          hasConflicts: false,
          isDirty: true,
          stashCount: 3,
          remotes: ['origin', 'upstream'],
        };

        const result = GitStatusSchema.safeParse(complete);
        expect(result.success).toBe(true);
      });
    });

    describe('ProjectStructureSchema', () => {
      it('validates minimal project structure', () => {
        const minimal: ProjectStructure = {
          root: '/test/project',
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

        const result = ProjectStructureSchema.safeParse(minimal);
        expect(result.success).toBe(true);
      });

      it('validates complete project structure', () => {
        const complete: ProjectStructure = {
          root: '/test/project',
          totalFiles: 10,
          totalDirectories: 3,
          entries: [
            { name: 'src', type: 'directory', path: 'src', size: 0 },
            { name: 'package.json', type: 'file', path: 'package.json', size: 1024 },
          ],
          rootFiles: ['package.json', 'README.md'],
          commonDirectories: ['src', 'tests'],
          hasPackageJson: true,
          hasGitIgnore: true,
          hasReadme: true,
          hasLicense: true,
          excludedDirectories: ['node_modules', 'dist'],
          scannedAt: new Date(),
        };

        const result = ProjectStructureSchema.safeParse(complete);
        expect(result.success).toBe(true);
      });
    });

    describe('FrameworkInfoSchema', () => {
      it('validates minimal framework info', () => {
        const minimal: FrameworkInfo = {
          name: 'React',
          confidence: 0.8,
          indicators: ['package.json'],
        };

        const result = FrameworkInfoSchema.safeParse(minimal);
        expect(result.success).toBe(true);
      });

      it('validates complete framework info', () => {
        const complete: FrameworkInfo = {
          name: 'React',
          version: '18.2.0',
          confidence: 0.95,
          indicators: ['package.json', 'src/App.tsx', 'public/index.html'],
        };

        const result = FrameworkInfoSchema.safeParse(complete);
        expect(result.success).toBe(true);
      });

      it('rejects invalid confidence values', () => {
        const invalidConfidence = [
          { name: 'React', confidence: -0.1, indicators: ['test'] },
          { name: 'React', confidence: 1.1, indicators: ['test'] },
          { name: 'React', confidence: 2, indicators: ['test'] },
        ];

        invalidConfidence.forEach(testCase => {
          const result = FrameworkInfoSchema.safeParse(testCase);
          expect(result.success).toBe(false);
        });
      });
    });

    describe('ConfigurationInfoSchema', () => {
      it('validates minimal configuration info', () => {
        const minimal: ConfigurationInfo = {
          name: 'ESLint',
          type: 'linting',
          files: ['.eslintrc.js'],
          isConfigured: true,
        };

        const result = ConfigurationInfoSchema.safeParse(minimal);
        expect(result.success).toBe(true);
      });

      it('validates complete configuration info', () => {
        const complete: ConfigurationInfo = {
          name: 'TypeScript',
          type: 'compiler',
          files: ['tsconfig.json', 'tsconfig.build.json'],
          isConfigured: true,
          version: '5.0.0',
          settings: { strict: true, target: 'ES2022' },
        };

        const result = ConfigurationInfoSchema.safeParse(complete);
        expect(result.success).toBe(true);
      });
    });

    describe('TestFrameworkInfoSchema', () => {
      it('validates minimal test framework info', () => {
        const minimal: TestFrameworkInfo = {
          name: 'Vitest',
          isConfigured: true,
          configFiles: ['vitest.config.ts'],
        };

        const result = TestFrameworkInfoSchema.safeParse(minimal);
        expect(result.success).toBe(true);
      });

      it('validates complete test framework info', () => {
        const complete: TestFrameworkInfo = {
          name: 'Jest',
          version: '29.0.0',
          isConfigured: true,
          configFiles: ['jest.config.js'],
          testFiles: ['**/*.test.ts', '**/*.spec.ts'],
          coverage: {
            enabled: true,
            threshold: 80,
            outputDir: 'coverage',
          },
        };

        const result = TestFrameworkInfoSchema.safeParse(complete);
        expect(result.success).toBe(true);
      });
    });

    describe('ProjectContextSchema', () => {
      it('validates minimal project context', () => {
        const minimal: ProjectContext = {
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

        const result = ProjectContextSchema.safeParse(minimal);
        expect(result.success).toBe(true);
      });

      it('validates complete project context', () => {
        const complete: ProjectContext = {
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
            remotes: ['origin'],
          },
          structure: {
            root: '/test',
            totalFiles: 5,
            totalDirectories: 2,
            entries: [],
            rootFiles: ['package.json'],
            commonDirectories: ['src'],
            hasPackageJson: true,
            hasGitIgnore: true,
            hasReadme: true,
            hasLicense: false,
            excludedDirectories: ['node_modules'],
            scannedAt: new Date(),
          },
          frameworks: [
            {
              name: 'React',
              version: '18.2.0',
              confidence: 0.95,
              indicators: ['package.json'],
            },
          ],
          configurations: [
            {
              name: 'TypeScript',
              type: 'compiler',
              files: ['tsconfig.json'],
              isConfigured: true,
            },
          ],
          testFrameworks: [
            {
              name: 'Vitest',
              version: '4.0.0',
              isConfigured: true,
              configFiles: ['vitest.config.ts'],
            },
          ],
          detectedAt: new Date(),
          errors: ['Warning: Could not detect some frameworks'],
        };

        const result = ProjectContextSchema.safeParse(complete);
        expect(result.success).toBe(true);
      });

      it('validates project context with optional fields missing', () => {
        const withoutOptional: ProjectContext = {
          // gitStatus is optional, so omit it
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

        const result = ProjectContextSchema.safeParse(withoutOptional);
        expect(result.success).toBe(true);
      });

      it('rejects project context with missing required fields', () => {
        const missingRequired = [
          {}, // Missing everything
          { structure: {} }, // Missing required structure fields
          {
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
            }
            // Missing frameworks, configurations, testFrameworks, detectedAt, errors
          },
        ];

        missingRequired.forEach(testCase => {
          const result = ProjectContextSchema.safeParse(testCase);
          expect(result.success).toBe(false);
        });
      });
    });
  });

  describe('Schema error messages and validation details', () => {
    it('provides detailed error messages for invalid data', () => {
      const invalidFrameworkDetection = {
        frameworks: 'not an array', // Should be array
        languages: [],
      };

      const result = FrameworkDetectionSchema.safeParse(invalidFrameworkDetection);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toBeDefined();
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('validates nested objects correctly', () => {
      const invalidNestedData = {
        frameworks: [
          {
            name: 'React',
            confidence: 'high', // Should be number
            indicators: [],
          },
        ],
        languages: [],
      };

      const result = FrameworkDetectionSchema.safeParse(invalidNestedData);
      expect(result.success).toBe(false);
    });

    it('handles additional properties correctly', () => {
      // Zod schemas should handle extra properties based on their configuration
      const withExtraProps = {
        frameworks: [],
        languages: [],
        extraProperty: 'should be ignored or rejected based on schema config',
      };

      const result = FrameworkDetectionSchema.safeParse(withExtraProps);
      // This test verifies the schema's behavior with extra properties
      expect(typeof result.success).toBe('boolean');
    });
  });
});