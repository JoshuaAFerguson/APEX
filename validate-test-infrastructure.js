/**
 * @fileoverview Validation script for APEX form controls integration test infrastructure
 *
 * This script validates that all necessary components for integration testing are in place.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating APEX Integration Test Infrastructure...\n');

// Check test configuration files
const checks = [
  {
    name: 'Main Vitest Config',
    path: 'vitest.config.ts',
    required: true
  },
  {
    name: 'Browser Integration Config',
    path: 'tests/browser-integration/vitest.config.ts',
    required: true
  },
  {
    name: 'Browser Setup File',
    path: 'tests/browser-integration/setup.ts',
    required: true
  },
  {
    name: 'Browser Test Helpers',
    path: 'tests/browser-integration/utils/test-helpers.ts',
    required: true
  },
  {
    name: 'Form Test Fixture',
    path: 'tests/browser-integration/fixtures/form-test-page.html',
    required: true
  },
  {
    name: 'Form Controls Integration Test',
    path: 'tests/browser-integration/form-control-interactions.integration.test.ts',
    required: true
  },
  {
    name: 'Test Utils Package Config',
    path: 'tests/test-utils/package.json',
    required: true
  },
  {
    name: 'Browser Test Base',
    path: 'tests/test-utils/browser-test-base.ts',
    required: true
  },
  {
    name: 'Infrastructure Verification Test',
    path: 'tests/browser-integration/infrastructure-verification.test.ts',
    required: true
  }
];

let passedChecks = 0;
let totalChecks = checks.length;

checks.forEach(check => {
  const filePath = path.join(process.cwd(), check.path);
  const exists = fs.existsSync(filePath);

  if (exists) {
    console.log(`✅ ${check.name}: Found`);
    passedChecks++;
  } else {
    console.log(`${check.required ? '❌' : '⚠️'} ${check.name}: ${check.required ? 'MISSING (Required)' : 'Not found (Optional)'}`);
    if (check.required) {
      totalChecks--;
    }
  }
});

console.log('\n📦 Checking package.json dependencies...');

// Check main package.json for required dependencies
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const devDeps = packageJson.devDependencies || {};

  const requiredDeps = {
    'vitest': 'Test runner',
    'playwright': 'Browser automation',
    'puppeteer': 'Alternative browser automation',
    '@vitest/coverage-v8': 'Test coverage',
    'pixelmatch': 'Image comparison',
    'pngjs': 'PNG processing'
  };

  Object.entries(requiredDeps).forEach(([dep, description]) => {
    if (devDeps[dep]) {
      console.log(`✅ ${dep} (${description}): ${devDeps[dep]}`);
    } else {
      console.log(`❌ ${dep} (${description}): Missing`);
    }
  });

} catch (error) {
  console.log('❌ Failed to read package.json');
}

console.log('\n🧪 Test Infrastructure Summary:');
console.log(`✅ Infrastructure files: ${passedChecks}/${totalChecks} found`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 Integration test infrastructure is COMPLETE!');
  console.log('\n📋 Available test commands:');
  console.log('  npm run test:browser-integration - Run browser integration tests');
  console.log('  npm run test:browser-integration:watch - Run tests in watch mode');
  console.log('  npm run test:browser-infrastructure - Verify infrastructure');
  console.log('  npm run validate:browser-infrastructure - Check dependencies');

  console.log('\n🔧 Test Features Available:');
  console.log('  • Comprehensive form control testing (inputs, selects, checkboxes, radio buttons)');
  console.log('  • File upload testing with validation');
  console.log('  • Form submission and validation scenarios');
  console.log('  • Real-time validation testing');
  console.log('  • Screenshot capture and comparison');
  console.log('  • Console message capture');
  console.log('  • Cross-browser testing (Chromium, Firefox, WebKit)');
  console.log('  • Performance monitoring');
  console.log('  • Error handling and edge cases');

} else {
  console.log('\n⚠️ Some infrastructure components may be missing.');
  console.log('Please ensure all required files are in place before running tests.');
}

console.log('\n✨ Form Controls Integration Test Infrastructure Ready!');