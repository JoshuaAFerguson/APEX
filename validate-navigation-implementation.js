#!/usr/bin/env node
/**
 * Simple validation script to check navigation scenario implementation
 */

const fs = require('fs');
const path = require('path');

// Check if the MockServer file exists and is readable
const mockServerPath = path.join(__dirname, 'packages/core/src/test-utils/mock-server.ts');

console.log('🔍 Validating navigation scenario implementation...\n');

// 1. Check if file exists
if (!fs.existsSync(mockServerPath)) {
  console.error('❌ MockServer file not found at:', mockServerPath);
  process.exit(1);
}

// 2. Read file content
let content;
try {
  content = fs.readFileSync(mockServerPath, 'utf8');
} catch (error) {
  console.error('❌ Failed to read MockServer file:', error.message);
  process.exit(1);
}

// 3. Check for required navigation scenario implementations
const checks = [
  {
    name: 'Navigation scenarios setup method',
    pattern: /setupNavigationScenarios\(\)/,
    required: true
  },
  {
    name: 'Redirect routes setup',
    pattern: /setupRedirectRoutes\(\)/,
    required: true
  },
  {
    name: 'Error routes setup',
    pattern: /setupErrorRoutes\(\)/,
    required: true
  },
  {
    name: 'Delay routes setup',
    pattern: /setupDelayRoutes\(\)/,
    required: true
  },
  {
    name: '301 redirect handler',
    pattern: /redirect\/301/,
    required: true
  },
  {
    name: '302 redirect handler',
    pattern: /redirect\/302/,
    required: true
  },
  {
    name: '307 redirect handler',
    pattern: /redirect\/307/,
    required: true
  },
  {
    name: 'Generic redirect handler',
    pattern: /redirect.*query/,
    required: true
  },
  {
    name: '404 error handler',
    pattern: /error\/404/,
    required: true
  },
  {
    name: '500 error handler',
    pattern: /error\/500/,
    required: true
  },
  {
    name: 'Generic error handler',
    pattern: /error.*status/,
    required: true
  },
  {
    name: 'Delay handler with parameter',
    pattern: /delay\/:ms/,
    required: true
  },
  {
    name: 'Generic delay handler',
    pattern: /delay.*ms/,
    required: true
  },
  {
    name: 'Delay with error handler',
    pattern: /delay-error/,
    required: true
  },
  {
    name: 'Slow redirect handler',
    pattern: /slow-redirect/,
    required: true
  }
];

let allPassed = true;

checks.forEach(check => {
  if (check.pattern.test(content)) {
    console.log(`✅ ${check.name}`);
  } else {
    console.log(`❌ ${check.name}`);
    if (check.required) {
      allPassed = false;
    }
  }
});

// 4. Check test file
const testPath = path.join(__dirname, 'packages/core/src/test-utils/__tests__/mock-server.test.ts');

console.log('\n🧪 Validating test implementation...\n');

if (!fs.existsSync(testPath)) {
  console.error('❌ Test file not found at:', testPath);
  allPassed = false;
} else {
  let testContent;
  try {
    testContent = fs.readFileSync(testPath, 'utf8');
  } catch (error) {
    console.error('❌ Failed to read test file:', error.message);
    allPassed = false;
  }

  const testChecks = [
    {
      name: 'Navigation Scenarios test suite',
      pattern: /describe.*Navigation Scenarios/,
      required: true
    },
    {
      name: 'Redirect Scenarios tests',
      pattern: /describe.*Redirect Scenarios/,
      required: true
    },
    {
      name: 'Error Scenarios tests',
      pattern: /describe.*Error Scenarios/,
      required: true
    },
    {
      name: 'Delay Scenarios tests',
      pattern: /describe.*Delay Scenarios/,
      required: true
    },
    {
      name: 'Acceptance criteria tests',
      pattern: /navigation scenario acceptance criteria/,
      required: true
    }
  ];

  testChecks.forEach(check => {
    if (check.pattern.test(testContent)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
      if (check.required) {
        allPassed = false;
      }
    }
  });
}

// 5. Summary
console.log('\n📊 Validation Summary:');
if (allPassed) {
  console.log('✅ All navigation scenario implementations are present');
  console.log('\n✅ Implementation validates successfully!');
  console.log('\nNext steps:');
  console.log('1. Run npm run build to compile TypeScript');
  console.log('2. Run npm test to verify all tests pass');
  console.log('3. Test redirect scenarios with: GET /redirect/301/target');
  console.log('4. Test error scenarios with: GET /error/404');
  console.log('5. Test delay scenarios with: GET /delay/1000');
  process.exit(0);
} else {
  console.log('❌ Some required implementations are missing');
  process.exit(1);
}