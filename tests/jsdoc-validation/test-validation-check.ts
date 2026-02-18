#!/usr/bin/env ts-node

/**
 * Manual Test Validation Checker
 *
 * Performs basic validation of the test files created for JSDoc validation
 * to ensure they are properly structured and can be executed.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test file information
 */
interface TestFileInfo {
  path: string;
  name: string;
  description: string;
  exists: boolean;
  size: number;
  testCount?: number;
  errors: string[];
}

/**
 * Validation results
 */
interface ValidationResults {
  totalFiles: number;
  validFiles: number;
  totalTests: number;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a test file structure and content
 * @param filePath - Path to the test file
 * @returns Test file information
 */
async function validateTestFile(filePath: string): Promise<TestFileInfo> {
  const fileName = path.basename(filePath);
  const info: TestFileInfo = {
    path: filePath,
    name: fileName,
    description: '',
    exists: false,
    size: 0,
    errors: []
  };

  try {
    // Check if file exists
    const stats = await fs.stat(filePath);
    info.exists = true;
    info.size = stats.size;

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Extract description from file header
    const descMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+?)\s*\n/);
    if (descMatch) {
      info.description = descMatch[1];
    }

    // Count test functions
    const testMatches = content.match(/\s+(it|test)\s*\(/g);
    info.testCount = testMatches ? testMatches.length : 0;

    // Basic structure validation
    if (!content.includes("import") || !content.includes("describe")) {
      info.errors.push("Missing basic test structure (imports/describe blocks)");
    }

    if (!content.includes("expect(")) {
      info.errors.push("No assertions found (expect statements)");
    }

    if (content.includes("TODO") || content.includes("FIXME")) {
      info.errors.push("Contains TODO/FIXME comments");
    }

    // Check for proper JSDoc in test file
    const jsDocMatches = content.match(/\/\*\*[\s\S]*?\*\//g);
    if (!jsDocMatches || jsDocMatches.length === 0) {
      info.errors.push("Test file itself lacks JSDoc documentation");
    }

  } catch (error) {
    info.errors.push(`Cannot read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return info;
}

/**
 * Validates all JSDoc test files
 */
async function validateAllTestFiles(): Promise<ValidationResults> {
  const testDir = __dirname;

  const testFiles = [
    'jsdoc-detector.unit.test.ts',
    'jsdoc-validation.integration.test.ts',
    'typescript-compilation.test.ts',
    'coverage-report.test.ts',
    'run-jsdoc-tests.ts'
  ];

  console.log('🔍 Validating JSDoc Test Files');
  console.log('===============================\n');

  const results: ValidationResults = {
    totalFiles: testFiles.length,
    validFiles: 0,
    totalTests: 0,
    errors: [],
    warnings: []
  };

  for (const fileName of testFiles) {
    const filePath = path.join(testDir, fileName);
    const info = await validateTestFile(filePath);

    console.log(`📄 ${fileName}`);
    console.log(`   Description: ${info.description || 'No description'}`);
    console.log(`   Exists: ${info.exists ? '✅' : '❌'}`);

    if (info.exists) {
      console.log(`   Size: ${info.size} bytes`);
      console.log(`   Test Count: ${info.testCount || 0}`);

      if (info.errors.length === 0) {
        console.log(`   Status: ✅ Valid`);
        results.validFiles++;
      } else {
        console.log(`   Status: ❌ Issues found:`);
        info.errors.forEach(error => {
          console.log(`     • ${error}`);
          results.errors.push(`${fileName}: ${error}`);
        });
      }

      results.totalTests += info.testCount || 0;
    } else {
      results.errors.push(`${fileName}: File does not exist`);
    }

    console.log();
  }

  return results;
}

/**
 * Validates that required dependencies and files exist
 */
async function validateDependencies(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // Check for required source files
    const requiredFiles = [
      '../../packages/core/src/jsdoc-detector.ts',
      '../../scripts/validate-jsdoc-comprehensive.ts',
      '../../tsconfig.jsdoc-validation.json',
      '../../package.json'
    ];

    for (const relativePath of requiredFiles) {
      const filePath = path.resolve(__dirname, relativePath);
      try {
        await fs.access(filePath);
      } catch {
        issues.push(`Required file missing: ${relativePath}`);
      }
    }

    // Check package.json for required scripts
    try {
      const packagePath = path.resolve(__dirname, '../../package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const requiredScripts = [
        'jsdoc:validate',
        'build',
        'test'
      ];

      for (const script of requiredScripts) {
        if (!packageJson.scripts || !packageJson.scripts[script]) {
          issues.push(`Required npm script missing: ${script}`);
        }
      }

      // Check for testing dependencies
      const testingDeps = ['vitest', 'typescript', '@types/node'];
      for (const dep of testingDeps) {
        const hasDevDep = packageJson.devDependencies && packageJson.devDependencies[dep];
        const hasDep = packageJson.dependencies && packageJson.dependencies[dep];
        if (!hasDevDep && !hasDep) {
          issues.push(`Testing dependency missing: ${dep}`);
        }
      }

    } catch (error) {
      issues.push(`Cannot read package.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  } catch (error) {
    issues.push(`Dependency validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Performs a syntax check on TypeScript files
 */
async function performSyntaxCheck(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    const testFiles = [
      'jsdoc-detector.unit.test.ts',
      'jsdoc-validation.integration.test.ts',
      'typescript-compilation.test.ts',
      'coverage-report.test.ts',
      'run-jsdoc-tests.ts',
      'test-validation-check.ts'
    ];

    for (const fileName of testFiles) {
      const filePath = path.join(__dirname, fileName);

      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Basic syntax checks
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
          issues.push(`${fileName}: Mismatched braces (${openBraces} open, ${closeBraces} close)`);
        }

        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
          issues.push(`${fileName}: Mismatched parentheses (${openParens} open, ${closeParens} close)`);
        }

        // Check for obvious syntax errors
        if (content.includes('import {') && !content.includes('} from')) {
          issues.push(`${fileName}: Malformed import statements`);
        }

      } catch (error) {
        issues.push(`${fileName}: Cannot read file for syntax check`);
      }
    }

  } catch (error) {
    issues.push(`Syntax check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Generates a comprehensive validation report
 */
async function generateValidationReport(): Promise<void> {
  console.log('🧪 JSDoc Test Validation Report');
  console.log('================================\n');

  // Test file validation
  const testResults = await validateAllTestFiles();

  // Dependency validation
  console.log('📦 Dependency Validation');
  console.log('-------------------------');
  const depResults = await validateDependencies();

  if (depResults.valid) {
    console.log('✅ All required dependencies and files found');
  } else {
    console.log('❌ Dependency issues found:');
    depResults.issues.forEach(issue => console.log(`   • ${issue}`));
  }
  console.log();

  // Syntax validation
  console.log('📝 Syntax Validation');
  console.log('---------------------');
  const syntaxResults = await performSyntaxCheck();

  if (syntaxResults.valid) {
    console.log('✅ All test files pass basic syntax checks');
  } else {
    console.log('❌ Syntax issues found:');
    syntaxResults.issues.forEach(issue => console.log(`   • ${issue}`));
  }
  console.log();

  // Summary
  console.log('📊 Summary');
  console.log('-----------');
  console.log(`Test Files: ${testResults.validFiles}/${testResults.totalFiles} valid`);
  console.log(`Total Tests: ${testResults.totalTests}`);
  console.log(`Dependencies: ${depResults.valid ? 'Valid' : 'Issues found'}`);
  console.log(`Syntax: ${syntaxResults.valid ? 'Valid' : 'Issues found'}`);

  const overallValid = testResults.validFiles === testResults.totalFiles &&
                      depResults.valid &&
                      syntaxResults.valid;

  console.log(`\n🎯 Overall Status: ${overallValid ? '✅ READY FOR TESTING' : '❌ NEEDS ATTENTION'}`);

  if (!overallValid) {
    console.log('\n⚠️  Issues to resolve:');
    [...testResults.errors, ...depResults.issues, ...syntaxResults.issues]
      .forEach(issue => console.log(`   • ${issue}`));
  }

  // Generate JSON report
  const report = {
    timestamp: new Date().toISOString(),
    status: overallValid ? 'ready' : 'needs_attention',
    testFiles: {
      total: testResults.totalFiles,
      valid: testResults.validFiles,
      totalTests: testResults.totalTests
    },
    dependencies: {
      valid: depResults.valid,
      issues: depResults.issues
    },
    syntax: {
      valid: syntaxResults.valid,
      issues: syntaxResults.issues
    },
    allIssues: [...testResults.errors, ...depResults.issues, ...syntaxResults.issues]
  };

  const reportPath = path.join(__dirname, 'validation-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

// Execute validation if run directly
if (require.main === module) {
  generateValidationReport().catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
}