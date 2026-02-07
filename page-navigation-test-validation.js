#!/usr/bin/env node

/**
 * Page Navigation Test Validation Script
 *
 * This script validates the page navigation test infrastructure by:
 * 1. Checking file structure and dependencies
 * 2. Parsing test files for syntax and structure
 * 3. Validating configuration files
 * 4. Simulating test execution flow
 * 5. Generating a comprehensive validation report
 */

const fs = require('fs/promises');
const path = require('path');

class PageNavigationTestValidator {
  constructor() {
    this.validationResults = {
      structureCheck: { passed: false, issues: [] },
      syntaxCheck: { passed: false, issues: [] },
      configValidation: { passed: false, issues: [] },
      dependencyCheck: { passed: false, issues: [] },
      testStructure: { passed: false, issues: [] },
      overall: { passed: false, score: 0 }
    };
  }

  async validateInfrastructure() {
    console.log('🔍 Starting Page Navigation Test Infrastructure Validation...\n');

    await this.checkFileStructure();
    await this.validateSyntax();
    await this.validateConfiguration();
    await this.checkDependencies();
    await this.analyzeTestStructure();

    this.calculateOverallScore();
    return this.validationResults;
  }

  async checkFileStructure() {
    console.log('📁 Checking file structure...');

    const requiredFiles = [
      'tests/page-navigation/vitest.config.ts',
      'tests/page-navigation/setup.ts',
      'tests/page-navigation/utils/navigation-helpers.ts',
      'tests/page-navigation/fixtures/navigation-scenarios.ts',
      'tests/page-navigation/infrastructure-verification.test.ts',
      'tests/page-navigation/navigation.integration.test.ts'
    ];

    const optionalFiles = [
      'tests/page-navigation/README.md',
      'tests/page-navigation/simple-navigation-demo.test.ts',
      'tests/page-navigation/utils/assertions.ts',
      'tests/page-navigation/utils/browser-fixtures.ts',
      'tests/page-navigation/utils/index.ts',
      'tests/page-navigation/fixtures/index.ts'
    ];

    let existingFiles = 0;
    let missingRequired = [];
    let existingOptional = [];

    for (const file of requiredFiles) {
      try {
        await fs.access(file);
        existingFiles++;
        console.log(`  ✅ ${file}`);
      } catch (error) {
        missingRequired.push(file);
        console.log(`  ❌ ${file} (REQUIRED)`);
        this.validationResults.structureCheck.issues.push(`Missing required file: ${file}`);
      }
    }

    for (const file of optionalFiles) {
      try {
        await fs.access(file);
        existingOptional.push(file);
        console.log(`  ✅ ${file} (optional)`);
      } catch (error) {
        console.log(`  ⚠️  ${file} (optional - missing)`);
      }
    }

    this.validationResults.structureCheck.passed = missingRequired.length === 0;
    console.log(`\n📊 File Structure: ${existingFiles}/${requiredFiles.length} required files present, ${existingOptional.length} optional files present\n`);
  }

  async validateSyntax() {
    console.log('🔧 Validating TypeScript syntax...');

    const tsFiles = [
      'tests/page-navigation/vitest.config.ts',
      'tests/page-navigation/setup.ts',
      'tests/page-navigation/utils/navigation-helpers.ts',
      'tests/page-navigation/fixtures/navigation-scenarios.ts',
      'tests/page-navigation/infrastructure-verification.test.ts',
      'tests/page-navigation/navigation.integration.test.ts'
    ];

    let syntaxValid = 0;

    for (const file of tsFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');

        // Basic syntax checks
        const issues = this.checkBasicSyntax(content, file);

        if (issues.length === 0) {
          syntaxValid++;
          console.log(`  ✅ ${file}`);
        } else {
          console.log(`  ❌ ${file}:`);
          issues.forEach(issue => {
            console.log(`     • ${issue}`);
            this.validationResults.syntaxCheck.issues.push(`${file}: ${issue}`);
          });
        }
      } catch (error) {
        console.log(`  ❌ ${file}: Cannot read file`);
        this.validationResults.syntaxCheck.issues.push(`${file}: Cannot read file - ${error.message}`);
      }
    }

