/**
 * @fileoverview Test Coverage Validation Script
 *
 * This script validates that our element interaction tests meet all acceptance criteria
 * and provides a comprehensive report of test coverage for element interactions.
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestCoverage {
  category: string;
  scenarios: string[];
  covered: boolean;
  testFile: string;
  details: string[];
}

/**
 * Define acceptance criteria from the task requirements
 */
const ACCEPTANCE_CRITERIA = {
  clickInteractions: [
    'Basic click on buttons, links, and custom elements',
    'Modified clicks (Ctrl+click, Shift+click, Alt+click)',
    'Double-click interactions',
    'Right-click (context menu) interactions',
    'Disabled element click handling',
    'Nested element click propagation',
    'Coordinate-based clicking',
  ],
  typeInteractions: [
    'Text input typing with validation',
    'Email input with format validation',
    'Number input with constraint validation',
    'Textarea multi-line input',
    'Keyboard event handling during typing',
    'Input clearing and replacement',
    'Advanced input types (date, time, color, range)',
  ],
  hoverInteractions: [
    'Hover state changes (mouseenter/mouseleave)',
    'Focus and blur event handling',
    'Tab navigation between focusable elements',
    'Nested element hover effects',
  ],
  selectInteractions: [
    'Single select dropdown selection',
    'Multi-select dropdown selection with multiple options',
    'Keyboard navigation in select dropdowns',
    'Option deselection in multi-select',
  ],
  formControls: [
    'Checkbox toggle interactions',
    'Multiple independent checkboxes',
    'Radio button group mutual exclusivity',
    'Keyboard interaction with form controls',
  ],
  dynamicElements: [
    'Interaction with dynamically created elements',
    'Elements that change visibility state',
    'Handling elements that move or change position',
    'Waiting for elements to become interactable',
  ],
  errorHandling: [
    'Invalid selector handling',
    'Rapid sequential interactions',
    'Elements that become detached from DOM',
    'Timeout scenarios',
    'Overlapping elements and z-index issues',
    'Elements outside viewport',
  ],
  accessibility: [
    'Full keyboard navigation support',
    'Enter and Space key activation',
    'Arrow key navigation in radio groups',
    'Skip links and landmark navigation',
    'Screen reader compatibility',
  ],
  advancedInteractions: [
    'Drag and drop operations',
    'Touch/mobile interactions',
    'Custom web component interactions',
    'Modal dialog interactions',
    'Performance stress testing',
  ],
};

/**
 * Analyze test files to determine coverage
 */
async function analyzeTestCoverage(): Promise<TestCoverage[]> {
  const testDirectory = path.join(__dirname);
  const testFiles = [
    'comprehensive-element-interaction.integration.test.ts',
    'enhanced-element-interactions.integration.test.ts',
    'element-interaction-validation.test.ts',
  ];

  const coverage: TestCoverage[] = [];

  for (const [category, scenarios] of Object.entries(ACCEPTANCE_CRITERIA)) {
    const testCoverage: TestCoverage = {
      category,
      scenarios,
      covered: false,
      testFile: '',
      details: [],
    };

    // Check which test files cover this category
    for (const testFile of testFiles) {
      const filePath = path.join(testDirectory, testFile);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const coveredScenarios = scenarios.filter(scenario => {
          // Create search patterns based on scenario keywords
          const keywords = extractKeywords(scenario);
          return keywords.some(keyword =>
            content.toLowerCase().includes(keyword.toLowerCase())
          );
        });

        if (coveredScenarios.length > 0) {
          testCoverage.covered = true;
          testCoverage.testFile = testFile;
          testCoverage.details.push(...coveredScenarios);
        }
      }
    }

    coverage.push(testCoverage);
  }

  return coverage;
}

/**
 * Extract keywords from scenario descriptions for pattern matching
 */
function extractKeywords(scenario: string): string[] {
  const keywords: string[] = [];

  // Extract main action words
  const actionWords = ['click', 'type', 'hover', 'select', 'focus', 'blur', 'drag', 'drop', 'touch', 'swipe'];
  actionWords.forEach(word => {
    if (scenario.toLowerCase().includes(word)) {
      keywords.push(word);
    }
  });

  // Extract element types
  const elementTypes = ['button', 'input', 'select', 'checkbox', 'radio', 'textarea', 'modal'];
  elementTypes.forEach(element => {
    if (scenario.toLowerCase().includes(element)) {
      keywords.push(element);
    }
  });

  // Extract interaction modifiers
  const modifiers = ['ctrl', 'shift', 'alt', 'double', 'right', 'disabled', 'dynamic'];
  modifiers.forEach(modifier => {
    if (scenario.toLowerCase().includes(modifier)) {
      keywords.push(modifier);
    }
  });

  return keywords;
}

