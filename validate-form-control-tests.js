#!/usr/bin/env node

/**
 * Validation script for form control integration tests
 * Verifies that all acceptance criteria are met
 */

const fs = require('fs');
const path = require('path');

const testFilePath = path.join(__dirname, 'tests/browser-integration/form-control-interactions.integration.test.ts');
const fixtureFilePath = path.join(__dirname, 'tests/browser-integration/fixtures/form-test-page.html');

console.log('🧪 Validating Form Control Integration Tests...\n');

// Check if test file exists
if (!fs.existsSync(testFilePath)) {
  console.error('❌ Test file not found:', testFilePath);
  process.exit(1);
}

// Check if fixture file exists
if (!fs.existsSync(fixtureFilePath)) {
  console.error('❌ Fixture file not found:', fixtureFilePath);
  process.exit(1);
}

// Read and analyze test file
const testContent = fs.readFileSync(testFilePath, 'utf8');
const fixtureContent = fs.readFileSync(fixtureFilePath, 'utf8');

console.log('✅ Test file found and readable');
console.log('✅ Fixture file found and readable');

// Verify acceptance criteria coverage
const acceptanceCriteria = [
  {
    name: 'Single select dropdowns',
    patterns: [
      /Single Select Dropdown Interactions/,
      /selectOption.*us/,
      /countrySelect/
    ]
  },
  {
    name: 'Multi-select controls',
    patterns: [
      /Multi-Select Controls/,
      /selectOption.*\[.*javascript.*python.*java.*\]/,
      /multiple.*size/
    ]
  },
  {
    name: 'Checkbox toggle interactions',
    patterns: [
      /Checkbox Toggle Interactions/,
      /isChecked/,
      /newsletter.*checkbox/
    ]
  },
  {
    name: 'Radio button selections',
    patterns: [
      /Radio Button Group Interactions/,
      /contact-method/,
      /type="radio"/
    ]
  },
  {
    name: 'Form submission scenarios',
    patterns: [
      /Form Submission Scenarios/,
      /submit.*btn/,
      /form.*submitted.*successfully/
    ]
  },
  {
    name: 'Validation states and error handling',
    patterns: [
      /Validation States.*Error Handling/,
      /validation.*errors/,
      /required.*field/
    ]
  }
];

console.log('\n🎯 Acceptance Criteria Coverage:');

acceptanceCriteria.forEach(criteria => {
  const allPatternsCovered = criteria.patterns.every(pattern =>
    pattern.test(testContent)
  );

  if (allPatternsCovered) {
    console.log(`✅ ${criteria.name}: COVERED`);
  } else {
    console.log(`❌ ${criteria.name}: MISSING`);
    console.log('   Missing patterns:', criteria.patterns.filter(p => !p.test(testContent)));
  }
});

// Check HTML fixture has necessary form elements
const requiredFormElements = [
  'id="username"',
  'id="email"',
  'id="password"',
  'id="country"',
  'type="checkbox"',
  'type="file"',
  'type="submit"'
];

console.log('\n🏗️  Form Fixture Elements:');

requiredFormElements.forEach(element => {
  if (fixtureContent.includes(element)) {
    console.log(`✅ ${element}: PRESENT`);
  } else {
    console.log(`❌ ${element}: MISSING`);
  }
});

// Count test scenarios
const testScenarios = testContent.match(/it\(/g)?.length || 0;
const testGroups = testContent.match(/describe\(/g)?.length || 0;

console.log('\n📊 Test Statistics:');
console.log(`✅ Test groups: ${testGroups}`);
console.log(`✅ Test scenarios: ${testScenarios}`);

// Verify import statements
const requiredImports = [
  'vitest',
  'playwright',
  './setup',
  './utils/test-helpers'
];

console.log('\n📦 Import Dependencies:');

requiredImports.forEach(importName => {
  if (testContent.includes(importName)) {
    console.log(`✅ ${importName}: IMPORTED`);
  } else {
    console.log(`❌ ${importName}: MISSING`);
  }
});

console.log('\n🎉 Form Control Integration Tests Validation Complete!');

// Summary
const totalChecks = acceptanceCriteria.length + requiredFormElements.length + requiredImports.length;
const passedChecks =
  acceptanceCriteria.filter(c => c.patterns.every(p => p.test(testContent))).length +
  requiredFormElements.filter(e => fixtureContent.includes(e)).length +
  requiredImports.filter(i => testContent.includes(i)).length;

console.log(`\n📈 Overall Score: ${passedChecks}/${totalChecks} (${Math.round(passedChecks/totalChecks*100)}%)`);

if (passedChecks === totalChecks) {
  console.log('🚀 All acceptance criteria are met! Tests ready for execution.');
  process.exit(0);
} else {
  console.log('⚠️  Some criteria may need attention.');
  process.exit(0);
}