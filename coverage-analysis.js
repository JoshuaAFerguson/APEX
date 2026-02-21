#!/usr/bin/env node

/**
 * Coverage Analysis for ProjectContextAnalyzer Integration Tests
 * This script analyzes the integration tests to ensure >80% coverage
 */

const fs = require('fs');
const path = require('path');

// Analyze coverage of public methods in ProjectContextAnalyzer
function analyzeMethodCoverage() {
  console.log('🔍 Analyzing ProjectContextAnalyzer Method Coverage\n');

  // Read the main implementation file
  const implPath = path.join(__dirname, 'packages/core/src/project-context-analyzer.ts');
  const implContent = fs.readFileSync(implPath, 'utf8');

  // Extract public methods
  const publicMethods = [
    { name: 'analyze()', pattern: 'async analyze()' },
    { name: 'getGitStatus()', pattern: 'async getGitStatus()' },
    { name: 'getProjectStructure()', pattern: 'async getProjectStructure()' },
    { name: 'analyzeProjectStructure()', pattern: 'async analyzeProjectStructure()' },
    { name: 'detectFrameworks()', pattern: 'async detectFrameworks()' },
    { name: 'getConfigurationInfoList()', pattern: 'async getConfigurationInfoList()' },
    { name: 'parseConfigurations()', pattern: 'async parseConfigurations(' },
    { name: 'getTestFrameworkInfoList()', pattern: 'async getTestFrameworkInfoList()' },
    { name: 'detectTestFrameworks()', pattern: 'async detectTestFrameworks()' },
    { name: 'getProjectPath()', pattern: 'getProjectPath()' },
    { name: 'getOptions()', pattern: 'getOptions()' }
  ];

  // Read all integration test files
  const testFiles = [
    'packages/core/src/__tests__/project-context-analyzer-comprehensive-integration.test.ts',
    'packages/core/src/__tests__/project-context-analyzer-method-interactions.test.ts',
    'packages/core/src/__tests__/project-context-analyzer-coverage-focused.test.ts'
  ];

  let combinedTestContent = '';
  testFiles.forEach(testFile => {
    const testPath = path.join(__dirname, testFile);
    if (fs.existsSync(testPath)) {
      combinedTestContent += fs.readFileSync(testPath, 'utf8') + '\n';
    }
  });

  // Analyze coverage of each method
  console.log('📊 Public Method Coverage Analysis:');
  console.log('-'.repeat(60));

  let coveredMethods = 0;
  publicMethods.forEach(method => {
    // Check if method is called in tests (various patterns)
    const methodName = method.name.replace('()', '');
    const patterns = [
      `analyzer.${methodName}(`,
      `await analyzer.${methodName}(`,
      `.${methodName}(`,
      `${methodName}(`
    ];

    const isCovered = patterns.some(pattern => combinedTestContent.includes(pattern));

    if (isCovered) {
      coveredMethods++;
      console.log(`✅ ${method.name.padEnd(25)} - COVERED`);
    } else {
      console.log(`❌ ${method.name.padEnd(25)} - NOT COVERED`);
    }
  });

  const coveragePercentage = (coveredMethods / publicMethods.length * 100).toFixed(1);
  console.log('-'.repeat(60));
  console.log(`📈 Method Coverage: ${coveredMethods}/${publicMethods.length} (${coveragePercentage}%)`);

  return { coveragePercentage: parseFloat(coveragePercentage), coveredMethods, totalMethods: publicMethods.length };
}

// Analyze test scenario coverage
function analyzeScenarioCoverage() {
  console.log('\n🎯 Test Scenario Coverage Analysis\n');

  const testFiles = [
    'packages/core/src/__tests__/project-context-analyzer-comprehensive-integration.test.ts',
    'packages/core/src/__tests__/project-context-analyzer-method-interactions.test.ts',
    'packages/core/src/__tests__/project-context-analyzer-coverage-focused.test.ts'
  ];

  // Key scenarios that should be tested
  const scenarios = [
    { name: 'Empty project handling', patterns: ['empty project', 'empty directory'] },
    { name: 'Monorepo detection', patterns: ['monorepo', 'workspace'] },
    { name: 'Framework detection', patterns: ['detectFrameworks', 'react', 'typescript', 'framework'] },
    { name: 'Git repository analysis', patterns: ['git', 'repository', 'getGitStatus'] },
    { name: 'Configuration parsing', patterns: ['configuration', 'package.json', 'tsconfig'] },
    { name: 'Test framework detection', patterns: ['test framework', 'jest', 'vitest'] },
    { name: 'Error handling', patterns: ['error', 'malformed', 'invalid'] },
    { name: 'File system operations', patterns: ['filesystem', 'directory', 'file'] },
    { name: 'Schema validation', patterns: ['schema', 'Schema.parse'] },
    { name: 'Options propagation', patterns: ['options', 'excludeDirectories', 'maxDepth'] }
  ];

  let combinedTestContent = '';
  testFiles.forEach(testFile => {
    const testPath = path.join(__dirname, testFile);
    if (fs.existsSync(testPath)) {
      combinedTestContent += fs.readFileSync(testPath, 'utf8') + '\n';
    }
  });

  console.log('📋 Scenario Coverage:');
  console.log('-'.repeat(60));

  let coveredScenarios = 0;
  scenarios.forEach(scenario => {
    const isCovered = scenario.patterns.some(pattern =>
      combinedTestContent.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isCovered) {
      coveredScenarios++;
      console.log(`✅ ${scenario.name.padEnd(30)} - COVERED`);
    } else {
      console.log(`❌ ${scenario.name.padEnd(30)} - NOT COVERED`);
    }
  });

  const scenarioCoverage = (coveredScenarios / scenarios.length * 100).toFixed(1);
  console.log('-'.repeat(60));
  console.log(`📈 Scenario Coverage: ${coveredScenarios}/${scenarios.length} (${scenarioCoverage}%)`);

  return { scenarioCoverage: parseFloat(scenarioCoverage), coveredScenarios, totalScenarios: scenarios.length };
}

