import { describe, it, expect } from 'vitest';
import { CodeSmell } from '../types';

describe('CodeSmell - deep-nesting Type Extension', () => {
  describe('deep-nesting smell type', () => {
    it('should accept "deep-nesting" as a valid smell type', () => {
      const deepNestingSmell: CodeSmell = {
        file: 'src/complex-function.ts',
        type: 'deep-nesting',
        severity: 'medium',
        details: 'Function has nested depth of 6 levels, exceeding recommended maximum of 4',
      };

      expect(deepNestingSmell.type).toBe('deep-nesting');
      expect(typeof deepNestingSmell.type).toBe('string');
      expect(deepNestingSmell.file).toBe('src/complex-function.ts');
      expect(deepNestingSmell.severity).toBe('medium');
      expect(deepNestingSmell.details).toBe('Function has nested depth of 6 levels, exceeding recommended maximum of 4');
    });

    it('should support all severity levels for deep-nesting smells', () => {
      const severityLevels: Array<'low' | 'medium' | 'high' | 'critical'> = [
        'low',
        'medium',
        'high',
        'critical',
      ];

      severityLevels.forEach((severity) => {
        const smell: CodeSmell = {
          file: `src/nesting-${severity}.ts`,
          type: 'deep-nesting',
          severity,
          details: `Deep nesting with ${severity} severity level`,
        };

        expect(smell.type).toBe('deep-nesting');
        expect(smell.severity).toBe(severity);
        expect(typeof smell.severity).toBe('string');
      });
    });

    it('should handle various deep-nesting scenarios with realistic details', () => {
      const deepNestingScenarios = [
        {
          file: 'src/auth/permissions.ts',
          severity: 'low' as const,
          details: 'if-else chain has nesting depth of 5, consider early returns',
        },
        {
          file: 'src/validation/form-validator.ts',
          severity: 'medium' as const,
          details: 'Nested loops and conditionals reach depth of 7, refactor into smaller functions',
        },
        {
          file: 'src/parser/config-parser.ts',
          severity: 'high' as const,
          details: 'Deeply nested object access with 9 levels, introduce intermediate variables',
        },
        {
          file: 'src/legacy/data-transformer.ts',
          severity: 'critical' as const,
          details: 'Extremely deep nesting of 12 levels making code unreadable and unmaintainable',
        },
      ];

      deepNestingScenarios.forEach((scenario) => {
        const smell: CodeSmell = {
          file: scenario.file,
          type: 'deep-nesting',
          severity: scenario.severity,
          details: scenario.details,
        };

        expect(smell.type).toBe('deep-nesting');
        expect(smell.severity).toBe(scenario.severity);
        expect(smell.file).toBe(scenario.file);
        expect(smell.details).toBe(scenario.details);
      });
    });

    it('should work in arrays with mixed smell types', () => {
      const mixedSmells: CodeSmell[] = [
        {
          file: 'src/user-service.ts',
          type: 'long-method',
          severity: 'high',
          details: 'Method has 150 lines',
        },
        {
          file: 'src/nested-logic.ts',
          type: 'deep-nesting',
          severity: 'medium',
          details: 'Conditional nesting depth of 6 levels',
        },
        {
          file: 'src/large-controller.ts',
          type: 'large-class',
          severity: 'high',
          details: 'Class has 45 methods',
        },
        {
          file: 'src/switch-statement.ts',
          type: 'deep-nesting',
          severity: 'low',
          details: 'Switch statement with nested cases, depth of 4',
        },
      ];

      // Filter only deep-nesting smells
      const deepNestingSmells = mixedSmells.filter(smell => smell.type === 'deep-nesting');

      expect(deepNestingSmells).toHaveLength(2);
      expect(deepNestingSmells[0].file).toBe('src/nested-logic.ts');
      expect(deepNestingSmells[0].severity).toBe('medium');
      expect(deepNestingSmells[1].file).toBe('src/switch-statement.ts');
      expect(deepNestingSmells[1].severity).toBe('low');

      // Verify all items are properly typed
      mixedSmells.forEach((smell) => {
        expect(typeof smell.file).toBe('string');
        expect(typeof smell.type).toBe('string');
        expect(typeof smell.severity).toBe('string');
        expect(typeof smell.details).toBe('string');
      });
    });

    it('should maintain type safety with all smell types including deep-nesting', () => {
      type SmellType =
        | 'long-method'
        | 'large-class'
        | 'duplicate-code'
        | 'dead-code'
        | 'magic-numbers'
        | 'feature-envy'
        | 'data-clumps'
        | 'deep-nesting';

      const allSmellTypes: SmellType[] = [
        'long-method',
        'large-class',
        'duplicate-code',
        'dead-code',
        'magic-numbers',
        'feature-envy',
        'data-clumps',
        'deep-nesting',
      ];

      allSmellTypes.forEach((type, index) => {
        const smell: CodeSmell = {
          file: `src/test${index}.ts`,
          type,
          severity: 'medium',
          details: `Example ${type} code smell`,
        };

        expect(smell.type).toBe(type);
        expect(allSmellTypes).toContain(smell.type);
      });

      // Verify that 'deep-nesting' is included in the type system
      expect(allSmellTypes).toContain('deep-nesting');
      expect(allSmellTypes).toHaveLength(8);
    });

    it('should handle edge cases for deep-nesting detection details', () => {
      const edgeCaseDetails = [
        'Single nested if statement, depth 2',
        'Complex recursive function call chain reaching depth 10',
        'Try-catch blocks nested within loops, total depth 8',
        'Promise chains with nested .then() callbacks, depth 6',
        'Object destructuring with deep property access: obj.a.b.c.d.e.f',
        'Nested ternary operators making code unreadable: a ? b ? c ? d : e : f : g',
        'Switch statement with nested if-else blocks in each case, depth 7',
        'Array methods chaining with nested callbacks: arr.map(x => x.filter(y => y.reduce(...)))',
      ];

      edgeCaseDetails.forEach((details, index) => {
        const smell: CodeSmell = {
          file: `src/edge-case-${index}.ts`,
          type: 'deep-nesting',
          severity: index < 2 ? 'low' : index < 5 ? 'medium' : 'high',
          details,
        };

        expect(smell.type).toBe('deep-nesting');
        expect(smell.details).toBe(details);
        expect(['low', 'medium', 'high']).toContain(smell.severity);
      });
    });
  });

  describe('type compatibility', () => {
    it('should be assignable to CodeSmell interface', () => {
      const smell: CodeSmell = {
        file: 'test.ts',
        type: 'deep-nesting',
        severity: 'high',
        details: 'Deep nesting detected',
      };

      // This test verifies type compatibility at compile time
      const smellType: CodeSmell['type'] = smell.type;
      const smellSeverity: CodeSmell['severity'] = smell.severity;

      expect(smellType).toBe('deep-nesting');
      expect(smellSeverity).toBe('high');
    });

    it('should work with generic functions expecting CodeSmell', () => {
      function processSmell(smell: CodeSmell): string {
        return `${smell.type} in ${smell.file}: ${smell.details}`;
      }

      const deepNestingSmell: CodeSmell = {
        file: 'src/complex.ts',
        type: 'deep-nesting',
        severity: 'medium',
        details: 'Nesting depth exceeds limit',
      };

      const result = processSmell(deepNestingSmell);
      expect(result).toBe('deep-nesting in src/complex.ts: Nesting depth exceeds limit');
    });

    it('should work with type guards and filters', () => {
      function isDeepNestingSmell(smell: CodeSmell): smell is CodeSmell & { type: 'deep-nesting' } {
        return smell.type === 'deep-nesting';
      }

      const smells: CodeSmell[] = [
        { file: 'a.ts', type: 'long-method', severity: 'high', details: 'Long method' },
        { file: 'b.ts', type: 'deep-nesting', severity: 'medium', details: 'Deep nesting' },
        { file: 'c.ts', type: 'large-class', severity: 'low', details: 'Large class' },
      ];

      const deepNestingSmells = smells.filter(isDeepNestingSmell);

      expect(deepNestingSmells).toHaveLength(1);
      expect(deepNestingSmells[0].type).toBe('deep-nesting');
      expect(deepNestingSmells[0].file).toBe('b.ts');
    });
  });

  describe('integration with existing smell types', () => {
    it('should not break existing smell type usage', () => {
      const existingSmellTypes: Array<Exclude<CodeSmell['type'], 'deep-nesting'>> = [
        'long-method',
        'large-class',
        'duplicate-code',
        'dead-code',
        'magic-numbers',
        'feature-envy',
        'data-clumps',
      ];

      existingSmellTypes.forEach((type) => {
        const smell: CodeSmell = {
          file: 'test.ts',
          type,
          severity: 'medium',
          details: `${type} example`,
        };

        expect(smell.type).toBe(type);
        expect(typeof smell.type).toBe('string');
      });
    });

    it('should allow switching between different smell types in conditional logic', () => {
      function getSmellDescription(smell: CodeSmell): string {
        switch (smell.type) {
          case 'long-method':
            return 'Method is too long';
          case 'large-class':
            return 'Class is too large';
          case 'duplicate-code':
            return 'Code is duplicated';
          case 'dead-code':
            return 'Code is unused';
          case 'magic-numbers':
            return 'Magic numbers found';
          case 'feature-envy':
            return 'Feature envy detected';
          case 'data-clumps':
            return 'Data clumps found';
          case 'deep-nesting':
            return 'Nesting is too deep';
          default:
            // TypeScript exhaustiveness check - this should never be reached
            const exhaustiveCheck: never = smell.type;
            return exhaustiveCheck;
        }
      }

      const deepNestingSmell: CodeSmell = {
        file: 'test.ts',
        type: 'deep-nesting',
        severity: 'high',
        details: 'Deeply nested code',
      };

      const description = getSmellDescription(deepNestingSmell);
      expect(description).toBe('Nesting is too deep');
    });

    it('should support counting smells by type including deep-nesting', () => {
      const smells: CodeSmell[] = [
        { file: 'a.ts', type: 'long-method', severity: 'high', details: 'Long method' },
        { file: 'b.ts', type: 'deep-nesting', severity: 'medium', details: 'Deep nesting' },
        { file: 'c.ts', type: 'long-method', severity: 'low', details: 'Another long method' },
        { file: 'd.ts', type: 'deep-nesting', severity: 'high', details: 'Another deep nesting' },
        { file: 'e.ts', type: 'large-class', severity: 'medium', details: 'Large class' },
      ];

      const smellCounts = smells.reduce((counts, smell) => {
        counts[smell.type] = (counts[smell.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      expect(smellCounts['long-method']).toBe(2);
      expect(smellCounts['deep-nesting']).toBe(2);
      expect(smellCounts['large-class']).toBe(1);
      expect(Object.keys(smellCounts)).toContain('deep-nesting');
    });
  });
});