/**
 * Generate test coverage report
 */
function generateCoverageReport(coverage: TestCoverage[]): string {
  let report = `# Element Interaction Test Coverage Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;

  const totalScenarios = coverage.reduce((sum, cat) => sum + cat.scenarios.length, 0);
  const coveredCategories = coverage.filter(cat => cat.covered).length;
  const coveredScenarios = coverage.reduce((sum, cat) => sum + cat.details.length, 0);

  report += `## Summary\n`;
  report += `- **Total Categories**: ${coverage.length}\n`;
  report += `- **Covered Categories**: ${coveredCategories} (${Math.round(coveredCategories / coverage.length * 100)}%)\n`;
  report += `- **Total Scenarios**: ${totalScenarios}\n`;
  report += `- **Covered Scenarios**: ${coveredScenarios} (${Math.round(coveredScenarios / totalScenarios * 100)}%)\n\n`;

  report += `## Coverage by Category\n\n`;

  for (const category of coverage) {
    const status = category.covered ? '✅' : '❌';
    const percentage = category.scenarios.length > 0
      ? Math.round(category.details.length / category.scenarios.length * 100)
      : 0;

    report += `### ${status} ${category.category} (${percentage}% covered)\n`;

    if (category.covered && category.testFile) {
      report += `**Test File**: \`${category.testFile}\`\n\n`;
    }

    report += `**Required Scenarios**:\n`;
    for (const scenario of category.scenarios) {
      const covered = category.details.includes(scenario);
      const mark = covered ? '✅' : '❌';
      report += `- ${mark} ${scenario}\n`;
    }

    if (category.details.length > 0) {
      report += `\n**Covered Details**:\n`;
      for (const detail of category.details) {
        report += `- ✅ ${detail}\n`;
      }
    }

    report += '\n';
  }

  // Recommendations section
  report += `## Recommendations\n\n`;
  const uncoveredCategories = coverage.filter(cat => !cat.covered);

  if (uncoveredCategories.length === 0) {
    report += `🎉 **Excellent!** All acceptance criteria categories are covered by tests.\n\n`;
    report += `**Next Steps:**\n`;
    report += `1. Run the test suite to ensure all tests pass\n`;
    report += `2. Verify tests run in CI environment\n`;
    report += `3. Consider adding edge case scenarios\n`;
  } else {
    report += `**Missing Coverage:**\n`;
    for (const category of uncoveredCategories) {
      report += `- **${category.category}**: Needs test implementation\n`;
    }
    report += `\n**Recommended Actions:**\n`;
    report += `1. Implement missing test scenarios\n`;
    report += `2. Update existing test files to cover gaps\n`;
    report += `3. Verify test infrastructure supports all interaction types\n`;
  }

  return report;
}

/**
 * Main validation function
 */
async function main() {
  console.log('🔍 Analyzing element interaction test coverage...\n');

  try {
    const coverage = await analyzeTestCoverage();
    const report = generateCoverageReport(coverage);

    // Write report to file
    const reportPath = path.join(__dirname, 'test-coverage-report.md');
    fs.writeFileSync(reportPath, report);

    console.log('📊 Coverage analysis complete!');
    console.log(`📄 Report saved to: ${reportPath}\n`);

    // Print summary to console
    const totalCategories = coverage.length;
    const coveredCategories = coverage.filter(cat => cat.covered).length;
    const coveragePercentage = Math.round(coveredCategories / totalCategories * 100);

    console.log(`✨ Coverage Summary:`);
    console.log(`   Categories: ${coveredCategories}/${totalCategories} (${coveragePercentage}%)`);

    if (coveragePercentage >= 90) {
      console.log('🎉 Excellent test coverage!');
      process.exit(0);
    } else if (coveragePercentage >= 75) {
      console.log('👍 Good test coverage, consider adding missing scenarios');
      process.exit(0);
    } else {
      console.log('⚠️  Test coverage needs improvement');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error analyzing test coverage:', error);
    process.exit(1);
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  main();
}

export { analyzeTestCoverage, generateCoverageReport, ACCEPTANCE_CRITERIA };