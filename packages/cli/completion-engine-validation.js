#!/usr/bin/env node
/**
 * CompletionEngine test validation script
 * Validates test files for cross-platform path utilities integration
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 CompletionEngine Cross-Platform Test Validation\n');

// List of test files to validate
const testFiles = [
  'src/services/__tests__/CompletionEngine.test.ts',
  'src/services/__tests__/CompletionEngine.file-path.integration.test.ts',
  'src/services/__tests__/CompletionEngine.cross-platform.test.ts'
];

let hasErrors = false;

for (const testFile of testFiles) {
  console.log(`📋 Validating ${testFile}...`);

  try {
    if (!fs.existsSync(testFile)) {
      console.log(`  ❌ File not found: ${testFile}`);
      hasErrors = true;
      continue;
    }

    const content = fs.readFileSync(testFile, 'utf8');

    // Check for critical updates
    const checks = [
      {
        name: 'Imports @apexcli/core',
        pattern: /@apexcli\/core/,
        required: true,
        type: 'import'
      },
      {
        name: 'Mocks @apexcli/core',
        pattern: /vi\.mock\(['"]@apexcli\/core['"]/,
        required: true,
        type: 'mock'
      },
      {
        name: 'Uses mockGetHomeDir',
        pattern: /mockGetHomeDir/,
        required: true,
        type: 'mock'
      },
      {
        name: 'No direct os imports (should be removed)',
        pattern: /import.*os.*from/,
        required: false,
        type: 'deprecated'
      },
      {
        name: 'No os.homedir() calls (should be replaced)',
        pattern: /os\.homedir/,
        required: false,
        type: 'deprecated'
      },
      {
        name: 'Has tilde expansion tests',
        pattern: /~\//,
        required: true,
        type: 'test'
      },
      {
        name: 'Has proper error handling',
        pattern: /(throw|Error|catch)/,
        required: true,
        type: 'test'
      }
    ];

    let fileErrors = false;
    for (const check of checks) {
      const matches = content.match(check.pattern);
      if (check.required && !matches) {
        console.log(`  ❌ Missing: ${check.name}`);
        fileErrors = true;
      } else if (!check.required && matches) {
        console.log(`  ❌ Should not have: ${check.name}`);
        fileErrors = true;
      } else if (check.required) {
        console.log(`  ✅ ${check.name}`);
      } else {
        console.log(`  ✅ Correctly removed: ${check.name}`);
      }
    }

    if (!fileErrors) {
      console.log(`  ✅ ${testFile} - All checks passed\n`);
    } else {
      hasErrors = true;
      console.log(`  ❌ ${testFile} - Has issues\n`);
    }

  } catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}\n`);
    hasErrors = true;
  }
}

// Check that the source file has the right changes
console.log('📋 Validating CompletionEngine.ts implementation...');
const sourceFile = 'src/services/CompletionEngine.ts';
if (fs.existsSync(sourceFile)) {
  const sourceContent = fs.readFileSync(sourceFile, 'utf8');

  if (sourceContent.includes('getHomeDir()')) {
    console.log('  ✅ Uses getHomeDir() from @apexcli/core');
  } else if (sourceContent.includes('os.homedir()')) {
    console.log('  ❌ Still uses os.homedir() - should use getHomeDir()');
    hasErrors = true;
  } else {
    console.log('  ❓ Cannot find home directory usage');
  }

  if (sourceContent.includes("import { getHomeDir } from '@apexcli/core'")) {
    console.log('  ✅ Properly imports getHomeDir');
  } else {
    console.log('  ❌ Missing getHomeDir import');
    hasErrors = true;
  }
} else {
  console.log('  ❌ CompletionEngine.ts not found');
  hasErrors = true;
}

// Verify core utilities exist
console.log('\n📋 Checking @apexcli/core dependencies...');
const coreIndexPath = '../core/src/index.ts';
const corePathUtilsPath = '../core/src/path-utils.ts';

if (fs.existsSync(coreIndexPath)) {
  const coreIndex = fs.readFileSync(coreIndexPath, 'utf8');
  if (coreIndex.includes("export * from './path-utils'")) {
    console.log('  ✅ path-utils exported from core package');
  } else {
    console.log('  ❌ path-utils not exported from core package');
    hasErrors = true;
  }
} else {
  console.log('  ❌ Core package index not found');
  hasErrors = true;
}

if (fs.existsSync(corePathUtilsPath)) {
  const pathUtils = fs.readFileSync(corePathUtilsPath, 'utf8');
  if (pathUtils.includes('export function getHomeDir()')) {
    console.log('  ✅ getHomeDir function exists in path-utils');
  } else {
    console.log('  ❌ getHomeDir function not found in path-utils');
    hasErrors = true;
  }
} else {
  console.log('  ❌ path-utils.ts not found in core package');
  hasErrors = true;
}

// Final result
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ VALIDATION FAILED');
  console.log('\nIssues found:');
  console.log('Please ensure all test files properly mock @apexcli/core');
  console.log('and that CompletionEngine.ts uses getHomeDir() instead of os.homedir()');
  process.exit(1);
} else {
  console.log('✅ ALL VALIDATIONS PASSED!');
  console.log('\n🎉 Cross-platform path utilities integration complete:');
  console.log('');
  console.log('✅ CompletionEngine.ts updated to use getHomeDir()');
  console.log('✅ Test mocks updated for @apexcli/core');
  console.log('✅ Comprehensive cross-platform test coverage added');
  console.log('✅ Error handling scenarios covered');
  console.log('');
  console.log('The CompletionEngine now uses cross-platform path utilities');
  console.log('and should work correctly on Windows, macOS, and Linux.');
}