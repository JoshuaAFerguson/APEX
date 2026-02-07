#!/usr/bin/env node

/**
 * APEX v0.5.0 Documentation Accuracy Test Suite
 *
 * Comprehensive testing to verify that all documented v0.5.0 features
 * are accurately described and actually implemented in the codebase
 */

const fs = require('fs');
const path = require('path');

class V050DocumentationAccuracyTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.errors = [];
    this.verificationResults = {
      codebaseStructure: { tested: 0, passed: 0 },
      featureImplementation: { tested: 0, passed: 0 },
      apiConsistency: { tested: 0, passed: 0 },
      documentationQuality: { tested: 0, passed: 0 },
      crossReferences: { tested: 0, passed: 0 }
    };
  }

  log(level, message, details = '') {
    const timestamp = new Date().toISOString().slice(11, 19);
    const prefix = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARN': '⚠️',
      'INFO': 'ℹ️'
    }[level] || '•';

    console.log(`${prefix} [${timestamp}] ${level}: ${message}`);
    if (details) console.log(`   Details: ${details}`);

    if (level === 'PASS') this.passed++;
    else if (level === 'FAIL') {
      this.failed++;
      this.errors.push({ message, details, level });
    } else if (level === 'WARN') this.warnings++;
  }

  /**
   * Test 1: Verify codebase structure matches documentation
   */
  testCodebaseStructure() {
    console.log('\n🏗️  Testing codebase structure vs documentation...\n');

    // Test package structure
    const packagesDir = path.join(__dirname, 'packages');
    const expectedPackages = ['core', 'orchestrator', 'cli', 'api', 'browser'];

    this.verificationResults.codebaseStructure.tested = expectedPackages.length + 5;

    expectedPackages.forEach(pkg => {
      const pkgPath = path.join(packagesDir, pkg);
      if (fs.existsSync(pkgPath)) {
        this.log('PASS', `Package exists: ${pkg}`);
        this.verificationResults.codebaseStructure.passed++;
      } else {
        this.log('FAIL', `Package missing: ${pkg}`, `Expected at ${pkgPath}`);
      }
    });

    // Test core type definitions exist
    const coreTypesPath = path.join(packagesDir, 'core', 'src', 'types.ts');
    if (fs.existsSync(coreTypesPath)) {
      const typesContent = fs.readFileSync(coreTypesPath, 'utf-8');

      // Check for tool definitions mentioned in docs
      const expectedTools = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Browser'];
      expectedTools.forEach(tool => {
        if (typesContent.includes(`'${tool}'`)) {
          this.log('PASS', `Tool type defined: ${tool}`);
          this.verificationResults.codebaseStructure.passed++;
        } else {
          this.log('FAIL', `Tool type missing: ${tool}`);
        }
      });
      this.verificationResults.codebaseStructure.tested += expectedTools.length;
    } else {
      this.log('FAIL', 'Core types.ts not found', coreTypesPath);
    }

    // Test browser package structure
    const browserPackagePath = path.join(packagesDir, 'browser', 'src', 'browser-session.ts');
    if (fs.existsSync(browserPackagePath)) {
      this.log('PASS', 'Browser session implementation exists');
      this.verificationResults.codebaseStructure.passed++;
    } else {
      this.log('FAIL', 'Browser session implementation missing');
    }

    // Test permission system
    const permissionManagerPath = path.join(packagesDir, 'orchestrator', 'src', 'permission-manager.ts');
    if (fs.existsSync(permissionManagerPath)) {
      this.log('PASS', 'Permission manager implementation exists');
      this.verificationResults.codebaseStructure.passed++;
    } else {
      this.log('FAIL', 'Permission manager implementation missing');
    }

    // Test permission store
    const permissionStorePath = path.join(packagesDir, 'orchestrator', 'src', 'permission-store.ts');
    if (fs.existsSync(permissionStorePath)) {
      this.log('PASS', 'Permission store implementation exists');
      this.verificationResults.codebaseStructure.passed++;
    } else {
      this.log('FAIL', 'Permission store implementation missing');
    }
  }

  /**
   * Test 2: Verify documented features have actual implementations
   */
  testFeatureImplementation() {
    console.log('\n🔬 Testing documented features vs actual implementation...\n');

    // Test permission system features
    const permissionManagerPath = path.join(__dirname, 'packages', 'orchestrator', 'src', 'permission-manager.ts');
    if (fs.existsSync(permissionManagerPath)) {
      const content = fs.readFileSync(permissionManagerPath, 'utf-8');

      const expectedFeatures = [
        'allow-always',
        'allow-once',
        'deny',
        'checkPermission',
        'grantPermission',
        'sessionCache'
      ];

      this.verificationResults.featureImplementation.tested = expectedFeatures.length;

      expectedFeatures.forEach(feature => {
        if (content.includes(feature)) {
          this.log('PASS', `Permission feature implemented: ${feature}`);
          this.verificationResults.featureImplementation.passed++;
        } else {
          this.log('FAIL', `Permission feature not found: ${feature}`);
        }
      });
    }

    // Test browser automation features
    const browserSessionPath = path.join(__dirname, 'packages', 'browser', 'src', 'browser-session.ts');
    if (fs.existsSync(browserSessionPath)) {
      const content = fs.readFileSync(browserSessionPath, 'utf-8');

      const expectedBrowserFeatures = [
        'playwright',
        'screenshot',
        'navigate',
        'EventEmitter'
      ];

      this.verificationResults.featureImplementation.tested += expectedBrowserFeatures.length;

      expectedBrowserFeatures.forEach(feature => {
        if (content.includes(feature)) {
          this.log('PASS', `Browser feature implemented: ${feature}`);
          this.verificationResults.featureImplementation.passed++;
        } else {
          this.log('FAIL', `Browser feature not found: ${feature}`);
        }
      });
    }

    // Test package.json for documented dependencies
    const packageJsonPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const expectedDeps = ['playwright', 'vitest', 'typescript'];
      this.verificationResults.featureImplementation.tested += expectedDeps.length;

      expectedDeps.forEach(dep => {
        const hasDirectDep = packageJson.dependencies && packageJson.dependencies[dep];
        const hasDevDep = packageJson.devDependencies && packageJson.devDependencies[dep];

        if (hasDirectDep || hasDevDep) {
          this.log('PASS', `Documented dependency exists: ${dep}`);
          this.verificationResults.featureImplementation.passed++;
        } else {
          this.log('FAIL', `Documented dependency missing: ${dep}`);
        }
      });
    }
  }

  /**
   * Test 3: Check API consistency between docs and implementation
   */
  testApiConsistency() {
    console.log('\n🔍 Testing API consistency between docs and implementation...\n');

    // Check that documented configuration options exist in types
    const coreTypesPath = path.join(__dirname, 'packages', 'core', 'src', 'types.ts');
    if (fs.existsSync(coreTypesPath)) {
      const content = fs.readFileSync(coreTypesPath, 'utf-8');

      const expectedConfigOptions = [
        'AgentModel',
        'AgentTool',
        'AgentDefinition'
      ];

      this.verificationResults.apiConsistency.tested = expectedConfigOptions.length;

      expectedConfigOptions.forEach(option => {
        if (content.includes(option)) {
          this.log('PASS', `API type defined: ${option}`);
          this.verificationResults.apiConsistency.passed++;
        } else {
          this.log('FAIL', `API type missing: ${option}`);
        }
      });
    }

    // Test documented scripts exist in package.json
    const packageJsonPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      const expectedScripts = ['build', 'dev', 'test', 'lint', 'typecheck'];
      this.verificationResults.apiConsistency.tested += expectedScripts.length;

      expectedScripts.forEach(script => {
        if (packageJson.scripts && packageJson.scripts[script]) {
          this.log('PASS', `Documented script exists: ${script}`);
          this.verificationResults.apiConsistency.passed++;
        } else {
          this.log('FAIL', `Documented script missing: ${script}`);
        }
      });
    }

    // Test version consistency
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      this.verificationResults.apiConsistency.tested++;

      if (packageJson.version && packageJson.version.startsWith('0.5.')) {
        this.log('PASS', `Package version matches documentation: ${packageJson.version}`);
        this.verificationResults.apiConsistency.passed++;
      } else {
        this.log('FAIL', `Package version mismatch: ${packageJson.version || 'undefined'}`);
      }
    }
  }

  /**
   * Test 4: Validate documentation quality and completeness
   */
  testDocumentationQuality() {
    console.log('\n📚 Testing documentation quality and completeness...\n');

    const documentationFiles = [
      { file: 'README.md', name: 'Main README' },
      { file: 'docs/v050-features.md', name: 'v0.5.0 Features' },
      { file: 'docs/browser-automation.md', name: 'Browser Automation' },
      { file: 'docs/permission-system.md', name: 'Permission System' },
      { file: 'docs/tool-system.md', name: 'Tool System' }
    ];

    this.verificationResults.documentationQuality.tested = documentationFiles.length * 3; // 3 tests per file

    documentationFiles.forEach(({ file, name }) => {
      const filePath = path.join(__dirname, file);

      if (fs.existsSync(filePath)) {
        this.log('PASS', `${name} exists`);
        this.verificationResults.documentationQuality.passed++;

        const content = fs.readFileSync(filePath, 'utf-8');

        // Test for code examples
        const codeBlocks = (content.match(/```[\w]*\n/g) || []).length;
        if (codeBlocks >= 3) {
          this.log('PASS', `${name} has sufficient code examples (${codeBlocks})`);
          this.verificationResults.documentationQuality.passed++;
        } else {
          this.log('WARN', `${name} could use more code examples (${codeBlocks})`);
        }

        // Test for comprehensive content
        if (content.length >= 1000) {
          this.log('PASS', `${name} has comprehensive content (${content.length} chars)`);
          this.verificationResults.documentationQuality.passed++;
        } else {
          this.log('FAIL', `${name} content appears insufficient (${content.length} chars)`);
        }
      } else {
        this.log('FAIL', `${name} does not exist`, filePath);
      }
    });

    // Test specific v0.5.0 content in README
    const readmePath = path.join(__dirname, 'README.md');
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf-8');

      const v050Features = [
        'Tool System & Permissions',
        'Browser Automation',
        'Permission System',
        'Built-in Tools',
        'Autonomy Controls'
      ];

      this.verificationResults.documentationQuality.tested += v050Features.length;

      v050Features.forEach(feature => {
        if (content.includes(feature)) {
          this.log('PASS', `README documents v0.5.0 feature: ${feature}`);
          this.verificationResults.documentationQuality.passed++;
        } else {
          this.log('FAIL', `README missing v0.5.0 feature: ${feature}`);
        }
      });
    }
  }

  /**
   * Test 5: Validate cross-references between documents
   */
  testCrossReferences() {
    console.log('\n🔗 Testing cross-references between documents...\n');

    const readmePath = path.join(__dirname, 'README.md');
    if (fs.existsSync(readmePath)) {
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');

      const expectedLinks = [
        'docs/v050-features.md',
        'docs/browser-automation.md',
        'docs/permission-system.md',
        'docs/tool-system.md'
      ];

      this.verificationResults.crossReferences.tested = expectedLinks.length * 2; // Test link + target exists

      expectedLinks.forEach(link => {
        if (readmeContent.includes(link)) {
          this.log('PASS', `README links to: ${link}`);
          this.verificationResults.crossReferences.passed++;

          // Test that the linked file exists
          const targetPath = path.join(__dirname, link);
          if (fs.existsSync(targetPath)) {
            this.log('PASS', `Link target exists: ${link}`);
            this.verificationResults.crossReferences.passed++;
          } else {
            this.log('FAIL', `Broken link target: ${link}`, targetPath);
          }
        } else {
          this.log('FAIL', `README missing link to: ${link}`);
        }
      });
    }

    // Test consistent terminology across documents
    const docs = ['README.md', 'docs/v050-features.md'];
    const terminology = [
      { term: 'APEX', description: 'Project name consistency' },
      { term: 'v0.5.0', description: 'Version consistency' },
      { term: 'Claude Agent SDK', description: 'Foundation technology' },
      { term: 'Playwright', description: 'Browser automation technology' }
    ];

    this.verificationResults.crossReferences.tested += docs.length * terminology.length;

    docs.forEach(docFile => {
      const docPath = path.join(__dirname, docFile);
      if (fs.existsSync(docPath)) {
        const content = fs.readFileSync(docPath, 'utf-8');

        terminology.forEach(({ term, description }) => {
          if (content.includes(term)) {
            this.log('PASS', `${docFile} uses consistent terminology: ${term}`);
            this.verificationResults.crossReferences.passed++;
          } else {
            this.log('WARN', `${docFile} missing terminology: ${term} (${description})`);
          }
        });
      }
    });
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('APEX v0.5.0 DOCUMENTATION ACCURACY REPORT');
    console.log('='.repeat(80));

    console.log(`\n📊 OVERALL RESULTS:`);
    console.log(`   ✅ Tests Passed: ${this.passed}`);
    console.log(`   ❌ Tests Failed: ${this.failed}`);
    console.log(`   ⚠️  Warnings: ${this.warnings}`);

    const total = this.passed + this.failed;
    const successRate = total > 0 ? Math.round((this.passed / total) * 100) : 0;
    console.log(`   📈 Success Rate: ${successRate}%`);

    console.log(`\n📋 DETAILED RESULTS BY CATEGORY:`);
    Object.entries(this.verificationResults).forEach(([category, results]) => {
      const rate = results.tested > 0 ? Math.round((results.passed / results.tested) * 100) : 0;
      const status = rate >= 90 ? '🟢' : rate >= 75 ? '🟡' : '🔴';
      console.log(`   ${status} ${category}: ${results.passed}/${results.tested} (${rate}%)`);
    });

    if (this.failed > 0) {
      console.log(`\n❌ CRITICAL ISSUES:`);
      this.errors.filter(e => e.level === 'FAIL').forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.message}`);
        if (error.details) console.log(`      └─ ${error.details}`);
      });
    }

    console.log(`\n📝 ASSESSMENT:`);
    if (successRate >= 95) {
      console.log(`   🎉 EXCELLENT: Documentation is accurate and comprehensive!`);
      console.log(`   👍 All v0.5.0 features are properly documented and implemented.`);
    } else if (successRate >= 85) {
      console.log(`   ✅ GOOD: Documentation is mostly accurate with minor gaps.`);
      console.log(`   📋 Address the ${this.failed} critical issues for full compliance.`);
    } else if (successRate >= 70) {
      console.log(`   ⚠️  NEEDS WORK: Documentation has significant accuracy issues.`);
      console.log(`   🔧 Major improvements needed to align docs with implementation.`);
    } else {
      console.log(`   ❌ POOR: Documentation accuracy is insufficient for v0.5.0 release.`);
      console.log(`   🚨 Critical documentation overhaul required.`);
    }

    console.log(`\n🎯 RECOMMENDATIONS:`);
    if (this.failed > 0) {
      console.log(`   • Fix ${this.failed} critical documentation-implementation mismatches`);
    }
    if (this.warnings > 0) {
      console.log(`   • Address ${this.warnings} documentation quality warnings`);
    }

    const worstCategory = Object.entries(this.verificationResults)
      .reduce((worst, [name, results]) => {
        const rate = results.tested > 0 ? results.passed / results.tested : 1;
        const worstRate = worst.results.tested > 0 ? worst.results.passed / worst.results.tested : 1;
        return rate < worstRate ? { name, results } : worst;
      }, { name: 'none', results: { tested: 1, passed: 1 } });

    if (worstCategory.results.tested > 0 && worstCategory.results.passed / worstCategory.results.tested < 0.8) {
      console.log(`   • Priority focus: ${worstCategory.name} category needs attention`);
    }

    console.log('\n' + '='.repeat(80));

    return {
      passed: this.passed,
      failed: this.failed,
      warnings: this.warnings,
      successRate,
      verificationResults: this.verificationResults,
      assessment: successRate >= 95 ? 'excellent' : successRate >= 85 ? 'good' : successRate >= 70 ? 'needs-work' : 'poor'
    };
  }

  /**
   * Run all documentation accuracy tests
   */
  async runAllTests() {
    console.log('🚀 Starting APEX v0.5.0 Documentation Accuracy Verification\n');
    console.log('This test suite verifies that documented features are actually implemented\n');

    this.testCodebaseStructure();
    this.testFeatureImplementation();
    this.testApiConsistency();
    this.testDocumentationQuality();
    this.testCrossReferences();

    return this.generateReport();
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new V050DocumentationAccuracyTester();
  tester.runAllTests().then(result => {
    process.exit(result.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = V050DocumentationAccuracyTester;