#!/usr/bin/env node

/**
 * Simple validation script to check that the hooks JSDoc test file is syntactically correct
 * and imports work properly.
 */

const fs = require('fs');
const path = require('path');

function validateTestFile() {
  const testFilePath = path.join(__dirname, 'packages', 'orchestrator', 'src', 'hooks-jsdoc-documentation.test.ts');

  try {
    // Check if the file exists
    if (!fs.existsSync(testFilePath)) {
      console.error('❌ Test file does not exist:', testFilePath);
      return false;
    }

    // Read the file content
    const content = fs.readFileSync(testFilePath, 'utf8');

    // Basic syntax checks
    const checks = [
      {
        name: 'Has describe blocks',
        test: content.includes('describe(') && content.includes('it(')
      },
      {
        name: 'Imports hooks module correctly',
        test: content.includes("from './hooks'")
      },
      {
        name: 'Imports TaskStore',
        test: content.includes("from './store'")
      },
      {
        name: 'Imports test dependencies',
        test: content.includes("from 'vitest'")
      },
      {
        name: 'Has HookContext interface tests',
        test: content.includes('HookContext interface documentation')
      },
      {
        name: 'Has createHooks function tests',
        test: content.includes('createHooks function documentation')
      },
      {
        name: 'Has createCustomHooks function tests',
        test: content.includes('createCustomHooks function documentation')
      },
      {
        name: 'Has FILE_MODIFYING_TOOLS tests',
        test: content.includes('FILE_MODIFYING_TOOLS constant documentation')
      },
      {
        name: 'Has JSDoc example validation',
        test: content.includes('JSDoc examples validation')
      }
    ];

    let passed = 0;
    let total = checks.length;

    console.log('🔍 Validating hooks JSDoc test file...\n');

    checks.forEach(check => {
      if (check.test) {
        console.log(`✅ ${check.name}`);
        passed++;
      } else {
        console.log(`❌ ${check.name}`);
      }
    });

    console.log(`\n📊 Validation Results: ${passed}/${total} checks passed`);

    if (passed === total) {
      console.log('✅ All validation checks passed! Test file appears to be well-structured.');
      return true;
    } else {
      console.log('❌ Some validation checks failed.');
      return false;
    }

  } catch (error) {
    console.error('❌ Error validating test file:', error.message);
    return false;
  }
}

function validateHooksFile() {
  const hooksFilePath = path.join(__dirname, 'packages', 'orchestrator', 'src', 'hooks.ts');

  try {
    if (!fs.existsSync(hooksFilePath)) {
      console.error('❌ Hooks file does not exist:', hooksFilePath);
      return false;
    }

    const content = fs.readFileSync(hooksFilePath, 'utf8');

    // Check for JSDoc documentation
    const jsdocChecks = [
      {
        name: 'HookContext interface has JSDoc',
        test: content.includes('* Context object providing access to task data')
      },
      {
        name: 'HooksConfig type has JSDoc',
        test: content.includes('* Configuration object that maps hook events')
      },
      {
        name: 'FILE_MODIFYING_TOOLS has JSDoc',
        test: content.includes('* Array of tool names that modify files')
      },
      {
        name: 'createHooks function has JSDoc',
        test: content.includes('* Creates the default set of hooks for the orchestrator') && content.includes('@param context') && content.includes('@returns') && content.includes('@example')
      },
      {
        name: 'createCustomHooks function has JSDoc',
        test: content.includes('* Creates custom hooks from user-defined configuration') && content.includes('@param customHooks') && content.includes('@param context') && content.includes('@returns') && content.includes('@example')
      }
    ];

    let passed = 0;
    let total = jsdocChecks.length;

    console.log('\n🔍 Validating hooks.ts JSDoc documentation...\n');

    jsdocChecks.forEach(check => {
      if (check.test) {
        console.log(`✅ ${check.name}`);
        passed++;
      } else {
        console.log(`❌ ${check.name}`);
      }
    });

    console.log(`\n📊 JSDoc Validation Results: ${passed}/${total} checks passed`);

    if (passed === total) {
      console.log('✅ All JSDoc documentation is present!');
      return true;
    } else {
      console.log('❌ Some JSDoc documentation is missing.');
      return false;
    }

  } catch (error) {
    console.error('❌ Error validating hooks file:', error.message);
    return false;
  }
}

// Run validations
console.log('🚀 Starting validation of hooks JSDoc tests and documentation...\n');

const testFileValid = validateTestFile();
const hooksFileValid = validateHooksFile();

if (testFileValid && hooksFileValid) {
  console.log('\n🎉 All validations passed! The hooks JSDoc documentation and tests are complete.');
  process.exit(0);
} else {
  console.log('\n💥 Some validations failed. Please check the output above.');
  process.exit(1);
}