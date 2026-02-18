#!/usr/bin/env node

/**
 * Manual validation script for integration test setup
 * This script checks all aspects of the Vitest integration configuration
 */

const fs = require('fs').promises;
const path = require('path');

class IntegrationValidator {
  constructor() {
    this.results = [];
    this.rootDir = process.cwd();
  }

  log(success, message, details) {
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${message}`);
    if (details && !success) {
      console.log(`   ${details}`);
    }
    this.results.push({ success, message, details });
  }

  async checkFile(filePath, description) {
    try {
      await fs.access(filePath);
      this.log(true, `${description}: exists`);
      return true;
    } catch {
      this.log(false, `${description}: missing`, `Path: ${filePath}`);
      return false;
    }
  }

  async checkDirectory(dirPath, description) {
    try {
      const stats = await fs.stat(dirPath);
      if (stats.isDirectory()) {
        this.log(true, `${description}: exists`);
        return true;
      } else {
        this.log(false, `${description}: exists but not a directory`);
        return false;
      }
    } catch {
      this.log(false, `${description}: missing`, `Path: ${dirPath}`);
      return false;
    }
  }

  async validateFiles() {
    console.log('\n📁 Checking required files...\n');

    await this.checkFile(
      path.join(this.rootDir, 'vitest.integration.config.ts'),
      'Integration config file'
    );

    await this.checkFile(
      path.join(this.rootDir, 'vitest.shared.config.ts'),
      'Shared config file'
    );

    await this.checkDirectory(
      path.join(this.rootDir, 'tests', 'integration'),
      'Integration test directory'
    );

    await this.checkFile(
      path.join(this.rootDir, 'tests', 'integration', 'setup.ts'),
      'Integration test setup file'
    );

    await this.checkFile(
      path.join(this.rootDir, 'tests', 'integration', 'vitest-integration-config-validation.test.ts'),
      'Config validation test file'
    );
  }

  async validatePackageJson() {
    console.log('\n📦 Checking package.json configuration...\n');

    try {
      const pkgContent = await fs.readFile(path.join(this.rootDir, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgContent);

      // Check scripts
      const requiredScripts = [
        'test:integration',
        'test:integration:watch',
        'test:integration:coverage'
      ];

      const missingScripts = [];
      for (const script of requiredScripts) {
        if (pkg.scripts && pkg.scripts[script]) {
          this.log(true, `NPM script '${script}': configured`);
        } else {
          this.log(false, `NPM script '${script}': missing`);
          missingScripts.push(script);
        }
      }

      // Check Vitest dependency
      const hasVitest = (pkg.devDependencies && pkg.devDependencies.vitest) ||
                       (pkg.dependencies && pkg.dependencies.vitest);
      this.log(hasVitest, hasVitest ? 'Vitest dependency: found' : 'Vitest dependency: missing');

      // Check workspace configuration
      if (pkg.workspaces) {
        this.log(true, `Workspaces: configured (${pkg.workspaces.length} workspaces)`);
      } else {
        this.log(false, 'Workspaces: not configured');
      }

    } catch (error) {
      this.log(false, 'Package.json: failed to read or parse', error.message);
    }
  }

  async validateConfigFiles() {
    console.log('\n⚙️  Checking configuration file contents...\n');

    try {
      // Check shared config
      const sharedConfigPath = path.join(this.rootDir, 'vitest.shared.config.ts');
      const sharedContent = await fs.readFile(sharedConfigPath, 'utf8');

      if (sharedContent.includes('createIntegrationTestConfig')) {
        this.log(true, 'Shared config: exports integration test function');
      } else {
        this.log(false, 'Shared config: missing createIntegrationTestConfig export');
      }

      // Check integration config
      const integrationConfigPath = path.join(this.rootDir, 'vitest.integration.config.ts');
      const integrationContent = await fs.readFile(integrationConfigPath, 'utf8');

      const checks = [
        { pattern: /testTimeout.*30000/, name: 'extended test timeout (30s)' },
        { pattern: /environment.*node/, name: 'Node.js environment' },
        { pattern: /tests\/integration/, name: 'integration test file patterns' },
        { pattern: /pool.*forks/, name: 'forks pool for test isolation' },
        { pattern: /setupFiles/, name: 'setup files configuration' },
        { pattern: /coverage/, name: 'coverage configuration' }
      ];

      for (const check of checks) {
        if (check.pattern.test(integrationContent)) {
          this.log(true, `Integration config: ${check.name}`);
        } else {
          this.log(false, `Integration config: missing ${check.name}`);
        }
      }

    } catch (error) {
      this.log(false, 'Configuration files: failed to validate', error.message);
    }
  }

  async validateTestFiles() {
    console.log('\n🧪 Checking test files...\n');

    try {
      const testDir = path.join(this.rootDir, 'tests', 'integration');
      const files = await fs.readdir(testDir);

      // Count test files
      const testFiles = files.filter(file =>
        file.endsWith('.test.ts') || file.endsWith('.integration.test.ts')
      );

      this.log(
        testFiles.length > 0,
        `Integration test files: found ${testFiles.length} files`
      );

      // Check for specific important tests
      const importantTests = [
        'vitest-integration-config-validation.test.ts',
        'simple-test-validation.test.ts',
        'error-display-flow.integration.test.ts'
      ];

      for (const testFile of importantTests) {
        if (files.includes(testFile)) {
          this.log(true, `Important test: ${testFile} exists`);
        } else {
          this.log(false, `Important test: ${testFile} missing`);
        }
      }

      // Check setup file content
      const setupPath = path.join(testDir, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf8');

      if (setupContent.includes('apexTestHelpers')) {
        this.log(true, 'Setup file: provides global test helpers');
      } else {
        this.log(false, 'Setup file: missing global test helpers');
      }

      if (setupContent.includes('cleanupAll')) {
        this.log(true, 'Setup file: includes cleanup utilities');
      } else {
        this.log(false, 'Setup file: missing cleanup utilities');
      }

    } catch (error) {
      this.log(false, 'Test files: failed to validate', error.message);
    }
  }

  async validatePackages() {
    console.log('\n📁 Checking package structure...\n');

    try {
      const packagesDir = path.join(this.rootDir, 'packages');
      const packages = await fs.readdir(packagesDir);

      const expectedPackages = ['core', 'orchestrator', 'cli', 'api'];

      for (const pkg of expectedPackages) {
        if (packages.includes(pkg)) {
          this.log(true, `Package: ${pkg} exists`);
        } else {
          this.log(false, `Package: ${pkg} missing`);
        }
      }

    } catch (error) {
      this.log(false, 'Package structure: failed to validate', error.message);
    }
  }

  async run() {
    console.log('🔍 APEX Integration Test Setup Validation\n');
    console.log('=' .repeat(50));

    await this.validateFiles();
    await this.validatePackageJson();
    await this.validateConfigFiles();
    await this.validateTestFiles();
    await this.validatePackages();

    // Summary
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;

    console.log('\n📊 Summary');
    console.log('=' .repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${total - passed}`);
    console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%\n`);

    if (passed === total) {
      console.log('🎉 All checks passed! Integration test setup is ready.');
      console.log('\n💡 Next steps:');
      console.log('   npm run test:integration           # Run all integration tests');
      console.log('   npm run test:integration:coverage  # Run with coverage report');
    } else {
      console.log('⚠️  Some checks failed. Please review the issues above.');
    }

    return passed === total;
  }
}

// Run the validation
if (require.main === module) {
  const validator = new IntegrationValidator();
  validator.run().catch(error => {
    console.error('\n💥 Validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = IntegrationValidator;