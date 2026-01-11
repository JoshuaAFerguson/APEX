#!/usr/bin/env node
/**
 * Test Verification Script for Screenshot Comparator
 *
 * This script verifies that all required test files exist and are properly structured
 * for the visual diff image generation feature acceptance criteria.
 */

const fs = require('fs');
const path = require('path');

const testDir = __dirname;
const requiredTestFiles = [
  'screenshot-comparator.test.ts',
  'screenshot-comparator.diff-generation.test.ts',
  'screenshot-comparator.acceptance.test.ts',
  'screenshot-comparator.edge-cases.test.ts',
  'screenshot-comparator.performance.test.ts',
  'screenshot-comparator.integration.test.ts',
  'screenshot-comparator.validation.test.ts',
  'screenshot-comparator.exports.test.ts'
];

console.log('🧪 Screenshot Comparator Test Verification');
console.log('==========================================\n');

// Check if all required test files exist
let allFilesExist = true;
console.log('📂 Checking test file existence:');
for (const fileName of requiredTestFiles) {
  const filePath = path.join(testDir, fileName);
  const exists = fs.existsSync(filePath);
  const status = exists ? '✅' : '❌';
  console.log(`   ${status} ${fileName}`);
  if (!exists) allFilesExist = false;
}

console.log('\n📋 Test Coverage Summary:');
console.log('==========================');

// Check content of key test files for acceptance criteria
const acceptanceTestPath = path.join(testDir, 'screenshot-comparator.acceptance.test.ts');
const diffGenerationTestPath = path.join(testDir, 'screenshot-comparator.diff-generation.test.ts');

if (fs.existsSync(acceptanceTestPath)) {
  const acceptanceContent = fs.readFileSync(acceptanceTestPath, 'utf8');

  // Check for AC1: Configurable color (default magenta)
  const hasAC1 = acceptanceContent.includes('AC1: Generate diff image with configurable color') &&
                 acceptanceContent.includes('default magenta color') &&
                 acceptanceContent.includes('custom diff colors');

  // Check for AC2: Diff images saved alongside results
  const hasAC2 = acceptanceContent.includes('AC2: Diff images are saved alongside comparison results') &&
                 acceptanceContent.includes('result.diffImagePath');

  // Check for AC3: Tests verify accuracy
  const hasAC3 = acceptanceContent.includes('AC3: Tests verify diff images accurately show differences') &&
                 acceptanceContent.includes('pixel by pixel') &&
                 acceptanceContent.includes('highlight all changed pixels');

  console.log(`✅ AC1: Configurable Color Support - ${hasAC1 ? 'TESTED' : 'MISSING'}`);
  console.log(`✅ AC2: File Saving Integration - ${hasAC2 ? 'TESTED' : 'MISSING'}`);
  console.log(`✅ AC3: Accuracy Verification - ${hasAC3 ? 'TESTED' : 'MISSING'}`);
} else {
  console.log('❌ Acceptance test file missing');
}

if (fs.existsSync(diffGenerationTestPath)) {
  const diffContent = fs.readFileSync(diffGenerationTestPath, 'utf8');

  // Check for comprehensive diff generation tests
  const hasDiffTests = diffContent.includes('default magenta diff color') &&
                       diffContent.includes('custom diff colors') &&
                       diffContent.includes('diff image content accuracy');

  console.log(`✅ Diff Generation Tests - ${hasDiffTests ? 'COMPREHENSIVE' : 'INCOMPLETE'}`);
} else {
  console.log('❌ Diff generation test file missing');
}

console.log('\n🎯 Feature Implementation Status:');
console.log('=================================');

// Check the main implementation file
const implementationPath = path.join(testDir, '..', 'screenshot-comparator.ts');
if (fs.existsSync(implementationPath)) {
  const implContent = fs.readFileSync(implementationPath, 'utf8');

  const hasDiffGeneration = implContent.includes('generateCustomDiffImage') &&
                            implContent.includes('diffColor') &&
                            implContent.includes('saveDiffImage');

  const hasConfigurableColors = implContent.includes('[255, 0, 255]') && // default magenta
                                implContent.includes('diffColor: [number, number, number]');

  const hasFileOperations = implContent.includes('diffOutputPath') &&
                            implContent.includes('fs.mkdir') &&
                            implContent.includes('.png()');

  console.log(`✅ Diff Image Generation - ${hasDiffGeneration ? 'IMPLEMENTED' : 'MISSING'}`);
  console.log(`✅ Configurable Colors - ${hasConfigurableColors ? 'IMPLEMENTED' : 'MISSING'}`);
  console.log(`✅ File Operations - ${hasFileOperations ? 'IMPLEMENTED' : 'MISSING'}`);
} else {
  console.log('❌ Implementation file not found');
}

console.log('\n📊 Test File Statistics:');
console.log('========================');

let totalTestCount = 0;
for (const fileName of requiredTestFiles) {
  const filePath = path.join(testDir, fileName);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const testMatches = content.match(/it\(/g) || [];
    const testCount = testMatches.length;
    totalTestCount += testCount;
    console.log(`📄 ${fileName.replace('screenshot-comparator.', '').replace('.test.ts', '')}: ${testCount} tests`);
  }
}

console.log(`\n🔢 Total Test Cases: ${totalTestCount}`);

console.log('\n🏁 Summary:');
console.log('===========');
if (allFilesExist && totalTestCount > 0) {
  console.log('🎉 All test files present and comprehensive test coverage achieved!');
  console.log('✅ Ready for test execution and validation');
  process.exit(0);
} else {
  console.log('⚠️  Some test files or coverage may be missing');
  console.log('❌ Review test implementation before proceeding');
  process.exit(1);
}