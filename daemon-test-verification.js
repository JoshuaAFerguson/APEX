#!/usr/bin/env node
/**
 * Daemon Test Verification Script
 * Validates the test suite structure and readiness for daemon functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 APEX Daemon Test Suite Verification');
console.log('=====================================');

// Configuration
const packagePaths = [
  'packages/orchestrator/src',
  'packages/cli/src',
  'packages/core/src',
  'packages/api/src'
];

// Test patterns to look for
const daemonTestPatterns = [
  '*daemon*.test.ts',
  '*daemon*.integration.test.ts',
  '*daemon*.e2e.test.ts'
];

let totalTests = 0;
let testFiles = [];

// Scan for daemon tests
console.log('\n📁 Scanning for daemon test files...');

function findTestFiles(dir, pattern) {
  try {
    const fullPath = path.resolve(dir);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Path not found: ${dir}`);
      return [];
    }

    const files = [];
    function scanDirectory(dirPath) {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          scanDirectory(itemPath);
        } else if (item.includes('daemon') && item.includes('.test.ts')) {
          files.push(itemPath);
        }
      }
    }

    scanDirectory(fullPath);
    return files;
  } catch (error) {
    console.log(`❌ Error scanning ${dir}: ${error.message}`);
    return [];
  }
}

// Find all daemon test files
for (const packagePath of packagePaths) {
  const files = findTestFiles(packagePath);
  testFiles.push(...files);
  console.log(`📦 ${packagePath}: ${files.length} daemon test files found`);
}

totalTests = testFiles.length;
console.log(`\n📊 Total daemon test files found: ${totalTests}`);

// Analyze test file structure
console.log('\n🔍 Analyzing test file structure...');

let structureValid = 0;
let importIssues = 0;
let testCases = 0;

for (const testFile of testFiles) {
  try {
    const content = fs.readFileSync(testFile, 'utf8');

    // Check for proper vitest imports
    const hasVitest = content.includes('from \'vitest\'');
    const hasDescribe = content.includes('describe(');
    const hasIt = content.includes('it(');
    const hasExpect = content.includes('expect(');

    // Count test cases
    const testCaseMatches = content.match(/\bit\s*\(/g);
    const fileTestCases = testCaseMatches ? testCaseMatches.length : 0;
    testCases += fileTestCases;

    if (hasVitest && hasDescribe && hasIt && hasExpected) {
      structureValid++;
      console.log(`✅ ${path.basename(testFile)} - ${fileTestCases} tests`);
    } else {
      console.log(`⚠️  ${path.basename(testFile)} - Structure issues detected`);
      if (!hasVitest) importIssues++;
    }
  } catch (error) {
    console.log(`❌ Error reading ${testFile}: ${error.message}`);
  }
}

// Verify key daemon components are tested
console.log('\n🎯 Key Component Coverage Check:');

const keyComponents = [
  'daemon.test.ts',
  'daemon-lifecycle',
  'daemon-health',
  'daemon-cli',
  'daemon-config'
];

let componentsCovered = 0;
for (const component of keyComponents) {
  const found = testFiles.some(file => path.basename(file).includes(component));
  if (found) {
    console.log(`✅ ${component} - Covered`);
    componentsCovered++;
  } else {
    console.log(`❌ ${component} - Missing tests`);
  }
}

// Check build artifacts
console.log('\n🏗️  Build Status Check:');

const buildPaths = [
  'packages/core/dist',
  'packages/orchestrator/dist',
  'packages/cli/dist',
  'packages/api/dist'
];

let buildReady = 0;
for (const buildPath of buildPaths) {
  if (fs.existsSync(buildPath)) {
    console.log(`✅ ${buildPath} - Built`);
    buildReady++;
  } else {
    console.log(`❌ ${buildPath} - Not built`);
  }
}

// Configuration check
console.log('\n⚙️  Configuration Check:');

const configFiles = [
  'vitest.config.ts',
  'package.json'
];

let configValid = 0;
for (const configFile of configFiles) {
  if (fs.existsSync(configFile)) {
    console.log(`✅ ${configFile} - Present`);
    configValid++;
  } else {
    console.log(`❌ ${configFile} - Missing`);
  }
}

// Generate summary report
console.log('\n📊 VERIFICATION SUMMARY');
console.log('======================');

console.log(`Total Daemon Test Files: ${totalTests}`);
console.log(`Structurally Valid Tests: ${structureValid}/${totalTests}`);
console.log(`Total Test Cases: ${testCases}`);
console.log(`Key Components Covered: ${componentsCovered}/${keyComponents.length}`);
console.log(`Build Status: ${buildReady}/${buildPaths.length} packages built`);
console.log(`Configuration: ${configValid}/${configFiles.length} files present`);

// Calculate overall score
const maxScore = 100;
const testScore = Math.round((structureValid / Math.max(totalTests, 1)) * 30);
const componentScore = Math.round((componentsCovered / keyComponents.length) * 25);
const buildScore = Math.round((buildReady / buildPaths.length) * 25);
const configScore = Math.round((configValid / configFiles.length) * 20);

const totalScore = testScore + componentScore + buildScore + configScore;

console.log(`\n🎯 Overall Test Readiness Score: ${totalScore}/${maxScore}`);

if (totalScore >= 80) {
  console.log('🟢 EXCELLENT - Test suite is ready for execution');
} else if (totalScore >= 60) {
  console.log('🟡 GOOD - Minor issues to address');
} else {
  console.log('🔴 NEEDS WORK - Significant issues detected');
}

// Recommendations
console.log('\n💡 RECOMMENDATIONS:');
if (buildReady < buildPaths.length) {
  console.log('  • Run "npm run build" to compile all packages');
}
if (structureValid < totalTests) {
  console.log('  • Review test files with structure issues');
}
if (componentsCovered < keyComponents.length) {
  console.log('  • Add tests for missing key components');
}

console.log('\n✅ Verification complete!');

// Exit with appropriate code
process.exit(totalScore >= 80 ? 0 : 1);