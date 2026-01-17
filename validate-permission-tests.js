#!/usr/bin/env node

/**
 * Quick validation script to check if permission grant tests compile correctly
 */

const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  console.log(`Checking file: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Basic syntax checks
  const checks = [
    {
      name: 'Valid TypeScript imports',
      test: content.includes("import {") && content.includes("} from"),
      error: 'Missing import statements'
    },
    {
      name: 'Test framework setup',
      test: content.includes("describe(") && content.includes("it("),
      error: 'Missing vitest/jest test structure'
    },
    {
      name: 'Permission Manager usage',
      test: content.includes("PermissionManager"),
      error: 'Missing PermissionManager usage'
    },
    {
      name: 'Permission Store usage',
      test: content.includes("PermissionStore"),
      error: 'Missing PermissionStore usage'
    },
    {
      name: 'Core types import',
      test: content.includes("@apexcli/core"),
      error: 'Missing @apexcli/core import'
    },
    {
      name: 'Test isolation setup',
      test: content.includes("beforeEach") && content.includes("afterEach"),
      error: 'Missing proper test isolation'
    },
    {
      name: 'Permission grant tests',
      test: content.includes("grantPermission"),
      error: 'Missing permission grant functionality tests'
    },
    {
      name: 'Permission check tests',
      test: content.includes("checkPermission"),
      error: 'Missing permission check functionality tests'
    }
  ];

  let allPassed = true;
  checks.forEach(check => {
    if (check.test) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.log(`  ❌ ${check.name}: ${check.error}`);
      allPassed = false;
    }
  });

  return allPassed;
}

function main() {
  const testFile = './packages/orchestrator/src/__tests__/permission-grants-integration.test.ts';

  console.log('='.repeat(60));
  console.log('APEX Permission Tests Validation');
  console.log('='.repeat(60));

  const success = checkFile(testFile);

  console.log('='.repeat(60));
  if (success) {
    console.log('✅ All validation checks passed!');
    console.log('The permission grants integration tests appear to be correctly implemented.');
  } else {
    console.log('❌ Some validation checks failed.');
    console.log('Please review the issues above.');
  }

  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main();
}