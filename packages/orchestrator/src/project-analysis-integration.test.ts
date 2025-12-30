import { describe, it, expect } from 'vitest';
import { ProjectAnalysis } from './idle-processor';
import {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
} from '@apexcli/core';
import {
  createMinimalAnalysis,
  createAnalysisWithIssues,
  createHealthyAnalysis,
  createAnalysisWithRichDependencies,
} from './test-helpers';

describe('ProjectAnalysis Integration with Enhanced Complexity Metrics', () => {
  describe('ProjectAnalysis.codeQuality interface', () => {
    it('should have correct structure with enhanced complexity metrics', () => {
      const analysis = createMinimalAnalysis();

      expect(analysis.codeQuality).toHaveProperty('lintIssues');
      expect(analysis.codeQuality).toHaveProperty('duplicatedCode');
      expect(analysis.codeQuality).toHaveProperty('complexityHotspots');
      expect(analysis.codeQuality).toHaveProperty('codeSmells');

      expect(typeof analysis.codeQuality.lintIssues).toBe('number');
      expect(Array.isArray(analysis.codeQuality.duplicatedCode)).toBe(true);
      expect(Array.isArray(analysis.codeQuality.complexityHotspots)).toBe(true);
      expect(Array.isArray(analysis.codeQuality.codeSmells)).toBe(true);
    });

    it('should properly handle complexityHotspots with enhanced structure', () => {
      const analysis = createAnalysisWithIssues('refactoring');

      expect(analysis.codeQuality.complexityHotspots).toHaveLength(1);

      const hotspot = analysis.codeQuality.complexityHotspots[0];
      expect(hotspot).toHaveProperty('file');
      expect(hotspot).toHaveProperty('cyclomaticComplexity');
      expect(hotspot).toHaveProperty('cognitiveComplexity');
      expect(hotspot).toHaveProperty('lineCount');

      expect(typeof hotspot.file).toBe('string');
      expect(typeof hotspot.cyclomaticComplexity).toBe('number');
      expect(typeof hotspot.cognitiveComplexity).toBe('number');
      expect(typeof hotspot.lineCount).toBe('number');

      expect(hotspot.file).toBe('src/complex.ts');
      expect(hotspot.cyclomaticComplexity).toBe(15);
      expect(hotspot.cognitiveComplexity).toBe(22);
      expect(hotspot.lineCount).toBe(120);
    });

    it('should properly handle codeSmells with full structure', () => {
      const analysis = createAnalysisWithIssues('refactoring');

      expect(analysis.codeQuality.codeSmells).toHaveLength(1);

      const codeSmell = analysis.codeQuality.codeSmells[0];
      expect(codeSmell).toHaveProperty('file');
      expect(codeSmell).toHaveProperty('type');
      expect(codeSmell).toHaveProperty('severity');
      expect(codeSmell).toHaveProperty('details');

      expect(typeof codeSmell.file).toBe('string');
      expect(typeof codeSmell.type).toBe('string');
      expect(typeof codeSmell.severity).toBe('string');
      expect(typeof codeSmell.details).toBe('string');

      expect(codeSmell.file).toBe('src/smelly.ts');
      expect(codeSmell.type).toBe('long-method');
      expect(codeSmell.severity).toBe('high');
      expect(codeSmell.details).toBe('Method has 85 lines and 12 parameters');
    });

    it('should properly handle duplicatedCode with enhanced pattern structure', () => {
      const analysis = createAnalysisWithIssues('refactoring');

      expect(analysis.codeQuality.duplicatedCode).toHaveLength(1);

      const pattern = analysis.codeQuality.duplicatedCode[0];
      expect(pattern).toHaveProperty('pattern');
      expect(pattern).toHaveProperty('locations');
      expect(pattern).toHaveProperty('similarity');

      expect(typeof pattern.pattern).toBe('string');
      expect(Array.isArray(pattern.locations)).toBe(true);
      expect(typeof pattern.similarity).toBe('number');

      expect(pattern.pattern).toBe('if (user) { return user.name; }');
      expect(pattern.locations).toEqual(['src/user.ts:42', 'src/profile.ts:18']);
      expect(pattern.similarity).toBe(0.95);
    });

    it('should work with empty arrays in healthy analysis', () => {
      const analysis = createHealthyAnalysis();

      expect(analysis.codeQuality.complexityHotspots).toEqual([]);
      expect(analysis.codeQuality.codeSmells).toEqual([]);
      expect(analysis.codeQuality.duplicatedCode).toEqual([]);
      expect(analysis.codeQuality.lintIssues).toBe(0);
    });

    it('should support multiple complexity hotspots', () => {
      const customAnalysis: ProjectAnalysis = {
        ...createMinimalAnalysis(),
        codeQuality: {
          lintIssues: 20,
          duplicatedCode: [],
          complexityHotspots: [
            {
              file: 'src/auth/AuthService.ts',
              cyclomaticComplexity: 25,
              cognitiveComplexity: 30,
              lineCount: 300,
            },
            {
              file: 'src/api/DataProcessor.ts',
              cyclomaticComplexity: 18,
              cognitiveComplexity: 22,
              lineCount: 180,
            },
            {
              file: 'src/utils/ValidationUtils.ts',
              cyclomaticComplexity: 12,
              cognitiveComplexity: 15,
              lineCount: 120,
            },
          ],
          codeSmells: [],
        },
      };

      expect(customAnalysis.codeQuality.complexityHotspots).toHaveLength(3);

      customAnalysis.codeQuality.complexityHotspots.forEach((hotspot) => {
        expect(hotspot).toHaveProperty('file');
        expect(hotspot).toHaveProperty('cyclomaticComplexity');
        expect(hotspot).toHaveProperty('cognitiveComplexity');
        expect(hotspot).toHaveProperty('lineCount');
        expect(hotspot.cyclomaticComplexity).toBeGreaterThan(0);
        expect(hotspot.cognitiveComplexity).toBeGreaterThan(0);
        expect(hotspot.lineCount).toBeGreaterThan(0);
      });
    });

    it('should support multiple code smells with different severities', () => {
      const customAnalysis: ProjectAnalysis = {
        ...createMinimalAnalysis(),
        codeQuality: {
          lintIssues: 5,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: [
            {
              file: 'src/UserController.ts',
              type: 'large-class',
              severity: 'critical',
              details: 'Class has 45 methods and violates SRP',
            },
            {
              file: 'src/helpers/utils.ts',
              type: 'magic-numbers',
              severity: 'medium',
              details: 'Magic number 42 used without constant definition',
            },
            {
              file: 'src/data/UserRepository.ts',
              type: 'feature-envy',
              severity: 'low',
              details: 'Method accesses too many external object fields',
            },
            {
              file: 'src/legacy/OldProcessor.ts',
              type: 'dead-code',
              severity: 'high',
              details: 'Unused imports and methods detected',
            },
          ],
        },
      };

      expect(customAnalysis.codeQuality.codeSmells).toHaveLength(4);

      const severities = customAnalysis.codeQuality.codeSmells.map(
        (smell) => smell.severity
      );
      expect(severities).toContain('critical');
      expect(severities).toContain('high');
      expect(severities).toContain('medium');
      expect(severities).toContain('low');

      const types = customAnalysis.codeQuality.codeSmells.map(
        (smell) => smell.type
      );
      expect(types).toContain('large-class');
      expect(types).toContain('magic-numbers');
      expect(types).toContain('feature-envy');
      expect(types).toContain('dead-code');
    });

    it('should support multiple duplicate patterns with varying similarity', () => {
      const customAnalysis: ProjectAnalysis = {
        ...createMinimalAnalysis(),
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [
            {
              pattern: 'const API_URL = process.env.API_URL || "http://localhost:3000";',
              locations: ['src/config/dev.ts', 'src/config/prod.ts', 'tests/setup.ts'],
              similarity: 1.0,
            },
            {
              pattern: 'if (!user) { throw new Error("User not found"); }',
              locations: ['src/auth.ts', 'src/profile.ts'],
              similarity: 0.95,
            },
            {
              pattern: 'try { const result = await api.call(); } catch (e) { logger.error(e); }',
              locations: [
                'src/services/UserService.ts',
                'src/services/ProductService.ts',
                'src/services/OrderService.ts',
                'src/services/PaymentService.ts',
              ],
              similarity: 0.85,
            },
          ],
          complexityHotspots: [],
          codeSmells: [],
        },
      };

      expect(customAnalysis.codeQuality.duplicatedCode).toHaveLength(3);

      const similarities = customAnalysis.codeQuality.duplicatedCode.map(
        (pattern) => pattern.similarity
      );
      expect(similarities).toContain(1.0);
      expect(similarities).toContain(0.95);
      expect(similarities).toContain(0.85);

      // Check that all patterns have the required structure
      customAnalysis.codeQuality.duplicatedCode.forEach((pattern) => {
        expect(pattern).toHaveProperty('pattern');
        expect(pattern).toHaveProperty('locations');
        expect(pattern).toHaveProperty('similarity');
        expect(Array.isArray(pattern.locations)).toBe(true);
        expect(pattern.locations.length).toBeGreaterThan(0);
        expect(pattern.similarity).toBeGreaterThan(0);
        expect(pattern.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should maintain backward compatibility with existing test helpers', () => {
      // Test all existing helper functions work with enhanced structure
      const minimal = createMinimalAnalysis();
      const healthy = createHealthyAnalysis();
      const maintenance = createAnalysisWithIssues('maintenance');
      const refactoring = createAnalysisWithIssues('refactoring');
      const docs = createAnalysisWithIssues('docs');
      const tests = createAnalysisWithIssues('tests');
      const richDeps = createAnalysisWithRichDependencies();

      const allAnalyses = [minimal, healthy, maintenance, refactoring, docs, tests, richDeps];

      allAnalyses.forEach((analysis) => {
        expect(analysis.codeQuality).toHaveProperty('lintIssues');
        expect(analysis.codeQuality).toHaveProperty('duplicatedCode');
        expect(analysis.codeQuality).toHaveProperty('complexityHotspots');
        expect(analysis.codeQuality).toHaveProperty('codeSmells');

        expect(Array.isArray(analysis.codeQuality.duplicatedCode)).toBe(true);
        expect(Array.isArray(analysis.codeQuality.complexityHotspots)).toBe(true);
        expect(Array.isArray(analysis.codeQuality.codeSmells)).toBe(true);
      });
    });

    it('should type-check ComplexityHotspot objects correctly', () => {
      const complexityHotspot: ComplexityHotspot = {
        file: 'src/example.ts',
        cyclomaticComplexity: 20,
        cognitiveComplexity: 25,
        lineCount: 200,
      };

      const analysis: ProjectAnalysis = {
        ...createMinimalAnalysis(),
        codeQuality: {
          lintIssues: 5,
          duplicatedCode: [],
          complexityHotspots: [complexityHotspot],
          codeSmells: [],
        },
      };

      expect(analysis.codeQuality.complexityHotspots[0]).toEqual(complexityHotspot);
    });

    it('should type-check CodeSmell objects correctly', () => {
      const codeSmell: CodeSmell = {
        file: 'src/smelly.ts',
        type: 'data-clumps',
        severity: 'medium',
        details: 'Parameters userId, userName, userEmail appear together frequently',
      };

      const analysis: ProjectAnalysis = {
        ...createMinimalAnalysis(),
        codeQuality: {
          lintIssues: 3,
          duplicatedCode: [],
          complexityHotspots: [],
          codeSmells: [codeSmell],
        },
      };

      expect(analysis.codeQuality.codeSmells[0]).toEqual(codeSmell);
    });

    it('should type-check DuplicatePattern objects correctly', () => {
      const duplicatePattern: DuplicatePattern = {
        pattern: 'export default class Service { constructor(private config: Config) {} }',
        locations: [
          'src/services/UserService.ts',
          'src/services/ProductService.ts',
          'src/services/OrderService.ts',
        ],
        similarity: 0.92,
      };

      const analysis: ProjectAnalysis = {
        ...createMinimalAnalysis(),
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [duplicatePattern],
          complexityHotspots: [],
          codeSmells: [],
        },
      };

      expect(analysis.codeQuality.duplicatedCode[0]).toEqual(duplicatePattern);
    });
  });

  describe('Integration with analyzers', () => {
    it('should provide rich data for refactoring analyzer prioritization', () => {
      const analysis = createAnalysisWithIssues('refactoring');

      // Verify that the structure supports analyzer decision making
      const { complexityHotspots, codeSmells, duplicatedCode } = analysis.codeQuality;

      // Complexity hotspots should include metrics for prioritization
      expect(complexityHotspots[0].cyclomaticComplexity).toBeGreaterThan(10);
      expect(complexityHotspots[0].lineCount).toBeGreaterThan(100);

      // Code smells should include severity for prioritization
      expect(['low', 'medium', 'high', 'critical']).toContain(
        codeSmells[0].severity
      );

      // Duplicate patterns should include similarity for prioritization
      expect(duplicatedCode[0].similarity).toBeGreaterThan(0.9);
      expect(duplicatedCode[0].locations.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle edge cases gracefully', () => {
      const edgeCaseAnalysis: ProjectAnalysis = {
        ...createMinimalAnalysis(),
        codeQuality: {
          lintIssues: 0,
          duplicatedCode: [
            {
              pattern: '',
              locations: [],
              similarity: 0.0,
            },
          ],
          complexityHotspots: [
            {
              file: '',
              cyclomaticComplexity: 0,
              cognitiveComplexity: 0,
              lineCount: 0,
            },
          ],
          codeSmells: [
            {
              file: '',
              type: 'dead-code',
              severity: 'low',
              details: '',
            },
          ],
        },
      };

      // Should not throw when accessing properties
      expect(() => {
        edgeCaseAnalysis.codeQuality.duplicatedCode.forEach((d) => d.pattern);
        edgeCaseAnalysis.codeQuality.complexityHotspots.forEach((h) => h.file);
        edgeCaseAnalysis.codeQuality.codeSmells.forEach((s) => s.type);
      }).not.toThrow();
    });
  });
});