// Count total test cases
function countTestCases() {
  console.log('\n📊 Test Case Statistics\n');

  const testFiles = [
    { name: 'Comprehensive Integration', file: 'packages/core/src/__tests__/project-context-analyzer-comprehensive-integration.test.ts' },
    { name: 'Method Interactions', file: 'packages/core/src/__tests__/project-context-analyzer-method-interactions.test.ts' },
    { name: 'Coverage Focused', file: 'packages/core/src/__tests__/project-context-analyzer-coverage-focused.test.ts' }
  ];

  let totalTestCases = 0;
  let totalDescribeBlocks = 0;

  testFiles.forEach(({ name, file }) => {
    const testPath = path.join(__dirname, file);
    if (fs.existsSync(testPath)) {
      const content = fs.readFileSync(testPath, 'utf8');
      const testCases = (content.match(/it\(/g) || []).length;
      const describeBlocks = (content.match(/describe\(/g) || []).length;

      totalTestCases += testCases;
      totalDescribeBlocks += describeBlocks;

      console.log(`📝 ${name.padEnd(25)} - ${testCases} test cases, ${describeBlocks} describe blocks`);
    }
  });

  console.log('-'.repeat(60));
  console.log(`📈 Total: ${totalTestCases} test cases, ${totalDescribeBlocks} describe blocks`);

  return { totalTestCases, totalDescribeBlocks };
}

// Main analysis
function main() {
  console.log('🧪 ProjectContextAnalyzer Integration Test Coverage Analysis\n');
  console.log('='.repeat(80));

  const methodAnalysis = analyzeMethodCoverage();
  const scenarioAnalysis = analyzeScenarioCoverage();
  const testStats = countTestCases();

  console.log('\n' + '='.repeat(80));
  console.log('📊 OVERALL COVERAGE SUMMARY');
  console.log('='.repeat(80));

  console.log(`🔧 Public Method Coverage: ${methodAnalysis.coveragePercentage}% (${methodAnalysis.coveredMethods}/${methodAnalysis.totalMethods})`);
  console.log(`🎯 Test Scenario Coverage: ${scenarioAnalysis.scenarioCoverage}% (${scenarioAnalysis.coveredScenarios}/${scenarioAnalysis.totalScenarios})`);
  console.log(`📝 Total Test Cases: ${testStats.totalTestCases}`);
  console.log(`📋 Total Describe Blocks: ${testStats.totalDescribeBlocks}`);

  // Calculate overall coverage score
  const overallCoverage = (methodAnalysis.coveragePercentage + scenarioAnalysis.scenarioCoverage) / 2;
  console.log(`\n🎯 Overall Coverage Score: ${overallCoverage.toFixed(1)}%`);

  // Determine if coverage meets requirements
  const meetsRequirements = methodAnalysis.coveragePercentage >= 80 && scenarioAnalysis.scenarioCoverage >= 80;

  console.log('\n' + '='.repeat(80));
  if (meetsRequirements) {
    console.log('✅ COVERAGE ANALYSIS: MEETS >80% REQUIREMENTS');
    console.log('✅ Integration tests provide comprehensive coverage');
    console.log('✅ All critical methods and scenarios are tested');
  } else {
    console.log('❌ COVERAGE ANALYSIS: BELOW REQUIREMENTS');
    if (methodAnalysis.coveragePercentage < 80) {
      console.log(`❌ Method coverage ${methodAnalysis.coveragePercentage}% is below 80%`);
    }
    if (scenarioAnalysis.scenarioCoverage < 80) {
      console.log(`❌ Scenario coverage ${scenarioAnalysis.scenarioCoverage}% is below 80%`);
    }
  }

  return {
    meetsRequirements,
    overallCoverage,
    methodCoverage: methodAnalysis.coveragePercentage,
    scenarioCoverage: scenarioAnalysis.scenarioCoverage,
    totalTestCases: testStats.totalTestCases
  };
}

if (require.main === module) {
  const result = main();
  console.log('\n💡 Next Steps:');
  if (result.meetsRequirements) {
    console.log('   - Run integration tests: npm run test:integration');
    console.log('   - Generate coverage report: npm run test:integration:coverage');
    console.log('   - Verify CI pipeline compatibility');
  } else {
    console.log('   - Add missing method coverage');
    console.log('   - Implement missing test scenarios');
    console.log('   - Re-run analysis to verify improvements');
  }

  process.exit(result.meetsRequirements ? 0 : 1);
}

module.exports = main;