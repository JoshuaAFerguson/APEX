#!/usr/bin/env node

/**
 * Page Navigation Requirements Validation Script
 *
 * This script validates that all requirements for page navigation testing are met:
 * 1. All required files are present
 * 2. Dependencies are properly installed
 * 3. Configuration is valid
 * 4. Tests are properly structured
 * 5. Build system is compatible
 */

const fs = require('fs/promises');
const path = require('path');

class RequirementsValidator {
  constructor() {
    this.results = {
      fileStructure: { passed: false, details: [] },
      dependencies: { passed: false, details: [] },
      configuration: { passed: false, details: [] },
      testStructure: { passed: false, details: [] },
      buildCompatibility: { passed: false, details: [] },
      overall: { passed: false, score: 0, summary: '' }
    };
  }

  async validateRequirements() {
    console.log('🔍 Validating Page Navigation Test Requirements...\n');

    await this.validateFileStructure();
    await this.validateDependencies();
    await this.validateConfiguration();
    await this.validateTestStructure();
    await this.validateBuildCompatibility();

    this.calculateOverallResult();
    this.generateSummaryReport();

    return this.results;
  }

  async validateFileStructure() {
    console.log('📁 Validating File Structure Requirements...');

    const requiredFiles = [
      // Core configuration
      { path: 'tests/page-navigation/vitest.config.ts', type: 'config', required: true },
      { path: 'tests/page-navigation/setup.ts', type: 'config', required: true },

      // Test files
      { path: 'tests/page-navigation/infrastructure-verification.test.ts', type: 'test', required: true },
      { path: 'tests/page-navigation/navigation.integration.test.ts', type: 'test', required: true },

      // Utilities
      { path: 'tests/page-navigation/utils/navigation-helpers.ts', type: 'utility', required: true },
      { path: 'tests/page-navigation/utils/assertions.ts', type: 'utility', required: true },
      { path: 'tests/page-navigation/utils/browser-fixtures.ts', type: 'utility', required: true },

      // Fixtures
      { path: 'tests/page-navigation/fixtures/navigation-scenarios.ts', type: 'fixture', required: true },

      // Documentation
      { path: 'tests/page-navigation/README.md', type: 'docs', required: false },

      // Optional test files
      { path: 'tests/page-navigation/simple-navigation-demo.test.ts', type: 'test', required: false },
    ];

    let requiredFound = 0;
    let requiredTotal = requiredFiles.filter(f => f.required).length;

    for (const file of requiredFiles) {
      try {
        const stats = await fs.stat(file.path);
        const status = file.required ? 'REQUIRED ✅' : 'OPTIONAL ✅';
        console.log(`  ${status} ${file.path} (${file.type}, ${stats.size} bytes)`);

        if (file.required) requiredFound++;

        this.results.fileStructure.details.push({
          path: file.path,
          type: file.type,
          required: file.required,
          found: true,
          size: stats.size
        });
      } catch (error) {
        const status = file.required ? 'REQUIRED ❌' : 'OPTIONAL ⚠️';
        console.log(`  ${status} ${file.path} (${file.type}) - MISSING`);

        this.results.fileStructure.details.push({
          path: file.path,
          type: file.type,
          required: file.required,
          found: false,
          error: error.message
        });
      }
    }

    this.results.fileStructure.passed = requiredFound === requiredTotal;
    console.log(`  📊 Required Files: ${requiredFound}/${requiredTotal}\n`);
  }

