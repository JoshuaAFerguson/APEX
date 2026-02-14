#!/usr/bin/env node

/**
 * @fileoverview Timeout Test Validation Script
 *
 * This script validates that timeout tests are properly structured and discoverable,
 * without requiring the full test suite to run. It performs static analysis of test files.
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(colors.green, `✅ ${message}`);
}

function logWarning(message) {
  log(colors.yellow, `⚠️  ${message}`);
}

function logError(message) {
  log(colors.red, `❌ ${message}`);
}

function logInfo(message) {
  log(colors.blue, `ℹ️  ${message}`);
}

function logHeader(message) {
  log(colors.bold, `\n${message}`);
  log(colors.bold, '='.repeat(message.length));
}

/**
 * Find all timeout-related test files
 */
async function findTimeoutTestFiles() {
  const patterns = [
    '**/timeout*.test.ts',
    '**/timeout*.test.js',
    '**/*timeout*.test.ts',
    '**/*timeout*.test.js'
  ];

  const files = new Set();

  for (const pattern of patterns) {
    try {
      const matches = await glob(pattern, {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**']
      });
      matches.forEach(file => files.add(file));
    } catch (error) {
      logWarning(`Failed to search pattern ${pattern}: ${error.message}`);
    }
  }

  return Array.from(files);
}

/**
 * Analyze a test file for timeout-related content
 */
