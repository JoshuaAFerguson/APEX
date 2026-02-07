#!/usr/bin/env node

/**
 * Simple Documentation Validation Test
 *
 * Tests documentation without external dependencies
 */

const fs = require('fs');
const path = require('path');

class SimpleDocTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
  }

  log(level, message, details = '') {
    const prefix = level === 'PASS' ? '✅' : level === 'FAIL' ? '❌' : '⚠️';
    console.log(`${prefix} ${level}: ${message}`);
    if (details) console.log(`   Details: ${details}`);

    if (level === 'PASS') this.passed++;
    else if (level === 'FAIL') this.failed++;
    else if (level === 'WARN') this.warnings++;
  }

  checkFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.log('PASS', `${description} exists`);
      return true;
    } else {
      this.log('FAIL', `${description} not found`, filePath);
      return false;
    }
  }

  checkContentIncludes(filePath, searchText, description) {
    if (!fs.existsSync(filePath)) {
      this.log('FAIL', `Cannot check content - file not found`, filePath);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(searchText)) {
      this.log('PASS', description);
      return true;
    } else {
      this.log('FAIL', description);
      return false;
    }
  }

  async testDocumentationFiles() {
    console.log('🔍 Testing documentation files existence...\n');

    // Test core documentation files exist
    this.checkFileExists(path.join(__dirname, 'README.md'), 'Main README.md');
    this.checkFileExists(path.join(__dirname, 'docs', 'v050-features.md'), 'v0.5.0 Features documentation');
    this.checkFileExists(path.join(__dirname, 'docs', 'browser-automation.md'), 'Browser automation documentation');
    this.checkFileExists(path.join(__dirname, 'docs', 'permission-system.md'), 'Permission system documentation');
    this.checkFileExists(path.join(__dirname, 'docs', 'tool-system.md'), 'Tool system documentation');

    // Test project structure files
    this.checkFileExists(path.join(__dirname, 'package.json'), 'Main package.json');
    this.checkFileExists(path.join(__dirname, 'tsconfig.json'), 'TypeScript configuration');
    this.checkFileExists(path.join(__dirname, 'turbo.json'), 'Turbo monorepo configuration');

    // Test packages directory structure
    const packagesDir = path.join(__dirname, 'packages');
    if (this.checkFileExists(packagesDir, 'Packages directory')) {
      const expectedPackages = ['core', 'orchestrator', 'cli', 'api'];
      for (const pkg of expectedPackages) {
        this.checkFileExists(path.join(packagesDir, pkg), `Package: ${pkg}`);
      }
    }
  }

  async testReadmeContent() {
    console.log('\n🔍 Testing README.md content...\n');

    const readmePath = path.join(__dirname, 'README.md');

    // Test v0.5.0 feature sections
    this.checkContentIncludes(readmePath, 'v0.5.0 - Tool System & Permissions', 'README contains v0.5.0 features section');
    this.checkContentIncludes(readmePath, 'Browser Automation', 'README contains browser automation section');
    this.checkContentIncludes(readmePath, 'Permission System', 'README contains permission system section');
    this.checkContentIncludes(readmePath, 'Built-in Tools', 'README contains built-in tools section');
    this.checkContentIncludes(readmePath, 'Claude Code Parity', 'README mentions Claude Code parity');

    // Test installation commands
    this.checkContentIncludes(readmePath, 'npm install -g @apexcli/cli', 'README contains npm installation');
    this.checkContentIncludes(readmePath, 'brew install apex', 'README contains Homebrew installation');
    this.checkContentIncludes(readmePath, 'npx playwright install', 'README contains browser setup');

    // Test configuration examples
    this.checkContentIncludes(readmePath, 'permissions:', 'README contains permissions config');
    this.checkContentIncludes(readmePath, 'tools:', 'README contains tools config');
    this.checkContentIncludes(readmePath, 'autonomy:', 'README contains autonomy config');

    // Test platform support
    this.checkContentIncludes(readmePath, 'Platform Support', 'README contains platform support table');
    this.checkContentIncludes(readmePath, 'Windows', 'README mentions Windows support');
    this.checkContentIncludes(readmePath, 'macOS', 'README mentions macOS support');
    this.checkContentIncludes(readmePath, 'Linux', 'README mentions Linux support');

    // Test utility functions
    this.checkContentIncludes(readmePath, 'formatDuration', 'README documents formatDuration utility');
    this.checkContentIncludes(readmePath, 'truncateToolOutput', 'README documents truncateToolOutput utility');
    this.checkContentIncludes(readmePath, 'ConnectionHealthManager', 'README documents ConnectionHealthManager');
  }

  async testFeatureDocumentation() {
    console.log('\n🔍 Testing feature documentation...\n');

    const v050Path = path.join(__dirname, 'docs', 'v050-features.md');

    if (fs.existsSync(v050Path)) {
      // Test feature categories
      this.checkContentIncludes(v050Path, 'Browser Automation', 'v050-features documents browser automation');
      this.checkContentIncludes(v050Path, 'Permission System', 'v050-features documents permission system');
      this.checkContentIncludes(v050Path, 'Autonomy Controls', 'v050-features documents autonomy controls');
      this.checkContentIncludes(v050Path, 'Code Quality Integration', 'v050-features documents code quality');
      this.checkContentIncludes(v050Path, 'MCP', 'v050-features mentions MCP integration');

      // Test migration guide
      this.checkContentIncludes(v050Path, 'Migration from v0.4.0', 'v050-features includes migration guide');
      this.checkContentIncludes(v050Path, 'Breaking Changes', 'v050-features documents breaking changes');

      // Test examples
      this.checkContentIncludes(v050Path, 'Examples', 'v050-features includes examples');
      this.checkContentIncludes(v050Path, 'Best Practices', 'v050-features includes best practices');
      this.checkContentIncludes(v050Path, 'Troubleshooting', 'v050-features includes troubleshooting');
    }

    // Test browser automation docs
    const browserPath = path.join(__dirname, 'docs', 'browser-automation.md');
    if (fs.existsSync(browserPath)) {
      this.checkContentIncludes(browserPath, 'Playwright', 'Browser docs mention Playwright');
      this.checkContentIncludes(browserPath, 'chromium', 'Browser docs mention Chromium');
      this.checkContentIncludes(browserPath, 'allowedDomains', 'Browser docs include security controls');
      this.checkContentIncludes(browserPath, 'screenshot', 'Browser docs mention screenshot capability');
    }

    // Test permission system docs
    const permissionPath = path.join(__dirname, 'docs', 'permission-system.md');
    if (fs.existsSync(permissionPath)) {
      this.checkContentIncludes(permissionPath, 'allow-always', 'Permission docs explain allow-always');
      this.checkContentIncludes(permissionPath, 'allow-once', 'Permission docs explain allow-once');
      this.checkContentIncludes(permissionPath, 'deny', 'Permission docs explain deny');
      this.checkContentIncludes(permissionPath, 'autonomous', 'Permission docs mention autonomous preset');
      this.checkContentIncludes(permissionPath, 'reviewAll', 'Permission docs mention reviewAll preset');
      this.checkContentIncludes(permissionPath, 'readOnly', 'Permission docs mention readOnly preset');
    }

    // Test tool system docs
    const toolPath = path.join(__dirname, 'docs', 'tool-system.md');
    if (fs.existsSync(toolPath)) {
      this.checkContentIncludes(toolPath, 'Claude Code Parity', 'Tool docs claim Claude Code parity');
      this.checkContentIncludes(toolPath, 'Read Tool', 'Tool docs document Read tool');
      this.checkContentIncludes(toolPath, 'Write Tool', 'Tool docs document Write tool');
      this.checkContentIncludes(toolPath, 'Edit Tool', 'Tool docs document Edit tool');
      this.checkContentIncludes(toolPath, 'Bash', 'Tool docs document Bash tool');
      this.checkContentIncludes(toolPath, 'Glob', 'Tool docs document Glob tool');
      this.checkContentIncludes(toolPath, 'Grep', 'Tool docs document Grep tool');
    }
  }

  async testPackageConfiguration() {
    console.log('\n🔍 Testing package configuration...\n');

    const packagePath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

        // Test required scripts
        const requiredScripts = ['build', 'dev', 'test', 'lint', 'typecheck'];
        for (const script of requiredScripts) {
          if (packageJson.scripts && packageJson.scripts[script]) {
            this.log('PASS', `Package has required script: ${script}`);
          } else {
            this.log('FAIL', `Package missing script: ${script}`);
          }
        }

        // Test workspaces
        if (packageJson.workspaces) {
          this.log('PASS', 'Package configured for workspaces');
        } else {
          this.log('WARN', 'Package not configured for workspaces');
        }

        // Test dependencies
        const deps = Object.keys(packageJson.dependencies || {});
        const devDeps = Object.keys(packageJson.devDependencies || {});

        this.log('PASS', `Package has ${deps.length} dependencies`);
        this.log('PASS', `Package has ${devDeps.length} dev dependencies`);

      } catch (error) {
        this.log('FAIL', 'Package.json is invalid JSON', error.message);
      }
    }

    // Test TypeScript config
    const tsconfigPath = path.join(__dirname, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));

        if (tsconfig.compilerOptions) {
          this.log('PASS', 'TypeScript compiler options configured');

          if (tsconfig.compilerOptions.target) {
            this.log('PASS', `TypeScript target: ${tsconfig.compilerOptions.target}`);
          }

          if (tsconfig.compilerOptions.module) {
            this.log('PASS', `TypeScript module: ${tsconfig.compilerOptions.module}`);
          }
        }

      } catch (error) {
        this.log('FAIL', 'tsconfig.json is invalid JSON', error.message);
      }
    }
  }

  async testCodeExamples() {
    console.log('\n🔍 Testing code examples in documentation...\n');

    // Test README code examples
    const readmePath = path.join(__dirname, 'README.md');
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');

      // Count code blocks
      const bashBlocks = (content.match(/```bash\n/g) || []).length;
      const yamlBlocks = (content.match(/```yaml\n/g) || []).length;
      const jsBlocks = (content.match(/```(javascript|typescript)\n/g) || []).length;

      this.log('PASS', `README contains ${bashBlocks} bash code examples`);
      this.log('PASS', `README contains ${yamlBlocks} YAML code examples`);
      this.log('PASS', `README contains ${jsBlocks} JS/TS code examples`);

      if (bashBlocks + yamlBlocks + jsBlocks >= 10) {
        this.log('PASS', 'README has sufficient code examples');
      } else {
        this.log('WARN', 'README could use more code examples');
      }
    }

    // Test specific command examples
    this.checkContentIncludes(readmePath, 'apex init', 'README shows apex init command');
    this.checkContentIncludes(readmePath, 'apex run', 'README shows apex run command');
    this.checkContentIncludes(readmePath, 'apex serve', 'README shows apex serve command');
    this.checkContentIncludes(readmePath, 'ANTHROPIC_API_KEY', 'README shows API key setup');
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 DOCUMENTATION VALIDATION SUMMARY');
    console.log('='.repeat(60));

    console.log(`\n📊 RESULTS:`);
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   ⚠️  Warnings: ${this.warnings}`);

    const total = this.passed + this.failed;
    const successRate = total > 0 ? Math.round((this.passed / total) * 100) : 0;
    console.log(`   📈 Success Rate: ${successRate}%`);

    if (successRate >= 90) {
      console.log(`\n🎉 EXCELLENT: Documentation is comprehensive and well-structured!`);
    } else if (successRate >= 80) {
      console.log(`\n👍 GOOD: Documentation is solid with minor improvements needed.`);
    } else if (successRate >= 70) {
      console.log(`\n⚠️  NEEDS WORK: Documentation has significant gaps to address.`);
    } else {
      console.log(`\n❌ POOR: Documentation needs major improvements.`);
    }

    console.log('\n' + '='.repeat(60));

    return { passed: this.passed, failed: this.failed, warnings: this.warnings, successRate };
  }

  async runTests() {
    console.log('🚀 Starting Simple Documentation Validation\n');

    await this.testDocumentationFiles();
    await this.testReadmeContent();
    await this.testFeatureDocumentation();
    await this.testPackageConfiguration();
    await this.testCodeExamples();

    return this.generateReport();
  }
}

// Run tests
const tester = new SimpleDocTester();
tester.runTests().then(result => {
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});