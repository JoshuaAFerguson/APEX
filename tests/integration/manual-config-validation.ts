/**
 * @fileoverview Manual validation script for integration test configuration
 *
 * This script manually validates the Vitest integration configuration by:
 * 1. Checking file existence
 * 2. Validating configuration structure
 * 3. Testing import paths
 * 4. Verifying test patterns
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface ValidationResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
}

class ConfigurationValidator {
  private results: ValidationResult[] = [];

  private addResult(step: string, success: boolean, message: string, details?: any) {
    this.results.push({ step, success, message, details });
  }

  async validateFileExists(filePath: string, description: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      this.addResult('file-check', true, `${description}: exists`);
      return true;
    } catch {
      this.addResult('file-check', false, `${description}: missing`, { path: filePath });
      return false;
    }
  }

  async validateDirectoryStructure(): Promise<void> {
    const rootDir = process.cwd();

    // Check main configuration files
    await this.validateFileExists(
      path.join(rootDir, 'vitest.integration.config.ts'),
      'Integration config file'
    );

    await this.validateFileExists(
      path.join(rootDir, 'vitest.shared.config.ts'),
      'Shared config file'
    );

    await this.validateFileExists(
      path.join(rootDir, 'package.json'),
      'Package.json'
    );

    // Check test directories
    await this.validateFileExists(
      path.join(rootDir, 'tests', 'integration'),
      'Integration test directory'
    );

    await this.validateFileExists(
      path.join(rootDir, 'tests', 'integration', 'setup.ts'),
      'Integration test setup file'
    );
  }

  async validatePackageJson(): Promise<void> {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const content = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(content);

      // Check for required scripts
      const requiredScripts = [
        'test:integration',
        'test:integration:watch',
        'test:integration:coverage'
      ];

      let allScriptsPresent = true;
      const missingScripts: string[] = [];

      for (const script of requiredScripts) {
        if (!pkg.scripts || !pkg.scripts[script]) {
          allScriptsPresent = false;
          missingScripts.push(script);
        }
      }

      if (allScriptsPresent) {
        this.addResult(
          'package-scripts',
          true,
          'All required npm scripts present',
          { scripts: requiredScripts }
        );
      } else {
        this.addResult(
          'package-scripts',
          false,
          'Missing required npm scripts',
          { missing: missingScripts }
        );
      }

      // Check for Vitest dependency
      const hasVitest = (pkg.devDependencies && pkg.devDependencies.vitest) ||
                       (pkg.dependencies && pkg.dependencies.vitest);

      this.addResult(
        'vitest-dependency',
        !!hasVitest,
        hasVitest ? 'Vitest dependency found' : 'Vitest dependency missing'
      );

      // Check workspaces configuration
      if (pkg.workspaces) {
        this.addResult(
          'workspaces',
          true,
          'Workspaces configured',
          { workspaces: pkg.workspaces }
        );
      } else {
        this.addResult(
          'workspaces',
          false,
          'Workspaces not configured'
        );
      }

    } catch (error) {
      this.addResult(
        'package-json',
        false,
        'Failed to parse package.json',
        { error: error.message }
      );
    }
  }

  async validateConfigurationFiles(): Promise<void> {
    try {
      // Try to import the configuration files
      const sharedConfigPath = path.join(process.cwd(), 'vitest.shared.config.ts');
      const integrationConfigPath = path.join(process.cwd(), 'vitest.integration.config.ts');

      // Check shared config content
      const sharedContent = await fs.readFile(sharedConfigPath, 'utf8');
      if (sharedContent.includes('createIntegrationTestConfig')) {
        this.addResult(
          'shared-config',
          true,
          'Shared config exports createIntegrationTestConfig function'
        );
      } else {
        this.addResult(
          'shared-config',
          false,
          'Shared config missing required exports'
        );
      }

      // Check integration config content
      const integrationContent = await fs.readFile(integrationConfigPath, 'utf8');
      const checks = [
        { pattern: /createIntegrationTestConfig/, name: 'uses shared config function' },
        { pattern: /testTimeout.*30000/, name: 'has extended test timeout' },
        { pattern: /environment.*node/, name: 'uses Node environment' },
        { pattern: /tests\/integration/, name: 'includes integration test patterns' },
        { pattern: /pool.*forks/, name: 'uses forks pool for isolation' }
      ];

      for (const check of checks) {
        if (check.pattern.test(integrationContent)) {
          this.addResult(
            'integration-config',
            true,
            `Integration config ${check.name}`
          );
        } else {
          this.addResult(
            'integration-config',
            false,
            `Integration config missing: ${check.name}`
          );
        }
      }

    } catch (error) {
      this.addResult(
        'config-validation',
        false,
        'Failed to validate configuration files',
        { error: error.message }
      );
    }
  }

  async validateTestFiles(): Promise<void> {
    try {
      const testDir = path.join(process.cwd(), 'tests', 'integration');
      const files = await fs.readdir(testDir);

      // Count test files
      const testFiles = files.filter(file =>
        file.endsWith('.test.ts') || file.endsWith('.integration.test.ts')
      );

      this.addResult(
        'test-files',
        testFiles.length > 0,
        `Found ${testFiles.length} integration test files`,
        { count: testFiles.length }
      );

      // Check for specific validation test
      const hasValidationTest = testFiles.some(file =>
        file.includes('vitest-integration-config-validation')
      );

      this.addResult(
        'validation-test',
        hasValidationTest,
        hasValidationTest
          ? 'Configuration validation test exists'
          : 'Configuration validation test missing'
      );

      // Check for setup file content
      const setupPath = path.join(testDir, 'setup.ts');
      const setupContent = await fs.readFile(setupPath, 'utf8');

      if (setupContent.includes('apexTestHelpers')) {
        this.addResult(
          'setup-helpers',
          true,
          'Test setup provides global helpers'
        );
      } else {
        this.addResult(
          'setup-helpers',
          false,
          'Test setup missing global helpers'
        );
      }

    } catch (error) {
      this.addResult(
        'test-files',
        false,
        'Failed to validate test files',
        { error: error.message }
      );
    }
  }

  async validatePackageStructure(): Promise<void> {
    try {
      const packagesDir = path.join(process.cwd(), 'packages');
      const packages = await fs.readdir(packagesDir);

      const expectedPackages = ['core', 'orchestrator', 'cli', 'api'];
      const missingPackages = expectedPackages.filter(pkg => !packages.includes(pkg));

      if (missingPackages.length === 0) {
        this.addResult(
          'package-structure',
          true,
          'All expected packages present',
          { packages }
        );
      } else {
        this.addResult(
          'package-structure',
          false,
          'Missing expected packages',
          { missing: missingPackages }
        );
      }

    } catch (error) {
      this.addResult(
        'package-structure',
        false,
        'Failed to validate package structure',
        { error: error.message }
      );
    }
  }

  async runValidation(): Promise<ValidationResult[]> {
    console.log('🔍 Starting Vitest Integration Configuration Validation\n');

    await this.validateDirectoryStructure();
    await this.validatePackageJson();
    await this.validateConfigurationFiles();
    await this.validateTestFiles();
    await this.validatePackageStructure();

    return this.results;
  }

  printResults(): void {
    let successCount = 0;
    let totalCount = this.results.length;

    console.log('📊 Validation Results:\n');

    for (const result of this.results) {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.message}`);

      if (result.details && !result.success) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }

      if (result.success) successCount++;
    }

    console.log(`\n📈 Summary: ${successCount}/${totalCount} checks passed\n`);

    if (successCount === totalCount) {
      console.log('🎉 All validation checks passed! Integration test setup is ready.\n');
    } else {
      console.log('⚠️  Some validation checks failed. Review the issues above.\n');
    }
  }
}

// Export for use in tests
export { ConfigurationValidator, ValidationResult };

// Run validation if executed directly
if (require.main === module) {
  const validator = new ConfigurationValidator();
  validator.runValidation()
    .then(() => {
      validator.printResults();
    })
    .catch((error) => {
      console.error('❌ Validation failed with error:', error);
      process.exit(1);
    });
}