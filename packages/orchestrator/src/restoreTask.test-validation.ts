/**
 * RestoreTask Test Validation Script
 *
 * This script validates that all test files for the restoreTask functionality
 * are properly structured and contain the expected test scenarios.
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestValidation {
  file: string;
  exists: boolean;
  hasDescribeBlocks: boolean;
  hasTestCases: boolean;
  testCount: number;
  coverageAreas: string[];
}

const TEST_FILES = [
  'restoreTask.test.ts',
  'restoreTask.integration.test.ts',
  'restoreTask.edge-cases.test.ts'
];

const EXPECTED_COVERAGE_AREAS = [
  'Valid restoreTask Operations',
  'Error Conditions',
  'Integration with Store Methods',
  'Event Emission',
  'Concurrency',
  'Performance',
  'Edge Cases'
];

export function validateTestFiles(): TestValidation[] {
  const validations: TestValidation[] = [];
  const srcDir = __dirname;

  for (const testFile of TEST_FILES) {
    const filePath = path.join(srcDir, testFile);
    const validation: TestValidation = {
      file: testFile,
      exists: false,
      hasDescribeBlocks: false,
      hasTestCases: false,
      testCount: 0,
      coverageAreas: []
    };

    try {
      if (fs.existsSync(filePath)) {
        validation.exists = true;
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for describe blocks
        const describeMatches = content.match(/describe\s*\(/g);
        validation.hasDescribeBlocks = (describeMatches?.length || 0) > 0;

        // Check for test cases
        const testMatches = content.match(/it\s*\(/g);
        validation.hasTestCases = (testMatches?.length || 0) > 0;
        validation.testCount = testMatches?.length || 0;

        // Extract coverage areas from describe blocks
        const describeBlocks = content.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]/g);
        if (describeBlocks) {
          validation.coverageAreas = describeBlocks.map(block =>
            block.replace(/describe\s*\(\s*['"`]([^'"`]+)['"`].*/, '$1')
          );
        }
      }
    } catch (error) {
      console.error(`Error validating ${testFile}:`, error);
    }

    validations.push(validation);
  }

  return validations;
}

export function generateValidationReport(): string {
  const validations = validateTestFiles();
  let report = '# RestoreTask Test Validation Report\n\n';

  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  // Summary
  const totalTests = validations.reduce((sum, v) => sum + v.testCount, 0);
  const existingFiles = validations.filter(v => v.exists).length;

  report += `## Summary\n\n`;
  report += `- **Test Files**: ${existingFiles}/${TEST_FILES.length}\n`;
  report += `- **Total Test Cases**: ${totalTests}\n`;
  report += `- **Coverage Status**: ${existingFiles === TEST_FILES.length ? '✅ Complete' : '⚠️ Incomplete'}\n\n`;

  // File Details
  report += `## File Details\n\n`;

  for (const validation of validations) {
    report += `### ${validation.file}\n`;
    report += `- **Exists**: ${validation.exists ? '✅' : '❌'}\n`;

    if (validation.exists) {
      report += `- **Test Cases**: ${validation.testCount}\n`;
      report += `- **Describe Blocks**: ${validation.hasDescribeBlocks ? '✅' : '❌'}\n`;
      report += `- **Coverage Areas**:\n`;

      if (validation.coverageAreas.length > 0) {
        for (const area of validation.coverageAreas) {
          report += `  - ${area}\n`;
        }
      } else {
        report += `  - No coverage areas detected\n`;
      }
    }

    report += '\n';
  }

  // Expected Coverage Check
  report += `## Expected Coverage Analysis\n\n`;

  const allCoverageAreas = validations.flatMap(v => v.coverageAreas);

  for (const expectedArea of EXPECTED_COVERAGE_AREAS) {
    const isCovered = allCoverageAreas.some(area =>
      area.toLowerCase().includes(expectedArea.toLowerCase()) ||
      expectedArea.toLowerCase().includes(area.toLowerCase())
    );

    report += `- **${expectedArea}**: ${isCovered ? '✅ Covered' : '❌ Missing'}\n`;
  }

  report += '\n';

  // Test File Structure Validation
  report += `## Test Structure Validation\n\n`;

  for (const validation of validations) {
    if (validation.exists) {
      const score = [
        validation.hasDescribeBlocks ? 1 : 0,
        validation.hasTestCases ? 1 : 0,
        validation.testCount >= 5 ? 1 : 0,
        validation.coverageAreas.length >= 3 ? 1 : 0
      ].reduce((a, b) => a + b, 0);

      const percentage = Math.round((score / 4) * 100);
      report += `- **${validation.file}**: ${percentage}% structure score\n`;
    }
  }

  // Recommendations
  report += `\n## Recommendations\n\n`;

  const missingFiles = validations.filter(v => !v.exists);
  if (missingFiles.length > 0) {
    report += `### Missing Test Files:\n`;
    for (const missing of missingFiles) {
      report += `- Create ${missing.file}\n`;
    }
    report += '\n';
  }

  const lowTestCount = validations.filter(v => v.exists && v.testCount < 5);
  if (lowTestCount.length > 0) {
    report += `### Files with Low Test Count:\n`;
    for (const low of lowTestCount) {
      report += `- ${low.file}: Add more test cases (current: ${low.testCount})\n`;
    }
    report += '\n';
  }

  report += `### Overall Status:\n`;
  if (existingFiles === TEST_FILES.length && totalTests >= 50) {
    report += `✅ **EXCELLENT**: All test files exist with comprehensive coverage\n`;
  } else if (existingFiles === TEST_FILES.length) {
    report += `✅ **GOOD**: All test files exist, consider adding more test cases\n`;
  } else {
    report += `⚠️ **INCOMPLETE**: Missing test files or insufficient coverage\n`;
  }

  return report;
}

// Generate and display report if run directly
if (require.main === module) {
  console.log(generateValidationReport());
}