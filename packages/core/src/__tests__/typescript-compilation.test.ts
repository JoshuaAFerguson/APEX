import { describe, it, expect } from 'vitest';
import { CodeSmell } from '../types';

describe('TypeScript Compilation - CodeSmell deep-nesting Extension', () => {
  describe('type compilation verification', () => {
    it('should compile successfully with deep-nesting type', () => {
      // This test verifies that TypeScript compilation works correctly
      // with the extended CodeSmell type including 'deep-nesting'

      const compilationTest = (): boolean => {
        // Test direct assignment
        const smell1: CodeSmell = {
          file: 'test1.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Compilation test for deep-nesting',
        };

        // Test with type assertion
        const smell2 = {
          file: 'test2.ts',
          type: 'deep-nesting' as const,
          severity: 'high' as const,
          details: 'Another compilation test',
        } satisfies CodeSmell;

        // Test array assignment
        const smells: CodeSmell[] = [smell1, smell2];

        // Test with all smell types to ensure no regression
        const allTypes: Array<CodeSmell['type']> = [
          'long-method',
          'large-class',
          'duplicate-code',
          'dead-code',
          'magic-numbers',
          'feature-envy',
          'data-clumps',
          'deep-nesting',
        ];

        // Test function parameter
        function processSmell(smell: CodeSmell): string {
          return smell.type;
        }

        const result = processSmell(smell1);

        // Test conditional logic with all types
        function categorizeSmell(smell: CodeSmell): string {
          switch (smell.type) {
            case 'long-method':
              return 'complexity';
            case 'large-class':
              return 'complexity';
            case 'duplicate-code':
              return 'duplication';
            case 'dead-code':
              return 'cleanup';
            case 'magic-numbers':
              return 'maintainability';
            case 'feature-envy':
              return 'coupling';
            case 'data-clumps':
              return 'cohesion';
            case 'deep-nesting':
              return 'complexity';
            default:
              // This should never be reached and TypeScript will error if we miss a case
              const exhaustive: never = smell.type;
              return exhaustive;
          }
        }

        return (
          smell1.type === 'deep-nesting' &&
          smell2.type === 'deep-nesting' &&
          smells.length === 2 &&
          allTypes.includes('deep-nesting') &&
          result === 'deep-nesting' &&
          categorizeSmell(smell1) === 'complexity'
        );
      };

      expect(compilationTest()).toBe(true);
    });

    it('should maintain type safety with discriminated unions', () => {
      // Test that TypeScript properly handles discriminated unions with the new type
      type SmellWithMetadata = CodeSmell & {
        detectedBy: string;
        confidence: number;
      };

      const deepNestingWithMetadata: SmellWithMetadata = {
        file: 'complex.ts',
        type: 'deep-nesting',
        severity: 'critical',
        details: 'Extremely deep nesting detected',
        detectedBy: 'static-analyzer',
        confidence: 0.95,
      };

      expect(deepNestingWithMetadata.type).toBe('deep-nesting');
      expect(deepNestingWithMetadata.detectedBy).toBe('static-analyzer');
      expect(deepNestingWithMetadata.confidence).toBe(0.95);
    });

    it('should work with generic functions and type constraints', () => {
      // Test generic function that works with CodeSmell
      function filterSmellsByType<T extends CodeSmell['type']>(
        smells: CodeSmell[],
        type: T
      ): CodeSmell[] {
        return smells.filter((smell): smell is CodeSmell & { type: T } =>
          smell.type === type
        );
      }

      const allSmells: CodeSmell[] = [
        { file: 'a.ts', type: 'long-method', severity: 'high', details: 'Long method' },
        { file: 'b.ts', type: 'deep-nesting', severity: 'medium', details: 'Deep nesting' },
        { file: 'c.ts', type: 'deep-nesting', severity: 'low', details: 'Another deep nesting' },
      ];

      const deepNestingSmells = filterSmellsByType(allSmells, 'deep-nesting');

      expect(deepNestingSmells).toHaveLength(2);
      expect(deepNestingSmells[0].type).toBe('deep-nesting');
      expect(deepNestingSmells[1].type).toBe('deep-nesting');
    });

    it('should support mapped types and utility types', () => {
      // Test that the new type works with TypeScript utility types
      type SmellTypeCount = Record<CodeSmell['type'], number>;

      const smellCounts: SmellTypeCount = {
        'long-method': 5,
        'large-class': 2,
        'duplicate-code': 8,
        'dead-code': 1,
        'magic-numbers': 3,
        'feature-envy': 0,
        'data-clumps': 2,
        'deep-nesting': 4, // This must be included or TypeScript will error
      };

      expect(smellCounts['deep-nesting']).toBe(4);
      expect(typeof smellCounts['deep-nesting']).toBe('number');

      // Test Partial utility type
      const partialCounts: Partial<SmellTypeCount> = {
        'deep-nesting': 10,
        'long-method': 15,
      };

      expect(partialCounts['deep-nesting']).toBe(10);

      // Test Pick utility type
      type ComplexitySmells = Pick<SmellTypeCount, 'long-method' | 'large-class' | 'deep-nesting'>;

      const complexityOnly: ComplexitySmells = {
        'long-method': 3,
        'large-class': 1,
        'deep-nesting': 6,
      };

      expect(complexityOnly['deep-nesting']).toBe(6);
    });

    it('should work with conditional types', () => {
      // Test conditional types that depend on the smell type
      type IsComplexitySmell<T> = T extends 'long-method' | 'large-class' | 'deep-nesting'
        ? true
        : false;

      // These should compile correctly
      const isLongMethodComplexity: IsComplexitySmell<'long-method'> = true;
      const isDeepNestingComplexity: IsComplexitySmell<'deep-nesting'> = true;
      const isDuplicateComplexity: IsComplexitySmell<'duplicate-code'> = false;

      expect(isLongMethodComplexity).toBe(true);
      expect(isDeepNestingComplexity).toBe(true);
      expect(isDuplicateComplexity).toBe(false);
    });

    it('should support template literal types if needed', () => {
      // Test that the type can be used in template literal type contexts
      type SmellMessage<T extends CodeSmell['type']> = `Found ${T} smell in file`;

      const deepNestingMessage: SmellMessage<'deep-nesting'> = 'Found deep-nesting smell in file';
      const longMethodMessage: SmellMessage<'long-method'> = 'Found long-method smell in file';

      expect(deepNestingMessage).toBe('Found deep-nesting smell in file');
      expect(longMethodMessage).toBe('Found long-method smell in file');
    });

    it('should maintain backwards compatibility with existing code', () => {
      // Test that existing code patterns still work after adding the new type
      const existingSmells: CodeSmell[] = [
        { file: 'legacy1.ts', type: 'long-method', severity: 'high', details: 'Legacy smell 1' },
        { file: 'legacy2.ts', type: 'large-class', severity: 'medium', details: 'Legacy smell 2' },
      ];

      // Add new deep-nesting smell to existing collection
      existingSmells.push({
        file: 'new.ts',
        type: 'deep-nesting',
        severity: 'low',
        details: 'New deep nesting smell'
      });

      expect(existingSmells).toHaveLength(3);
      expect(existingSmells[2].type).toBe('deep-nesting');

      // Test that existing filtering logic still works
      const highSeveritySmells = existingSmells.filter(smell => smell.severity === 'high');
      expect(highSeveritySmells).toHaveLength(1);

      // Test that new filtering logic works
      const complexitySmells = existingSmells.filter(smell =>
        ['long-method', 'large-class', 'deep-nesting'].includes(smell.type)
      );
      expect(complexitySmells).toHaveLength(3);
    });
  });
});