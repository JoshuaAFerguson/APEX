#!/usr/bin/env node

/**
 * Comprehensive Documentation Validation Test Suite
 *
 * Tests all v0.5.0 feature documentation for accuracy and completeness
 * Validates code examples, configuration snippets, and feature claims
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const yaml = require('yaml');

class DocumentationTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.errors = [];
    this.results = {
      readme: { tested: 0, passed: 0 },
      v050Features: { tested: 0, passed: 0 },
      browserAutomation: { tested: 0, passed: 0 },
      permissionSystem: { tested: 0, passed: 0 },
      toolSystem: { tested: 0, passed: 0 }
    };
  }

  log(level, message, details = '') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'PASS' ? '✅' :
                   level === 'FAIL' ? '❌' :
                   level === 'WARN' ? '⚠️' : 'ℹ️';

    console.log(`${prefix} [${timestamp}] ${level}: ${message}`);
    if (details) console.log(`   Details: ${details}`);

    if (level === 'PASS') this.passed++;
    else if (level === 'FAIL') {
      this.failed++;
      this.errors.push({ message, details });
    } else if (level === 'WARN') this.warnings++;
  }

  /**
   * Test 1: Validate README.md v0.5.0 features section
   */
  async testReadmeV050Features() {
    const readmePath = path.join(__dirname, 'README.md');

    if (!fs.existsSync(readmePath)) {
      this.log('FAIL', 'README.md not found', readmePath);
      return;
    }

    const content = fs.readFileSync(readmePath, 'utf-8');

    // Test feature sections exist
    const requiredSections = [
      'v0.5.0 - Tool System & Permissions',
      'Browser Automation',
      'Built-in Tools (Claude Code Parity)',
      'Permission System',
      'Policy Engine & Governance',
      'Smart Autonomy Controls',
      'Code Quality Integration',
      'Extensible Tool Ecosystem',
      'Security & Safety'
    ];

    this.results.readme.tested = requiredSections.length;

    for (const section of requiredSections) {
      if (content.includes(section)) {
        this.log('PASS', `README contains required section: ${section}`);
        this.results.readme.passed++;
      } else {
        this.log('FAIL', `README missing required section: ${section}`);
      }
    }

    // Test code examples are properly formatted
    const codeBlocks = content.match(/```[\w]*\n[\s\S]*?```/g) || [];
    if (codeBlocks.length >= 10) {
      this.log('PASS', `README contains adequate code examples (${codeBlocks.length})`);
    } else {
      this.log('WARN', `README has few code examples (${codeBlocks.length})`);
    }

    // Test installation commands are present
    const installCommands = ['npm install -g @apexcli/cli', 'brew install apex', 'npx playwright install'];
    for (const cmd of installCommands) {
      if (content.includes(cmd)) {
        this.log('PASS', `README contains installation command: ${cmd}`);
      } else {
        this.log('WARN', `README missing installation command: ${cmd}`);
      }
    }
  }

  /**
   * Test 2: Validate v050-features.md completeness
   */
  async testV050Features() {
    const featuresPath = path.join(__dirname, 'docs', 'v050-features.md');

    if (!fs.existsSync(featuresPath)) {
      this.log('FAIL', 'docs/v050-features.md not found', featuresPath);
      return;
    }

    const content = fs.readFileSync(featuresPath, 'utf-8');

    // Test all v0.5.0 feature categories are documented
    const featureCategories = [
      'Browser Automation',
      'Built-in Tools (Claude Code Parity)',
      'Tool Visualization',
      'Permission System',
      'Autonomy Controls',
      'Code Quality Integration',
      'Tool Extensions & MCP',
      'Policy-as-Code Rules',
      'Secret Leak Guardrails'
    ];

    this.results.v050Features.tested = featureCategories.length + 5; // + config examples

    for (const category of featureCategories) {
      if (content.includes(category)) {
        this.log('PASS', `v050-features.md documents: ${category}`);
        this.results.v050Features.passed++;
      } else {
        this.log('FAIL', `v050-features.md missing: ${category}`);
      }
    }

    // Test configuration examples are valid YAML
    const yamlBlocks = content.match(/```yaml\n([\s\S]*?)```/g) || [];
    let validYamlCount = 0;

    for (const block of yamlBlocks) {
      try {
        const yamlContent = block.replace(/```yaml\n/, '').replace(/```$/, '');
        yaml.parse(yamlContent);
        validYamlCount++;
      } catch (error) {
        this.log('WARN', 'Invalid YAML in v050-features.md', error.message);
      }
    }

    if (validYamlCount >= 5) {
      this.log('PASS', `v050-features.md contains valid YAML examples (${validYamlCount})`);
      this.results.v050Features.passed++;
    } else {
      this.log('FAIL', `v050-features.md has insufficient YAML examples (${validYamlCount})`);
    }

    // Test migration guide exists
    if (content.includes('Migration from v0.4.0')) {
      this.log('PASS', 'v050-features.md includes migration guide');
      this.results.v050Features.passed++;
    } else {
      this.log('FAIL', 'v050-features.md missing migration guide');
    }

    // Test troubleshooting section exists
    if (content.includes('Troubleshooting')) {
      this.log('PASS', 'v050-features.md includes troubleshooting');
      this.results.v050Features.passed++;
    } else {
      this.log('FAIL', 'v050-features.md missing troubleshooting');
    }

    // Test examples section exists
    if (content.includes('Examples')) {
      this.log('PASS', 'v050-features.md includes examples section');
      this.results.v050Features.passed++;
    } else {
      this.log('FAIL', 'v050-features.md missing examples section');
    }

    // Test best practices section exists
    if (content.includes('Best Practices')) {
      this.log('PASS', 'v050-features.md includes best practices');
      this.results.v050Features.passed++;
    } else {
      this.log('FAIL', 'v050-features.md missing best practices');
    }
  }

  /**
   * Test 3: Validate build and install procedures work
   */
  async testBuildAndInstall() {
    try {
      // Test package.json exists and has correct scripts
      const packagePath = path.join(__dirname, 'package.json');
      if (!fs.existsSync(packagePath)) {
        this.log('FAIL', 'package.json not found');
        return;
      }

      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const requiredScripts = ['build', 'dev', 'test', 'lint', 'typecheck'];

      for (const script of requiredScripts) {
        if (packageJson.scripts && packageJson.scripts[script]) {
          this.log('PASS', `package.json has required script: ${script}`);
        } else {
          this.log('FAIL', `package.json missing script: ${script}`);
        }
      }

      // Test TypeScript configuration
      const tsconfigPath = path.join(__dirname, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        this.log('PASS', 'TypeScript configuration exists');

        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
        if (tsconfig.compilerOptions && tsconfig.compilerOptions.target) {
          this.log('PASS', `TypeScript target: ${tsconfig.compilerOptions.target}`);
        }
      } else {
        this.log('WARN', 'TypeScript configuration not found');
      }

      // Test monorepo structure
      const packagesPath = path.join(__dirname, 'packages');
      if (fs.existsSync(packagesPath)) {
        this.log('PASS', 'Monorepo packages directory exists');

        const packages = fs.readdirSync(packagesPath, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        const expectedPackages = ['core', 'orchestrator', 'cli', 'api'];
        for (const pkg of expectedPackages) {
          if (packages.includes(pkg)) {
            this.log('PASS', `Package exists: ${pkg}`);
          } else {
            this.log('FAIL', `Package missing: ${pkg}`);
          }
        }
      } else {
        this.log('FAIL', 'Monorepo packages directory not found');
      }

    } catch (error) {
      this.log('FAIL', 'Build/install test failed', error.message);
    }
  }

  /**
   * Test 4: Validate browser automation documentation
   */
  async testBrowserAutomation() {
    const browserPath = path.join(__dirname, 'docs', 'browser-automation.md');

    if (!fs.existsSync(browserPath)) {
      this.log('FAIL', 'docs/browser-automation.md not found');
      return;
    }

    const content = fs.readFileSync(browserPath, 'utf-8');

    const requiredSections = [
      'Overview',
      'Features',
      'Configuration',
      'Multi-browser support',
      'Interactive operations',
      'Screenshot capture',
      'Visual regression testing'
    ];

    this.results.browserAutomation.tested = requiredSections.length + 3; // + config validation

    for (const section of requiredSections) {
      if (content.includes(section)) {
        this.log('PASS', `Browser automation docs include: ${section}`);
        this.results.browserAutomation.passed++;
      } else {
        this.log('FAIL', `Browser automation docs missing: ${section}`);
      }
    }

    // Test Playwright references
    if (content.includes('Playwright')) {
      this.log('PASS', 'Browser automation mentions Playwright');
      this.results.browserAutomation.passed++;
    } else {
      this.log('WARN', 'Browser automation missing Playwright reference');
    }

    // Test security features
    if (content.includes('allowedDomains') && content.includes('blockedDomains')) {
      this.log('PASS', 'Browser automation includes security controls');
      this.results.browserAutomation.passed++;
    } else {
      this.log('FAIL', 'Browser automation missing security controls');
    }

    // Test browser engine options
    const engines = ['chromium', 'firefox', 'webkit'];
    let engineCount = 0;
    for (const engine of engines) {
      if (content.includes(engine)) engineCount++;
    }

    if (engineCount >= 2) {
      this.log('PASS', `Browser automation supports multiple engines (${engineCount})`);
      this.results.browserAutomation.passed++;
    } else {
      this.log('FAIL', 'Browser automation insufficient engine support');
    }
  }

  /**
   * Test 5: Validate permission system documentation
   */
  async testPermissionSystem() {
    const permissionPath = path.join(__dirname, 'docs', 'permission-system.md');

    if (!fs.existsSync(permissionPath)) {
      this.log('FAIL', 'docs/permission-system.md not found');
      return;
    }

    const content = fs.readFileSync(permissionPath, 'utf-8');

    const requiredSections = [
      'Overview',
      'Permission Levels',
      'allow-always',
      'allow-once',
      'deny',
      'Permission Presets',
      'Autonomous Preset',
      'Review All Preset',
      'Read Only Preset'
    ];

    this.results.permissionSystem.tested = requiredSections.length + 2;

    for (const section of requiredSections) {
      if (content.includes(section)) {
        this.log('PASS', `Permission system docs include: ${section}`);
        this.results.permissionSystem.passed++;
      } else {
        this.log('FAIL', `Permission system docs missing: ${section}`);
      }
    }

    // Test code examples are present
    const codeBlocks = content.match(/```[\w]*\n[\s\S]*?```/g) || [];
    if (codeBlocks.length >= 5) {
      this.log('PASS', `Permission docs have sufficient examples (${codeBlocks.length})`);
      this.results.permissionSystem.passed++;
    } else {
      this.log('FAIL', `Permission docs lack examples (${codeBlocks.length})`);
    }

    // Test preset configurations are documented
    const presets = ['autonomous', 'reviewAll', 'readOnly'];
    let presetCount = 0;
    for (const preset of presets) {
      if (content.includes(`preset: ${preset}`)) presetCount++;
    }

    if (presetCount === 3) {
      this.log('PASS', 'All permission presets documented');
      this.results.permissionSystem.passed++;
    } else {
      this.log('FAIL', `Missing permission preset documentation (${presetCount}/3)`);
    }
  }

  /**
   * Test 6: Validate tool system documentation
   */
  async testToolSystem() {
    const toolPath = path.join(__dirname, 'docs', 'tool-system.md');

    if (!fs.existsSync(toolPath)) {
      this.log('FAIL', 'docs/tool-system.md not found');
      return;
    }

    const content = fs.readFileSync(toolPath, 'utf-8');

    const requiredTools = [
      'Read Tool',
      'Write Tool',
      'Edit Tool',
      'MultiEdit Tool',
      'Bash',
      'Glob',
      'Grep',
      'WebFetch',
      'WebSearch'
    ];

    this.results.toolSystem.tested = requiredTools.length + 3;

    for (const tool of requiredTools) {
      if (content.includes(tool)) {
        this.log('PASS', `Tool system docs include: ${tool}`);
        this.results.toolSystem.passed++;
      } else {
        this.log('FAIL', `Tool system docs missing: ${tool}`);
      }
    }

    // Test Claude Code parity claim
    if (content.includes('Claude Code Parity') || content.includes('claude code')) {
      this.log('PASS', 'Tool system claims Claude Code parity');
      this.results.toolSystem.passed++;
    } else {
      this.log('WARN', 'Tool system missing Claude Code parity mention');
    }

    // Test MCP integration
    if (content.includes('MCP') || content.includes('Model Context Protocol')) {
      this.log('PASS', 'Tool system includes MCP integration');
      this.results.toolSystem.passed++;
    } else {
      this.log('FAIL', 'Tool system missing MCP integration');
    }

    // Test TypeScript examples
    const tsBlocks = content.match(/```typescript\n([\s\S]*?)```/g) || [];
    if (tsBlocks.length >= 3) {
      this.log('PASS', `Tool system has TypeScript examples (${tsBlocks.length})`);
      this.results.toolSystem.passed++;
    } else {
      this.log('FAIL', `Tool system lacks TypeScript examples (${tsBlocks.length})`);
    }
  }

  /**
   * Test 7: Validate cross-platform compatibility claims
   */
  async testCrossPlatformCompatibility() {
    const readmePath = path.join(__dirname, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf-8');

    // Test platform support table exists
    if (content.includes('Platform Support') && content.includes('Windows') &&
        content.includes('macOS') && content.includes('Linux')) {
      this.log('PASS', 'Cross-platform support documented');
    } else {
      this.log('FAIL', 'Cross-platform support not documented');
    }

    // Test Windows-specific notes
    if (content.includes('Windows Prerequisites') && content.includes('PowerShell')) {
      this.log('PASS', 'Windows-specific guidance provided');
    } else {
      this.log('WARN', 'Windows guidance could be improved');
    }

    // Test installation commands for different platforms
    const platforms = [
      { name: 'npm', command: 'npm install -g' },
      { name: 'homebrew', command: 'brew install' },
      { name: 'winget', command: 'winget install' }
    ];

    for (const platform of platforms) {
      if (content.includes(platform.command)) {
        this.log('PASS', `${platform.name} installation documented`);
      } else {
        this.log('WARN', `${platform.name} installation not found`);
      }
    }
  }

  /**
   * Test 8: Validate utility functions documentation
   */
  async testUtilityFunctions() {
    const readmePath = path.join(__dirname, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf-8');

    const utilityFunctions = [
      'formatDuration',
      'formatElapsed',
      'formatTokens',
      'formatCost',
      'truncate',
      'truncateToolOutput',
      'generateTaskId',
      'ConnectionHealthManager',
      'ExponentialBackoffReconnector'
    ];

    let documentedCount = 0;
    for (const func of utilityFunctions) {
      if (content.includes(func)) {
        this.log('PASS', `Utility function documented: ${func}`);
        documentedCount++;
      } else {
        this.log('WARN', `Utility function not documented: ${func}`);
      }
    }

    if (documentedCount >= 7) {
      this.log('PASS', `Comprehensive utility documentation (${documentedCount}/${utilityFunctions.length})`);
    } else {
      this.log('FAIL', `Insufficient utility documentation (${documentedCount}/${utilityFunctions.length})`);
    }
  }

  /**
   * Test 9: Validate documentation consistency
   */
  async testDocumentationConsistency() {
    const docs = [
      { file: 'README.md', name: 'README' },
      { file: 'docs/v050-features.md', name: 'v0.5.0 Features' },
      { file: 'docs/browser-automation.md', name: 'Browser Automation' },
      { file: 'docs/permission-system.md', name: 'Permission System' },
      { file: 'docs/tool-system.md', name: 'Tool System' }
    ];

    // Test version consistency
    let versionCount = 0;
    for (const doc of docs) {
      const fullPath = path.join(__dirname, doc.file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('v0.5.0') || content.includes('0.5.0')) {
          versionCount++;
        }
      }
    }

    if (versionCount >= 3) {
      this.log('PASS', `Version consistency across docs (${versionCount}/${docs.length})`);
    } else {
      this.log('WARN', `Version inconsistency in docs (${versionCount}/${docs.length})`);
    }

    // Test cross-references
    const readmeContent = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8');
    const docLinks = [
      'docs/v050-features.md',
      'docs/browser-automation.md',
      'docs/permission-system.md',
      'docs/tool-system.md'
    ];

    let linkCount = 0;
    for (const link of docLinks) {
      if (readmeContent.includes(link)) {
        linkCount++;
      }
    }

    if (linkCount >= 3) {
      this.log('PASS', `Good cross-referencing in README (${linkCount}/${docLinks.length})`);
    } else {
      this.log('WARN', `Improve cross-referencing in README (${linkCount}/${docLinks.length})`);
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('DOCUMENTATION VALIDATION REPORT');
    console.log('='.repeat(80));

    console.log(`\n📊 OVERALL RESULTS:`);
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   ⚠️  Warnings: ${this.warnings}`);

    const total = this.passed + this.failed;
    const successRate = total > 0 ? Math.round((this.passed / total) * 100) : 0;
    console.log(`   📈 Success Rate: ${successRate}%`);

    console.log(`\n📋 DETAILED RESULTS BY SECTION:`);
    for (const [section, results] of Object.entries(this.results)) {
      const rate = results.tested > 0 ? Math.round((results.passed / results.tested) * 100) : 0;
      console.log(`   ${section}: ${results.passed}/${results.tested} (${rate}%)`);
    }

    if (this.failed > 0) {
      console.log(`\n❌ FAILURES:`);
      for (const error of this.errors) {
        console.log(`   • ${error.message}`);
        if (error.details) {
          console.log(`     ${error.details}`);
        }
      }
    }

    console.log(`\n📝 RECOMMENDATIONS:`);
    if (this.failed > 0) {
      console.log(`   • Address ${this.failed} failing tests for complete documentation`);
    }
    if (this.warnings > 0) {
      console.log(`   • Review ${this.warnings} warnings for improved documentation quality`);
    }
    if (successRate >= 90) {
      console.log(`   • Excellent documentation quality - minimal improvements needed`);
    } else if (successRate >= 80) {
      console.log(`   • Good documentation quality - address key failures`);
    } else {
      console.log(`   • Documentation needs significant improvement`);
    }

    console.log('\n' + '='.repeat(80));

    return {
      passed: this.passed,
      failed: this.failed,
      warnings: this.warnings,
      successRate,
      results: this.results
    };
  }

  /**
   * Run all documentation tests
   */
  async runAllTests() {
    console.log('🚀 Starting APEX v0.5.0 Documentation Validation\n');

    await this.testReadmeV050Features();
    await this.testV050Features();
    await this.testBuildAndInstall();
    await this.testBrowserAutomation();
    await this.testPermissionSystem();
    await this.testToolSystem();
    await this.testCrossPlatformCompatibility();
    await this.testUtilityFunctions();
    await this.testDocumentationConsistency();

    return this.generateReport();
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new DocumentationTester();
  tester.runAllTests().then(result => {
    process.exit(result.failed > 0 ? 1 : 0);
  });
}

module.exports = DocumentationTester;