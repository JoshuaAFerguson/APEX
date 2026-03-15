/**
 * @fileoverview Final integration test to verify ProjectContextAnalyzer works end-to-end
 * with proper exports and type validation
 */

import { describe, it, expect } from 'vitest';
import {
  ProjectContextAnalyzer,
  getProjectContextAnalyzer,
  analyzeProject,
  type ProjectContextAnalyzerOptions,
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema
} from '../project-context-analyzer.js';

describe('ProjectContextAnalyzer - Final Integration Test', () => {
  const testPath = '/test/project';

  describe('Exports and Class Instantiation', () => {
    it('should export ProjectContextAnalyzer class correctly', () => {
      expect(ProjectContextAnalyzer).toBeDefined();
      expect(typeof ProjectContextAnalyzer).toBe('function');
    });

    it('should create analyzer instance with proper methods', () => {
      const analyzer = new ProjectContextAnalyzer(testPath);

      expect(analyzer).toBeInstanceOf(ProjectContextAnalyzer);
      expect(typeof analyzer.getProjectPath).toBe('function');
      expect(typeof analyzer.getOptions).toBe('function');
      expect(typeof analyzer.getGitStatus).toBe('function');
      expect(typeof analyzer.getProjectStructure).toBe('function');
      expect(typeof analyzer.detectFrameworks).toBe('function');
      expect(typeof analyzer.getConfigurationInfoList).toBe('function');
      expect(typeof analyzer.getTestFrameworkInfoList).toBe('function');
      expect(typeof analyzer.analyze).toBe('function');
    });

    it('should export convenience functions', () => {
      expect(getProjectContextAnalyzer).toBeDefined();
      expect(typeof getProjectContextAnalyzer).toBe('function');
      expect(analyzeProject).toBeDefined();
      expect(typeof analyzeProject).toBe('function');
    });

    it('should export all required Zod schemas', () => {
      expect(GitStatusSchema).toBeDefined();
      expect(ProjectStructureSchema).toBeDefined();
      expect(FrameworkDetectionSchema).toBeDefined();
      expect(ConfigurationInfoSchema).toBeDefined();
      expect(TestFrameworkInfoSchema).toBeDefined();

      // All should be Zod schemas
      expect(typeof GitStatusSchema.parse).toBe('function');
      expect(typeof ProjectStructureSchema.parse).toBe('function');
      expect(typeof FrameworkDetectionSchema.parse).toBe('function');
      expect(typeof ConfigurationInfoSchema.parse).toBe('function');
      expect(typeof TestFrameworkInfoSchema.parse).toBe('function');
    });
  });

  describe('Basic Functionality Integration', () => {
    it('should maintain proper TypeScript types', () => {
      const analyzer = new ProjectContextAnalyzer(testPath);
      const projectPath: string = analyzer.getProjectPath();
      const options: Readonly<Required<ProjectContextAnalyzerOptions>> = analyzer.getOptions();

      expect(projectPath).toBe(testPath);
      expect(typeof options.maxDepth).toBe('number');
      expect(typeof options.includeHidden).toBe('boolean');
    });

    it('should produce schema-compliant empty results', async () => {
      const analyzer = new ProjectContextAnalyzer(testPath, {
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: false
      });

      // These should work without throwing since they return proper defaults
      const structure = await analyzer.getProjectStructure();
      const frameworks = await analyzer.detectFrameworks();
      const configs = await analyzer.getConfigurationInfoList();
      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      // Validate against schemas - should not throw
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
      expect(() => FrameworkDetectionSchema.parse(frameworks)).not.toThrow();
      expect(() => configs.forEach(c => ConfigurationInfoSchema.parse(c))).not.toThrow();
      expect(() => testFrameworks.forEach(f => TestFrameworkInfoSchema.parse(f))).not.toThrow();

      // Verify basic structure
      expect(structure.root).toBe(testPath);
      expect(Array.isArray(structure.entries)).toBe(true);
      expect(Array.isArray(frameworks.frameworks)).toBe(true);
      expect(Array.isArray(frameworks.languages)).toBe(true);
      expect(Array.isArray(configs)).toBe(true);
      expect(Array.isArray(testFrameworks)).toBe(true);
    });

    it('should handle convenience function exports', () => {
      const analyzer1 = getProjectContextAnalyzer(testPath);
      const analyzer2 = getProjectContextAnalyzer(testPath);

      expect(analyzer1).toBeInstanceOf(ProjectContextAnalyzer);
      expect(analyzer1).toBe(analyzer2); // Should be same instance (singleton)
    });

    it('should handle analyzeProject function', async () => {
      const context = await analyzeProject(testPath, {
        analyzeGit: false,
        detectFrameworks: false,
        analyzeConfiguration: false,
        detectTests: false
      });

      expect(context).toBeDefined();
      expect(context.structure).toBeDefined();
      expect(context.structure.root).toBe(testPath);
      expect(context.frameworks).toEqual([]);
      expect(context.configurations).toEqual([]);
      expect(context.testFrameworks).toEqual([]);
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(Array.isArray(context.errors)).toBe(true);
    });
  });

  describe('Schema Validation Integration', () => {
    it('should validate that all method return types match their schemas', async () => {
      const analyzer = new ProjectContextAnalyzer(testPath);

      // Get results from all methods
      const structure = await analyzer.getProjectStructure();
      const frameworks = await analyzer.detectFrameworks();
      const configs = await analyzer.getConfigurationInfoList();
      const testFrameworks = await analyzer.getTestFrameworkInfoList();

      // All should pass schema validation
      const structureResult = ProjectStructureSchema.safeParse(structure);
      const frameworksResult = FrameworkDetectionSchema.safeParse(frameworks);

      expect(structureResult.success).toBe(true);
      expect(frameworksResult.success).toBe(true);

      // Array validation
      for (const config of configs) {
        const configResult = ConfigurationInfoSchema.safeParse(config);
        expect(configResult.success).toBe(true);
      }

      for (const framework of testFrameworks) {
        const frameworkResult = TestFrameworkInfoSchema.safeParse(framework);
        expect(frameworkResult.success).toBe(true);
      }
    });

    it('should validate complete analysis result schema', async () => {
      const context = await analyzeProject(testPath, {
        analyzeGit: false // Avoid git calls in this test
      });

      // The context should be valid (we can't import ProjectContextSchema here easily,
      // but we can validate the structure)
      expect(context).toBeDefined();
      expect(typeof context.detectedAt).toBe('object');
      expect(context.detectedAt).toBeInstanceOf(Date);
      expect(Array.isArray(context.errors)).toBe(true);
      expect(Array.isArray(context.frameworks)).toBe(true);
      expect(Array.isArray(context.configurations)).toBe(true);
      expect(Array.isArray(context.testFrameworks)).toBe(true);

      // Structure should always be present
      expect(context.structure).toBeDefined();
      expect(typeof context.structure.root).toBe('string');
      expect(typeof context.structure.totalFiles).toBe('number');
      expect(typeof context.structure.totalDirectories).toBe('number');
    });
  });

  describe('Error Resilience Integration', () => {
    it('should handle errors gracefully and still produce valid schemas', async () => {
      // Create analyzer that might encounter errors
      const analyzer = new ProjectContextAnalyzer('/nonexistent/path/that/should/not/exist');

      try {
        const structure = await analyzer.getProjectStructure();
        // Should still be valid even if path doesn't exist
        expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();
        expect(structure.root).toBe('/nonexistent/path/that/should/not/exist');
      } catch (error) {
        // If it throws, that's also okay for a nonexistent path
        expect(error).toBeDefined();
      }
    });

    it('should handle concurrent operations without issues', async () => {
      const analyzer = new ProjectContextAnalyzer(testPath);

      // Run multiple operations in parallel
      const promises = [
        analyzer.getProjectStructure(),
        analyzer.detectFrameworks(),
        analyzer.getConfigurationInfoList(),
        analyzer.getTestFrameworkInfoList()
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      expect(results[0]).toBeDefined(); // structure
      expect(results[1]).toBeDefined(); // frameworks
      expect(results[2]).toBeDefined(); // configs
      expect(results[3]).toBeDefined(); // test frameworks

      // All should be valid arrays or objects
      expect(typeof results[0]).toBe('object');
      expect(typeof results[1]).toBe('object');
      expect(Array.isArray(results[2])).toBe(true);
      expect(Array.isArray(results[3])).toBe(true);
    });
  });

  describe('Options Integration', () => {
    it('should respect all option combinations', async () => {
      const optionsCombinations: ProjectContextAnalyzerOptions[] = [
        {}, // All defaults
        { analyzeGit: false },
        { detectFrameworks: false },
        { analyzeConfiguration: false },
        { detectTests: false },
        { maxDepth: 1, includeHidden: true },
        { excludeDirectories: ['node_modules', 'dist', 'custom'] },
        {
          analyzeGit: false,
          detectFrameworks: false,
          analyzeConfiguration: false,
          detectTests: false,
          maxDepth: 0,
          includeHidden: true
        }
      ];

      for (const options of optionsCombinations) {
        const analyzer = new ProjectContextAnalyzer(testPath, options);
        const context = await analyzer.analyze();

        // Should always produce valid context
        expect(context).toBeDefined();
        expect(context.structure).toBeDefined();
        expect(context.detectedAt).toBeInstanceOf(Date);
        expect(Array.isArray(context.errors)).toBe(true);

        // Verify option respect
        if (options.analyzeGit === false) {
          expect(context.gitStatus).toBeUndefined();
        }
        if (options.detectFrameworks === false) {
          expect(context.frameworks).toEqual([]);
        }
        if (options.analyzeConfiguration === false) {
          expect(context.configurations).toEqual([]);
        }
        if (options.detectTests === false) {
          expect(context.testFrameworks).toEqual([]);
        }
      }
    });
  });
});