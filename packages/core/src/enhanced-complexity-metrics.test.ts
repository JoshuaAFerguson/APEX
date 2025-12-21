import { describe, it, expect } from 'vitest';
import {
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
} from './types';

describe('Enhanced Complexity Metrics Types', () => {
  describe('ComplexityHotspot interface', () => {
    it('should create valid ComplexityHotspot objects', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/utils/complex-function.ts',
        cyclomaticComplexity: 15,
        cognitiveComplexity: 20,
        lineCount: 150,
      };

      expect(hotspot.file).toBe('src/utils/complex-function.ts');
      expect(hotspot.cyclomaticComplexity).toBe(15);
      expect(hotspot.cognitiveComplexity).toBe(20);
      expect(hotspot.lineCount).toBe(150);
    });

    it('should handle various file paths', () => {
      const testCases = [
        'index.ts',
        'src/components/UserProfile.tsx',
        'packages/core/src/utils.ts',
        'tests/integration/auth.test.ts',
      ];

      testCases.forEach((filePath) => {
        const hotspot: ComplexityHotspot = {
          file: filePath,
          cyclomaticComplexity: 10,
          cognitiveComplexity: 12,
          lineCount: 100,
        };

        expect(hotspot.file).toBe(filePath);
        expect(typeof hotspot.file).toBe('string');
      });
    });

    it('should handle edge case complexity values', () => {
      const edgeCases = [
        { cyclomatic: 0, cognitive: 0, lines: 1 }, // Minimal complexity
        { cyclomatic: 1, cognitive: 1, lines: 10 }, // Low complexity
        { cyclomatic: 100, cognitive: 150, lines: 5000 }, // Very high complexity
      ];

      edgeCases.forEach((testCase) => {
        const hotspot: ComplexityHotspot = {
          file: 'test.ts',
          cyclomaticComplexity: testCase.cyclomatic,
          cognitiveComplexity: testCase.cognitive,
          lineCount: testCase.lines,
        };

        expect(hotspot.cyclomaticComplexity).toBe(testCase.cyclomatic);
        expect(hotspot.cognitiveComplexity).toBe(testCase.cognitive);
        expect(hotspot.lineCount).toBe(testCase.lines);
        expect(typeof hotspot.cyclomaticComplexity).toBe('number');
        expect(typeof hotspot.cognitiveComplexity).toBe('number');
        expect(typeof hotspot.lineCount).toBe('number');
      });
    });

    it('should maintain proper typing for all fields', () => {
      const hotspot: ComplexityHotspot = {
        file: 'src/example.ts',
        cyclomaticComplexity: 25,
        cognitiveComplexity: 30,
        lineCount: 200,
      };

      // Type assertions to ensure proper typing
      expect(typeof hotspot.file).toBe('string');
      expect(typeof hotspot.cyclomaticComplexity).toBe('number');
      expect(typeof hotspot.cognitiveComplexity).toBe('number');
      expect(typeof hotspot.lineCount).toBe('number');

      // Ensure no additional properties are allowed
      const keys = Object.keys(hotspot);
      expect(keys).toHaveLength(4);
      expect(keys).toContain('file');
      expect(keys).toContain('cyclomaticComplexity');
      expect(keys).toContain('cognitiveComplexity');
      expect(keys).toContain('lineCount');
    });
  });

  describe('CodeSmell interface', () => {
    it('should create valid CodeSmell objects with all severity levels', () => {
      const severityLevels: Array<'low' | 'medium' | 'high' | 'critical'> = [
        'low',
        'medium',
        'high',
        'critical',
      ];

      severityLevels.forEach((severity) => {
        const codeSmell: CodeSmell = {
          file: 'src/example.ts',
          type: 'long-method',
          severity,
          details: `Code smell with ${severity} severity`,
        };

        expect(codeSmell.severity).toBe(severity);
        expect(typeof codeSmell.severity).toBe('string');
      });
    });

    it('should support all code smell types', () => {
      const smellTypes: Array<
        | 'long-method'
        | 'large-class'
        | 'duplicate-code'
        | 'dead-code'
        | 'magic-numbers'
        | 'feature-envy'
        | 'data-clumps'
        | 'deep-nesting'
      > = [
        'long-method',
        'large-class',
        'duplicate-code',
        'dead-code',
        'magic-numbers',
        'feature-envy',
        'data-clumps',
        'deep-nesting',
      ];

      smellTypes.forEach((type) => {
        const codeSmell: CodeSmell = {
          file: 'src/test.ts',
          type,
          severity: 'medium',
          details: `Example of ${type} smell`,
        };

        expect(codeSmell.type).toBe(type);
        expect(typeof codeSmell.type).toBe('string');
      });
    });

    it('should handle detailed descriptions', () => {
      const testCases = [
        'Method has 150 lines and should be refactored',
        'Class contains 25 methods and violates SRP',
        'Found duplicate code block in 4 different locations',
        'Unused import detected: lodash',
        'Magic number 42 used without explanation',
        'Method accesses too many fields from other classes',
        'Parameters user, userId, userName should be grouped',
        'Nested if-else statements reach depth of 7 levels',
      ];

      testCases.forEach((details, index) => {
        const smellTypes = [
          'long-method',
          'large-class',
          'duplicate-code',
          'dead-code',
          'magic-numbers',
          'feature-envy',
          'data-clumps',
          'deep-nesting',
        ] as const;

        const codeSmell: CodeSmell = {
          file: `src/test${index}.ts`,
          type: smellTypes[index],
          severity: 'medium',
          details,
        };

        expect(codeSmell.details).toBe(details);
        expect(typeof codeSmell.details).toBe('string');
      });
    });

    it('should maintain proper field typing', () => {
      const codeSmell: CodeSmell = {
        file: 'src/sample.ts',
        type: 'long-method',
        severity: 'high',
        details: 'Method exceeds recommended length of 50 lines',
      };

      expect(typeof codeSmell.file).toBe('string');
      expect(typeof codeSmell.type).toBe('string');
      expect(typeof codeSmell.severity).toBe('string');
      expect(typeof codeSmell.details).toBe('string');

      const keys = Object.keys(codeSmell);
      expect(keys).toHaveLength(4);
      expect(keys).toContain('file');
      expect(keys).toContain('type');
      expect(keys).toContain('severity');
      expect(keys).toContain('details');
    });

    it('should handle various file paths and patterns', () => {
      const filePaths = [
        'index.ts',
        'src/auth/UserService.ts',
        'packages/api/src/controllers/AuthController.js',
        'tests/unit/services/UserService.test.ts',
        'lib/utils/string-helpers.ts',
      ];

      filePaths.forEach((file) => {
        const codeSmell: CodeSmell = {
          file,
          type: 'large-class',
          severity: 'medium',
          details: 'Class has too many responsibilities',
        };

        expect(codeSmell.file).toBe(file);
      });
    });
  });

  describe('DuplicatePattern interface', () => {
    it('should create valid DuplicatePattern objects', () => {
      const pattern: DuplicatePattern = {
        pattern: 'function validateUser(user) { return user.email && user.password; }',
        locations: ['src/auth/validation.ts', 'src/user/userService.ts'],
        similarity: 0.95,
      };

      expect(pattern.pattern).toBe(
        'function validateUser(user) { return user.email && user.password; }'
      );
      expect(pattern.locations).toHaveLength(2);
      expect(pattern.similarity).toBe(0.95);
    });

    it('should handle various similarity scores', () => {
      const similarityScores = [0.0, 0.1, 0.5, 0.75, 0.9, 0.99, 1.0];

      similarityScores.forEach((similarity) => {
        const pattern: DuplicatePattern = {
          pattern: 'console.log("debug");',
          locations: ['file1.ts', 'file2.ts'],
          similarity,
        };

        expect(pattern.similarity).toBe(similarity);
        expect(typeof pattern.similarity).toBe('number');
        expect(pattern.similarity).toBeGreaterThanOrEqual(0);
        expect(pattern.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should handle multiple file locations', () => {
      const testCases = [
        ['single.ts'], // Single occurrence
        ['file1.ts', 'file2.ts'], // Two occurrences
        ['a.ts', 'b.ts', 'c.ts', 'd.ts'], // Multiple occurrences
        [
          'src/auth/login.ts',
          'src/auth/register.ts',
          'src/user/profile.ts',
          'tests/auth.test.ts',
        ], // Complex paths
      ];

      testCases.forEach((locations) => {
        const pattern: DuplicatePattern = {
          pattern: 'if (condition) { return true; }',
          locations,
          similarity: 0.8,
        };

        expect(pattern.locations).toEqual(locations);
        expect(pattern.locations).toHaveLength(locations.length);
        expect(Array.isArray(pattern.locations)).toBe(true);
      });
    });

    it('should handle various code patterns', () => {
      const codePatterns = [
        // Simple statements
        'console.log("debug");',
        // Function declarations
        'function add(a, b) { return a + b; }',
        // Class methods
        'async fetchUser(id) { return await api.get(`/users/${id}`); }',
        // Control structures
        'if (user.isActive) { processUser(user); }',
        // Error handling
        'try { await operation(); } catch (e) { logger.error(e); }',
        // Type definitions
        'interface User { id: number; name: string; }',
        // Complex multiline patterns
        `const validateInput = (input) => {
  if (!input) return false;
  if (input.length < 3) return false;
  return true;
}`,
      ];

      codePatterns.forEach((pattern) => {
        const duplicatePattern: DuplicatePattern = {
          pattern,
          locations: ['file1.ts', 'file2.ts'],
          similarity: 0.85,
        };

        expect(duplicatePattern.pattern).toBe(pattern);
        expect(typeof duplicatePattern.pattern).toBe('string');
      });
    });

    it('should maintain proper field typing and structure', () => {
      const pattern: DuplicatePattern = {
        pattern: 'export const API_URL = "https://api.example.com";',
        locations: ['config/dev.ts', 'config/prod.ts', 'tests/config.ts'],
        similarity: 1.0,
      };

      expect(typeof pattern.pattern).toBe('string');
      expect(Array.isArray(pattern.locations)).toBe(true);
      expect(typeof pattern.similarity).toBe('number');

      // Check each location is a string
      pattern.locations.forEach((location) => {
        expect(typeof location).toBe('string');
      });

      const keys = Object.keys(pattern);
      expect(keys).toHaveLength(3);
      expect(keys).toContain('pattern');
      expect(keys).toContain('locations');
      expect(keys).toContain('similarity');
    });

    it('should handle edge cases for locations array', () => {
      // Empty array (theoretical edge case)
      const emptyPattern: DuplicatePattern = {
        pattern: 'some code',
        locations: [],
        similarity: 0.0,
      };

      expect(emptyPattern.locations).toHaveLength(0);
      expect(Array.isArray(emptyPattern.locations)).toBe(true);

      // Single location
      const singlePattern: DuplicatePattern = {
        pattern: 'single occurrence',
        locations: ['only-file.ts'],
        similarity: 1.0,
      };

      expect(singlePattern.locations).toHaveLength(1);
      expect(singlePattern.locations[0]).toBe('only-file.ts');

      // Many locations
      const manyLocations = Array.from(
        { length: 10 },
        (_, i) => `file${i + 1}.ts`
      );
      const manyPattern: DuplicatePattern = {
        pattern: 'common utility',
        locations: manyLocations,
        similarity: 0.7,
      };

      expect(manyPattern.locations).toHaveLength(10);
      expect(manyPattern.locations).toEqual(manyLocations);
    });
  });
});