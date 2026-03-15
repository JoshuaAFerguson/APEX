import { describe, it, expect } from 'vitest';
import {
  StackAnalysisSchema,
  StackAnalysis,
  ArchitectureAnalysisSchema,
  ArchitectureAnalysis,
  ConventionAnalysisSchema,
  ConventionAnalysis,
  TechnicalDebtAnalysisSchema,
  TechnicalDebtAnalysis,
  CodebaseAnalysisSchema,
  CodebaseAnalysis,
} from '../types';

describe('CodebaseAnalysis Schemas', () => {
  describe('StackAnalysisSchema', () => {
    it('should parse valid stack analysis', () => {
      const validStack: StackAnalysis = {
        primaryLanguage: 'TypeScript',
        languages: [
          { name: 'TypeScript', percentage: 85, files: 120, extensions: ['.ts', '.tsx'] },
          { name: 'JavaScript', percentage: 15, files: 20, extensions: ['.js', '.jsx'] },
        ],
        frameworks: [
          { name: 'React', version: '18.2.0', category: 'frontend', confidence: 0.95 },
          { name: 'Node.js', version: '18.17.0', category: 'runtime' },
        ],
        buildTools: ['Vite', 'TypeScript'],
        packageManagers: ['npm'],
        runtimes: [
          { name: 'Node.js', version: '18.17.0', type: 'node' },
        ],
      };

      const result = StackAnalysisSchema.parse(validStack);
      expect(result).toEqual(validStack);
    });

    it('should apply defaults for optional fields', () => {
      const minimalStack = {
        primaryLanguage: 'Python',
        languages: [
          { name: 'Python', percentage: 100, files: 50 },
        ],
        frameworks: [
          { name: 'Django', category: 'backend' as const },
        ],
        buildTools: [],
        packageManagers: ['pip' as const],
      };

      const result = StackAnalysisSchema.parse(minimalStack);
      expect(result.runtimes).toEqual([]);
      expect(result.frameworks[0].confidence).toBe(1);
    });

    it('should validate language percentage constraints', () => {
      const invalidStack = {
        primaryLanguage: 'TypeScript',
        languages: [
          { name: 'TypeScript', percentage: 150, files: 120 }, // Invalid percentage
        ],
        frameworks: [],
        buildTools: [],
        packageManagers: ['npm' as const],
      };

      expect(() => StackAnalysisSchema.parse(invalidStack)).toThrow();
    });

    it('should validate framework categories', () => {
      const invalidStack = {
        primaryLanguage: 'TypeScript',
        languages: [
          { name: 'TypeScript', percentage: 100, files: 120 },
        ],
        frameworks: [
          { name: 'React', category: 'invalid-category' }, // Invalid category
        ],
        buildTools: [],
        packageManagers: ['npm' as const],
      };

      expect(() => StackAnalysisSchema.parse(invalidStack)).toThrow();
    });
  });

  describe('ArchitectureAnalysisSchema', () => {
    it('should parse valid architecture analysis', () => {
      const validArch: ArchitectureAnalysis = {
        pattern: 'layered',
        components: [
          {
            name: 'UserService',
            type: 'service',
            path: 'src/services/user.ts',
            dependencies: ['UserRepository'],
            exports: ['createUser', 'getUserById'],
            loc: 250,
          },
          {
            name: 'UserController',
            type: 'controller',
            path: 'src/controllers/user.ts',
          },
        ],
        layers: [
          {
            name: 'presentation',
            description: 'UI components',
            paths: ['src/components'],
            dependencies: ['business'],
          },
          {
            name: 'business',
            paths: ['src/services'],
          },
        ],
        dependencies: {
          external: 25,
          internal: 45,
          circular: 2,
          unused: 3,
        },
        entryPoints: [
          {
            path: 'src/main.ts',
            type: 'main',
            description: 'Application entry point',
          },
        ],
      };

      const result = ArchitectureAnalysisSchema.parse(validArch);
      expect(result).toEqual(validArch);
    });

    it('should apply defaults for optional arrays', () => {
      const minimalArch = {
        pattern: 'mvc' as const,
        components: [
          {
            name: 'TestComponent',
            type: 'component' as const,
            path: 'src/test.ts',
          },
        ],
        layers: [
          {
            name: 'view',
            paths: ['src/views'],
          },
        ],
        dependencies: {
          external: 10,
          internal: 20,
          circular: 0,
        },
      };

      const result = ArchitectureAnalysisSchema.parse(minimalArch);
      expect(result.components[0].dependencies).toEqual([]);
      expect(result.components[0].exports).toEqual([]);
      expect(result.layers[0].dependencies).toEqual([]);
      expect(result.entryPoints).toEqual([]);
      expect(result.dependencies.unused).toBe(0);
    });

    it('should validate component types', () => {
      const invalidArch = {
        pattern: 'layered' as const,
        components: [
          {
            name: 'TestComponent',
            type: 'invalid-type', // Invalid component type
            path: 'src/test.ts',
          },
        ],
        layers: [],
        dependencies: { external: 0, internal: 0, circular: 0 },
      };

      expect(() => ArchitectureAnalysisSchema.parse(invalidArch)).toThrow();
    });
  });

  describe('ConventionAnalysisSchema', () => {
    it('should parse valid convention analysis', () => {
      const validConventions: ConventionAnalysis = {
        fileNaming: 'camelCase',
        functionNaming: 'camelCase',
        variableNaming: 'camelCase',
        classNaming: 'PascalCase',
        constantNaming: 'SCREAMING_SNAKE_CASE',
        indentation: {
          type: 'spaces',
          size: 2,
        },
        imports: {
          style: 'es6',
          grouping: 'type-separate',
          quotes: 'single',
        },
        documentation: {
          style: 'jsdoc',
          coverage: 75,
        },
        formatting: {
          lineLength: 100,
          semicolons: 'required',
          quotes: 'single',
          trailingCommas: 'always',
        },
      };

      const result = ConventionAnalysisSchema.parse(validConventions);
      expect(result).toEqual(validConventions);
    });

    it('should validate indentation size constraints', () => {
      const invalidConventions = {
        fileNaming: 'camelCase' as const,
        functionNaming: 'camelCase' as const,
        variableNaming: 'camelCase' as const,
        indentation: {
          type: 'spaces' as const,
          size: 10, // Invalid size (> 8)
        },
        imports: { style: 'es6' as const },
        documentation: { style: 'jsdoc' as const, coverage: 75 },
      };

      expect(() => ConventionAnalysisSchema.parse(invalidConventions)).toThrow();
    });

    it('should validate documentation coverage range', () => {
      const invalidConventions = {
        fileNaming: 'camelCase' as const,
        functionNaming: 'camelCase' as const,
        variableNaming: 'camelCase' as const,
        indentation: { type: 'spaces' as const },
        imports: { style: 'es6' as const },
        documentation: { style: 'jsdoc' as const, coverage: 150 }, // Invalid coverage > 100
      };

      expect(() => ConventionAnalysisSchema.parse(invalidConventions)).toThrow();
    });
  });

  describe('TechnicalDebtAnalysisSchema', () => {
    it('should parse valid technical debt analysis', () => {
      const validDebt: TechnicalDebtAnalysis = {
        totalScore: 42,
        categories: [
          {
            category: 'code-smell',
            count: 15,
            severity: 'medium',
            examples: ['Large function in user.ts'],
            estimatedEffort: '2 hours',
          },
          {
            category: 'duplication',
            count: 8,
            severity: 'high',
            examples: ['Repeated validation logic'],
          },
        ],
        hotspots: [
          {
            path: 'src/legacy/old-api.js',
            score: 95,
            issues: ['outdated-dependency', 'no-tests'],
            loc: 500,
            lastModified: new Date(),
          },
        ],
        metrics: {
          codeComplexity: 7.5,
          testCoverage: 65,
          duplicatedLinesPercent: 12,
          maintainabilityIndex: 58,
        },
        trends: {
          improving: true,
          changeRate: -5.2,
          timeframe: 'last 30 days',
        },
      };

      const result = TechnicalDebtAnalysisSchema.parse(validDebt);
      expect(result).toEqual(validDebt);
    });

    it('should apply defaults for optional arrays', () => {
      const minimalDebt = {
        totalScore: 30,
        categories: [
          {
            category: 'complexity' as const,
            count: 5,
            severity: 'low' as const,
          },
        ],
        hotspots: [
          {
            path: 'src/complex.ts',
            score: 85,
            issues: ['high-complexity'],
          },
        ],
      };

      const result = TechnicalDebtAnalysisSchema.parse(minimalDebt);
      expect(result.categories[0].examples).toEqual([]);
      expect(result.trends?.timeframe).toBe('last 30 days');
    });

    it('should validate score constraints', () => {
      const invalidDebt = {
        totalScore: 150, // Invalid score > 100
        categories: [],
        hotspots: [],
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(invalidDebt)).toThrow();
    });

    it('should validate severity levels', () => {
      const invalidDebt = {
        totalScore: 50,
        categories: [
          {
            category: 'code-smell' as const,
            count: 5,
            severity: 'invalid-severity', // Invalid severity
          },
        ],
        hotspots: [],
      };

      expect(() => TechnicalDebtAnalysisSchema.parse(invalidDebt)).toThrow();
    });
  });

  describe('CodebaseAnalysisSchema', () => {
    it('should parse complete codebase analysis', () => {
      const validAnalysis: CodebaseAnalysis = {
        timestamp: new Date(),
        projectPath: '/path/to/project',
        stack: {
          primaryLanguage: 'TypeScript',
          languages: [
            { name: 'TypeScript', percentage: 100, files: 50 },
          ],
          frameworks: [
            { name: 'React', category: 'frontend' },
          ],
          buildTools: ['Vite'],
          packageManagers: ['npm'],
        },
        architecture: {
          pattern: 'component-based',
          components: [
            { name: 'App', type: 'component', path: 'src/App.tsx' },
          ],
          layers: [
            { name: 'ui', paths: ['src/components'] },
          ],
          dependencies: { external: 10, internal: 5, circular: 0 },
        },
        conventions: {
          fileNaming: 'camelCase',
          functionNaming: 'camelCase',
          variableNaming: 'camelCase',
          indentation: { type: 'spaces', size: 2 },
          imports: { style: 'es6' },
          documentation: { style: 'jsdoc', coverage: 80 },
        },
        technicalDebt: {
          totalScore: 25,
          categories: [
            {
              category: 'documentation',
              count: 3,
              severity: 'low',
            },
          ],
          hotspots: [],
        },
        summary: {
          totalFiles: 150,
          totalLines: 25000,
          analysisVersion: '1.0.0',
          confidence: 0.95,
          warnings: ['Some files excluded'],
        },
        metadata: {
          analysisTools: ['eslint', 'tsc'],
          excludedPaths: ['node_modules', '.git'],
          analysisTime: 5000,
          errors: [
            {
              component: 'dependency-analyzer',
              error: 'Failed to parse package.json',
              severity: 'warning',
            },
          ],
        },
      };

      const result = CodebaseAnalysisSchema.parse(validAnalysis);
      expect(result).toEqual(validAnalysis);
    });

    it('should apply defaults for optional fields', () => {
      const minimalAnalysis = {
        timestamp: new Date(),
        projectPath: '/path/to/project',
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
          fileNaming: 'kebab-case' as const,
          functionNaming: 'camelCase' as const,
          variableNaming: 'camelCase' as const,
          indentation: { type: 'spaces' as const },
          imports: { style: 'commonjs' as const },
          documentation: { style: 'none' as const, coverage: 0 },
        },
        technicalDebt: {
          totalScore: 10,
          categories: [],
          hotspots: [],
        },
        summary: {
          totalFiles: 10,
          totalLines: 500,
          analysisVersion: '1.0.0',
        },
      };

      const result = CodebaseAnalysisSchema.parse(minimalAnalysis);
      expect(result.summary.confidence).toBe(1);
      expect(result.summary.warnings).toEqual([]);
      expect(result.metadata?.analysisTools).toEqual([]);
      expect(result.metadata?.excludedPaths).toEqual([]);
      expect(result.metadata?.errors).toEqual([]);
    });

    it('should validate required fields', () => {
      const incompleteAnalysis = {
        timestamp: new Date(),
        projectPath: '/path/to/project',
        // Missing required fields: stack, architecture, conventions, technicalDebt, summary
      };

      expect(() => CodebaseAnalysisSchema.parse(incompleteAnalysis)).toThrow();
    });

    it('should validate summary constraints', () => {
      const invalidAnalysis = {
        timestamp: new Date(),
        projectPath: '/path/to/project',
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
          totalFiles: -5, // Invalid negative value
          totalLines: 1000,
          analysisVersion: '1.0.0',
        },
      };

      expect(() => CodebaseAnalysisSchema.parse(invalidAnalysis)).toThrow();
    });
  });

  describe('Schema Integration Tests', () => {
    it('should allow nested schema composition', () => {
      // Test that all sub-schemas work together properly
      const fullAnalysis: CodebaseAnalysis = {
        timestamp: new Date('2024-01-15T10:00:00Z'),
        projectPath: '/project',
        stack: {
          primaryLanguage: 'TypeScript',
          languages: [
            { name: 'TypeScript', percentage: 85, files: 100 },
            { name: 'CSS', percentage: 15, files: 20 },
          ],
          frameworks: [
            { name: 'Next.js', version: '14.0.0', category: 'frontend' },
            { name: 'Tailwind CSS', category: 'ui' },
          ],
          buildTools: ['Next.js', 'PostCSS'],
          packageManagers: ['npm'],
          runtimes: [{ name: 'Node.js', type: 'node' }],
        },
        architecture: {
          pattern: 'component-based',
          components: [
            {
              name: 'HomePage',
              type: 'component',
              path: 'src/pages/index.tsx',
              dependencies: ['Button', 'Header'],
              exports: ['HomePage'],
              loc: 150,
            },
          ],
          layers: [
            {
              name: 'pages',
              description: 'Next.js pages',
              paths: ['src/pages'],
            },
          ],
          dependencies: { external: 20, internal: 15, circular: 1 },
          entryPoints: [{ path: 'src/pages/_app.tsx', type: 'main' }],
        },
        conventions: {
          fileNaming: 'camelCase',
          functionNaming: 'camelCase',
          variableNaming: 'camelCase',
          classNaming: 'PascalCase',
          indentation: { type: 'spaces', size: 2 },
          imports: { style: 'es6', grouping: 'type-separate' },
          documentation: { style: 'jsdoc', coverage: 85 },
        },
        technicalDebt: {
          totalScore: 15,
          categories: [
            {
              category: 'documentation',
              count: 2,
              severity: 'low',
              examples: ['Missing component props documentation'],
            },
          ],
          hotspots: [
            {
              path: 'src/utils/legacy.ts',
              score: 75,
              issues: ['complexity', 'no-tests'],
            },
          ],
          trends: { improving: true, changeRate: -2.5 },
        },
        summary: {
          totalFiles: 120,
          totalLines: 15000,
          analysisVersion: '1.0.0',
          confidence: 0.9,
        },
      };

      expect(() => CodebaseAnalysisSchema.parse(fullAnalysis)).not.toThrow();
      const parsed = CodebaseAnalysisSchema.parse(fullAnalysis);
      expect(parsed.stack.primaryLanguage).toBe('TypeScript');
      expect(parsed.architecture.pattern).toBe('component-based');
      expect(parsed.conventions.fileNaming).toBe('camelCase');
      expect(parsed.technicalDebt.totalScore).toBe(15);
    });
  });
});