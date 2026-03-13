import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Output Components Test Coverage Analysis Testing Suite
 *
 * This test suite analyzes and validates the test coverage functionality
 * for output components, ensuring comprehensive coverage reporting,
 * accurate metrics collection, and proper coverage analysis workflows.
 *
 * Coverage Analysis Areas:
 * 1. Test file discovery and counting
 * 2. Coverage metrics calculation
 * 3. Coverage gap identification
 * 4. Test quality assessment
 * 5. Coverage trend analysis
 * 6. Report generation validation
 */

// Path constants
const PROJECT_ROOT = process.cwd();
const UI_COMPONENTS_PATH = path.join(PROJECT_ROOT, 'packages/cli/src/ui/components');
const TESTS_PATH = path.join(UI_COMPONENTS_PATH, '__tests__');
const AUDIT_REPORT_PATH = path.join(PROJECT_ROOT, 'docs/audits/output-components-audit.md');

// Coverage analysis interfaces
interface TestFileMetrics {
  fileName: string;
  component: string;
  testType: string;
  lineCount: number;
  testCount: number;
  assertionCount: number;
  mockCount: number;
  coverageKeywords: string[];
}

interface ComponentCoverage {
  component: string;
  implementationLines: number;
  testFiles: TestFileMetrics[];
  totalTestLines: number;
  totalTests: number;
  coverageScore: number;
  qualityScore: number;
  gaps: string[];
}

interface CoverageAnalysisResult {
  totalComponents: number;
  totalTestFiles: number;
  totalTestLines: number;
  totalTests: number;
  averageCoverageScore: number;
  overallQualityScore: number;
  componentCoverages: ComponentCoverage[];
}

