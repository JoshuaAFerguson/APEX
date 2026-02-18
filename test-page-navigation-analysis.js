#!/usr/bin/env node

/**
 * Page Navigation Infrastructure Analysis Script
 *
 * This script analyzes the page navigation test infrastructure to ensure
 * all components are properly set up and ready for testing.
 */

const fs = require('fs/promises');
const path = require('path');

async function analyzePageNavigationInfrastructure() {
  console.log('🔍 Analyzing Page Navigation Test Infrastructure...\n');

  const results = {
    configurationFiles: [],
    testFiles: [],
    utilityFiles: [],
    fixtureFiles: [],
    missingComponents: [],
    errors: []
  };

  try {
    // Check main configuration files
    const configFiles = [
      'tests/page-navigation/vitest.config.ts',
      'tests/page-navigation/setup.ts',
      'tests/page-navigation/README.md'
    ];

    for (const configFile of configFiles) {
      try {
        const fullPath = path.join(process.cwd(), configFile);
        const stats = await fs.stat(fullPath);
        results.configurationFiles.push({
          file: configFile,
          size: stats.size,
          status: 'exists'
        });
      } catch (error) {
        results.missingComponents.push({
          file: configFile,
          type: 'configuration',
          error: error.message
        });
      }
    }

    // Check test files
    const testFiles = [
      'tests/page-navigation/infrastructure-verification.test.ts',
      'tests/page-navigation/navigation.integration.test.ts',
      'tests/page-navigation/simple-navigation-demo.test.ts'
    ];

    for (const testFile of testFiles) {
      try {
        const fullPath = path.join(process.cwd(), testFile);
        const stats = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath, 'utf8');

        results.testFiles.push({
          file: testFile,
          size: stats.size,
          testCount: (content.match(/it\(/g) || []).length,
          describeCount: (content.match(/describe\(/g) || []).length,
          status: 'exists'
        });
      } catch (error) {
        results.missingComponents.push({
          file: testFile,
          type: 'test',
          error: error.message
        });
      }
    }

    // Check utility files
    const utilityFiles = [
      'tests/page-navigation/utils/navigation-helpers.ts',
      'tests/page-navigation/utils/assertions.ts',
      'tests/page-navigation/utils/browser-fixtures.ts',
      'tests/page-navigation/utils/index.ts'
    ];

    for (const utilityFile of utilityFiles) {
      try {
        const fullPath = path.join(process.cwd(), utilityFile);
        const stats = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath, 'utf8');

        results.utilityFiles.push({
          file: utilityFile,
          size: stats.size,
          functionCount: (content.match(/export (?:async )?function/g) || []).length,
          classCount: (content.match(/export class/g) || []).length,
          status: 'exists'
        });
      } catch (error) {
        results.missingComponents.push({
          file: utilityFile,
          type: 'utility',
          error: error.message
        });
      }
    }

    // Check fixture files
    const fixtureFiles = [
      'tests/page-navigation/fixtures/navigation-scenarios.ts'
    ];

    for (const fixtureFile of fixtureFiles) {
      try {
        const fullPath = path.join(process.cwd(), fixtureFile);
        const stats = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath, 'utf8');

        results.fixtureFiles.push({
          file: fixtureFile,
          size: stats.size,
          scenarioCount: (content.match(/name:\s*['"][\w-]+['"]/g) || []).length,
          status: 'exists'
        });
      } catch (error) {
        results.missingComponents.push({
          file: fixtureFile,
          type: 'fixture',
          error: error.message
        });
      }
    }

    // Check package.json scripts
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      const navigationScripts = Object.keys(packageJson.scripts || {})
        .filter(script => script.includes('page-navigation'));

      if (navigationScripts.length > 0) {
        results.configurationFiles.push({
          file: 'package.json (navigation scripts)',
          scriptCount: navigationScripts.length,
          scripts: navigationScripts,
          status: 'exists'
        });
      } else {
        results.missingComponents.push({
          file: 'package.json navigation scripts',
          type: 'configuration',
          error: 'No page-navigation scripts found'
        });
      }
    } catch (error) {
      results.errors.push(`Failed to analyze package.json: ${error.message}`);
    }

    // Analyze dependencies
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const requiredDeps = ['playwright', 'vitest'];
      const missingDeps = requiredDeps.filter(dep => !dependencies[dep]);

      if (missingDeps.length > 0) {
        results.missingComponents.push({
          file: 'package.json dependencies',
          type: 'dependency',
          error: `Missing dependencies: ${missingDeps.join(', ')}`
        });
      }

      const presentDeps = requiredDeps.filter(dep => dependencies[dep]);
      if (presentDeps.length > 0) {
        results.configurationFiles.push({
          file: 'package.json dependencies',
          dependencies: presentDeps.map(dep => `${dep}@${dependencies[dep]}`),
          status: 'exists'
        });
      }
    } catch (error) {
      results.errors.push(`Failed to analyze dependencies: ${error.message}`);
    }

  } catch (error) {
    results.errors.push(`Infrastructure analysis failed: ${error.message}`);
  }

  return results;
}

