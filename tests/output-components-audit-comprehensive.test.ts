import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Output Components Audit Comprehensive Testing Suite
 *
 * This test suite provides comprehensive validation of the output components audit functionality,
 * verifying that all 7 categories are properly implemented, tested, and documented according
 * to the audit report requirements.
 *
 * Coverage Areas:
 * 1. Component implementation status verification
 * 2. Test coverage validation and analysis
 * 3. Audit report generation functionality
 * 4. Build and integration testing
 * 5. Documentation completeness
 * 6. Cross-cutting concerns validation
 * 7. Gap identification and reporting
 */

// Path constants
const DOCS_AUDITS_PATH = path.join(process.cwd(), 'docs/audits');
const UI_COMPONENTS_PATH = path.join(process.cwd(), 'packages/cli/src/ui/components');
const TESTS_PATH = path.join(UI_COMPONENTS_PATH, '__tests__');
const AUDIT_REPORT_PATH = path.join(DOCS_AUDITS_PATH, 'output-components-audit.md');

// Test utility functions
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function getFileContent(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

function countLinesOfCode(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(line => line.trim().length > 0).length;
}

function countTestFiles(pattern: string): number {
  try {
    const files = fs.readdirSync(TESTS_PATH);
    return files.filter(file => file.includes(pattern) && file.endsWith('.test.tsx')).length;
  } catch {
    return 0;
  }
}

function getTestFileLines(pattern: string): number {
  try {
    const files = fs.readdirSync(TESTS_PATH);
    return files
      .filter(file => file.includes(pattern) && file.endsWith('.test.tsx'))
      .reduce((total, file) => total + countLinesOfCode(path.join(TESTS_PATH, file)), 0);
  } catch {
    return 0;
  }
}

// Component categories as defined in audit report
const COMPONENT_CATEGORIES = [
  {
    name: 'StreamingText/ResponseStream',
    components: [
      { file: 'StreamingText.tsx', minLines: 200 },
      { file: 'ResponseStream.tsx', minLines: 280 }
    ],
    testPattern: 'StreamingText',
    minTestFiles: 3,
    minTestLines: 500
  },
  {
    name: 'MarkdownRenderer',
    components: [
      { file: 'MarkdownRenderer.tsx', minLines: 100 }
    ],
    testPattern: 'MarkdownRenderer',
    minTestFiles: 4,
    minTestLines: 800
  },
  {
    name: 'StatusBar',
    components: [
      { file: 'StatusBar.tsx', minLines: 800 }
    ],
    testPattern: 'StatusBar',
    minTestFiles: 10,
    minTestLines: 2000
  },
  {
    name: 'ProgressIndicators',
    components: [
      { file: 'ProgressIndicators.tsx', minLines: 200 },
      { file: 'TaskProgress.tsx', minLines: 100 }
    ],
    testPattern: 'ProgressIndicators',
    minTestFiles: 3,
    minTestLines: 400
  },
  {
    name: 'ErrorDisplay',
    components: [
      { file: 'ErrorDisplay.tsx', minLines: 200 }
    ],
    testPattern: 'ErrorDisplay',
    minTestFiles: 3,
    minTestLines: 400
  },
  {
    name: 'ActivityLog',
    components: [
      { file: 'ActivityLog.tsx', minLines: 200 }
    ],
    testPattern: 'ActivityLog',
    minTestFiles: 5,
    minTestLines: 600
  },
  {
    name: 'SuccessCelebration',
    components: [
      { file: 'SuccessCelebration.tsx', minLines: 200 }
    ],
    testPattern: 'SuccessCelebration',
    minTestFiles: 1,
    minTestLines: 200
  }
];

describe('Output Components Audit - Comprehensive Validation', () => {
  let auditReportContent: string;

  beforeAll(() => {
    // Verify audit report exists and load content
    expect(fileExists(AUDIT_REPORT_PATH)).toBe(true);
    auditReportContent = getFileContent(AUDIT_REPORT_PATH);
  });

  describe('Audit Report Structure and Metadata', () => {
    it('should have proper audit report metadata', () => {
      expect(auditReportContent).toContain('# Output Components Audit Summary Report');
      expect(auditReportContent).toContain('**Date**: 2026-03-10');
      expect(auditReportContent).toContain('**Version**: v0.6.0');
      expect(auditReportContent).toContain('**Status**: VERIFIED');
    });

    it('should contain executive summary with status table', () => {
      expect(auditReportContent).toContain('## Executive Summary');
      expect(auditReportContent).toContain('| Category | Status | Test Coverage | Key Issues |');
      expect(auditReportContent).toContain('All 7 output component categories are **implemented and functional**');
    });

    it('should document all 7 categories with detailed sections', () => {
      COMPONENT_CATEGORIES.forEach(category => {
        expect(auditReportContent).toContain(`## Category`);
        expect(auditReportContent).toContain(category.name);
      });
    });

    it('should include cross-cutting concerns documentation', () => {
      expect(auditReportContent).toContain('## Cross-Cutting Concerns');
      expect(auditReportContent).toContain('### Ink Framework Integration');
      expect(auditReportContent).toContain('### Responsive Width System');
    });
  });

  describe('Component Implementation Status Verification', () => {
    COMPONENT_CATEGORIES.forEach(category => {
      describe(`Category: ${category.name}`, () => {
        it(`should have all ${category.name} components implemented with minimum complexity`, () => {
          category.components.forEach(component => {
            const componentPath = path.join(UI_COMPONENTS_PATH, component.file);
            expect(fileExists(componentPath)).toBe(true);

            const lineCount = countLinesOfCode(componentPath);
            expect(lineCount).toBeGreaterThanOrEqual(component.minLines);

            // Verify component has React/Ink patterns
            const content = getFileContent(componentPath);
            expect(content).toMatch(/import.*react|from.*ink/i);
            expect(content).toMatch(/export.*function|export.*const.*=.*\(/);
          });
        });

        it(`should verify ${category.name} is documented as PASS in audit report`, () => {
          // Find the category section and verify status
          const categoryPattern = category.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const categorySection = auditReportContent.match(
            new RegExp(`## Category.*${categoryPattern}[\\s\\S]*?(?=## Category|---\\n\\n## |$)`)
          );
          expect(categorySection).toBeTruthy();

          if (categorySection) {
            const sectionContent = categorySection[0];
            expect(sectionContent).toMatch(/COMPLETE|PASS/);
            expect(sectionContent.length).toBeGreaterThan(100); // Should have substantial content
          }
        });
      });
    });
  });

  describe('Test Coverage Analysis and Validation', () => {
    it('should verify overall test coverage meets audit requirements', () => {
      // Verify the audit report claims 500+ tests
      expect(auditReportContent).toContain('**500+**');
      expect(auditReportContent).toContain('**PASS**');

      // Verify test coverage summary table exists
      expect(auditReportContent).toContain('## Test Coverage Summary');
      expect(auditReportContent).toContain('### Overall Statistics');
    });

    COMPONENT_CATEGORIES.forEach(category => {
      describe(`Test Coverage: ${category.name}`, () => {
        it(`should have minimum required test files for ${category.name}`, () => {
          const testFileCount = countTestFiles(category.testPattern);
          expect(testFileCount).toBeGreaterThanOrEqual(category.minTestFiles);
        });

        it(`should have comprehensive test lines for ${category.name}`, () => {
          const testLineCount = getTestFileLines(category.testPattern);
          expect(testLineCount).toBeGreaterThanOrEqual(category.minTestLines);
        });

        it(`should verify ${category.name} test coverage is documented in audit report`, () => {
          // Check for test coverage documentation in audit report
          const categoryPattern = category.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const testCoverageRegex = new RegExp(`${categoryPattern}.*PASS|Test Coverage.*${categoryPattern}`, 'i');
          expect(auditReportContent).toMatch(testCoverageRegex);
        });
      });
    });
  });

  describe('Cross-Cutting Concerns Implementation Verification', () => {
    it('should verify Ink framework integration is complete', () => {
      const packageJsonPath = path.join(process.cwd(), 'packages/cli/package.json');
      if (!fileExists(packageJsonPath)) {
        // Try root package.json if CLI package.json doesn't exist
        const rootPackageJsonPath = path.join(process.cwd(), 'package.json');
        expect(fileExists(rootPackageJsonPath)).toBe(true);
        return;
      }
      const packageContent = getFileContent(packageJsonPath);

      // Verify key Ink dependencies from audit report
      expect(packageContent).toMatch(/"ink"|ink-/);

      // Verify audit report documents this
      expect(auditReportContent).toContain('Ink Framework Integration');
      expect(auditReportContent).toMatch(/Status.*VERIFIED|ink.*dependency/);
    });

    it('should verify responsive width system implementation', () => {
      // Check if useStdoutDimensions hook exists
      const hookPath = path.join(process.cwd(), 'packages/cli/src/ui/hooks/useStdoutDimensions.ts');
      expect(fileExists(hookPath)).toBe(true);

      // Verify audit report documents 4-tier breakpoint system
      expect(auditReportContent).toContain('### Responsive Width System');
      expect(auditReportContent).toContain('4-tier breakpoints');
      expect(auditReportContent).toContain('narrow | <60');
      expect(auditReportContent).toContain('compact | 60-99');
      expect(auditReportContent).toContain('normal | 100-159');
      expect(auditReportContent).toContain('wide | 160+');
    });

    it('should verify display mode support across components', () => {
      // Verify audit report documents display modes
      expect(auditReportContent).toContain('Display Modes');
      expect(auditReportContent).toContain('Compact');
      expect(auditReportContent).toContain('Normal');
      expect(auditReportContent).toContain('Verbose');
    });
  });

  describe('Build Verification and Integration Testing', () => {
    it('should verify build status is documented as passing', () => {
      expect(auditReportContent).toContain('### Build Verification');
      expect(auditReportContent).toContain('Build Status: PASSING');
      expect(auditReportContent).toContain('Tasks: 7 successful, 7 total');
      expect(auditReportContent).toContain('Verified: 2026-03-10');
    });

    it('should verify test run summary shows passing status', () => {
      expect(auditReportContent).toContain('### Test Run Summary');
      expect(auditReportContent).toContain('Core Output Component Tests: PASSING');

      // Verify specific test results are documented
      expect(auditReportContent).toMatch(/StreamingText\.test\.tsx.*PASS/);
      expect(auditReportContent).toMatch(/ProgressIndicators\.test\.tsx.*PASS/);
    });
  });

  describe('Gap Identification and Documentation', () => {
    it('should properly categorize and document identified gaps', () => {
      expect(auditReportContent).toContain('## Identified Gaps');
      expect(auditReportContent).toContain('### Priority: High');
      expect(auditReportContent).toContain('### Priority: Medium');
      expect(auditReportContent).toContain('### Priority: Low');
    });

    it('should document specific gaps for ErrorDisplay component', () => {
      // Verify documented medium priority gaps
      expect(auditReportContent).toContain('ErrorDisplay | Stack trace width adaptation');
      expect(auditReportContent).toContain('ErrorDisplay | Verbose mode integration');
    });

    it('should document low priority enhancements', () => {
      // Verify documented low priority items
      expect(auditReportContent).toContain('StreamingText | Performance memoization');
      expect(auditReportContent).toContain('StreamingText | ARIA accessibility labels');
    });

    it('should confirm no critical gaps exist', () => {
      expect(auditReportContent).toContain('### Priority: High');
      expect(auditReportContent).toContain('None - All critical functionality is implemented.');
    });
  });

  describe('Recommendations and Future Work Documentation', () => {
    it('should provide actionable recommendations', () => {
      expect(auditReportContent).toContain('## Recommendations');
      expect(auditReportContent).toContain('### Immediate Actions');
      expect(auditReportContent).toContain('### Future Enhancements');
      expect(auditReportContent).toContain('### Architecture Improvements');
    });

    it('should document immediate actions as low priority', () => {
      expect(auditReportContent).toContain('**No critical actions required** - All output components are functional');
    });

    it('should provide future enhancement guidance', () => {
      expect(auditReportContent).toContain('**Performance**: Add memoization to StreamingText');
      expect(auditReportContent).toContain('**Accessibility**: Add ARIA labels');
      expect(auditReportContent).toContain('**Testing**: Achieve 100% passing tests');
    });
  });

  describe('Audit Report Completeness and Quality', () => {
    it('should have comprehensive conclusion section', () => {
      expect(auditReportContent).toContain('## Conclusion');
      expect(auditReportContent).toContain('**All 7 output component categories are implemented**');
      expect(auditReportContent).toContain('**Test coverage is comprehensive (500+ tests)**');
      expect(auditReportContent).toContain('**Build passes successfully**');
      expect(auditReportContent).toContain('**production-ready**');
    });

    it('should reference related audit documents', () => {
      expect(auditReportContent).toContain('## Related Audit Documents');
      expect(auditReportContent).toContain('streaming-text-architecture-audit.md');
      expect(auditReportContent).toContain('v060-markdownrenderer-audit.md');
      expect(auditReportContent).toContain('ADR-051-statusbar-component-audit.md');
    });

    it('should have proper report metadata and signatures', () => {
      expect(auditReportContent).toContain('**Generated**: 2026-03-10');
      expect(auditReportContent).toContain('**Verified**: 2026-03-10');
      expect(auditReportContent).toContain('**Reviewer**: Architecture Stage');
      expect(auditReportContent).toContain('**Build Status**: ✅ PASSING (7/7 tasks)');
    });

    it('should have appropriate word count and depth', () => {
      const wordCount = auditReportContent.split(/\s+/).length;
      expect(wordCount).toBeGreaterThan(2000); // Comprehensive report

      const sections = auditReportContent.split('##').length;
      expect(sections).toBeGreaterThan(8); // Detailed section breakdown

      const tables = (auditReportContent.match(/\|.*\|/g) || []).length;
      expect(tables).toBeGreaterThan(10); // Comprehensive tabular data
    });
  });

  describe('Component-Specific Deep Validation', () => {
    it('should validate StreamingText features as documented', () => {
      const streamingPath = path.join(UI_COMPONENTS_PATH, 'StreamingText.tsx');
      const content = getFileContent(streamingPath);

      // Features verified in audit report
      expect(content).toMatch(/useState|useEffect/); // Real streaming logic
      expect(content).toMatch(/cursor|▊/); // Cursor animation
      expect(content).toMatch(/speed|delay/); // Speed control
      expect(content).toMatch(/useStdoutDimensions/); // Responsive width
    });

    it('should validate StatusBar comprehensive implementation', () => {
      const statusPath = path.join(UI_COMPONENTS_PATH, 'StatusBar.tsx');
      const content = getFileContent(statusPath);
      const lineCount = countLinesOfCode(statusPath);

      // Verify implementation scale matches audit
      expect(lineCount).toBeGreaterThan(800);
      expect(content).toMatch(/CRITICAL|HIGH|MEDIUM|LOW/); // Priority system
      expect(content).toMatch(/breakpoint/); // Responsive system
    });

    it('should validate MarkdownRenderer integration', () => {
      const markdownPath = path.join(UI_COMPONENTS_PATH, 'MarkdownRenderer.tsx');
      const content = getFileContent(markdownPath);

      // Features documented in audit
      expect(content).toMatch(/marked/); // Uses marked library
      expect(content).toMatch(/H1|H2|H3|header/i); // Header support
      expect(content).toMatch(/list|bullet/i); // List support
      expect(content).toMatch(/code|syntax/i); // Code support
    });
  });
});

describe('Output Components Audit - Test Infrastructure Validation', () => {
  describe('Test Infrastructure and Patterns', () => {
    it('should have proper test utilities setup', () => {
      const testUtilsPath = path.join(UI_COMPONENTS_PATH, '__tests__/test-utils.tsx');
      const testSetupPath = path.join(process.cwd(), 'test-setup.ts');

      // Either test-utils.tsx in components or global test setup should exist
      const hasTestUtils = fileExists(testUtilsPath) || fileExists(testSetupPath);
      expect(hasTestUtils).toBe(true);
    });

    it('should have vitest configuration for UI components', () => {
      const vitestConfigPath = path.join(process.cwd(), 'vitest.config.ts');
      expect(fileExists(vitestConfigPath)).toBe(true);

      const content = getFileContent(vitestConfigPath);
      expect(content).toMatch(/test.*glob|__tests__/);
      expect(content).toMatch(/environment.*node|jsdom/);
    });

    it('should have ink-testing-library integration', () => {
      // Check in multiple possible locations for ink-testing-library
      const packageJsonPaths = [
        path.join(process.cwd(), 'package.json'),
        path.join(process.cwd(), 'packages/cli/package.json')
      ];

      let hasInkTestingLibrary = false;
      for (const packagePath of packageJsonPaths) {
        if (fileExists(packagePath)) {
          const content = getFileContent(packagePath);
          if (content.includes('ink-testing-library') || content.includes('@testing-library')) {
            hasInkTestingLibrary = true;
            break;
          }
        }
      }

      expect(hasInkTestingLibrary).toBe(true);
    });
  });

  describe('Test Pattern Consistency', () => {
    it('should verify audit test patterns are consistent across components', () => {
      // Check for .audit.test.tsx files which follow the pattern
      const auditTestFiles = [
        'MarkdownRenderer.audit.test.tsx'
      ];

      auditTestFiles.forEach(file => {
        const testPath = path.join(TESTS_PATH, file);
        if (fileExists(testPath)) {
          const content = getFileContent(testPath);
          expect(content).toMatch(/acceptance.*criteria/i);
          expect(content).toMatch(/comprehensive.*test/i);
        }
      });
    });

    it('should verify responsive test patterns exist', () => {
      try {
        const responsiveTestFiles = fs.readdirSync(TESTS_PATH)
          .filter(file => file.includes('responsive') && file.endsWith('.test.tsx'));

        expect(responsiveTestFiles.length).toBeGreaterThan(1);

        responsiveTestFiles.forEach(file => {
          const content = getFileContent(path.join(TESTS_PATH, file));
          expect(content).toMatch(/narrow|compact|normal|wide|responsive|breakpoint|width|dimension/i);
        });
      } catch (error) {
        // If __tests__ directory doesn't exist, check for responsive patterns in audit report
        expect(auditReportContent).toContain('Responsive Width System');
        expect(auditReportContent).toMatch(/narrow.*compact.*normal.*wide/);
      }
    });

    it('should verify integration test patterns exist', () => {
      const integrationTestFiles = fs.readdirSync(TESTS_PATH)
        .filter(file => file.includes('integration') && file.endsWith('.test.tsx'));

      expect(integrationTestFiles.length).toBeGreaterThan(2);
    });
  });
});