    this.validationResults.syntaxCheck.passed = syntaxValid === tsFiles.length;
    console.log(`\n📊 Syntax Check: ${syntaxValid}/${tsFiles.length} files passed\n`);
  }

  checkBasicSyntax(content, filename) {
    const issues = [];

    // Check for basic TypeScript issues
    if (!content.trim()) {
      issues.push('File is empty');
      return issues;
    }

    // Check for unclosed brackets
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push(`Mismatched braces: ${openBrackets} opening, ${closeBrackets} closing`);
    }

    // Check for unclosed parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Mismatched parentheses: ${openParens} opening, ${closeParens} closing`);
    }

    // Check for imports/exports
    if (filename.includes('.test.ts')) {
      if (!content.includes('describe') && !content.includes('it(')) {
        issues.push('Test file should contain describe or it blocks');
      }
      if (!content.includes('vitest') && !content.includes('@vitest')) {
        issues.push('Test file should import from vitest');
      }
    }

    return issues;
  }

  async validateConfiguration() {
    console.log('⚙️  Validating configuration files...');

    // Check Vitest config
    try {
      const vitestConfig = await fs.readFile('tests/page-navigation/vitest.config.ts', 'utf8');
      console.log('  ✅ vitest.config.ts exists');

      if (vitestConfig.includes('defineConfig')) {
        console.log('    ✅ Contains defineConfig');
      } else {
        this.validationResults.configValidation.issues.push('vitest.config.ts missing defineConfig');
      }

      if (vitestConfig.includes('environment') && vitestConfig.includes('node')) {
        console.log('    ✅ Uses node environment');
      } else {
        this.validationResults.configValidation.issues.push('vitest.config.ts should use node environment');
      }

    } catch (error) {
      console.log('  ❌ vitest.config.ts missing or unreadable');
      this.validationResults.configValidation.issues.push('vitest.config.ts missing');
    }

    // Check setup file
    try {
      const setupFile = await fs.readFile('tests/page-navigation/setup.ts', 'utf8');
      console.log('  ✅ setup.ts exists');

      if (setupFile.includes('beforeAll') && setupFile.includes('afterAll')) {
        console.log('    ✅ Contains beforeAll/afterAll hooks');
      } else {
        this.validationResults.configValidation.issues.push('setup.ts missing global hooks');
      }

      if (setupFile.includes('playwright')) {
        console.log('    ✅ Integrates with Playwright');
      } else {
        this.validationResults.configValidation.issues.push('setup.ts should integrate with Playwright');
      }

    } catch (error) {
      console.log('  ❌ setup.ts missing or unreadable');
      this.validationResults.configValidation.issues.push('setup.ts missing');
    }

    // Check package.json for scripts
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const scripts = packageJson.scripts || {};

      const navigationScripts = Object.keys(scripts).filter(script =>
        script.includes('page-navigation')
      );

      if (navigationScripts.length > 0) {
        console.log(`  ✅ package.json has ${navigationScripts.length} page-navigation scripts:`);
        navigationScripts.forEach(script => {
          console.log(`    • ${script}: ${scripts[script]}`);
        });
      } else {
        console.log('  ⚠️  No page-navigation scripts found in package.json');
        this.validationResults.configValidation.issues.push('No page-navigation scripts in package.json');
      }

    } catch (error) {
      console.log('  ❌ package.json missing or unreadable');
      this.validationResults.configValidation.issues.push('package.json missing');
    }

    this.validationResults.configValidation.passed = this.validationResults.configValidation.issues.length === 0;
    console.log('');
  }

  async checkDependencies() {
    console.log('📦 Checking dependencies...');

    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const requiredDeps = [
        'vitest',
        'playwright',
        '@vitest/coverage-v8'
      ];

      const optionalDeps = [
        'typescript',
        '@types/node'
      ];

      let foundRequired = 0;
      let foundOptional = 0;

      for (const dep of requiredDeps) {
        if (allDeps[dep]) {
          console.log(`  ✅ ${dep}@${allDeps[dep]}`);
          foundRequired++;
        } else {
          console.log(`  ❌ ${dep} (REQUIRED)`);
          this.validationResults.dependencyCheck.issues.push(`Missing required dependency: ${dep}`);
        }
      }

      for (const dep of optionalDeps) {
        if (allDeps[dep]) {
          console.log(`  ✅ ${dep}@${allDeps[dep]} (optional)`);
          foundOptional++;
        } else {
          console.log(`  ⚠️  ${dep} (optional - missing)`);
        }
      }

      this.validationResults.dependencyCheck.passed = foundRequired === requiredDeps.length;
      console.log(`\n📊 Dependencies: ${foundRequired}/${requiredDeps.length} required, ${foundOptional}/${optionalDeps.length} optional\n`);

    } catch (error) {
      console.log('  ❌ Cannot read package.json');
      this.validationResults.dependencyCheck.issues.push('Cannot read package.json');
    }
  }

  async analyzeTestStructure() {
    console.log('🧪 Analyzing test structure...');

    const testFiles = [
      'tests/page-navigation/infrastructure-verification.test.ts',
      'tests/page-navigation/navigation.integration.test.ts',
      'tests/page-navigation/simple-navigation-demo.test.ts'
    ];

    let totalTests = 0;
    let totalSuites = 0;

    for (const testFile of testFiles) {
      try {
        const content = await fs.readFile(testFile, 'utf8');

        const testCount = (content.match(/it\(/g) || []).length;
        const suiteCount = (content.match(/describe\(/g) || []).length;
        const beforeEachCount = (content.match(/beforeEach\(/g) || []).length;
        const afterEachCount = (content.match(/afterEach\(/g) || []).length;

        totalTests += testCount;
        totalSuites += suiteCount;

        console.log(`  ✅ ${testFile}:`);
        console.log(`    • Test cases: ${testCount}`);
        console.log(`    • Test suites: ${suiteCount}`);
        console.log(`    • Setup/teardown: ${beforeEachCount + afterEachCount} hooks`);

        if (testCount === 0) {
          this.validationResults.testStructure.issues.push(`${testFile}: No test cases found`);
        }

        if (suiteCount === 0) {
          this.validationResults.testStructure.issues.push(`${testFile}: No test suites found`);
        }

      } catch (error) {
        console.log(`  ❌ ${testFile}: Cannot analyze`);
        this.validationResults.testStructure.issues.push(`${testFile}: Cannot read file`);
      }
    }

    // Check utilities
    try {
      const helpersContent = await fs.readFile('tests/page-navigation/utils/navigation-helpers.ts', 'utf8');
      const functionCount = (helpersContent.match(/export (?:async )?function/g) || []).length;
      const classCount = (helpersContent.match(/export class/g) || []).length;

      console.log(`  ✅ navigation-helpers.ts:`);
      console.log(`    • Exported functions: ${functionCount}`);
      console.log(`    • Exported classes: ${classCount}`);

    } catch (error) {
      console.log(`  ❌ navigation-helpers.ts: Cannot analyze`);
      this.validationResults.testStructure.issues.push('navigation-helpers.ts: Cannot read file');
    }

    // Check scenarios
    try {
      const scenariosContent = await fs.readFile('tests/page-navigation/fixtures/navigation-scenarios.ts', 'utf8');
      const scenarioCount = (scenariosContent.match(/name:\s*['"][^'"]+['"]/g) || []).length;

      console.log(`  ✅ navigation-scenarios.ts:`);
      console.log(`    • Navigation scenarios: ${scenarioCount}`);

      if (scenarioCount === 0) {
        this.validationResults.testStructure.issues.push('No navigation scenarios found');
      }

    } catch (error) {
      console.log(`  ❌ navigation-scenarios.ts: Cannot analyze`);
      this.validationResults.testStructure.issues.push('navigation-scenarios.ts: Cannot read file');
    }

    this.validationResults.testStructure.passed =
      totalTests > 0 &&
      totalSuites > 0 &&
      this.validationResults.testStructure.issues.length === 0;

    console.log(`\n📊 Test Structure: ${totalTests} tests in ${totalSuites} suites\n`);
  }

  calculateOverallScore() {
    const checks = [
      this.validationResults.structureCheck,
      this.validationResults.syntaxCheck,
      this.validationResults.configValidation,
      this.validationResults.dependencyCheck,
      this.validationResults.testStructure
    ];

    const passedChecks = checks.filter(check => check.passed).length;
    const score = Math.round((passedChecks / checks.length) * 100);

    this.validationResults.overall.score = score;
    this.validationResults.overall.passed = score >= 80;
  }

  generateReport() {
    console.log('📋 VALIDATION REPORT');
    console.log('='.repeat(50));

    const checks = [
      { name: 'File Structure', result: this.validationResults.structureCheck },
      { name: 'Syntax Check', result: this.validationResults.syntaxCheck },
      { name: 'Configuration', result: this.validationResults.configValidation },
      { name: 'Dependencies', result: this.validationResults.dependencyCheck },
      { name: 'Test Structure', result: this.validationResults.testStructure }
    ];

    checks.forEach(check => {
      const status = check.result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`\n${check.name}: ${status}`);

      if (check.result.issues.length > 0) {
        console.log('  Issues:');
        check.result.issues.forEach(issue => {
          console.log(`    • ${issue}`);
        });
      }
    });

    console.log(`\n📊 OVERALL SCORE: ${this.validationResults.overall.score}%`);

    let status = 'EXCELLENT';
    if (this.validationResults.overall.score < 90) status = 'GOOD';
    if (this.validationResults.overall.score < 75) status = 'FAIR';
    if (this.validationResults.overall.score < 60) status = 'POOR';

    console.log(`🎯 STATUS: ${status}`);

    if (this.validationResults.overall.passed) {
      console.log('✅ Page navigation test infrastructure is ready for testing!');
    } else {
      console.log('⚠️  Page navigation test infrastructure has issues that should be addressed');
    }

    console.log('\n' + '='.repeat(50));
  }
}

async function main() {
  const validator = new PageNavigationTestValidator();

  try {
    await validator.validateInfrastructure();
    validator.generateReport();

    // Return exit code based on validation result
    return validator.validationResults.overall.passed ? 0 : 1;

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    return 1;
  }
}

if (require.main === module) {
  main().then(code => process.exit(code));
}

module.exports = { PageNavigationTestValidator };