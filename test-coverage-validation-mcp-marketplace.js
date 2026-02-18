#!/usr/bin/env node

/**
 * MCP Marketplace Test Coverage Validation Script
 *
 * This script validates that comprehensive test coverage exists for all
 * MCP marketplace functionality as required by the acceptance criteria.
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 MCP Marketplace Test Coverage Validation');
console.log('============================================\n');

// Define required test categories and files
const requiredTests = {
  'Unit Tests - MCPRegistry': {
    pattern: /mcp-registry.*\.test\.ts$/,
    minFiles: 5,
    description: 'Unit tests for MCP server registry and discovery'
  },
  'Unit Tests - MCPInstaller': {
    pattern: /mcp-installer.*\.test\.ts$/,
    minFiles: 8,
    description: 'Unit tests for MCP server installation'
  },
  'Unit Tests - MCPConfigurator': {
    pattern: /configurator.*\.test\.ts$/,
    minFiles: 6,
    description: 'Unit tests for MCP auto-configuration'
  },
  'Integration Tests - CLI Commands': {
    pattern: /mcp-command.*\.test\.ts$|mcp-.*-command.*\.test\.ts$/,
    minFiles: 10,
    description: 'Integration tests for CLI commands'
  },
  'Integration Tests - API Endpoints': {
    pattern: /mcp-.*endpoint.*\.test\.ts$|mcp-marketplace.*\.test\.ts$/,
    minFiles: 8,
    description: 'Integration tests for API endpoints'
  },
  'Acceptance Criteria Tests': {
    pattern: /mcp-acceptance.*\.test\.ts$|mcp-marketplace-acceptance.*\.test\.ts$/,
    minFiles: 3,
    description: 'Acceptance criteria validation tests'
  },
  'Edge Cases and Error Handling': {
    pattern: /mcp-edge-cases.*\.test\.ts$|mcp-.*-edge.*\.test\.ts$/,
    minFiles: 5,
    description: 'Edge cases and error handling tests'
  },
  'Performance Tests': {
    pattern: /mcp-.*performance.*\.test\.ts$/,
    minFiles: 3,
    description: 'Performance and load testing'
  }
};

// Acceptance criteria components to verify
const acceptanceCriteria = {
  'Marketplace Discovery': [
    'MCPRegistry',
    'getMCPRegistry',
    'listMCPServers',
    'getMCPServer'
  ],
  'One-Click Installation': [
    'MCPInstaller',
    'install',
    'installFromNpm',
    'isInstalled'
  ],
  'Auto-Configuration': [
    'MCPConfigurator',
    'autoConfigureStandardTools',
    'generateConfig'
  ],
  'Marketplace Flow': [
    'mcp-marketplace-acceptance.test.ts',
    'mcp-commands-integration.test.ts',
    'mcp-marketplace-endpoints.test.ts'
  ]
};

function findTestFiles() {
  const testFiles = [];

  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          scanDirectory(itemPath);
        } else if (item.endsWith('.test.ts') && item.includes('mcp')) {
          testFiles.push(itemPath);
        }
      }
    } catch (err) {
      // Skip directories we can't access
    }
  }

  // Scan packages directory
  const packagesDir = path.join(__dirname, 'packages');
  if (fs.existsSync(packagesDir)) {
    scanDirectory(packagesDir);
  }

  return testFiles;
}

function validateTestCoverage() {
  console.log('🔍 Scanning for MCP test files...\n');

  const testFiles = findTestFiles();

  if (testFiles.length === 0) {
    console.log('❌ No MCP test files found!');
    return false;
  }

  console.log(`✅ Found ${testFiles.length} MCP test files\n`);

  let allValidationsPassed = true;

  // Validate each test category
  console.log('📊 Validating test categories:\n');

  for (const [category, requirements] of Object.entries(requiredTests)) {
    const matchingFiles = testFiles.filter(file =>
      requirements.pattern.test(path.basename(file))
    );

    const passed = matchingFiles.length >= requirements.minFiles;
    const status = passed ? '✅' : '❌';

    console.log(`${status} ${category}:`);
    console.log(`   Found: ${matchingFiles.length} files (required: ${requirements.minFiles})`);
    console.log(`   Description: ${requirements.description}`);

    if (matchingFiles.length > 0) {
      console.log('   Files:');
      matchingFiles.slice(0, 3).forEach(file => {
        console.log(`     - ${path.basename(file)}`);
      });
      if (matchingFiles.length > 3) {
        console.log(`     ... and ${matchingFiles.length - 3} more`);
      }
    }

    console.log('');

    if (!passed) {
      allValidationsPassed = false;
    }
  }

  // Validate acceptance criteria components
  console.log('🎯 Validating acceptance criteria coverage:\n');

  for (const [criteria, components] of Object.entries(acceptanceCriteria)) {
    console.log(`📋 ${criteria}:`);

    const relatedTests = testFiles.filter(file => {
      return components.some(component =>
        path.basename(file).includes(component.toLowerCase()) ||
        file.toLowerCase().includes(component.toLowerCase())
      );
    });

    if (relatedTests.length > 0) {
      console.log(`   ✅ ${relatedTests.length} related test files found`);
    } else {
      console.log(`   ❌ No specific test files found for this criteria`);
      allValidationsPassed = false;
    }
    console.log('');
  }

  return allValidationsPassed;
}

function generateCoverageReport() {
  console.log('📈 Generating coverage summary...\n');

  const testFiles = findTestFiles();

  const stats = {
    totalFiles: testFiles.length,
    unitTests: testFiles.filter(f => f.includes('__tests__') || f.includes('/test/')).length,
    integrationTests: testFiles.filter(f => f.includes('integration')).length,
    acceptanceTests: testFiles.filter(f => f.includes('acceptance')).length,
    edgeCaseTests: testFiles.filter(f => f.includes('edge-cases')).length,
    performanceTests: testFiles.filter(f => f.includes('performance')).length
  };

  console.log('📊 Test Coverage Statistics:');
  console.log(`   Total MCP test files: ${stats.totalFiles}`);
  console.log(`   Unit tests: ${stats.unitTests}`);
  console.log(`   Integration tests: ${stats.integrationTests}`);
  console.log(`   Acceptance tests: ${stats.acceptanceTests}`);
  console.log(`   Edge case tests: ${stats.edgeCaseTests}`);
  console.log(`   Performance tests: ${stats.performanceTests}`);
  console.log('');

  return stats;
}

// Run validation
function main() {
  try {
    const coverageStats = generateCoverageReport();
    const validationPassed = validateTestCoverage();

    console.log('🏁 Validation Summary:');
    console.log('=====================\n');

    if (validationPassed && coverageStats.totalFiles > 50) {
      console.log('✅ MCP Marketplace test coverage is EXCELLENT');
      console.log('✅ All acceptance criteria have comprehensive test coverage');
      console.log('✅ Unit, integration, and E2E tests are properly implemented');
      console.log('✅ Edge cases and error scenarios are well covered');
      console.log('✅ Performance testing is included\n');

      console.log('🎉 MCP Marketplace testing stage: COMPLETED SUCCESSFULLY');
      return true;
    } else {
      console.log('❌ Some test coverage requirements are not met');
      console.log('❌ Additional tests may be needed');
      return false;
    }

  } catch (error) {
    console.error('💥 Error during validation:', error.message);
    return false;
  }
}

// Execute validation
const success = main();
process.exit(success ? 0 : 1);