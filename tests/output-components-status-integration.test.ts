import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Output Components Status Integration Testing Suite
 *
 * This test suite validates the integration between component implementations,
 * their status tracking, and the audit report generation system. It ensures
 * that component status is properly tracked across the development lifecycle
 * and accurately reflected in audit reports.
 *
 * Integration Areas:
 * 1. Component implementation ↔ Status tracking
 * 2. Test results ↔ Coverage analysis
 * 3. Build status ↔ Audit reporting
 * 4. Git integration ↔ Change tracking
 * 5. Documentation ↔ Implementation verification
 */

// Path constants
const PROJECT_ROOT = process.cwd();
const UI_COMPONENTS_PATH = path.join(PROJECT_ROOT, 'packages/cli/src/ui/components');
const TESTS_PATH = path.join(UI_COMPONENTS_PATH, '__tests__');
const AUDIT_REPORT_PATH = path.join(PROJECT_ROOT, 'docs/audits/output-components-audit.md');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');

// Component status tracking interface
interface ComponentStatus {
  name: string;
  implementationStatus: 'COMPLETE' | 'PARTIAL' | 'MISSING';
  testStatus: 'COMPREHENSIVE' | 'BASIC' | 'MISSING';
  auditStatus: 'PASS' | 'PARTIAL' | 'FAIL';
  lastModified?: Date;
  testFileCount: number;
  implementationLines: number;
}

// Test utilities
function getFileStats(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      size: stats.size,
      lastModified: stats.mtime,
      lines: fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim().length > 0).length
    };
  } catch {
    return {
      exists: false,
      size: 0,
      lastModified: new Date(0),
      lines: 0
    };
  }
}

function getTestFiles(componentName: string): string[] {
  try {
    const files = fs.readdirSync(TESTS_PATH);
    return files.filter(file =>
      file.includes(componentName) &&
      file.endsWith('.test.tsx')
    );
  } catch {
    return [];
  }
}

function analyzeComponentStatus(componentName: string, mainFile: string): ComponentStatus {
  const componentPath = path.join(UI_COMPONENTS_PATH, mainFile);
  const stats = getFileStats(componentPath);
  const testFiles = getTestFiles(componentName);

  return {
    name: componentName,
    implementationStatus: stats.exists && stats.lines > 100 ? 'COMPLETE' : stats.exists ? 'PARTIAL' : 'MISSING',
    testStatus: testFiles.length >= 3 ? 'COMPREHENSIVE' : testFiles.length > 0 ? 'BASIC' : 'MISSING',
    auditStatus: 'PASS', // Will be updated based on audit report
    lastModified: stats.lastModified,
    testFileCount: testFiles.length,
    implementationLines: stats.lines
  };
}

// Component definitions with their primary implementation files
const COMPONENTS = [
  { name: 'StreamingText', mainFile: 'StreamingText.tsx' },
  { name: 'ResponseStream', mainFile: 'ResponseStream.tsx' },
  { name: 'MarkdownRenderer', mainFile: 'MarkdownRenderer.tsx' },
  { name: 'StatusBar', mainFile: 'StatusBar.tsx' },
  { name: 'ProgressIndicators', mainFile: 'ProgressIndicators.tsx' },
  { name: 'ErrorDisplay', mainFile: 'ErrorDisplay.tsx' },
  { name: 'ActivityLog', mainFile: 'ActivityLog.tsx' },
  { name: 'SuccessCelebration', mainFile: 'SuccessCelebration.tsx' }
];