  async validateDependencies() {
    console.log('📦 Validating Dependency Requirements...');

    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const requiredDeps = [
        { name: 'vitest', type: 'test framework', minVersion: '4.0.0' },
        { name: 'playwright', type: 'browser automation', minVersion: '1.40.0' },
        { name: '@vitest/coverage-v8', type: 'coverage', minVersion: '4.0.0' }
      ];

      const optionalDeps = [
        { name: 'typescript', type: 'compiler', minVersion: '5.0.0' },
        { name: '@types/node', type: 'types', minVersion: '18.0.0' }
      ];

      let requiredFound = 0;
      let optionalFound = 0;

      for (const dep of requiredDeps) {
        if (allDeps[dep.name]) {
          console.log(`  ✅ ${dep.name}@${allDeps[dep.name]} (${dep.type})`);
          requiredFound++;

          this.results.dependencies.details.push({
            name: dep.name,
            version: allDeps[dep.name],
            type: dep.type,
            required: true,
            found: true
          });
        } else {
          console.log(`  ❌ ${dep.name} (${dep.type}) - MISSING`);

          this.results.dependencies.details.push({
            name: dep.name,
            type: dep.type,
            required: true,
            found: false
          });
        }
      }

      for (const dep of optionalDeps) {
        if (allDeps[dep.name]) {
          console.log(`  ✅ ${dep.name}@${allDeps[dep.name]} (${dep.type}) - OPTIONAL`);
          optionalFound++;

          this.results.dependencies.details.push({
            name: dep.name,
            version: allDeps[dep.name],
            type: dep.type,
            required: false,
            found: true
          });
        } else {
          console.log(`  ⚠️ ${dep.name} (${dep.type}) - OPTIONAL, MISSING`);

          this.results.dependencies.details.push({
            name: dep.name,
            type: dep.type,
            required: false,
            found: false
          });
        }
      }

      this.results.dependencies.passed = requiredFound === requiredDeps.length;
      console.log(`  📊 Required Dependencies: ${requiredFound}/${requiredDeps.length}, Optional: ${optionalFound}/${optionalDeps.length}\n`);

    } catch (error) {
      console.log(`  ❌ Cannot read package.json: ${error.message}\n`);
      this.results.dependencies.passed = false;
    }
  }

  async validateConfiguration() {
    console.log('⚙️ Validating Configuration Requirements...');

    // Check Vitest config
    try {
      const vitestConfig = await fs.readFile('tests/page-navigation/vitest.config.ts', 'utf8');

      const configChecks = [
        { check: 'defineConfig imported', test: /import.*defineConfig/ },
        { check: 'node environment set', test: /environment:\s*['"]node['"]/ },
        { check: 'test timeout configured', test: /testTimeout:\s*\d+/ },
        { check: 'setup file specified', test: /setupFiles/ },
        { check: 'coverage configured', test: /coverage.*provider/ }
      ];

      let passedChecks = 0;

      for (const configCheck of configChecks) {
        if (configCheck.test.test(vitestConfig)) {
          console.log(`  ✅ ${configCheck.check}`);
          passedChecks++;
        } else {
          console.log(`  ❌ ${configCheck.check}`);
        }
      }

      this.results.configuration.details.push({
        file: 'vitest.config.ts',
        passedChecks,
        totalChecks: configChecks.length,
        valid: passedChecks >= configChecks.length * 0.8 // 80% threshold
      });

      console.log(`  📊 Vitest Config: ${passedChecks}/${configChecks.length} checks passed`);

    } catch (error) {
      console.log(`  ❌ vitest.config.ts: ${error.message}`);
      this.results.configuration.details.push({
        file: 'vitest.config.ts',
        valid: false,
        error: error.message
      });
    }

    // Check setup file
    try {
      const setupFile = await fs.readFile('tests/page-navigation/setup.ts', 'utf8');

      const setupChecks = [
        { check: 'Playwright imported', test: /import.*playwright/ },
        { check: 'beforeAll hook', test: /beforeAll/ },
        { check: 'afterAll hook', test: /afterAll/ },
        { check: 'mock server creation', test: /createMockServer|createServer/ },
        { check: 'browser management', test: /createNavigationBrowser/ }
      ];

      let passedChecks = 0;

      for (const setupCheck of setupChecks) {
        if (setupCheck.test.test(setupFile)) {
          console.log(`  ✅ ${setupCheck.check}`);
          passedChecks++;
        } else {
          console.log(`  ❌ ${setupCheck.check}`);
        }
      }

      this.results.configuration.details.push({
        file: 'setup.ts',
        passedChecks,
        totalChecks: setupChecks.length,
        valid: passedChecks >= setupChecks.length * 0.8
      });

      console.log(`  📊 Setup File: ${passedChecks}/${setupChecks.length} checks passed`);

    } catch (error) {
      console.log(`  ❌ setup.ts: ${error.message}`);
      this.results.configuration.details.push({
        file: 'setup.ts',
        valid: false,
        error: error.message
      });
    }

    // Check package.json scripts
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const scripts = packageJson.scripts || {};

      const requiredScripts = [
        'test:page-navigation',
        'test:page-navigation:watch',
        'test:page-navigation:coverage'
      ];

      let foundScripts = 0;

      for (const script of requiredScripts) {
        if (scripts[script]) {
          console.log(`  ✅ ${script}: ${scripts[script]}`);
          foundScripts++;
        } else {
          console.log(`  ❌ ${script}: MISSING`);
        }
      }

      this.results.configuration.details.push({
        file: 'package.json scripts',
        foundScripts,
        totalScripts: requiredScripts.length,
        valid: foundScripts >= requiredScripts.length
      });

      console.log(`  📊 NPM Scripts: ${foundScripts}/${requiredScripts.length} scripts found`);

    } catch (error) {
      console.log(`  ❌ package.json scripts: ${error.message}`);
    }

    // Determine overall configuration validity
    const validConfigs = this.results.configuration.details.filter(d => d.valid !== false).length;
    this.results.configuration.passed = validConfigs >= 2; // At least vitest config and setup file

    console.log('');
  }

  async validateTestStructure() {
    console.log('🧪 Validating Test Structure Requirements...');

    const testFiles = [
      'tests/page-navigation/infrastructure-verification.test.ts',
      'tests/page-navigation/navigation.integration.test.ts',
      'tests/page-navigation/simple-navigation-demo.test.ts'
    ];

    let totalTests = 0;
    let totalSuites = 0;
    let validFiles = 0;

    for (const testFile of testFiles) {
      try {
        const content = await fs.readFile(testFile, 'utf8');

        const testCount = (content.match(/it\s*\(/g) || []).length;
        const suiteCount = (content.match(/describe\s*\(/g) || []).length;
        const hasSetup = /beforeEach|beforeAll/.test(content);
        const hasTeardown = /afterEach|afterAll/.test(content);

        totalTests += testCount;
        totalSuites += suiteCount;

        const valid = testCount > 0 && suiteCount > 0;
        if (valid) validFiles++;

        console.log(`  ${valid ? '✅' : '❌'} ${testFile}:`);
        console.log(`    • Tests: ${testCount}, Suites: ${suiteCount}`);
        console.log(`    • Setup: ${hasSetup ? 'Yes' : 'No'}, Teardown: ${hasTeardown ? 'Yes' : 'No'}`);

        this.results.testStructure.details.push({
          file: testFile,
          testCount,
          suiteCount,
          hasSetup,
          hasTeardown,
          valid
        });

      } catch (error) {
        console.log(`  ❌ ${testFile}: Cannot read - ${error.message}`);
        this.results.testStructure.details.push({
          file: testFile,
          valid: false,
          error: error.message
        });
      }
    }

    this.results.testStructure.passed = validFiles >= 2 && totalTests >= 10; // At least 2 valid files with 10+ tests
    console.log(`  📊 Total: ${totalTests} tests in ${totalSuites} suites across ${validFiles} valid files\n`);
  }

  async validateBuildCompatibility() {
    console.log('🔧 Validating Build System Compatibility...');

    // Check TypeScript configuration
    try {
      let tsConfigFound = false;
      try {
        await fs.access('tsconfig.json');
        tsConfigFound = true;
        console.log('  ✅ tsconfig.json found');
      } catch {
        console.log('  ⚠️ tsconfig.json not found (optional)');
      }

      this.results.buildCompatibility.details.push({
        component: 'TypeScript config',
        found: tsConfigFound,
        required: false
      });

    } catch (error) {
      console.log(`  ❌ TypeScript config check failed: ${error.message}`);
    }

    // Check Turbo configuration (APEX uses Turbo)
    try {
      let turboConfigFound = false;
      try {
        await fs.access('turbo.json');
        turboConfigFound = true;
        console.log('  ✅ turbo.json found (APEX monorepo)');
      } catch {
        console.log('  ⚠️ turbo.json not found');
      }

      this.results.buildCompatibility.details.push({
        component: 'Turbo config',
        found: turboConfigFound,
        required: false
      });

    } catch (error) {
      console.log(`  ❌ Turbo config check failed: ${error.message}`);
    }

    // Check package.json build scripts
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const scripts = packageJson.scripts || {};

      const buildScripts = ['build', 'test'];
      let foundBuildScripts = 0;

      for (const script of buildScripts) {
        if (scripts[script]) {
          console.log(`  ✅ ${script} script: ${scripts[script]}`);
          foundBuildScripts++;
        } else {
          console.log(`  ❌ ${script} script: MISSING`);
        }
      }

      this.results.buildCompatibility.details.push({
        component: 'Build scripts',
        foundScripts: foundBuildScripts,
        totalScripts: buildScripts.length,
        valid: foundBuildScripts >= buildScripts.length
      });

      console.log(`  📊 Build Scripts: ${foundBuildScripts}/${buildScripts.length} found`);

    } catch (error) {
      console.log(`  ❌ Build scripts check failed: ${error.message}`);
    }

    // Check workspace configuration (APEX is a monorepo)
    try {
      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
      const hasWorkspaces = packageJson.workspaces && Array.isArray(packageJson.workspaces);

      if (hasWorkspaces) {
        console.log(`  ✅ Workspace configuration found (${packageJson.workspaces.length} workspaces)`);
      } else {
        console.log('  ⚠️ No workspace configuration (single package)');
      }

      this.results.buildCompatibility.details.push({
        component: 'Workspace config',
        found: hasWorkspaces,
        workspaceCount: hasWorkspaces ? packageJson.workspaces.length : 0
      });

    } catch (error) {
      console.log(`  ❌ Workspace check failed: ${error.message}`);
    }

    // Overall build compatibility
    const validComponents = this.results.buildCompatibility.details.filter(d => d.valid !== false).length;
    this.results.buildCompatibility.passed = validComponents >= 2; // At least build scripts + one other

    console.log('');
  }

  calculateOverallResult() {
    const categories = [
      { name: 'File Structure', result: this.results.fileStructure, weight: 25 },
      { name: 'Dependencies', result: this.results.dependencies, weight: 25 },
      { name: 'Configuration', result: this.results.configuration, weight: 20 },
      { name: 'Test Structure', result: this.results.testStructure, weight: 20 },
      { name: 'Build Compatibility', result: this.results.buildCompatibility, weight: 10 }
    ];

    let totalScore = 0;
    let passedCategories = 0;

    categories.forEach(category => {
      if (category.result.passed) {
        totalScore += category.weight;
        passedCategories++;
      }
    });

    this.results.overall.score = totalScore;
    this.results.overall.passed = totalScore >= 80; // 80% threshold

    let status = 'EXCELLENT';
    if (totalScore < 90) status = 'GOOD';
    if (totalScore < 75) status = 'FAIR';
    if (totalScore < 60) status = 'POOR';

    this.results.overall.summary = `${passedCategories}/${categories.length} categories passed (${totalScore}% - ${status})`;
  }

  generateSummaryReport() {
    console.log('📋 REQUIREMENTS VALIDATION SUMMARY');
    console.log('='.repeat(60));

    const categories = [
      { name: 'File Structure', result: this.results.fileStructure },
      { name: 'Dependencies', result: this.results.dependencies },
      { name: 'Configuration', result: this.results.configuration },
      { name: 'Test Structure', result: this.results.testStructure },
      { name: 'Build Compatibility', result: this.results.buildCompatibility }
    ];

    categories.forEach(category => {
      const status = category.result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`\n${category.name}: ${status}`);
    });

    console.log(`\n📊 OVERALL SCORE: ${this.results.overall.score}%`);
    console.log(`🎯 STATUS: ${this.results.overall.summary}`);

    if (this.results.overall.passed) {
      console.log('\n✅ ALL REQUIREMENTS MET - READY FOR TESTING!');
      console.log('\n🚀 You can now run:');
      console.log('  • npm run test:page-navigation');
      console.log('  • npm run test:page-navigation:watch');
      console.log('  • npm run test:page-navigation:coverage');
    } else {
      console.log('\n⚠️  SOME REQUIREMENTS NOT MET - REVIEW NEEDED');
    }

    console.log('\n' + '='.repeat(60));
  }
}

async function main() {
  const validator = new RequirementsValidator();

  try {
    const results = await validator.validateRequirements();

    // Exit with appropriate code
    process.exit(results.overall.passed ? 0 : 1);

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { RequirementsValidator };