function analyzeTestFile(filePath) {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    return { error: 'File does not exist' };
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  const analysis = {
    path: filePath,
    totalLines: lines.length,
    hasDescribeBlocks: false,
    hasItBlocks: false,
    hasTimeoutImports: false,
    hasVitestImports: false,
    hasFakeTimers: false,
    hasAdvanceTimers: false,
    testDescriptions: [],
    describeBlocks: [],
    imports: [],
    potentialIssues: [],
    score: 0
  };

  // Check for imports
  const importLines = lines.filter(line => line.trim().startsWith('import'));
  analysis.imports = importLines;

  // Check for timeout-related imports
  analysis.hasTimeoutImports = importLines.some(line =>
    line.includes('TimeoutUtils') ||
    line.includes('timeout-documentation') ||
    line.includes('PromiseRaceTimeoutPattern') ||
    line.includes('SetTimeoutWithCleanupPattern')
  );

  // Check for Vitest imports
  analysis.hasVitestImports = importLines.some(line =>
    line.includes('vitest') || line.includes('vi')
  );

  // Check for describe blocks
  const describeRegex = /describe\(['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = describeRegex.exec(content)) !== null) {
    analysis.describeBlocks.push(match[1]);
    analysis.hasDescribeBlocks = true;
  }

  // Check for it/test blocks
  const testRegex = /(?:it|test)\(['"`]([^'"`]+)['"`]/g;
  while ((match = testRegex.exec(content)) !== null) {
    analysis.testDescriptions.push(match[1]);
    analysis.hasItBlocks = true;
  }

  // Check for fake timers usage
  analysis.hasFakeTimers = content.includes('vi.useFakeTimers()') ||
                          content.includes('vi.clearAllTimers()') ||
                          content.includes('vi.useRealTimers()');

  // Check for timer advancement
  analysis.hasAdvanceTimers = content.includes('vi.advanceTimersByTime(') ||
                             content.includes('vi.runAllTimers()');

  // Validate test structure and content
  if (!analysis.hasDescribeBlocks) {
    analysis.potentialIssues.push('No describe blocks found');
  }

  if (!analysis.hasItBlocks) {
    analysis.potentialIssues.push('No test cases found');
  }

  if (!analysis.hasTimeoutImports) {
    analysis.potentialIssues.push('No timeout utility imports found');
  }

  if (!analysis.hasVitestImports) {
    analysis.potentialIssues.push('No Vitest imports found');
  }

  if (!analysis.hasFakeTimers && filePath.includes('timeout')) {
    analysis.potentialIssues.push('Timeout tests should use fake timers');
  }

  if (!analysis.hasAdvanceTimers && filePath.includes('timeout')) {
    analysis.potentialIssues.push('Timeout tests should advance timers for testing');
  }

  // Calculate quality score
  let score = 0;
  if (analysis.hasDescribeBlocks) score += 2;
  if (analysis.hasItBlocks) score += 2;
  if (analysis.hasTimeoutImports) score += 2;
  if (analysis.hasVitestImports) score += 1;
  if (analysis.hasFakeTimers) score += 2;
  if (analysis.hasAdvanceTimers) score += 1;

  analysis.score = Math.min(10, score);

  return analysis;
}

/**
 * Validate specific timeout test patterns
 */
function validateTimeoutTestPatterns(analysis) {
  const issues = [];

  // Check for common timeout test patterns
  const hasZeroTimeoutTests = analysis.testDescriptions.some(desc =>
    desc.toLowerCase().includes('zero timeout')
  );

  const hasNegativeTimeoutTests = analysis.testDescriptions.some(desc =>
    desc.toLowerCase().includes('negative timeout')
  );

  const hasTimeoutErrorTests = analysis.testDescriptions.some(desc =>
    desc.toLowerCase().includes('timeout error') ||
    desc.toLowerCase().includes('timeout message')
  );

  const hasEdgeCaseTests = analysis.testDescriptions.some(desc =>
    desc.toLowerCase().includes('edge case') ||
    desc.toLowerCase().includes('boundary')
  );

  if (!hasZeroTimeoutTests) {
    issues.push('Missing zero timeout edge case tests');
  }

  if (!hasNegativeTimeoutTests) {
    issues.push('Missing negative timeout edge case tests');
  }

  if (!hasTimeoutErrorTests) {
    issues.push('Missing timeout error handling tests');
  }

  if (!hasEdgeCaseTests) {
    issues.push('Missing edge case tests');
  }

  return issues;
}

/**
 * Check if timeout documentation exists
 */
function checkTimeoutDocumentation() {
  const docPaths = [
    'packages/orchestrator/src/timeout-documentation.ts',
    'docs/timeout-configurations.md',
    'docs/timeout-integration-test-documentation.md'
  ];

  const results = {};

  docPaths.forEach(docPath => {
    const fullPath = path.resolve(docPath);
    results[docPath] = {
      exists: fs.existsSync(fullPath),
      size: fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0
    };
  });

  return results;
}

/**
 * Validate timeout test coverage across packages
 */
function validateTestCoverage(analyses) {
  const coverage = {
    core: false,
    orchestrator: false,
    browser: false,
    integration: false,
    cli: false
  };

  const packageCounts = {
    core: 0,
    orchestrator: 0,
    browser: 0,
    integration: 0,
    cli: 0,
    other: 0
  };

  analyses.forEach(analysis => {
    if (analysis.path.includes('packages/core')) {
      coverage.core = true;
      packageCounts.core++;
    } else if (analysis.path.includes('packages/orchestrator')) {
      coverage.orchestrator = true;
      packageCounts.orchestrator++;
    } else if (analysis.path.includes('packages/browser')) {
      coverage.browser = true;
      packageCounts.browser++;
    } else if (analysis.path.includes('packages/cli')) {
      coverage.cli = true;
      packageCounts.cli++;
    } else if (analysis.path.includes('tests/integration')) {
      coverage.integration = true;
      packageCounts.integration++;
    } else {
      packageCounts.other++;
    }
  });

  return { coverage, packageCounts };
}

/**
 * Main validation function
 */
async function main() {
  logHeader('APEX Timeout Test Validation');

  logInfo('Searching for timeout test files...');
  const testFiles = await findTimeoutTestFiles();

  if (testFiles.length === 0) {
    logError('No timeout test files found!');
    process.exit(1);
  }

  logSuccess(`Found ${testFiles.length} timeout test files`);

  logHeader('Test File Analysis');

  const analyses = [];
  let totalIssues = 0;
  let totalScore = 0;

  for (const file of testFiles) {
    logInfo(`Analyzing: ${file}`);

    const analysis = analyzeTestFile(file);

    if (analysis.error) {
      logError(`  Error: ${analysis.error}`);
      continue;
    }

    analyses.push(analysis);

    // Report analysis results
    console.log(`  📊 Lines: ${analysis.totalLines}`);
    console.log(`  🧪 Test cases: ${analysis.testDescriptions.length}`);
    console.log(`  📝 Describe blocks: ${analysis.describeBlocks.length}`);
    console.log(`  ⏱️  Fake timers: ${analysis.hasFakeTimers ? 'Yes' : 'No'}`);
    console.log(`  ⚡ Timer advancement: ${analysis.hasAdvanceTimers ? 'Yes' : 'No'}`);
    console.log(`  📈 Quality score: ${analysis.score}/10`);

    // Validate timeout-specific patterns
    const patternIssues = validateTimeoutTestPatterns(analysis);
    analysis.potentialIssues.push(...patternIssues);

    if (analysis.potentialIssues.length > 0) {
      logWarning(`  Issues found:`);
      analysis.potentialIssues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
      totalIssues += analysis.potentialIssues.length;
    } else {
      logSuccess(`  No issues found`);
    }

    totalScore += analysis.score;
    console.log('');
  }

  logHeader('Test Coverage Analysis');

  const { coverage, packageCounts } = validateTestCoverage(analyses);

  console.log('Package Coverage:');
  Object.entries(coverage).forEach(([pkg, hasCoverage]) => {
    const icon = hasCoverage ? '✅' : '❌';
    const count = packageCounts[pkg] || 0;
    console.log(`  ${icon} ${pkg}: ${count} test files`);
  });

  logHeader('Documentation Check');

  const docResults = checkTimeoutDocumentation();
  Object.entries(docResults).forEach(([docPath, result]) => {
    if (result.exists) {
      logSuccess(`${docPath} (${result.size} bytes)`);
    } else {
      logWarning(`${docPath} - Missing`);
    }
  });

  logHeader('Summary');

  const averageScore = totalScore / analyses.length;
  console.log(`📊 Total timeout test files: ${analyses.length}`);
  console.log(`⚠️  Total issues found: ${totalIssues}`);
  console.log(`📈 Average quality score: ${averageScore.toFixed(1)}/10`);

  // Overall assessment
  if (totalIssues === 0 && averageScore >= 8) {
    logSuccess('✨ Timeout tests are well-structured and comprehensive!');
  } else if (totalIssues <= 5 && averageScore >= 6) {
    logWarning('⚠️  Timeout tests are good but could be improved');
  } else {
    logError('❌ Timeout tests need significant improvement');
  }

  // Detailed recommendations
  logHeader('Recommendations');

  if (averageScore < 8) {
    console.log('• Ensure all timeout tests use fake timers (vi.useFakeTimers())');
    console.log('• Add timer advancement (vi.advanceTimersByTime()) in tests');
    console.log('• Import and use timeout utilities from timeout-documentation.ts');
  }

  if (!coverage.core) {
    console.log('• Add timeout tests for core package (types, configurations)');
  }

  if (!coverage.integration) {
    console.log('• Add integration tests for end-to-end timeout scenarios');
  }

  if (totalIssues > 0) {
    console.log('• Address the specific issues identified in test files above');
  }

  const missingDocs = Object.entries(docResults)
    .filter(([_, result]) => !result.exists)
    .map(([path]) => path);

  if (missingDocs.length > 0) {
    console.log('• Create missing documentation files:');
    missingDocs.forEach(doc => console.log(`  - ${doc}`));
  }

  console.log('');

  // Exit with appropriate code
  if (totalIssues === 0 && averageScore >= 7) {
    logSuccess('Validation completed successfully! 🎉');
    process.exit(0);
  } else {
    logWarning('Validation completed with recommendations for improvement');
    process.exit(0);
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled promise rejection: ${reason}`);
  console.error(promise);
  process.exit(1);
});

// Run the validation
main().catch(error => {
  logError(`Validation failed: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});