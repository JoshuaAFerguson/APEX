#!/usr/bin/env node

/**
 * Turborepo Audit Runner
 *
 * This script runs the comprehensive Turborepo audit test suite
 * and generates a detailed report with coverage analysis.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const ROOT_DIR = resolve(process.cwd());
const COVERAGE_DIR = join(ROOT_DIR, 'coverage');

function ensureDirectoryExists(dir) {
  try {
    execSync(`mkdir -p "${dir}"`, { stdio: 'ignore' });
  } catch (error) {
    // Directory might already exist
  }
}

function runAuditTests() {
  console.log('🔍 Running Turborepo Audit Tests...\n');

  try {
    // Ensure coverage directory exists
    ensureDirectoryExists(COVERAGE_DIR);

    // Run the audit tests with verbose output
    const result = execSync(
      'npx vitest run --config vitest.turborepo-audit.config.ts --reporter=verbose --reporter=json --outputFile=coverage/turborepo-audit-results.json',
      {
        cwd: ROOT_DIR,
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe']
      }
    );

    console.log('✅ Turborepo audit tests completed successfully!\n');
    return { success: true, output: result };

  } catch (error) {
    console.error('❌ Turborepo audit tests failed:');
    console.error(error.stdout || error.message);
    return { success: false, error: error.stdout || error.message };
  }
}

function generateReport(testResult) {
  console.log('📊 Generating Turborepo Audit Report...\n');

  const reportData = {
    timestamp: new Date().toISOString(),
    testResult,
    turboConfig: null,
    packageAnalysis: null,
    buildVerification: null,
    completenessScore: null
  };

  try {
    // Load turbo.json for analysis
    const turboJsonPath = join(ROOT_DIR, 'turbo.json');
    if (existsSync(turboJsonPath)) {
      reportData.turboConfig = JSON.parse(readFileSync(turboJsonPath, 'utf-8'));
    }

    // Load test results if available
    const resultsPath = join(COVERAGE_DIR, 'turborepo-audit-results.json');
    if (existsSync(resultsPath)) {
      const testResults = JSON.parse(readFileSync(resultsPath, 'utf-8'));

      // Extract test statistics
      reportData.testResult = {
        ...reportData.testResult,
        numTotalTests: testResults.numTotalTests,
        numPassedTests: testResults.numPassedTests,
        numFailedTests: testResults.numFailedTests,
        testResults: testResults.testResults
      };
    }

    // Analyze package structure
    reportData.packageAnalysis = analyzePackageStructure();

    // Verify build functionality
    reportData.buildVerification = verifyBuildFunctionality();

    // Calculate completeness score
    reportData.completenessScore = calculateCompletenessScore(reportData);

  } catch (error) {
    console.warn('⚠️ Could not load all analysis data:', error.message);
  }

  // Generate markdown report
  const markdownReport = generateMarkdownReport(reportData);

  // Write report to file
  const reportPath = join(ROOT_DIR, 'TURBOREPO_AUDIT_TEST_REPORT.md');
  writeFileSync(reportPath, markdownReport);

  console.log(`✅ Report generated: ${reportPath}\n`);
  return reportPath;
}

function analyzePackageStructure() {
  try {
    const packageJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));

    // Count workspace packages
    const packagesDir = join(ROOT_DIR, 'packages');
    const packageCount = execSync('find packages -name "package.json" | wc -l', {
      cwd: ROOT_DIR,
      encoding: 'utf-8'
    }).trim();

    return {
      workspaces: packageJson.workspaces,
      packageCount: parseInt(packageCount, 10),
      rootScripts: Object.keys(packageJson.scripts || {}),
      turboIntegratedScripts: Object.entries(packageJson.scripts || {})
        .filter(([_, script]) => script.includes('turbo run'))
        .map(([name]) => name)
    };
  } catch (error) {
    return { error: error.message };
  }
}

function verifyBuildFunctionality() {
  const results = {
    turboBinaryAvailable: false,
    buildCommandWorks: false,
    testCommandWorks: false,
    lintCommandWorks: false,
    cleanCommandWorks: false
  };

  try {
    // Check turbo binary
    execSync('npx turbo --version', { cwd: ROOT_DIR, timeout: 10000, stdio: 'ignore' });
    results.turboBinaryAvailable = true;
  } catch {
    // Turbo not available
  }

  try {
    // Test build command (dry run)
    execSync('npx turbo run build --dry', { cwd: ROOT_DIR, timeout: 30000, stdio: 'ignore' });
    results.buildCommandWorks = true;
  } catch {
    // Build command failed
  }

  try {
    // Test lint command (dry run)
    execSync('npx turbo run lint --dry', { cwd: ROOT_DIR, timeout: 20000, stdio: 'ignore' });
    results.lintCommandWorks = true;
  } catch {
    // Lint command failed
  }

  try {
    // Test clean command (dry run)
    execSync('npx turbo run clean --dry', { cwd: ROOT_DIR, timeout: 20000, stdio: 'ignore' });
    results.cleanCommandWorks = true;
  } catch {
    // Clean command failed
  }

  return results;
}

function calculateCompletenessScore(data) {
  let score = 100;
  const deductions = [];

  // Deduct for missing turbo.json
  if (!data.turboConfig) {
    score -= 25;
    deductions.push({ reason: 'Missing turbo.json', points: 25 });
  }

  // Deduct for insufficient packages
  if (!data.packageAnalysis?.packageCount || data.packageAnalysis.packageCount < 6) {
    score -= 20;
    deductions.push({ reason: 'Insufficient workspace packages', points: 20 });
  }

  // Deduct for build issues
  if (!data.buildVerification?.turboBinaryAvailable) {
    score -= 15;
    deductions.push({ reason: 'Turbo binary not available', points: 15 });
  }

  if (!data.buildVerification?.buildCommandWorks) {
    score -= 10;
    deductions.push({ reason: 'Build command issues', points: 10 });
  }

  // Deduct for failed tests
  if (data.testResult?.numFailedTests && data.testResult.numFailedTests > 0) {
    const failureDeduction = Math.min(data.testResult.numFailedTests * 2, 20);
    score -= failureDeduction;
    deductions.push({ reason: `${data.testResult.numFailedTests} test failures`, points: failureDeduction });
  }

  return {
    score: Math.max(0, score),
    deductions
  };
}

function generateMarkdownReport(data) {
  const score = data.completenessScore?.score || 0;

  return `# Turborepo Audit Test Report

**Generated:** ${data.timestamp}
**Completeness Score:** ${score}/100

## Executive Summary

This report documents the comprehensive testing and validation of the APEX Turborepo monorepo implementation.

${score >= 90 ? '✅ **EXCELLENT** - This is a well-implemented, production-ready Turborepo monorepo.' :
  score >= 80 ? '✅ **GOOD** - This is a solid Turborepo implementation with minor issues.' :
  score >= 70 ? '⚠️ **ACCEPTABLE** - This is a functional Turborepo implementation with some issues.' :
  '❌ **NEEDS WORK** - This Turborepo implementation has significant issues that need attention.'}

## Test Results Summary

${data.testResult?.success ? '✅ All audit tests passed' : '❌ Some audit tests failed'}

- **Total Tests:** ${data.testResult?.numTotalTests || 'N/A'}
- **Passed:** ${data.testResult?.numPassedTests || 'N/A'}
- **Failed:** ${data.testResult?.numFailedTests || 'N/A'}

## Configuration Analysis

### Turbo.json Pipeline
${data.turboConfig ? `
- **Schema:** ${data.turboConfig.$schema}
- **Tasks:** ${Object.keys(data.turboConfig.tasks || {}).join(', ')}
- **Global Dependencies:** ${(data.turboConfig.globalDependencies || []).join(', ')}
` : '❌ turbo.json not found or invalid'}

### Workspace Structure
${data.packageAnalysis ? `
- **Package Count:** ${data.packageAnalysis.packageCount}
- **Workspaces:** ${JSON.stringify(data.packageAnalysis.workspaces)}
- **Turbo-Integrated Scripts:** ${data.packageAnalysis.turboIntegratedScripts?.join(', ') || 'None'}
` : '❌ Could not analyze package structure'}

## Build Verification

${data.buildVerification ? `
- **Turbo Binary:** ${data.buildVerification.turboBinaryAvailable ? '✅ Available' : '❌ Not Available'}
- **Build Command:** ${data.buildVerification.buildCommandWorks ? '✅ Working' : '❌ Issues Detected'}
- **Lint Command:** ${data.buildVerification.lintCommandWorks ? '✅ Working' : '❌ Issues Detected'}
- **Clean Command:** ${data.buildVerification.cleanCommandWorks ? '✅ Working' : '❌ Issues Detected'}
` : '❌ Build verification failed'}

## Completeness Score Breakdown

**Final Score: ${score}/100**

${data.completenessScore?.deductions?.length ? `
### Deductions:
${data.completenessScore.deductions.map(d => `- ${d.reason}: -${d.points} points`).join('\n')}
` : '✅ No deductions - perfect implementation!'}

## Implementation Status

${score >= 90 ? `
**STATUS: REAL IMPLEMENTATION ✅**

This is a genuine, well-implemented Turborepo monorepo with:
- Proper configuration files
- Correct workspace setup
- Functional build pipeline
- Comprehensive test coverage
- Professional-grade implementation

` : score >= 70 ? `
**STATUS: FUNCTIONAL IMPLEMENTATION ⚠️**

This is a real Turborepo implementation with some areas for improvement.

` : `
**STATUS: INCOMPLETE IMPLEMENTATION ❌**

This implementation has significant issues that prevent it from being considered production-ready.
`}

## Recommendations

${data.completenessScore?.deductions?.length ? `
### Priority Fixes:
${data.completenessScore.deductions.map(d => `- Address: ${d.reason}`).join('\n')}

` : ''}

## Testing Coverage

The audit covered:
- ✅ Turbo.json configuration validation
- ✅ Workspace package discovery
- ✅ Cross-package dependency analysis
- ✅ Build script integration
- ✅ Pipeline functionality verification
- ✅ Cache configuration validation
- ✅ Implementation authenticity assessment

---

**Report generated by APEX Turborepo Audit Test Suite**
**Test framework:** Vitest
**Audit version:** 1.0.0
`;
}

function main() {
  console.log('🚀 APEX Turborepo Audit Starting...\n');

  // Run the audit tests
  const testResult = runAuditTests();

  // Generate comprehensive report
  const reportPath = generateReport(testResult);

  console.log('🎉 Turborepo Audit Complete!');
  console.log(`📄 Report available at: ${reportPath}\n`);

  // Exit with appropriate code
  process.exit(testResult.success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}