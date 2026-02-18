#!/usr/bin/env node

/**
 * @fileoverview E2E Test Coverage Analysis
 *
 * This script analyzes the E2E test coverage to ensure all critical
 * functionality is tested end-to-end.
 */

const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

async function analyzeE2ETestCoverage() {
  console.log('📊 Analyzing E2E Test Coverage\n');

  // Discover all E2E test files
  const e2ePatterns = [
    'packages/*/src/**/*.e2e.test.ts',
    'tests/e2e/**/*.test.ts',
    'tests/e2e/**/*.e2e.test.ts',
    '**/*e2e*.test.ts',
    '**/e2e-*.test.ts',
    'tests/integration/**/*e2e*.test.ts'
  ];

  const excludePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**'
  ];

  let allE2ETests = new Set();

  for (const pattern of e2ePatterns) {
    try {
      const files = await glob(pattern, {
        ignore: excludePatterns,
        cwd: process.cwd()
      });
      files.forEach(file => allE2ETests.add(file));
    } catch (error) {
      console.warn(`⚠️  Warning with pattern ${pattern}: ${error.message}`);
    }
  }

  const e2eTests = Array.from(allE2ETests).sort();

  console.log(`📈 Total E2E Tests Found: ${e2eTests.length}\n`);

  // Categorize tests by functionality
  const categories = {
    marketplace: [],
    cli: [],
    git: [],
    browser: [],
    permissions: [],
    orchestrator: [],
    infrastructure: [],
    workflow: [],
    api: [],
    core: [],
    other: []
  };

  e2eTests.forEach(testFile => {
    const fileName = testFile.toLowerCase();

    if (fileName.includes('marketplace') || fileName.includes('mcp-')) {
      categories.marketplace.push(testFile);
    } else if (fileName.includes('cli') || fileName.includes('command') || fileName.includes('checkout') || fileName.includes('push') || fileName.includes('init') || fileName.includes('run')) {
      categories.cli.push(testFile);
    } else if (fileName.includes('git') || fileName.includes('merge')) {
      categories.git.push(testFile);
    } else if (fileName.includes('browser')) {
      categories.browser.push(testFile);
    } else if (fileName.includes('permission') || fileName.includes('approval')) {
      categories.permissions.push(testFile);
    } else if (fileName.includes('orchestrator') || fileName.includes('workflow') && fileName.includes('orchestrator')) {
      categories.orchestrator.push(testFile);
    } else if (fileName.includes('infrastructure') || fileName.includes('service') || fileName.includes('cleanup')) {
      categories.infrastructure.push(testFile);
    } else if (fileName.includes('workflow') || fileName.includes('integration')) {
      categories.workflow.push(testFile);
    } else if (fileName.includes('api') || fileName.includes('endpoint')) {
      categories.api.push(testFile);
    } else if (fileName.includes('core') || fileName.includes('config') || fileName.includes('autonomy')) {
      categories.core.push(testFile);
    } else {
      categories.other.push(testFile);
    }
  });

  // Generate coverage report
  const report = {
    summary: {
      totalTests: e2eTests.length,
      categoriesCount: Object.keys(categories).length,
      timestamp: new Date().toISOString()
    },
    categories: {},
    coverage: {
      marketplace: calculateCoverage('marketplace', categories.marketplace),
      cli: calculateCoverage('cli', categories.cli),
      git: calculateCoverage('git', categories.git),
      browser: calculateCoverage('browser', categories.browser),
      permissions: calculateCoverage('permissions', categories.permissions),
      infrastructure: calculateCoverage('infrastructure', categories.infrastructure)
    },
    recommendations: []
  };

  // Print detailed coverage analysis
  console.log('📋 E2E Test Coverage by Category:\n');

  for (const [category, tests] of Object.entries(categories)) {
    if (tests.length > 0) {
      console.log(`🏷️  ${category.toUpperCase()} (${tests.length} tests):`);
      tests.forEach(test => {
        console.log(`   • ${test}`);
      });
      console.log('');

      report.categories[category] = tests;
    }
  }

  // Analysis and recommendations
  console.log('🎯 Coverage Analysis:\n');

  const coverageAnalysis = [
    {
      area: 'Marketplace E2E Tests',
      count: categories.marketplace.length,
      expected: 8,
      status: categories.marketplace.length >= 8 ? 'GOOD' : 'NEEDS_ATTENTION'
    },
    {
      area: 'CLI Command Tests',
      count: categories.cli.length,
      expected: 10,
      status: categories.cli.length >= 10 ? 'GOOD' : 'NEEDS_ATTENTION'
    },
    {
      area: 'Git Workflow Tests',
      count: categories.git.length,
      expected: 3,
      status: categories.git.length >= 3 ? 'GOOD' : 'NEEDS_ATTENTION'
    },
    {
      area: 'Browser Integration Tests',
      count: categories.browser.length,
      expected: 3,
      status: categories.browser.length >= 3 ? 'GOOD' : 'NEEDS_ATTENTION'
    },
    {
      area: 'Permission System Tests',
      count: categories.permissions.length,
      expected: 5,
      status: categories.permissions.length >= 5 ? 'GOOD' : 'NEEDS_ATTENTION'
    },
    {
      area: 'Infrastructure Tests',
      count: categories.infrastructure.length,
      expected: 3,
      status: categories.infrastructure.length >= 3 ? 'GOOD' : 'NEEDS_ATTENTION'
    }
  ];

  coverageAnalysis.forEach(analysis => {
    const icon = analysis.status === 'GOOD' ? '✅' : '⚠️';
    console.log(`${icon} ${analysis.area}: ${analysis.count}/${analysis.expected} (${analysis.status})`);

    if (analysis.status === 'NEEDS_ATTENTION') {
      report.recommendations.push(`Consider adding more ${analysis.area} to reach target of ${analysis.expected}`);
    }
  });

  // Quality indicators
  console.log('\n🔍 Quality Indicators:\n');

  const qualityChecks = [
    {
      check: 'Comprehensive marketplace coverage',
      passed: categories.marketplace.length >= 8,
      details: `${categories.marketplace.length} marketplace E2E tests found`
    },
    {
      check: 'CLI command coverage',
      passed: categories.cli.length >= 10,
      details: `${categories.cli.length} CLI command E2E tests found`
    },
    {
      check: 'End-to-end workflow coverage',
      passed: categories.workflow.length >= 3,
      details: `${categories.workflow.length} workflow E2E tests found`
    },
    {
      check: 'Cross-package integration coverage',
      passed: e2eTests.some(test => test.includes('integration')),
      details: 'Cross-package integration tests present'
    },
    {
      check: 'Real system resource testing',
      passed: e2eTests.some(test => test.includes('git') || test.includes('service')),
      details: 'Tests with real git repos and services present'
    }
  ];

  qualityChecks.forEach(check => {
    const icon = check.passed ? '✅' : '❌';
    console.log(`${icon} ${check.check}: ${check.details}`);
  });

  // Save detailed report
  const reportPath = path.join(__dirname, 'e2e-coverage-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n📊 Coverage report saved to: ${reportPath}`);

  // Final assessment
  const overallScore = qualityChecks.filter(c => c.passed).length / qualityChecks.length;
  console.log(`\n🎯 Overall E2E Coverage Score: ${(overallScore * 100).toFixed(1)}%`);

  if (overallScore >= 0.8) {
    console.log('✅ E2E test coverage is comprehensive and well-distributed');
  } else if (overallScore >= 0.6) {
    console.log('⚠️  E2E test coverage is adequate but could be improved');
  } else {
    console.log('❌ E2E test coverage needs significant improvement');
  }

  return report;
}

function calculateCoverage(area, tests) {
  const targets = {
    marketplace: 8,
    cli: 10,
    git: 3,
    browser: 3,
    permissions: 5,
    infrastructure: 3
  };

  const target = targets[area] || 1;
  const actual = tests.length;
  const percentage = Math.min((actual / target) * 100, 100);

  return {
    actual,
    target,
    percentage: percentage.toFixed(1) + '%',
    status: actual >= target ? 'GOOD' : 'NEEDS_ATTENTION'
  };
}

if (require.main === module) {
  analyzeE2ETestCoverage().catch(error => {
    console.error('❌ Coverage analysis failed:', error);
    process.exit(1);
  });
}

module.exports = { analyzeE2ETestCoverage };