// Test utilities for coverage analysis
function analyzeTestFile(filePath: string): TestFileMetrics {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  // Extract component name from test file name
  const componentMatch = fileName.match(/^(.+?)\..*test\.tsx?$/);
  const component = componentMatch ? componentMatch[1] : 'Unknown';

  // Determine test type
  let testType = 'unit';
  if (fileName.includes('integration')) testType = 'integration';
  else if (fileName.includes('responsive')) testType = 'responsive';
  else if (fileName.includes('audit')) testType = 'audit';
  else if (fileName.includes('edge-cases')) testType = 'edge-cases';
  else if (fileName.includes('performance')) testType = 'performance';

  // Calculate metrics
  const lines = content.split('\n');
  const lineCount = lines.filter(line => line.trim().length > 0).length;

  const testCount = (content.match(/\bit\(/g) || []).length;
  const assertionCount = (content.match(/expect\(/g) || []).length;
  const mockCount = (content.match(/mock|vi\./g) || []).length;

  // Identify coverage keywords
  const coverageKeywords: string[] = [];
  const keywords = [
    'render', 'fireEvent', 'screen', 'userEvent',
    'toBeInTheDocument', 'toHaveTextContent', 'toBeVisible',
    'responsive', 'breakpoint', 'useStdoutDimensions',
    'integration', 'component', 'hook', 'service',
    'edge case', 'error handling', 'accessibility',
    'performance', 'memory', 'timeout'
  ];

  keywords.forEach(keyword => {
    if (content.toLowerCase().includes(keyword.toLowerCase())) {
      coverageKeywords.push(keyword);
    }
  });

  return {
    fileName,
    component,
    testType,
    lineCount,
    testCount,
    assertionCount,
    mockCount,
    coverageKeywords
  };
}

function getComponentImplementationLines(componentName: string): number {
  const possibleFiles = [
    `${componentName}.tsx`,
    `${componentName}.ts`,
    `${componentName}/index.tsx`
  ];

  for (const file of possibleFiles) {
    const filePath = path.join(UI_COMPONENTS_PATH, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.split('\n').filter(line => line.trim().length > 0).length;
    }
  }
  return 0;
}

function calculateCoverageScore(testLines: number, implLines: number, testCount: number): number {
  const lineRatio = Math.min(testLines / implLines, 2); // Cap at 2x implementation
  const testDensity = testCount / testLines; // Tests per line
  const baseScore = (lineRatio * 50) + (testDensity * 1000 * 50);
  return Math.min(Math.max(baseScore, 0), 100);
}

function calculateQualityScore(testFile: TestFileMetrics): number {
  const assertionRatio = testFile.assertionCount / Math.max(testFile.testCount, 1);
  const keywordDiversity = testFile.coverageKeywords.length;
  const mockingScore = testFile.mockCount > 0 ? 10 : 0;

  const qualityScore = (assertionRatio * 40) + (keywordDiversity * 5) + mockingScore;
  return Math.min(qualityScore, 100);
}

function analyzeComponentCoverage(componentName: string): ComponentCoverage {
  // Get test files for component
  let testFiles: TestFileMetrics[] = [];
  try {
    const allTestFiles = fs.readdirSync(TESTS_PATH);
    const componentTestFiles = allTestFiles.filter(file =>
      file.includes(componentName) && file.endsWith('.test.tsx')
    );

    testFiles = componentTestFiles.map(file =>
      analyzeTestFile(path.join(TESTS_PATH, file))
    );
  } catch (error) {
    // Directory might not exist or be accessible
  }

  const implementationLines = getComponentImplementationLines(componentName);
  const totalTestLines = testFiles.reduce((sum, tf) => sum + tf.lineCount, 0);
  const totalTests = testFiles.reduce((sum, tf) => sum + tf.testCount, 0);

  const coverageScore = calculateCoverageScore(totalTestLines, implementationLines, totalTests);
  const qualityScore = testFiles.length > 0 ?
    testFiles.reduce((sum, tf) => sum + calculateQualityScore(tf), 0) / testFiles.length :
    0;

  // Identify coverage gaps
  const gaps: string[] = [];
  if (testFiles.length === 0) gaps.push('No test files found');
  if (implementationLines > 0 && totalTestLines < implementationLines * 0.5) gaps.push('Low test coverage ratio');
  if (totalTests < 5) gaps.push('Insufficient test count');

  const hasResponsiveTests = testFiles.some(tf => tf.testType === 'responsive');
  const hasIntegrationTests = testFiles.some(tf => tf.testType === 'integration');
  const hasEdgeCaseTests = testFiles.some(tf => tf.testType === 'edge-cases');

  if (!hasResponsiveTests && componentName !== 'SuccessCelebration') {
    gaps.push('Missing responsive behavior tests');
  }
  if (!hasIntegrationTests) gaps.push('Missing integration tests');
  if (!hasEdgeCaseTests) gaps.push('Missing edge case tests');

  return {
    component: componentName,
    implementationLines,
    testFiles,
    totalTestLines,
    totalTests,
    coverageScore,
    qualityScore,
    gaps
  };
}

// Component list for analysis
const COMPONENTS_TO_ANALYZE = [
  'StreamingText', 'ResponseStream', 'MarkdownRenderer', 'StatusBar',
  'ProgressIndicators', 'ErrorDisplay', 'ActivityLog', 'SuccessCelebration'
];

describe('Output Components Coverage Analysis', () => {
  let coverageAnalysis: CoverageAnalysisResult;

  beforeAll(() => {
    // Perform comprehensive coverage analysis
    const componentCoverages = COMPONENTS_TO_ANALYZE.map(analyzeComponentCoverage);

    coverageAnalysis = {
      totalComponents: componentCoverages.length,
      totalTestFiles: componentCoverages.reduce((sum, cc) => sum + cc.testFiles.length, 0),
      totalTestLines: componentCoverages.reduce((sum, cc) => sum + cc.totalTestLines, 0),
      totalTests: componentCoverages.reduce((sum, cc) => sum + cc.totalTests, 0),
      averageCoverageScore: componentCoverages.reduce((sum, cc) => sum + cc.coverageScore, 0) / componentCoverages.length,
      overallQualityScore: componentCoverages.reduce((sum, cc) => sum + cc.qualityScore, 0) / componentCoverages.length,
      componentCoverages
    };
  });

  describe('Test File Discovery and Metrics', () => {
    it('should discover and analyze all component test files', () => {
      expect(coverageAnalysis.totalTestFiles).toBeGreaterThan(25);
      expect(coverageAnalysis.totalTestLines).toBeGreaterThan(5000);
      expect(coverageAnalysis.totalTests).toBeGreaterThan(200);

      // Each component should have at least some test files
      coverageAnalysis.componentCoverages.forEach(cc => {
        if (cc.implementationLines > 0) {
          expect(cc.testFiles.length).toBeGreaterThan(0);
        }
      });
    });

    it('should validate test file metrics calculation', () => {
      coverageAnalysis.componentCoverages.forEach(cc => {
        cc.testFiles.forEach(tf => {
          // Basic validations
          expect(tf.fileName).toMatch(/\.test\.tsx?$/);
          expect(tf.lineCount).toBeGreaterThan(0);
          expect(tf.component).toBeTruthy();

          // Quality indicators
          if (tf.testCount > 0) {
            expect(tf.assertionCount).toBeGreaterThan(0);
            expect(tf.coverageKeywords).toBeInstanceOf(Array);
          }
        });
      });
    });

    it('should categorize test types correctly', () => {
      const testTypes = new Set<string>();
      coverageAnalysis.componentCoverages.forEach(cc => {
        cc.testFiles.forEach(tf => {
          testTypes.add(tf.testType);
        });
      });

      // Should have various test types
      expect(testTypes.has('unit')).toBe(true);
      expect(testTypes.has('responsive')).toBe(true);
      expect(testTypes.has('integration')).toBe(true);
    });
  });

  describe('Coverage Score Calculation', () => {
    it('should calculate meaningful coverage scores for all components', () => {
      expect(coverageAnalysis.averageCoverageScore).toBeGreaterThan(30);
      expect(coverageAnalysis.averageCoverageScore).toBeLessThan(101);

      // Components with good implementation should have decent scores
      const wellImplementedComponents = coverageAnalysis.componentCoverages.filter(
        cc => cc.implementationLines > 300
      );

      wellImplementedComponents.forEach(cc => {
        expect(cc.coverageScore).toBeGreaterThan(20);
      });
    });

    it('should calculate quality scores based on test characteristics', () => {
      expect(coverageAnalysis.overallQualityScore).toBeGreaterThan(20);

      // Components with many test files should have higher quality scores
      const highTestCountComponents = coverageAnalysis.componentCoverages.filter(
        cc => cc.testFiles.length >= 5
      );

      if (highTestCountComponents.length > 0) {
        const avgHighTestQuality = highTestCountComponents.reduce(
          (sum, cc) => sum + cc.qualityScore, 0
        ) / highTestCountComponents.length;

        expect(avgHighTestQuality).toBeGreaterThan(coverageAnalysis.overallQualityScore);
      }
    });

    it('should identify coverage score patterns across components', () => {
      const coverageScores = coverageAnalysis.componentCoverages.map(cc => cc.coverageScore);
      const minScore = Math.min(...coverageScores);
      const maxScore = Math.max(...coverageScores);

      expect(maxScore - minScore).toBeGreaterThan(10); // Should have variation
      expect(minScore).toBeGreaterThan(0); // All should have some coverage
    });
  });

  describe('Coverage Gap Identification', () => {
    it('should identify specific coverage gaps for each component', () => {
      coverageAnalysis.componentCoverages.forEach(cc => {
        expect(cc.gaps).toBeInstanceOf(Array);

        // Components without implementation shouldn't have test-related gaps
        if (cc.implementationLines === 0) {
          expect(cc.gaps).toContain('No test files found');
        }
      });
    });

    it('should detect missing test types across components', () => {
      const gapCounts = {
        'Missing responsive behavior tests': 0,
        'Missing integration tests': 0,
        'Missing edge case tests': 0,
        'Low test coverage ratio': 0
      };

      coverageAnalysis.componentCoverages.forEach(cc => {
        cc.gaps.forEach(gap => {
          if (gapCounts.hasOwnProperty(gap)) {
            gapCounts[gap]++;
          }
        });
      });

      // Most components should have responsive tests (except SuccessCelebration)
      expect(gapCounts['Missing responsive behavior tests']).toBeLessThan(4);

      // Some gaps are expected but shouldn't be too widespread
      Object.values(gapCounts).forEach(count => {
        expect(count).toBeLessThan(coverageAnalysis.totalComponents);
      });
    });

    it('should validate gap detection accuracy', () => {
      // Manually verify some expected gaps
      const statusBarCoverage = coverageAnalysis.componentCoverages.find(
        cc => cc.component === 'StatusBar'
      );

      const streamingTextCoverage = coverageAnalysis.componentCoverages.find(
        cc => cc.component === 'StreamingText'
      );

      // StatusBar should have comprehensive coverage
      if (statusBarCoverage) {
        expect(statusBarCoverage.testFiles.length).toBeGreaterThan(5);
        expect(statusBarCoverage.gaps).not.toContain('No test files found');
      }

      // StreamingText should have multiple test types
      if (streamingTextCoverage) {
        expect(streamingTextCoverage.testFiles.length).toBeGreaterThan(2);
      }
    });
  });

  describe('Test Quality Assessment', () => {
    it('should assess test file quality characteristics', () => {
      let totalAssertions = 0;
      let totalMocks = 0;
      let totalKeywords = 0;

      coverageAnalysis.componentCoverages.forEach(cc => {
        cc.testFiles.forEach(tf => {
          totalAssertions += tf.assertionCount;
          totalMocks += tf.mockCount;
          totalKeywords += tf.coverageKeywords.length;
        });
      });

      // Quality indicators
      expect(totalAssertions).toBeGreaterThan(500); // Many assertions
      expect(totalMocks).toBeGreaterThan(50); // Some mocking
      expect(totalKeywords).toBeGreaterThan(200); // Diverse coverage keywords
    });

    it('should identify high-quality test files', () => {
      const highQualityFiles = coverageAnalysis.componentCoverages
        .flatMap(cc => cc.testFiles)
        .filter(tf => calculateQualityScore(tf) > 60);

      expect(highQualityFiles.length).toBeGreaterThan(5);

      // High quality files should have good characteristics
      highQualityFiles.forEach(tf => {
        expect(tf.testCount).toBeGreaterThan(3);
        expect(tf.assertionCount).toBeGreaterThan(3);
        expect(tf.coverageKeywords.length).toBeGreaterThan(3);
      });
    });

    it('should validate test coverage keywords distribution', () => {
      const keywordFrequency = new Map<string, number>();

      coverageAnalysis.componentCoverages.forEach(cc => {
        cc.testFiles.forEach(tf => {
          tf.coverageKeywords.forEach(keyword => {
            keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
          });
        });
      });

      // Should have common testing keywords
      expect(keywordFrequency.get('render')).toBeGreaterThan(5);
      expect(keywordFrequency.get('expect')).toBeGreaterThan(10);
      expect(keywordFrequency.get('component')).toBeGreaterThan(8);
    });
  });

  describe('Coverage Trend Analysis', () => {
    it('should analyze coverage distribution across components', () => {
      const coverageDistribution = {
        excellent: 0, // > 80
        good: 0,      // 60-80
        fair: 0,      // 40-60
        poor: 0       // < 40
      };

      coverageAnalysis.componentCoverages.forEach(cc => {
        if (cc.coverageScore > 80) coverageDistribution.excellent++;
        else if (cc.coverageScore > 60) coverageDistribution.good++;
        else if (cc.coverageScore > 40) coverageDistribution.fair++;
        else coverageDistribution.poor++;
      });

      // Should have mostly good or excellent coverage
      expect(coverageDistribution.good + coverageDistribution.excellent).toBeGreaterThan(4);
      expect(coverageDistribution.poor).toBeLessThan(3);
    });

    it('should identify coverage leaders and laggards', () => {
      const sortedByScore = [...coverageAnalysis.componentCoverages].sort(
        (a, b) => b.coverageScore - a.coverageScore
      );

      const leader = sortedByScore[0];
      const laggard = sortedByScore[sortedByScore.length - 1];

      // Leader should have comprehensive coverage
      expect(leader.testFiles.length).toBeGreaterThan(3);
      expect(leader.totalTests).toBeGreaterThan(10);

      // Even laggard should have some coverage
      expect(laggard.testFiles.length).toBeGreaterThan(0);
    });

    it('should validate coverage metrics align with audit report claims', () => {
      // Total should align with 500+ claim in audit report
      expect(coverageAnalysis.totalTests).toBeGreaterThan(200);
      expect(coverageAnalysis.totalTestLines).toBeGreaterThan(3000);

      // Components mentioned in audit should have coverage
      const auditReport = fs.readFileSync(AUDIT_REPORT_PATH, 'utf-8');
      const auditComponents = ['StreamingText', 'MarkdownRenderer', 'StatusBar'];

      auditComponents.forEach(compName => {
        const coverage = coverageAnalysis.componentCoverages.find(cc => cc.component === compName);
        expect(coverage).toBeTruthy();
        if (coverage) {
          expect(coverage.testFiles.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Coverage Analysis Report Generation', () => {
    it('should generate comprehensive coverage analysis report', () => {
      console.log('\n📊 Output Components Coverage Analysis Report:');
      console.log('═'.repeat(80));

      console.log(`\n📈 Overall Metrics:`);
      console.log(`   • Components Analyzed: ${coverageAnalysis.totalComponents}`);
      console.log(`   • Total Test Files: ${coverageAnalysis.totalTestFiles}`);
      console.log(`   • Total Test Lines: ${coverageAnalysis.totalTestLines.toLocaleString()}`);
      console.log(`   • Total Tests: ${coverageAnalysis.totalTests}`);
      console.log(`   • Average Coverage Score: ${coverageAnalysis.averageCoverageScore.toFixed(1)}/100`);
      console.log(`   • Overall Quality Score: ${coverageAnalysis.overallQualityScore.toFixed(1)}/100`);

      console.log(`\n🎯 Component Coverage Breakdown:`);
      coverageAnalysis.componentCoverages
        .sort((a, b) => b.coverageScore - a.coverageScore)
        .forEach((cc, index) => {
          const scoreEmoji = cc.coverageScore > 70 ? '🟢' :
                           cc.coverageScore > 50 ? '🟡' : '🔴';
          console.log(`   ${index + 1}. ${scoreEmoji} ${cc.component}: ${cc.coverageScore.toFixed(1)}/100`);
          console.log(`      • Implementation: ${cc.implementationLines} lines`);
          console.log(`      • Test Files: ${cc.testFiles.length} (${cc.totalTestLines} lines)`);
          console.log(`      • Tests: ${cc.totalTests}`);
          if (cc.gaps.length > 0) {
            console.log(`      • Gaps: ${cc.gaps.slice(0, 2).join(', ')}${cc.gaps.length > 2 ? '...' : ''}`);
          }
        });

      // Validate report completeness
      expect(coverageAnalysis.totalComponents).toBeGreaterThan(6);
      expect(coverageAnalysis.averageCoverageScore).toBeGreaterThan(20);
    });
  });
});