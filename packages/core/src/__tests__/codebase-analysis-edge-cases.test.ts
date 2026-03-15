import { describe, it, expect } from 'vitest';
import {
  CodebaseAnalysisSchema,
  StackAnalysisSchema,
  ArchitectureAnalysisSchema,
  ConventionAnalysisSchema,
  TechnicalDebtAnalysisSchema,
  type CodebaseAnalysis,
  type StackAnalysis,
  type ArchitectureAnalysis,
  type ConventionAnalysis,
  type TechnicalDebtAnalysis,
} from '../types';

describe('CodebaseAnalysis Edge Cases and Boundary Conditions', () => {
  describe('StackAnalysis Edge Cases', () => {
    it('should handle boundary values for language percentages', () => {
      const stackWithBoundaryValues: StackAnalysis = {
        primaryLanguage: 'TypeScript',
        languages: [
          { name: 'TypeScript', percentage: 0, files: 0 }, // Minimum values
          { name: 'JavaScript', percentage: 100, files: 1000 }, // Maximum percentage
        ],
        frameworks: [],
        buildTools: [],
        packageManagers: ['npm'],
      };

      expect(() => StackAnalysisSchema.parse(stackWithBoundaryValues)).not.toThrow();
    });

    it('should reject negative percentages', () => {
      const invalidStack = {
        primaryLanguage: 'TypeScript',
        languages: [
          { name: 'TypeScript', percentage: -1, files: 10 },
        ],
        frameworks: [],
        buildTools: [],
        packageManagers: ['npm' as const],
      };

      expect(() => StackAnalysisSchema.parse(invalidStack)).toThrow();
    });

    it('should reject percentages over 100', () => {
      const invalidStack = {
        primaryLanguage: 'TypeScript',
        languages: [
          { name: 'TypeScript', percentage: 101, files: 10 },
        ],
        frameworks: [],
        buildTools: [],
        packageManagers: ['npm' as const],
      };

      expect(() => StackAnalysisSchema.parse(invalidStack)).toThrow();
    });

    it('should reject negative file counts', () => {
      const invalidStack = {
        primaryLanguage: 'TypeScript',
        languages: [
          { name: 'TypeScript', percentage: 100, files: -1 },
        ],
        frameworks: [],
        buildTools: [],
        packageManagers: ['npm' as const],
      };

      expect(() => StackAnalysisSchema.parse(invalidStack)).toThrow();
    });

    it('should handle framework confidence boundary values', () => {
      const stackWithConfidenceBounds: StackAnalysis = {
        primaryLanguage: 'JavaScript',
        languages: [
          { name: 'JavaScript', percentage: 100, files: 50 },
        ],
        frameworks: [
          { name: 'React', category: 'frontend', confidence: 0 }, // Minimum confidence
          { name: 'Express', category: 'backend', confidence: 1 }, // Maximum confidence
        ],
        buildTools: [],
        packageManagers: ['npm'],
      };

      expect(() => StackAnalysisSchema.parse(stackWithConfidenceBounds)).not.toThrow();
    });

    it('should reject confidence values outside 0-1 range', () => {
      const invalidStack = {
        primaryLanguage: 'TypeScript',
        languages: [{ name: 'TypeScript', percentage: 100, files: 10 }],
        frameworks: [
          { name: 'React', category: 'frontend' as const, confidence: 1.5 }, // Invalid confidence
        ],
        buildTools: [],
        packageManagers: ['npm' as const],
      };

      expect(() => StackAnalysisSchema.parse(invalidStack)).toThrow();
    });

    it('should handle empty arrays gracefully', () => {
      const stackWithEmptyArrays: StackAnalysis = {
        primaryLanguage: 'Python',
        languages: [{ name: 'Python', percentage: 100, files: 25 }],
        frameworks: [], // Empty array
        buildTools: [], // Empty array
        packageManagers: ['pip'],
        runtimes: [], // Empty array
      };

      expect(() => StackAnalysisSchema.parse(stackWithEmptyArrays)).not.toThrow();
    });
  });

  describe('ArchitectureAnalysis Edge Cases', () => {
    it('should handle components with zero lines of code', () => {
      const archWithZeroLoc: ArchitectureAnalysis = {
        pattern: 'layered',
        components: [
          {
            name: 'EmptyComponent',
            type: 'component',
            path: 'src/empty.ts',
            loc: 0, // Zero lines of code
          },
        ],
        layers: [],
        dependencies: { external: 0, internal: 0, circular: 0 },
      };

      expect(() => ArchitectureAnalysisSchema.parse(archWithZeroLoc)).not.toThrow();
    });

    it('should reject negative lines of code', () => {
      const invalidArch = {
        pattern: 'layered' as const,
        components: [
          {
            name: 'InvalidComponent',
            type: 'component' as const,
            path: 'src/invalid.ts',
            loc: -1, // Invalid negative LOC
          },
        ],
        layers: [],
        dependencies: { external: 0, internal: 0, circular: 0 },
      };

      expect(() => ArchitectureAnalysisSchema.parse(invalidArch)).toThrow();
    });

    it('should handle large dependency counts', () => {
      const archWithManyDeps: ArchitectureAnalysis = {
        pattern: 'microservices',
        components: [],
        layers: [],
        dependencies: {
          external: 1000,
          internal: 5000,
          circular: 50,
          unused: 25,
        },
      };

      expect(() => ArchitectureAnalysisSchema.parse(archWithManyDeps)).not.toThrow();
    });

    it('should handle components with many dependencies and exports', () => {
      const componentWithManyDeps = {
        name: 'ComplexComponent',
        type: 'service' as const,
        path: 'src/complex.ts',
        dependencies: Array.from({ length: 100 }, (_, i) => `Dep${i}`),
        exports: Array.from({ length: 50 }, (_, i) => `export${i}`),
        loc: 2500,
      };

      const arch: ArchitectureAnalysis = {
        pattern: 'layered',
        components: [componentWithManyDeps],
        layers: [],
        dependencies: { external: 100, internal: 50, circular: 0 },
      };

      expect(() => ArchitectureAnalysisSchema.parse(arch)).not.toThrow();
    });
  });

  describe('ConventionAnalysis Edge Cases', () => {
    it('should handle boundary indentation sizes', () => {
      const conventionWithBoundaryIndent: ConventionAnalysis = {
        fileNaming: 'camelCase',
        functionNaming: 'camelCase',
        variableNaming: 'camelCase',
        indentation: { type: 'spaces', size: 1 }, // Minimum size
        imports: { style: 'es6' },
        documentation: { style: 'jsdoc', coverage: 0 },
      };

      expect(() => ConventionAnalysisSchema.parse(conventionWithBoundaryIndent)).not.toThrow();

      const conventionWithMaxIndent: ConventionAnalysis = {
        fileNaming: 'kebab-case',
        functionNaming: 'snake_case',
        variableNaming: 'snake_case',
        indentation: { type: 'tabs', size: 8 }, // Maximum size
        imports: { style: 'commonjs' },
        documentation: { style: 'none', coverage: 100 },
      };

      expect(() => ConventionAnalysisSchema.parse(conventionWithMaxIndent)).not.toThrow();
    });

    it('should reject invalid indentation sizes', () => {
      const invalidConvention = {
        fileNaming: 'camelCase' as const,
        functionNaming: 'camelCase' as const,
        variableNaming: 'camelCase' as const,
        indentation: { type: 'spaces' as const, size: 0 }, // Invalid size (< 1)
        imports: { style: 'es6' as const },
        documentation: { style: 'jsdoc' as const, coverage: 75 },
      };

      expect(() => ConventionAnalysisSchema.parse(invalidConvention)).toThrow();

      const invalidConvention2 = {
        fileNaming: 'camelCase' as const,
        functionNaming: 'camelCase' as const,
        variableNaming: 'camelCase' as const,
        indentation: { type: 'spaces' as const, size: 9 }, // Invalid size (> 8)
        imports: { style: 'es6' as const },
        documentation: { style: 'jsdoc' as const, coverage: 75 },
      };

      expect(() => ConventionAnalysisSchema.parse(invalidConvention2)).toThrow();
    });

    it('should handle boundary documentation coverage values', () => {
      const conventionWithZeroCoverage: ConventionAnalysis = {
        fileNaming: 'PascalCase',
        functionNaming: 'camelCase',
        variableNaming: 'camelCase',
        indentation: { type: 'spaces' },
        imports: { style: 'es6' },
        documentation: { style: 'none', coverage: 0 }, // Minimum coverage
      };

      expect(() => ConventionAnalysisSchema.parse(conventionWithZeroCoverage)).not.toThrow();

      const conventionWithFullCoverage: ConventionAnalysis = {
        fileNaming: 'snake_case',
        functionNaming: 'snake_case',
        variableNaming: 'SCREAMING_SNAKE_CASE',
        indentation: { type: 'tabs' },
        imports: { style: 'commonjs' },
        documentation: { style: 'markdown', coverage: 100 }, // Maximum coverage
      };

      expect(() => ConventionAnalysisSchema.parse(conventionWithFullCoverage)).not.toThrow();
    });

    it('should reject invalid documentation coverage', () => {
      const invalidConvention = {
        fileNaming: 'camelCase' as const,
        functionNaming: 'camelCase' as const,
        variableNaming: 'camelCase' as const,
        indentation: { type: 'spaces' as const },
        imports: { style: 'es6' as const },
        documentation: { style: 'jsdoc' as const, coverage: -1 }, // Invalid negative coverage
      };

      expect(() => ConventionAnalysisSchema.parse(invalidConvention)).toThrow();

      const invalidConvention2 = {
        fileNaming: 'camelCase' as const,
        functionNaming: 'camelCase' as const,
        variableNaming: 'camelCase' as const,
        indentation: { type: 'spaces' as const },
        imports: { style: 'es6' as const },
        documentation: { style: 'jsdoc' as const, coverage: 101 }, // Invalid coverage > 100
      };

      expect(() => ConventionAnalysisSchema.parse(invalidConvention2)).toThrow();
    });
  });

  describe('TechnicalDebtAnalysis Edge Cases', () => {
    it('should handle boundary debt scores', () => {
      const debtWithMinScore: TechnicalDebtAnalysis = {
        totalScore: 0, // Minimum score
        categories: [],
        hotspots: [],
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(debtWithMinScore)).not.toThrow();

      const debtWithMaxScore: TechnicalDebtAnalysis = {
        totalScore: 100, // Maximum score
        categories: [],
        hotspots: [],
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(debtWithMaxScore)).not.toThrow();
    });

    it('should reject scores outside 0-100 range', () => {
      const invalidDebt1 = {
        totalScore: -1, // Invalid negative score
        categories: [],
        hotspots: [],
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(invalidDebt1)).toThrow();

      const invalidDebt2 = {
        totalScore: 101, // Invalid score > 100
        categories: [],
        hotspots: [],
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(invalidDebt2)).toThrow();
    });

    it('should handle hotspots with boundary values', () => {
      const debtWithBoundaryHotspots: TechnicalDebtAnalysis = {
        totalScore: 50,
        categories: [],
        hotspots: [
          {
            path: 'minimal.ts',
            score: 0, // Minimum hotspot score
            issues: [],
            loc: 0, // Minimum LOC
          },
          {
            path: 'maximal.ts',
            score: 100, // Maximum hotspot score
            issues: ['complexity', 'duplication'],
            loc: 10000, // Large LOC
            lastModified: new Date(),
          },
        ],
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(debtWithBoundaryHotspots)).not.toThrow();
    });

    it('should reject invalid hotspot scores', () => {
      const invalidDebt = {
        totalScore: 50,
        categories: [],
        hotspots: [
          {
            path: 'invalid.ts',
            score: 101, // Invalid score > 100
            issues: [],
          },
        ],
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(invalidDebt)).toThrow();
    });

    it('should handle metrics with boundary values', () => {
      const debtWithBoundaryMetrics: TechnicalDebtAnalysis = {
        totalScore: 30,
        categories: [],
        hotspots: [],
        metrics: {
          codeComplexity: 0, // Minimum complexity
          testCoverage: 0, // Minimum coverage
          duplicatedLinesPercent: 0, // Minimum duplication
          maintainabilityIndex: 0, // Minimum maintainability
        },
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(debtWithBoundaryMetrics)).not.toThrow();

      const debtWithHighMetrics: TechnicalDebtAnalysis = {
        totalScore: 80,
        categories: [],
        hotspots: [],
        metrics: {
          codeComplexity: 50, // High complexity
          testCoverage: 100, // Full coverage
          duplicatedLinesPercent: 100, // All duplicated
          maintainabilityIndex: 100, // Maximum maintainability
        },
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(debtWithHighMetrics)).not.toThrow();
    });

    it('should reject invalid metric values', () => {
      const invalidDebt1 = {
        totalScore: 50,
        categories: [],
        hotspots: [],
        metrics: {
          testCoverage: -1, // Invalid negative coverage
        },
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(invalidDebt1)).toThrow();

      const invalidDebt2 = {
        totalScore: 50,
        categories: [],
        hotspots: [],
        metrics: {
          testCoverage: 101, // Invalid coverage > 100
        },
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(invalidDebt2)).toThrow();

      const invalidDebt3 = {
        totalScore: 50,
        categories: [],
        hotspots: [],
        metrics: {
          duplicatedLinesPercent: 101, // Invalid percentage > 100
        },
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(invalidDebt3)).toThrow();
    });
  });

  describe('CodebaseAnalysis Integration Edge Cases', () => {
    it('should handle analysis with boundary summary values', () => {
      const analysisWithBoundarySummary: CodebaseAnalysis = {
        timestamp: new Date(),
        projectPath: '',
        stack: {
          primaryLanguage: 'TypeScript',
          languages: [{ name: 'TypeScript', percentage: 100, files: 1 }],
          frameworks: [],
          buildTools: [],
          packageManagers: ['npm'],
        },
        architecture: {
          pattern: 'monolithic',
          components: [],
          layers: [],
          dependencies: { external: 0, internal: 0, circular: 0 },
        },
        conventions: {
          fileNaming: 'mixed',
          functionNaming: 'inconsistent',
          variableNaming: 'mixed',
          indentation: { type: 'mixed' },
          imports: { style: 'mixed' },
          documentation: { style: 'mixed', coverage: 50 },
        },
        technicalDebt: {
          totalScore: 0,
          categories: [],
          hotspots: [],
        },
        summary: {
          totalFiles: 0, // Minimum files
          totalLines: 0, // Minimum lines
          analysisVersion: '1.0.0',
          confidence: 0, // Minimum confidence
          warnings: [],
        },
      };

      expect(() => CodebaseAnalysisSchema.parse(analysisWithBoundarySummary)).not.toThrow();
    });

    it('should reject analysis with invalid summary values', () => {
      const invalidAnalysis = {
        timestamp: new Date(),
        projectPath: '/path',
        stack: {
          primaryLanguage: 'TypeScript',
          languages: [{ name: 'TypeScript', percentage: 100, files: 50 }],
          frameworks: [],
          buildTools: [],
          packageManagers: ['npm' as const],
        },
        architecture: {
          pattern: 'layered' as const,
          components: [],
          layers: [],
          dependencies: { external: 0, internal: 0, circular: 0 },
        },
        conventions: {
          fileNaming: 'camelCase' as const,
          functionNaming: 'camelCase' as const,
          variableNaming: 'camelCase' as const,
          indentation: { type: 'spaces' as const },
          imports: { style: 'es6' as const },
          documentation: { style: 'jsdoc' as const, coverage: 75 },
        },
        technicalDebt: {
          totalScore: 30,
          categories: [],
          hotspots: [],
        },
        summary: {
          totalFiles: -1, // Invalid negative value
          totalLines: 1000,
          analysisVersion: '1.0.0',
        },
      };

      expect(() => CodebaseAnalysisSchema.parse(invalidAnalysis)).toThrow();
    });

    it('should handle analysis with all enum edge cases', () => {
      const analysisWithEdgeCaseEnums: CodebaseAnalysis = {
        timestamp: new Date(),
        projectPath: '/edge-case-project',
        stack: {
          primaryLanguage: 'Other',
          languages: [{ name: 'Other', percentage: 100, files: 10 }],
          frameworks: [
            { name: 'CustomFramework', category: 'other' },
          ],
          buildTools: [],
          packageManagers: ['other'],
          runtimes: [{ name: 'CustomRuntime', type: 'other' }],
        },
        architecture: {
          pattern: 'other', // Edge case enum value
          components: [{
            name: 'EdgeComponent',
            type: 'other', // Edge case enum value
            path: 'src/edge.ts',
          }],
          layers: [],
          dependencies: { external: 0, internal: 0, circular: 0 },
          entryPoints: [{ path: 'src/main.ts', type: 'other' }], // Edge case enum value
        },
        conventions: {
          fileNaming: 'inconsistent', // Edge case enum value
          functionNaming: 'mixed', // Edge case enum value
          variableNaming: 'inconsistent', // Edge case enum value
          indentation: { type: 'mixed' }, // Edge case enum value
          imports: {
            style: 'mixed', // Edge case enum value
            grouping: 'none',
            quotes: 'mixed',
          },
          documentation: { style: 'mixed', coverage: 25 }, // Edge case enum value
          formatting: {
            quotes: 'mixed', // Edge case enum value
            trailingCommas: 'mixed', // Edge case enum value
          },
        },
        technicalDebt: {
          totalScore: 75,
          categories: [
            { category: 'other', count: 5, severity: 'critical' }, // Edge case enum values
          ],
          hotspots: [],
        },
        summary: {
          totalFiles: 50,
          totalLines: 2500,
          analysisVersion: '1.0.0',
        },
      };

      expect(() => CodebaseAnalysisSchema.parse(analysisWithEdgeCaseEnums)).not.toThrow();
    });

    it('should handle analysis with maximum metadata complexity', () => {
      const analysisWithComplexMetadata: CodebaseAnalysis = {
        timestamp: new Date(),
        projectPath: '/complex-project',
        stack: {
          primaryLanguage: 'JavaScript',
          languages: [{ name: 'JavaScript', percentage: 100, files: 100 }],
          frameworks: [],
          buildTools: [],
          packageManagers: ['npm'],
        },
        architecture: {
          pattern: 'layered',
          components: [],
          layers: [],
          dependencies: { external: 0, internal: 0, circular: 0 },
        },
        conventions: {
          fileNaming: 'camelCase',
          functionNaming: 'camelCase',
          variableNaming: 'camelCase',
          indentation: { type: 'spaces' },
          imports: { style: 'es6' },
          documentation: { style: 'jsdoc', coverage: 80 },
        },
        technicalDebt: {
          totalScore: 40,
          categories: [],
          hotspots: [],
        },
        summary: {
          totalFiles: 500,
          totalLines: 50000,
          analysisVersion: '2.0.0',
          confidence: 0.95,
          warnings: Array.from({ length: 50 }, (_, i) => `Warning ${i}`), // Many warnings
        },
        metadata: {
          analysisTools: Array.from({ length: 20 }, (_, i) => `tool${i}`), // Many tools
          excludedPaths: Array.from({ length: 100 }, (_, i) => `path${i}`), // Many excluded paths
          analysisTime: 300000, // 5 minutes in milliseconds
          errors: Array.from({ length: 10 }, (_, i) => ({
            component: `component-${i}`,
            error: `Error message ${i}`,
            severity: i % 2 === 0 ? 'warning' : 'error' as const,
          })),
        },
      };

      expect(() => CodebaseAnalysisSchema.parse(analysisWithComplexMetadata)).not.toThrow();
    });
  });

  describe('Type Safety and Schema Inference', () => {
    it('should ensure type safety between schemas and inferred types', () => {
      // This test ensures that the TypeScript types match the Zod schemas
      const stackData: StackAnalysis = {
        primaryLanguage: 'TypeScript',
        languages: [{ name: 'TypeScript', percentage: 100, files: 10 }],
        frameworks: [],
        buildTools: [],
        packageManagers: ['npm'],
      };

      const archData: ArchitectureAnalysis = {
        pattern: 'layered',
        components: [],
        layers: [],
        dependencies: { external: 0, internal: 0, circular: 0 },
      };

      const conventionData: ConventionAnalysis = {
        fileNaming: 'camelCase',
        functionNaming: 'camelCase',
        variableNaming: 'camelCase',
        indentation: { type: 'spaces' },
        imports: { style: 'es6' },
        documentation: { style: 'jsdoc', coverage: 75 },
      };

      const debtData: TechnicalDebtAnalysis = {
        totalScore: 25,
        categories: [],
        hotspots: [],
      };

      const analysisData: CodebaseAnalysis = {
        timestamp: new Date(),
        projectPath: '/test',
        stack: stackData,
        architecture: archData,
        conventions: conventionData,
        technicalDebt: debtData,
        summary: {
          totalFiles: 10,
          totalLines: 500,
          analysisVersion: '1.0.0',
        },
      };

      // These should all parse successfully
      expect(() => StackAnalysisSchema.parse(stackData)).not.toThrow();
      expect(() => ArchitectureAnalysisSchema.parse(archData)).not.toThrow();
      expect(() => ConventionAnalysisSchema.parse(conventionData)).not.toThrow();
      expect(() => TechnicalDebtAnalysisSchema.parse(debtData)).not.toThrow();
      expect(() => CodebaseAnalysisSchema.parse(analysisData)).not.toThrow();

      // Verify the parsed data matches the original
      const parsedStack = StackAnalysisSchema.parse(stackData);
      const parsedArch = ArchitectureAnalysisSchema.parse(archData);
      const parsedConvention = ConventionAnalysisSchema.parse(conventionData);
      const parsedDebt = TechnicalDebtAnalysisSchema.parse(debtData);
      const parsedAnalysis = CodebaseAnalysisSchema.parse(analysisData);

      expect(parsedStack.primaryLanguage).toBe(stackData.primaryLanguage);
      expect(parsedArch.pattern).toBe(archData.pattern);
      expect(parsedConvention.fileNaming).toBe(conventionData.fileNaming);
      expect(parsedDebt.totalScore).toBe(debtData.totalScore);
      expect(parsedAnalysis.summary.totalFiles).toBe(analysisData.summary.totalFiles);
    });
  });
});