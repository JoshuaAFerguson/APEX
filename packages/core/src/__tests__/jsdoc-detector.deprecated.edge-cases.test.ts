import { describe, it, expect } from 'vitest';
import { validateDeprecatedTags } from '../jsdoc-detector.js';

describe('JSDoc Detector - @deprecated tag validation edge cases', () => {
  describe('validateDeprecatedTags edge cases', () => {
    it('should handle multiple @deprecated tags on same export', () => {
      const source = `
/**
 * Function with multiple @deprecated tags
 * @deprecated First deprecation notice
 * @deprecated Second deprecation notice with migration: Use newFunction() instead
 */
export function multipleDeprecatedTags() {
  return 'data';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1); // Only one should fail (first one lacks migration)
      expect(issues[0].description).toContain('multipleDeprecatedTags');
      expect(issues[0].suggestion).toContain('Add @see tag or include migration path information');
    });

    it('should handle @deprecated with whitespace-only explanation', () => {
      const source = `
/**
 * Function with whitespace explanation
 * @deprecated
 */
export function whitespaceDeprecated() {
  return 'data';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1);
      expect(issues[0].description).toContain('missing or insufficient explanation');
    });

    it('should handle @deprecated with exactly 10 characters', () => {
      const source = `
/**
 * Function with exactly 10 char explanation
 * @deprecated 1234567890
 */
export function exactTenChars() {
  return 'data';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1); // Should still fail due to no migration path
      expect(issues[0].suggestion).not.toContain('meaningful explanation');
      expect(issues[0].suggestion).toContain('migration path');
    });

    it('should handle @deprecated with exactly 9 characters', () => {
      const source = `
/**
 * Function with 9 char explanation
 * @deprecated 123456789
 */
export function exactNineChars() {
  return 'data';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1);
      expect(issues[0].suggestion).toContain('meaningful explanation');
      expect(issues[0].suggestion).toContain('migration path');
    });

    it('should handle case-insensitive migration path keywords', () => {
      const source = `
/**
 * Function with uppercase migration keywords
 * @deprecated This is old. USE newFunction() INSTEAD for better results
 */
export function uppercaseMigration() {
  return 'data';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0); // Should pass - migration keywords are case-insensitive
    });

    it('should handle @deprecated in multiline format', () => {
      const source = `
/**
 * Function with multiline deprecation
 * @deprecated This function is deprecated.
 *             Use the new implementation instead
 *             for better performance and reliability.
 */
export function multilineDeprecated() {
  return 'data';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0); // Should pass - has explanation and migration path
    });

    it('should handle @deprecated with @see tag containing URL', () => {
      const source = `
/**
 * Legacy API function
 * @deprecated This API is outdated and will be removed in v4.0
 * @see https://docs.example.com/migration-guide
 */
export function legacyAPI() {
  return 'legacy';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0); // Should pass - has @see tag
    });

    it('should handle default exports with @deprecated', () => {
      const source = `
/**
 * Default export that is deprecated
 * @deprecated
 */
export default function deprecatedDefault() {
  return 'default';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(1);
      expect(issues[0].description).toContain('deprecatedDefault');
      expect(issues[0].type).toBe('deprecated-api');
    });

    it('should handle enums with @deprecated', () => {
      const source = `
/**
 * Old status enumeration
 * @deprecated Use NewStatus enum instead of this legacy enum
 */
export enum OldStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0); // Should pass
    });

    it('should handle namespaces with @deprecated', () => {
      const source = `
/**
 * Legacy namespace
 * @deprecated Migrate to the new module structure
 */
export namespace LegacyNamespace {
  export const value = 'legacy';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0); // Should pass
    });

    it('should ignore non-exported items with @deprecated', () => {
      const source = `
/**
 * Internal function
 * @deprecated
 */
function internalDeprecated() {
  return 'internal';
}

/**
 * Exported function
 * @deprecated Use newFunction() instead
 */
export function exportedDeprecated() {
  return 'exported';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0); // Only exported function should be checked, and it's valid
    });

    it('should handle mixed valid and invalid @deprecated tags in complex file', () => {
      const source = `
/**
 * Good deprecation
 * @deprecated Use betterFunction() instead for improved performance
 */
export function goodDeprecation() {
  return 'good';
}

/**
 * Bad deprecation
 * @deprecated
 */
export function badDeprecation() {
  return 'bad';
}

/**
 * Another good deprecation
 * @deprecated This is being removed. Use alternativeFunction() instead
 */
export function anotherGoodDeprecation() {
  return 'good2';
}

/**
 * Bad with short explanation
 * @deprecated Short
 */
export function shortExplanation() {
  return 'short';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(2); // badDeprecation and shortExplanation should fail

      const badDepIssue = issues.find(issue => issue.description.includes('badDeprecation'));
      const shortIssue = issues.find(issue => issue.description.includes('shortExplanation'));

      expect(badDepIssue).toBeDefined();
      expect(shortIssue).toBeDefined();
    });

    it('should handle partial migration path keywords', () => {
      const source = `
/**
 * Function that mentions use but not properly
 * @deprecated This function has issues and causes trouble when use case changes
 */
export function partialMigrationKeyword() {
  return 'partial';
}
      `;

      const issues = validateDeprecatedTags(source, 'test.ts');
      expect(issues).toHaveLength(0); // Should pass - contains 'use' keyword
    });
  });
});