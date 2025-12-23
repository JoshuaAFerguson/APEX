import { describe, it, expect } from 'vitest';
import { validateDeprecatedTags, type OutdatedDocumentation } from '../jsdoc-detector.js';

describe('JSDoc Detector - @deprecated tag validation', () => {
  describe('validateDeprecatedTags', () => {
    it('should validate valid @deprecated tag with explanation and migration path', () => {
      const source = `
/**
 * Old function for processing data
 * @deprecated This function is deprecated since v2.0. Use processDataV2() instead for better performance
 */
export function processData() {
  return 'old data';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should validate valid @deprecated tag with explanation and @see tag', () => {
      const source = `
/**
 * Legacy user handler
 * @deprecated No longer maintained as of v3.0
 * @see {@link newUserHandler} for the replacement
 */
export function oldUserHandler() {
  return 'legacy';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should detect @deprecated with missing explanation', () => {
      const source = `
/**
 * Some function
 * @deprecated
 */
export function someFunction() {
  return 'data';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        file: 'test.ts',
        type: 'deprecated-api',
        description: '@deprecated tag for someFunction lacks proper documentation: missing or insufficient explanation and migration path',
        line: 6,
        suggestion: 'Add a meaningful explanation (at least 10 characters) describing why this is deprecated; Add @see tag or include migration path information (e.g., "Use newFunction() instead")',
        severity: 'medium'
      });
    });

    it('should detect @deprecated with insufficient explanation (less than 10 chars)', () => {
      const source = `
/**
 * Bad function
 * @deprecated Old
 */
export function badFunction() {
  return 'bad';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        file: 'test.ts',
        type: 'deprecated-api',
        description: '@deprecated tag for badFunction lacks proper documentation: missing or insufficient explanation and migration path',
        line: 6,
        suggestion: 'Add a meaningful explanation (at least 10 characters) describing why this is deprecated; Add @see tag or include migration path information (e.g., "Use newFunction() instead")',
        severity: 'medium'
      });
    });

    it('should detect @deprecated with explanation but no migration path', () => {
      const source = `
/**
 * Legacy function
 * @deprecated This function has performance issues and should not be used
 */
export function legacyFunction() {
  return 'legacy';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        file: 'test.ts',
        type: 'deprecated-api',
        description: '@deprecated tag for legacyFunction lacks proper documentation: missing migration path',
        line: 6,
        suggestion: 'Add @see tag or include migration path information (e.g., "Use newFunction() instead")',
        severity: 'medium'
      });
    });

    it('should accept migration path keywords in explanation', () => {
      const source = `
/**
 * Old API
 * @deprecated This API is obsolete. Use newAPI() for the same functionality
 */
export function oldAPI() {
  return 'old';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should accept "instead" keyword in explanation', () => {
      const source = `
/**
 * Legacy method
 * @deprecated Consider using the newer method instead of this one for better results
 */
export function legacyMethod() {
  return 'legacy';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should accept "replace" keyword in explanation', () => {
      const source = `
/**
 * Outdated helper
 * @deprecated This helper will be removed in v4.0. Please replace with modernHelper()
 */
export function outdatedHelper() {
  return 'outdated';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should accept "migrate" keyword in explanation', () => {
      const source = `
/**
 * Old service
 * @deprecated Migrate your code to use the new service implementation
 */
export function oldService() {
  return 'old';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should handle multiple @deprecated tags in same file', () => {
      const source = `
/**
 * First bad function
 * @deprecated
 */
export function firstBad() {
  return 'first';
}

/**
 * Second good function
 * @deprecated This is properly explained. Use goodFunction() instead
 */
export function secondGood() {
  return 'second';
}

/**
 * Third bad function
 * @deprecated Too short
 */
export function thirdBad() {
  return 'third';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(2);

      expect(issues[0].description).toBe('@deprecated tag for firstBad lacks proper documentation: missing or insufficient explanation and migration path');
      expect(issues[0].line).toBe(6);

      expect(issues[1].description).toBe('@deprecated tag for thirdBad lacks proper documentation: missing or insufficient explanation and migration path');
      expect(issues[1].line).toBe(20);
    });

    it('should handle classes with @deprecated tags', () => {
      const source = `
/**
 * Old utility class
 * @deprecated Use NewUtility class instead for better performance
 */
export class OldUtility {
  constructor() {}
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should handle interfaces with @deprecated tags', () => {
      const source = `
/**
 * Legacy interface
 * @deprecated
 */
export interface LegacyInterface {
  prop: string;
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1);
      expect(issues[0].description).toBe('@deprecated tag for LegacyInterface lacks proper documentation: missing or insufficient explanation and migration path');
    });

    it('should ignore exports without @deprecated tags', () => {
      const source = `
/**
 * Normal function
 * @param data Input data
 * @returns Processed data
 */
export function normalFunction(data: string) {
  return data.toUpperCase();
}

/**
 * Another function without deprecation
 */
export function anotherFunction() {
  return 'result';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should ignore exports without JSDoc', () => {
      const source = `
export function undocumentedFunction() {
  return 'undocumented';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0);
    });

    it('should handle configuration options properly', () => {
      const source = `
/**
 * Private deprecated function
 * @deprecated
 */
export function _privateDeprecated() {
  return 'private';
}
      `;

      // With includePrivate: false (default)
      const issuesDefault = validateDeprecatedTags(source, 'test.ts');
      expect(issuesDefault).toHaveLength(0);

      // With includePrivate: true
      const issuesWithPrivate = validateDeprecatedTags(source, 'test.ts', { includePrivate: true });
      expect(issuesWithPrivate).toHaveLength(1);
      expect(issuesWithPrivate[0].description).toContain('_privateDeprecated');
    });
  });
});