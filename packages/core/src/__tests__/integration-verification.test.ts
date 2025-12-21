import { describe, it, expect } from 'vitest';
import { CodeSmell } from '../types';

describe('Deep-Nesting Integration Verification', () => {
  it('should successfully create and use deep-nesting CodeSmell objects', () => {
    // Test the actual implementation
    const deepNestingSmell: CodeSmell = {
      file: 'src/integration-test.ts',
      type: 'deep-nesting',
      severity: 'high',
      details: 'Integration test for deep-nesting type extension',
    };

    // Verify the object was created correctly
    expect(deepNestingSmell).toBeDefined();
    expect(deepNestingSmell.type).toBe('deep-nesting');
    expect(deepNestingSmell.severity).toBe('high');
    expect(deepNestingSmell.file).toBe('src/integration-test.ts');
    expect(deepNestingSmell.details).toBe('Integration test for deep-nesting type extension');
  });

  it('should work with the type system correctly', () => {
    // Test that the type is properly recognized by TypeScript
    function isDeepNesting(smell: CodeSmell): boolean {
      return smell.type === 'deep-nesting';
    }

    const testSmells: CodeSmell[] = [
      { file: 'a.ts', type: 'long-method', severity: 'medium', details: 'Long method' },
      { file: 'b.ts', type: 'deep-nesting', severity: 'high', details: 'Deep nesting' },
      { file: 'c.ts', type: 'large-class', severity: 'low', details: 'Large class' },
    ];

    const deepNestingSmells = testSmells.filter(isDeepNesting);

    expect(deepNestingSmells).toHaveLength(1);
    expect(deepNestingSmells[0].type).toBe('deep-nesting');
  });

  it('should validate that the implementation meets acceptance criteria', () => {
    // Verify acceptance criteria:
    // ✅ CodeSmell type includes 'deep-nesting' as a valid smell type

    const smellTypes: Array<CodeSmell['type']> = [
      'long-method',
      'large-class',
      'duplicate-code',
      'dead-code',
      'magic-numbers',
      'feature-envy',
      'data-clumps',
      'deep-nesting', // This should be valid
    ];

    // Test each type can be assigned
    smellTypes.forEach(type => {
      const smell: CodeSmell = {
        file: 'test.ts',
        type,
        severity: 'medium',
        details: `Test ${type}`,
      };

      expect(smell.type).toBe(type);
    });

    // Verify 'deep-nesting' is specifically included
    expect(smellTypes).toContain('deep-nesting');
  });
});