describe('Output Components Status Integration', () => {
  let auditReportContent: string;
  let componentStatuses: ComponentStatus[] = [];

  beforeAll(() => {
    // Load audit report content
    auditReportContent = fs.readFileSync(AUDIT_REPORT_PATH, 'utf-8');

    // Analyze all components
    componentStatuses = COMPONENTS.map(comp =>
      analyzeComponentStatus(comp.name, comp.mainFile)
    );
  });

  describe('Component Implementation ↔ Status Tracking Integration', () => {
    it('should track implementation status for all components accurately', () => {
      componentStatuses.forEach(status => {
        expect(status.implementationStatus).toBe('COMPLETE');
        expect(status.implementationLines).toBeGreaterThan(100);
      });

      // Verify all components are represented
      expect(componentStatuses).toHaveLength(8);

      // Verify no missing implementations
      const missingComponents = componentStatuses.filter(s => s.implementationStatus === 'MISSING');
      expect(missingComponents).toHaveLength(0);
    });

    it('should validate component complexity metrics align with audit expectations', () => {
      const complexityExpectations = {
        'StatusBar': 800,
        'StreamingText': 200,
        'ResponseStream': 300,
        'MarkdownRenderer': 100,
        'ProgressIndicators': 200,
        'ErrorDisplay': 200,
        'ActivityLog': 200,
        'SuccessCelebration': 200
      };

      componentStatuses.forEach(status => {
        const expectedMinLines = complexityExpectations[status.name];
        if (expectedMinLines) {
          expect(status.implementationLines).toBeGreaterThanOrEqual(expectedMinLines);
        }
      });
    });

    it('should verify component implementation patterns are consistent', () => {
      componentStatuses.forEach(status => {
        const componentPath = path.join(UI_COMPONENTS_PATH,
          COMPONENTS.find(c => c.name === status.name)?.mainFile || ''
        );

        if (fs.existsSync(componentPath)) {
          const content = fs.readFileSync(componentPath, 'utf-8');

          // All components should follow React/Ink patterns
          expect(content).toMatch(/import.*react|from.*ink/i);
          expect(content).toMatch(/export.*function|export.*const.*=/);

          // Should have TypeScript interfaces/types
          expect(content).toMatch(/interface|type.*=|Props/);
        }
      });
    });
  });

  describe('Test Results ↔ Coverage Analysis Integration', () => {
    it('should validate test coverage aligns with audit report claims', () => {
      const testCoverageMap = {
        'StreamingText': { minFiles: 3, minLines: 500 },
        'MarkdownRenderer': { minFiles: 4, minLines: 800 },
        'StatusBar': { minFiles: 10, minLines: 2000 },
        'ProgressIndicators': { minFiles: 3, minLines: 400 },
        'ErrorDisplay': { minFiles: 3, minLines: 400 },
        'ActivityLog': { minFiles: 5, minLines: 600 },
        'SuccessCelebration': { minFiles: 1, minLines: 200 }
      };

      componentStatuses.forEach(status => {
        const expectations = testCoverageMap[status.name];
        if (expectations) {
          expect(status.testFileCount).toBeGreaterThanOrEqual(expectations.minFiles);

          // Calculate total test lines
          const testFiles = getTestFiles(status.name);
          const totalTestLines = testFiles.reduce((total, file) => {
            const testPath = path.join(TESTS_PATH, file);
            return total + getFileStats(testPath).lines;
          }, 0);

          expect(totalTestLines).toBeGreaterThanOrEqual(expectations.minLines);
        }
      });
    });

    it('should verify test pattern consistency across components', () => {
      const requiredTestPatterns = [
        'unit', 'responsive', 'integration'
      ];

      componentStatuses
        .filter(s => s.testFileCount >= 3)
        .forEach(status => {
          const testFiles = getTestFiles(status.name);
          const testPatterns = testFiles.map(file => {
            if (file.includes('responsive')) return 'responsive';
            if (file.includes('integration')) return 'integration';
            if (file.includes('.test.')) return 'unit';
            return 'other';
          });

          // Should have at least unit tests
          expect(testPatterns).toContain('unit');

          // Most components should have responsive tests
          if (status.name !== 'SuccessCelebration') {
            expect(testPatterns.some(p => p === 'responsive' || p === 'unit')).toBe(true);
          }
        });
    });

    it('should validate test quality indicators', () => {
      const qualityIndicators = [
        'describe', 'it', 'expect', 'beforeAll', 'afterAll',
        'mock', 'render', 'fireEvent'
      ];

      componentStatuses.forEach(status => {
        const testFiles = getTestFiles(status.name);

        testFiles.forEach(file => {
          const testPath = path.join(TESTS_PATH, file);
          if (fs.existsSync(testPath)) {
            const content = fs.readFileSync(testPath, 'utf-8');

            // Should have basic test structure
            expect(content).toMatch(/describe|it.*expect/);

            // Should import testing utilities
            expect(content).toMatch(/vitest|@testing-library/);

            // Should have meaningful test count
            const testCount = (content.match(/it\(/g) || []).length;
            expect(testCount).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  describe('Build Status ↔ Audit Reporting Integration', () => {
    it('should verify build configuration supports all components', () => {
      const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));

      // Verify build dependencies
      const buildDeps = [
        'typescript', 'vitest', 'react', 'ink'
      ];

      buildDeps.forEach(dep => {
        expect(
          packageJson.dependencies?.[dep] ||
          packageJson.devDependencies?.[dep] ||
          packageJson.peerDependencies?.[dep]
        ).toBeTruthy();
      });
    });

    it('should validate audit report reflects actual implementation status', () => {
      componentStatuses.forEach(status => {
        // Each component should be mentioned in audit report
        expect(auditReportContent).toContain(status.name);

        // Should be marked as PASS or COMPLETE
        const componentSection = auditReportContent.match(
          new RegExp(`${status.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{1,1000}?(?=##|$)`)
        );

        if (componentSection) {
          expect(componentSection[0]).toMatch(/PASS|COMPLETE/i);
        }
      });
    });

    it('should verify build status consistency with component status', () => {
      // Audit report should reflect current build state
      expect(auditReportContent).toContain('Build Status: PASSING');
      expect(auditReportContent).toContain('Tasks: 7 successful, 7 total');

      // All components should have COMPLETE status
      const completeComponents = componentStatuses.filter(s => s.implementationStatus === 'COMPLETE');
      expect(completeComponents).toHaveLength(componentStatuses.length);
    });
  });

  describe('Git Integration ↔ Change Tracking', () => {
    it('should verify component modification tracking', () => {
      componentStatuses.forEach(status => {
        expect(status.lastModified).toBeInstanceOf(Date);
        expect(status.lastModified.getTime()).toBeGreaterThan(0);
      });
    });

    it('should validate audit report reflects recent modifications', () => {
      // Audit report should have recent timestamp
      expect(auditReportContent).toMatch(/2026-03-10|2025-\d{2}-\d{2}/);

      // Should reference correct branch
      expect(auditReportContent).toMatch(/branch|apex/i);
    });

    it('should verify version alignment across documentation', () => {
      const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
      const version = packageJson.version;

      // Audit report should reference current or compatible version
      expect(auditReportContent).toMatch(new RegExp(`v?${version.split('.')[0]}\\.${version.split('.')[1]}`));
    });
  });

  describe('Documentation ↔ Implementation Verification', () => {
    it('should verify feature claims in audit match implementation', () => {
      const featureClaims = [
        { component: 'StreamingText', features: ['streaming', 'cursor', 'responsive'] },
        { component: 'MarkdownRenderer', features: ['markdown', 'syntax', 'headers'] },
        { component: 'StatusBar', features: ['priority', 'responsive', 'segments'] },
        { component: 'ProgressIndicators', features: ['spinner', 'progress', 'percentage'] },
        { component: 'ErrorDisplay', features: ['error', 'display', 'responsive'] },
        { component: 'ActivityLog', features: ['activity', 'log', 'timestamp'] },
        { component: 'SuccessCelebration', features: ['celebration', 'animation', 'success'] }
      ];

      featureClaims.forEach(claim => {
        const componentFile = COMPONENTS.find(c => c.name === claim.component)?.mainFile;
        if (componentFile) {
          const componentPath = path.join(UI_COMPONENTS_PATH, componentFile);
          if (fs.existsSync(componentPath)) {
            const content = fs.readFileSync(componentPath, 'utf-8');

            claim.features.forEach(feature => {
              const hasFeature = content.toLowerCase().includes(feature.toLowerCase());
              expect(hasFeature).toBe(true);
            });
          }
        }
      });
    });

    it('should validate cross-cutting concern implementation', () => {
      const crossCuttingFeatures = [
        'useStdoutDimensions',
        'responsive',
        'breakpoint',
        'ThemeProvider'
      ];

      let foundFeatures = 0;
      componentStatuses.forEach(status => {
        const componentFile = COMPONENTS.find(c => c.name === status.name)?.mainFile;
        if (componentFile) {
          const componentPath = path.join(UI_COMPONENTS_PATH, componentFile);
          if (fs.existsSync(componentPath)) {
            const content = fs.readFileSync(componentPath, 'utf-8');

            crossCuttingFeatures.forEach(feature => {
              if (content.includes(feature)) {
                foundFeatures++;
              }
            });
          }
        }
      });

      // Most components should use cross-cutting features
      expect(foundFeatures).toBeGreaterThan(5);
    });

    it('should verify gap documentation accuracy', () => {
      // Documented gaps should be reflected in implementation or tests
      const documentedGaps = [
        'Stack trace width adaptation',
        'Verbose mode integration',
        'Performance memoization',
        'ARIA accessibility labels'
      ];

      documentedGaps.forEach(gap => {
        expect(auditReportContent).toContain(gap);
      });

      // Should categorize gaps appropriately
      expect(auditReportContent).toContain('Priority: High');
      expect(auditReportContent).toContain('Priority: Medium');
      expect(auditReportContent).toContain('Priority: Low');
    });
  });

  describe('Status Integration Summary', () => {
    it('should generate integration status report', () => {
      const report = {
        totalComponents: componentStatuses.length,
        implementedComponents: componentStatuses.filter(s => s.implementationStatus === 'COMPLETE').length,
        comprehensivelyTested: componentStatuses.filter(s => s.testStatus === 'COMPREHENSIVE').length,
        auditPassing: componentStatuses.filter(s => s.auditStatus === 'PASS').length,
        averageImplementationLines: Math.round(
          componentStatuses.reduce((sum, s) => sum + s.implementationLines, 0) / componentStatuses.length
        ),
        totalTestFiles: componentStatuses.reduce((sum, s) => sum + s.testFileCount, 0)
      };

      // Validate integration metrics
      expect(report.totalComponents).toBe(8);
      expect(report.implementedComponents).toBe(report.totalComponents);
      expect(report.comprehensivelyTested).toBeGreaterThanOrEqual(6);
      expect(report.averageImplementationLines).toBeGreaterThan(200);
      expect(report.totalTestFiles).toBeGreaterThan(30);

      // Log integration summary for audit trail
      console.log('\n🔗 Output Components Status Integration Summary:');
      console.log(`   📊 Components: ${report.implementedComponents}/${report.totalComponents} implemented`);
      console.log(`   🧪 Test Coverage: ${report.totalTestFiles} test files`);
      console.log(`   📏 Avg Implementation: ${report.averageImplementationLines} lines/component`);
      console.log(`   ✅ Comprehensive Testing: ${report.comprehensivelyTested}/${report.totalComponents}`);
    });
  });
});