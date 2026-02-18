import { describe, it, expect } from 'vitest';
import {
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkInfoSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  ProjectContextSchema,
  ProjectContext,
} from '../types';

describe('Project Context Integration Tests', () => {
  describe('Schema exports integration', () => {
    it('should export all schemas from types module', () => {
      // Verify all schemas are properly exported and callable
      expect(GitStatusSchema).toBeDefined();
      expect(GitStatusSchema.parse).toBeDefined();

      expect(ProjectStructureSchema).toBeDefined();
      expect(ProjectStructureSchema.parse).toBeDefined();

      expect(FrameworkInfoSchema).toBeDefined();
      expect(FrameworkInfoSchema.parse).toBeDefined();

      expect(ConfigurationInfoSchema).toBeDefined();
      expect(ConfigurationInfoSchema.parse).toBeDefined();

      expect(TestFrameworkInfoSchema).toBeDefined();
      expect(TestFrameworkInfoSchema.parse).toBeDefined();

      expect(ProjectContextSchema).toBeDefined();
      expect(ProjectContextSchema.parse).toBeDefined();
    });

    it('should validate schemas work together in aggregate', () => {
      const fullProjectContext = {
        gitStatus: {
          isRepository: true,
          branch: 'integration-test',
          hasUncommittedChanges: false,
          hasUntrackedFiles: false,
          isClean: true,
          ahead: 0,
          behind: 0,
        },
        structure: {
          root: '/test/integration',
          totalFiles: 42,
          totalDirectories: 7,
          primaryLanguages: ['typescript'],
          packageManager: 'npm',
        },
        frameworks: [{
          name: 'Test Framework',
          version: '1.0.0',
          category: 'testing',
          configFiles: ['test.config.js'],
          isMainFramework: true,
        }],
        configurations: [{
          name: 'test.json',
          path: 'configs/test.json',
          format: 'json',
          purpose: 'testing',
          isValid: true,
        }],
        testFrameworks: [{
          name: 'vitest',
          version: '1.0.0',
          type: 'unit',
          configFiles: ['vitest.config.ts'],
          isActive: true,
        }],
        detectedAt: new Date('2024-01-15T12:00:00Z'),
      };

      // Should parse without errors
      const result = ProjectContextSchema.parse(fullProjectContext);

      expect(result.gitStatus?.branch).toBe('integration-test');
      expect(result.structure?.totalFiles).toBe(42);
      expect(result.frameworks).toHaveLength(1);
      expect(result.configurations).toHaveLength(1);
      expect(result.testFrameworks).toHaveLength(1);
      expect(result.detectedAt).toBeInstanceOf(Date);
    });
  });

  describe('Type compatibility', () => {
    it('should work with type annotations and inference', () => {
      // Test type annotation works
      const context: ProjectContext = {
        gitStatus: {
          isRepository: false,
        },
        structure: {
          root: '/simple',
          totalFiles: 1,
          totalDirectories: 1,
          primaryLanguages: ['text'],
        },
      };

      // Test inference works
      const inferredContext = {
        frameworks: [],
        configurations: [],
        testFrameworks: [],
      };

      const typedInferred: ProjectContext = inferredContext;

      expect(context.gitStatus?.isRepository).toBe(false);
      expect(typedInferred.frameworks).toEqual([]);
    });

    it('should support destructuring and spread operations', () => {
      const baseContext: ProjectContext = {
        structure: {
          root: '/base',
          totalFiles: 10,
          totalDirectories: 2,
          primaryLanguages: ['javascript'],
        },
      };

      const { structure } = baseContext;
      expect(structure?.root).toBe('/base');

      const mergedContext: ProjectContext = {
        ...baseContext,
        gitStatus: {
          isRepository: true,
          branch: 'main',
          hasUncommittedChanges: false,
          hasUntrackedFiles: false,
          isClean: true,
          ahead: 0,
          behind: 0,
        },
      };

      expect(mergedContext.structure?.root).toBe('/base');
      expect(mergedContext.gitStatus?.branch).toBe('main');
    });
  });

  describe('Error handling and validation', () => {
    it('should provide meaningful error messages for invalid data', () => {
      // Test invalid gitStatus
      expect(() => {
        GitStatusSchema.parse({
          branch: 'main',
          // Missing required isRepository field
        });
      }).toThrow();

      // Test invalid structure
      expect(() => {
        ProjectStructureSchema.parse({
          root: '/test',
          totalFiles: 'not-a-number', // Invalid type
          totalDirectories: 2,
          primaryLanguages: ['js'],
        });
      }).toThrow();

      // Test invalid framework category
      expect(() => {
        FrameworkInfoSchema.parse({
          name: 'Invalid Framework',
          version: '1.0.0',
          category: 'invalid-category',
        });
      }).toThrow();
    });

    it('should handle deeply nested validation errors', () => {
      expect(() => {
        ProjectContextSchema.parse({
          gitStatus: {
            isRepository: 'not-boolean', // Invalid type
          },
          frameworks: [{
            name: 'Test',
            // Missing version and category
          }],
        });
      }).toThrow();
    });

    it('should accept empty or minimal valid data', () => {
      // Empty object should work with defaults
      expect(() => ProjectContextSchema.parse({})).not.toThrow();

      // Minimal valid data should work
      expect(() => {
        ProjectContextSchema.parse({
          gitStatus: { isRepository: false },
        });
      }).not.toThrow();
    });
  });

  describe('Default values and optional fields', () => {
    it('should apply default values correctly', () => {
      const minimal = ProjectContextSchema.parse({});

      expect(minimal.frameworks).toEqual([]);
      expect(minimal.configurations).toEqual([]);
      expect(minimal.testFrameworks).toEqual([]);
      expect(minimal.gitStatus).toBeUndefined();
      expect(minimal.structure).toBeUndefined();
      expect(minimal.detectedAt).toBeUndefined();
    });

    it('should preserve provided values over defaults', () => {
      const withValues = ProjectContextSchema.parse({
        frameworks: [{
          name: 'React',
          version: '18.0.0',
          category: 'frontend',
        }],
        configurations: [{
          name: 'config.json',
          path: './config.json',
          format: 'json',
        }],
        testFrameworks: [{
          name: 'jest',
          version: '29.0.0',
          type: 'unit',
        }],
      });

      expect(withValues.frameworks).toHaveLength(1);
      expect(withValues.configurations).toHaveLength(1);
      expect(withValues.testFrameworks).toHaveLength(1);
    });
  });

  describe('Real-world scenario validation', () => {
    it('should handle typical monorepo project context', () => {
      const monorepoContext = {
        gitStatus: {
          isRepository: true,
          branch: 'develop',
          hasUncommittedChanges: true,
          hasUntrackedFiles: false,
          isClean: false,
          ahead: 5,
          behind: 2,
        },
        structure: {
          root: '/workspace/monorepo',
          totalFiles: 15000,
          totalDirectories: 500,
          sizeInBytes: 1073741824,
          primaryLanguages: ['typescript', 'javascript', 'python', 'rust'],
          packageManager: 'yarn',
        },
        frameworks: [
          {
            name: 'Next.js',
            version: '14.0.0',
            category: 'fullstack',
            configFiles: ['next.config.js'],
            isMainFramework: true,
            features: ['ssr', 'static-generation'],
          },
          {
            name: 'FastAPI',
            version: '0.104.0',
            category: 'backend',
            configFiles: ['requirements.txt'],
            isMainFramework: false,
          },
          {
            name: 'Tauri',
            version: '1.5.0',
            category: 'other',
            configFiles: ['Cargo.toml', 'tauri.conf.json'],
            isMainFramework: false,
          },
        ],
        configurations: [
          {
            name: 'package.json',
            path: 'package.json',
            format: 'json',
            purpose: 'package-manager',
            isValid: true,
          },
          {
            name: 'tsconfig.json',
            path: 'tsconfig.json',
            format: 'json',
            purpose: 'typescript',
            isValid: true,
          },
          {
            name: 'docker-compose.yml',
            path: 'docker-compose.yml',
            format: 'yaml',
            purpose: 'containerization',
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
            features: ['coverage', 'mocking'],
            testPatterns: ['**/*.test.ts'],
          },
          {
            name: 'playwright',
            version: '1.40.0',
            type: 'e2e',
            configFiles: ['playwright.config.ts'],
            isActive: true,
            features: ['browser-testing'],
          },
          {
            name: 'pytest',
            version: '7.4.0',
            type: 'unit',
            configFiles: ['pytest.ini'],
            isActive: true,
          },
        ],
        detectedAt: new Date(),
      };

      const result = ProjectContextSchema.parse(monorepoContext);

      expect(result.gitStatus?.branch).toBe('develop');
      expect(result.structure?.packageManager).toBe('yarn');
      expect(result.frameworks).toHaveLength(3);
      expect(result.configurations).toHaveLength(3);
      expect(result.testFrameworks).toHaveLength(3);
      expect(result.structure?.primaryLanguages).toContain('rust');
    });

    it('should handle simple single-language project', () => {
      const simpleProject = {
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
          root: '/projects/hello-world',
          totalFiles: 3,
          totalDirectories: 1,
          primaryLanguages: ['python'],
        },
        configurations: [
          {
            name: 'requirements.txt',
            path: 'requirements.txt',
            format: 'other',
            purpose: 'dependencies',
            isValid: true,
          },
        ],
      };

      const result = ProjectContextSchema.parse(simpleProject);

      expect(result.structure?.primaryLanguages).toEqual(['python']);
      expect(result.frameworks).toEqual([]);
      expect(result.testFrameworks).toEqual([]);
      expect(result.configurations).toHaveLength(1);
    });
  });
});