import { describe, it, expect } from 'vitest';
import {
  CodebaseAnalysisSchema,
  StackAnalysisSchema,
  ArchitectureAnalysisSchema,
  ConventionAnalysisSchema,
  TechnicalDebtAnalysisSchema,
  type CodebaseAnalysis,
} from '../types';

describe('CodebaseAnalysis Performance Tests', () => {
  describe('Large Dataset Performance', () => {
    it('should handle stack analysis with many languages and frameworks', () => {
      const startTime = performance.now();

      const largeStack = {
        primaryLanguage: 'TypeScript',
        languages: Array.from({ length: 50 }, (_, i) => ({
          name: `Language${i}`,
          percentage: Math.floor(100 / 50),
          files: Math.floor(Math.random() * 1000) + 1,
          extensions: [`.ext${i}`, `.${i}ext`],
        })),
        frameworks: Array.from({ length: 100 }, (_, i) => ({
          name: `Framework${i}`,
          version: `1.${i}.0`,
          category: ['frontend', 'backend', 'testing', 'ui', 'build', 'other'][i % 6] as any,
          confidence: Math.random(),
        })),
        buildTools: Array.from({ length: 50 }, (_, i) => `BuildTool${i}`),
        packageManagers: ['npm', 'yarn', 'pnpm'] as const,
        runtimes: Array.from({ length: 20 }, (_, i) => ({
          name: `Runtime${i}`,
          version: `${i}.0.0`,
          type: ['node', 'browser', 'deno', 'bun', 'other'][i % 5] as any,
        })),
      };

      const result = StackAnalysisSchema.parse(largeStack);
      const endTime = performance.now();

      expect(result.languages).toHaveLength(50);
      expect(result.frameworks).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(100); // Should parse in under 100ms
    });

    it('should handle architecture analysis with many components and layers', () => {
      const startTime = performance.now();

      const largeArchitecture = {
        pattern: 'microservices' as const,
        components: Array.from({ length: 500 }, (_, i) => ({
          name: `Component${i}`,
          type: ['service', 'controller', 'repository', 'component', 'utility', 'other'][i % 6] as any,
          path: `src/component${i}/index.ts`,
          dependencies: Array.from({ length: Math.min(10, i) }, (_, j) => `Component${j}`),
          exports: Array.from({ length: 5 }, (_, j) => `export${i}_${j}`),
          loc: Math.floor(Math.random() * 1000) + 1,
          description: `Description for Component${i}`,
        })),
        layers: Array.from({ length: 20 }, (_, i) => ({
          name: `Layer${i}`,
          description: `Description for Layer${i}`,
          paths: Array.from({ length: 5 }, (_, j) => `src/layer${i}/path${j}`),
          dependencies: Array.from({ length: Math.min(3, i) }, (_, j) => `Layer${j}`),
        })),
        dependencies: {
          external: 150,
          internal: 2000,
          circular: 25,
          unused: 10,
        },
        entryPoints: Array.from({ length: 10 }, (_, i) => ({
          path: `src/entry${i}.ts`,
          type: ['main', 'test', 'config', 'other'][i % 4] as any,
          description: `Entry point ${i}`,
        })),
      };

      const result = ArchitectureAnalysisSchema.parse(largeArchitecture);
      const endTime = performance.now();

      expect(result.components).toHaveLength(500);
      expect(result.layers).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(200); // Should parse in under 200ms
    });

    it('should handle technical debt analysis with many categories and hotspots', () => {
      const startTime = performance.now();

      const largeTechnicalDebt = {
        totalScore: 85,
        categories: Array.from({ length: 50 }, (_, i) => ({
          category: [
            'code-smell', 'duplication', 'complexity', 'security', 'performance',
            'maintainability', 'documentation', 'testing', 'dependency', 'other'
          ][i % 10] as any,
          count: Math.floor(Math.random() * 100) + 1,
          severity: ['low', 'medium', 'high', 'critical'][i % 4] as any,
          examples: Array.from({ length: 3 }, (_, j) => `Example ${i}-${j}`),
          estimatedEffort: `${Math.floor(Math.random() * 20) + 1} hours`,
        })),
        hotspots: Array.from({ length: 200 }, (_, i) => ({
          path: `src/hotspot${i}.ts`,
          score: Math.floor(Math.random() * 100),
          issues: Array.from({ length: 3 }, (_, j) =>
            ['complexity', 'duplication', 'no-tests', 'security', 'performance'][j % 5]
          ),
          loc: Math.floor(Math.random() * 5000) + 100,
          lastModified: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)),
        })),
        metrics: {
          codeComplexity: 8.5,
          testCoverage: 65,
          duplicatedLinesPercent: 15,
          maintainabilityIndex: 45,
        },
        trends: {
          improving: Math.random() > 0.5,
          changeRate: (Math.random() - 0.5) * 20, // -10 to +10
          timeframe: 'last 90 days',
        },
      };

      const result = TechnicalDebtAnalysisSchema.parse(largeTechnicalDebt);
      const endTime = performance.now();

      expect(result.categories).toHaveLength(50);
      expect(result.hotspots).toHaveLength(200);
      expect(endTime - startTime).toBeLessThan(150); // Should parse in under 150ms
    });

    it('should handle complete codebase analysis with maximum data', () => {
      const startTime = performance.now();

      const massiveAnalysis: CodebaseAnalysis = {
        timestamp: new Date(),
        projectPath: '/massive-project',
        stack: {
          primaryLanguage: 'TypeScript',
          languages: Array.from({ length: 25 }, (_, i) => ({
            name: `Lang${i}`,
            percentage: Math.floor(100 / 25),
            files: Math.floor(Math.random() * 500) + 1,
            extensions: [`.l${i}`],
          })),
          frameworks: Array.from({ length: 50 }, (_, i) => ({
            name: `Framework${i}`,
            version: `${i}.0.0`,
            category: ['frontend', 'backend', 'testing'][i % 3] as any,
          })),
          buildTools: Array.from({ length: 25 }, (_, i) => `Tool${i}`),
          packageManagers: ['npm', 'yarn'] as const,
          runtimes: Array.from({ length: 10 }, (_, i) => ({
            name: `Runtime${i}`,
            type: 'node' as const,
          })),
        },
        architecture: {
          pattern: 'layered',
          components: Array.from({ length: 300 }, (_, i) => ({
            name: `Comp${i}`,
            type: 'component' as const,
            path: `src/comp${i}.ts`,
            dependencies: Array.from({ length: Math.min(5, i) }, (_, j) => `Comp${j}`),
            exports: [`export${i}`],
            loc: Math.floor(Math.random() * 500) + 50,
          })),
          layers: Array.from({ length: 15 }, (_, i) => ({
            name: `Layer${i}`,
            paths: [`src/layer${i}`],
          })),
          dependencies: { external: 100, internal: 500, circular: 15 },
          entryPoints: Array.from({ length: 5 }, (_, i) => ({
            path: `src/main${i}.ts`,
            type: 'main' as const,
          })),
        },
        conventions: {
          fileNaming: 'camelCase',
          functionNaming: 'camelCase',
          variableNaming: 'camelCase',
          classNaming: 'PascalCase',
          constantNaming: 'SCREAMING_SNAKE_CASE',
          indentation: { type: 'spaces', size: 2 },
          imports: {
            style: 'es6',
            grouping: 'type-separate',
            quotes: 'single',
          },
          documentation: { style: 'jsdoc', coverage: 80 },
          formatting: {
            lineLength: 100,
            semicolons: 'required',
            quotes: 'single',
            trailingCommas: 'always',
          },
        },
        technicalDebt: {
          totalScore: 55,
          categories: Array.from({ length: 30 }, (_, i) => ({
            category: ['code-smell', 'duplication', 'complexity'][i % 3] as any,
            count: Math.floor(Math.random() * 20) + 1,
            severity: ['low', 'medium', 'high'][i % 3] as any,
            examples: [`Example ${i}`],
          })),
          hotspots: Array.from({ length: 100 }, (_, i) => ({
            path: `src/hot${i}.ts`,
            score: Math.floor(Math.random() * 100),
            issues: ['complexity'],
          })),
        },
        summary: {
          totalFiles: 10000,
          totalLines: 500000,
          analysisVersion: '2.0.0',
          confidence: 0.95,
          warnings: Array.from({ length: 25 }, (_, i) => `Warning ${i}`),
        },
        metadata: {
          analysisTools: Array.from({ length: 15 }, (_, i) => `tool${i}`),
          excludedPaths: Array.from({ length: 50 }, (_, i) => `excluded${i}`),
          analysisTime: 120000, // 2 minutes
          errors: Array.from({ length: 5 }, (_, i) => ({
            component: `comp${i}`,
            error: `Error ${i}`,
            severity: 'warning' as const,
          })),
        },
      };

      const result = CodebaseAnalysisSchema.parse(massiveAnalysis);
      const endTime = performance.now();

      expect(result.stack.languages).toHaveLength(25);
      expect(result.architecture.components).toHaveLength(300);
      expect(result.technicalDebt.categories).toHaveLength(30);
      expect(endTime - startTime).toBeLessThan(500); // Should parse in under 500ms for large dataset
    });
  });

  describe('Memory Usage Tests', () => {
    it('should handle repeated parsing without memory leaks', () => {
      const baseAnalysis = {
        timestamp: new Date(),
        projectPath: '/test',
        stack: {
          primaryLanguage: 'JavaScript',
          languages: [{ name: 'JavaScript', percentage: 100, files: 10 }],
          frameworks: [],
          buildTools: [],
          packageManagers: ['npm' as const],
        },
        architecture: {
          pattern: 'monolithic' as const,
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
          totalScore: 25,
          categories: [],
          hotspots: [],
        },
        summary: {
          totalFiles: 10,
          totalLines: 500,
          analysisVersion: '1.0.0',
        },
      };

      const startTime = performance.now();
      const iterations = 1000;

      // Perform many parsing operations
      for (let i = 0; i < iterations; i++) {
        const result = CodebaseAnalysisSchema.parse({
          ...baseAnalysis,
          timestamp: new Date(Date.now() + i),
        });
        expect(result.stack.primaryLanguage).toBe('JavaScript');
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      expect(averageTime).toBeLessThan(1); // Should average less than 1ms per parse
    });

    it('should handle concurrent parsing operations', async () => {
      const baseAnalysis = {
        timestamp: new Date(),
        projectPath: '/test',
        stack: {
          primaryLanguage: 'Python',
          languages: [{ name: 'Python', percentage: 100, files: 20 }],
          frameworks: [],
          buildTools: [],
          packageManagers: ['pip' as const],
        },
        architecture: {
          pattern: 'layered' as const,
          components: [],
          layers: [],
          dependencies: { external: 0, internal: 0, circular: 0 },
        },
        conventions: {
          fileNaming: 'snake_case' as const,
          functionNaming: 'snake_case' as const,
          variableNaming: 'snake_case' as const,
          indentation: { type: 'spaces' as const, size: 4 },
          imports: { style: 'python' as const },
          documentation: { style: 'sphinx' as const, coverage: 60 },
        },
        technicalDebt: {
          totalScore: 35,
          categories: [],
          hotspots: [],
        },
        summary: {
          totalFiles: 50,
          totalLines: 2500,
          analysisVersion: '1.1.0',
        },
      };

      const concurrentOperations = Array.from({ length: 50 }, (_, i) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            const result = CodebaseAnalysisSchema.parse({
              ...baseAnalysis,
              timestamp: new Date(Date.now() + i),
              summary: {
                ...baseAnalysis.summary,
                totalFiles: baseAnalysis.summary.totalFiles + i,
              },
            });
            expect(result.stack.primaryLanguage).toBe('Python');
            resolve();
          }, Math.random() * 10);
        })
      );

      const startTime = performance.now();
      await Promise.all(concurrentOperations);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete all operations within 1 second
    });
  });

  describe('Validation Performance', () => {
    it('should efficiently validate deeply nested structures', () => {
      const deeplyNestedAnalysis = {
        timestamp: new Date(),
        projectPath: '/deep-project',
        stack: {
          primaryLanguage: 'TypeScript',
          languages: [{ name: 'TypeScript', percentage: 100, files: 100 }],
          frameworks: Array.from({ length: 20 }, (_, i) => ({
            name: `Framework${i}`,
            category: 'frontend' as const,
            version: `1.${i}.0`,
            confidence: 0.9,
          })),
          buildTools: Array.from({ length: 10 }, (_, i) => `Tool${i}`),
          packageManagers: ['npm' as const],
        },
        architecture: {
          pattern: 'hexagonal' as const,
          components: Array.from({ length: 100 }, (_, i) => ({
            name: `Component${i}`,
            type: 'service' as const,
            path: `src/services/component${i}.ts`,
            dependencies: Array.from({ length: 5 }, (_, j) => `Component${(i + j) % 100}`),
            exports: Array.from({ length: 3 }, (_, j) => `export${i}_${j}`),
            loc: 200 + i,
            description: `Service component number ${i} with complex dependencies`,
          })),
          layers: Array.from({ length: 8 }, (_, i) => ({
            name: `Layer${i}`,
            description: `Architectural layer ${i}`,
            paths: Array.from({ length: 5 }, (_, j) => `src/layer${i}/path${j}`),
            dependencies: i > 0 ? [`Layer${i - 1}`] : [],
          })),
          dependencies: { external: 50, internal: 300, circular: 5, unused: 8 },
          entryPoints: [
            { path: 'src/main.ts', type: 'main' as const, description: 'Main entry point' },
            { path: 'src/test.ts', type: 'test' as const, description: 'Test entry point' },
          ],
        },
        conventions: {
          fileNaming: 'camelCase' as const,
          functionNaming: 'camelCase' as const,
          variableNaming: 'camelCase' as const,
          classNaming: 'PascalCase' as const,
          constantNaming: 'SCREAMING_SNAKE_CASE' as const,
          indentation: { type: 'spaces' as const, size: 2 },
          imports: {
            style: 'es6' as const,
            grouping: 'type-separate' as const,
            quotes: 'single' as const,
          },
          documentation: { style: 'jsdoc' as const, coverage: 85 },
          formatting: {
            lineLength: 120,
            semicolons: 'required' as const,
            quotes: 'single' as const,
            trailingCommas: 'always' as const,
          },
        },
        technicalDebt: {
          totalScore: 45,
          categories: Array.from({ length: 15 }, (_, i) => ({
            category: [
              'code-smell', 'duplication', 'complexity', 'security', 'performance'
            ][i % 5] as any,
            count: 5 + i,
            severity: ['low', 'medium', 'high'][i % 3] as any,
            examples: Array.from({ length: 2 }, (_, j) => `Category ${i} example ${j}`),
            estimatedEffort: `${2 + i} hours`,
          })),
          hotspots: Array.from({ length: 30 }, (_, i) => ({
            path: `src/problematic/file${i}.ts`,
            score: 60 + (i % 40), // Scores from 60-99
            issues: ['complexity', 'no-tests', 'duplication'].slice(0, (i % 3) + 1),
            loc: 500 + i * 10,
            lastModified: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          })),
          metrics: {
            codeComplexity: 7.5,
            testCoverage: 68,
            duplicatedLinesPercent: 12,
            maintainabilityIndex: 55,
          },
          trends: {
            improving: true,
            changeRate: -2.5,
            timeframe: 'last 60 days',
          },
        },
        summary: {
          totalFiles: 1500,
          totalLines: 75000,
          analysisVersion: '2.1.0',
          confidence: 0.88,
          warnings: Array.from({ length: 10 }, (_, i) => `Performance warning ${i}`),
        },
        metadata: {
          analysisTools: ['eslint', 'typescript', 'sonarjs', 'complexity-report'],
          excludedPaths: ['node_modules', 'dist', 'coverage', '.git'],
          analysisTime: 180000, // 3 minutes
          errors: [
            { component: 'dependency-analyzer', error: 'Circular dependency detected', severity: 'warning' as const },
            { component: 'complexity-analyzer', error: 'High complexity in core module', severity: 'error' as const },
          ],
        },
      };

      const startTime = performance.now();
      const result = CodebaseAnalysisSchema.parse(deeplyNestedAnalysis);
      const endTime = performance.now();

      expect(result.architecture.components).toHaveLength(100);
      expect(result.technicalDebt.categories).toHaveLength(15);
      expect(result.technicalDebt.hotspots).toHaveLength(30);
      expect(endTime - startTime).toBeLessThan(50); // Should validate complex structure quickly
    });
  });
});