function generateInfrastructureReport(results) {
  console.log('📊 Page Navigation Infrastructure Analysis Report\n');
  console.log('='.repeat(60));

  // Configuration Files
  console.log('\n📋 Configuration Files:');
  if (results.configurationFiles.length > 0) {
    results.configurationFiles.forEach(file => {
      console.log(`  ✅ ${file.file}`);
      if (file.size) console.log(`     Size: ${file.size} bytes`);
      if (file.scriptCount) console.log(`     Scripts: ${file.scriptCount}`);
      if (file.scripts) console.log(`     Available: ${file.scripts.join(', ')}`);
      if (file.dependencies) console.log(`     Dependencies: ${file.dependencies.join(', ')}`);
    });
  } else {
    console.log('  ❌ No configuration files found');
  }

  // Test Files
  console.log('\n🧪 Test Files:');
  if (results.testFiles.length > 0) {
    results.testFiles.forEach(file => {
      console.log(`  ✅ ${file.file}`);
      console.log(`     Size: ${file.size} bytes, Tests: ${file.testCount}, Suites: ${file.describeCount}`);
    });
  } else {
    console.log('  ❌ No test files found');
  }

  // Utility Files
  console.log('\n🔧 Utility Files:');
  if (results.utilityFiles.length > 0) {
    results.utilityFiles.forEach(file => {
      console.log(`  ✅ ${file.file}`);
      console.log(`     Size: ${file.size} bytes, Functions: ${file.functionCount}, Classes: ${file.classCount}`);
    });
  } else {
    console.log('  ❌ No utility files found');
  }

  // Fixture Files
  console.log('\n📦 Fixture Files:');
  if (results.fixtureFiles.length > 0) {
    results.fixtureFiles.forEach(file => {
      console.log(`  ✅ ${file.file}`);
      console.log(`     Size: ${file.size} bytes, Scenarios: ${file.scenarioCount}`);
    });
  } else {
    console.log('  ❌ No fixture files found');
  }

  // Missing Components
  if (results.missingComponents.length > 0) {
    console.log('\n❌ Missing Components:');
    results.missingComponents.forEach(component => {
      console.log(`  ⚠️  ${component.file} (${component.type})`);
      console.log(`     Error: ${component.error}`);
    });
  } else {
    console.log('\n✅ All Expected Components Present');
  }

  // Errors
  if (results.errors.length > 0) {
    console.log('\n⚠️  Analysis Errors:');
    results.errors.forEach(error => {
      console.log(`  • ${error}`);
    });
  }

  // Summary
  console.log('\n📈 Infrastructure Summary:');
  console.log(`  • Configuration Files: ${results.configurationFiles.length}`);
  console.log(`  • Test Files: ${results.testFiles.length}`);
  console.log(`  • Utility Files: ${results.utilityFiles.length}`);
  console.log(`  • Fixture Files: ${results.fixtureFiles.length}`);
  console.log(`  • Missing Components: ${results.missingComponents.length}`);
  console.log(`  • Analysis Errors: ${results.errors.length}`);

  const totalTestCount = results.testFiles.reduce((sum, file) => sum + file.testCount, 0);
  const totalFunctionCount = results.utilityFiles.reduce((sum, file) => sum + file.functionCount, 0);
  const totalScenarioCount = results.fixtureFiles.reduce((sum, file) => sum + file.scenarioCount, 0);

  console.log(`  • Total Tests: ${totalTestCount}`);
  console.log(`  • Total Utility Functions: ${totalFunctionCount}`);
  console.log(`  • Total Navigation Scenarios: ${totalScenarioCount}`);

  // Infrastructure Readiness Assessment
  const readinessScore = calculateReadinessScore(results);
  console.log(`\n🎯 Infrastructure Readiness: ${readinessScore.score}% (${readinessScore.status})`);

  if (readinessScore.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    readinessScore.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }

  console.log('\n' + '=' .repeat(60));
}

function calculateReadinessScore(results) {
  let score = 0;
  const recommendations = [];

  // Configuration files (25 points)
  if (results.configurationFiles.length >= 3) {
    score += 25;
  } else {
    score += Math.floor((results.configurationFiles.length / 3) * 25);
    recommendations.push('Complete configuration files setup');
  }

  // Test files (25 points)
  if (results.testFiles.length >= 3) {
    score += 25;
  } else {
    score += Math.floor((results.testFiles.length / 3) * 25);
    recommendations.push('Add more comprehensive test files');
  }

  // Utility files (25 points)
  if (results.utilityFiles.length >= 3) {
    score += 25;
  } else {
    score += Math.floor((results.utilityFiles.length / 3) * 25);
    recommendations.push('Implement additional utility functions');
  }

  // Fixture files (15 points)
  if (results.fixtureFiles.length >= 1) {
    score += 15;
  } else {
    recommendations.push('Create navigation scenario fixtures');
  }

  // Missing components penalty (10 points)
  if (results.missingComponents.length === 0) {
    score += 10;
  } else {
    recommendations.push('Resolve missing components');
  }

  let status;
  if (score >= 90) status = 'Excellent';
  else if (score >= 75) status = 'Good';
  else if (score >= 60) status = 'Fair';
  else status = 'Needs Improvement';

  return { score, status, recommendations };
}

// Main execution
async function main() {
  try {
    const results = await analyzePageNavigationInfrastructure();
    generateInfrastructureReport(results);

    console.log('\n🔍 Page Navigation Infrastructure Analysis Complete!');

    // Exit with appropriate code
    if (results.missingComponents.length === 0 && results.errors.length === 0) {
      console.log('✅ Infrastructure is ready for testing');
      process.exit(0);
    } else {
      console.log('⚠️  Infrastructure has issues that should be addressed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzePageNavigationInfrastructure,
  generateInfrastructureReport,
  calculateReadinessScore
};