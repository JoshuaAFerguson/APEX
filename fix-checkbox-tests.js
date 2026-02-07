#!/usr/bin/env node

/**
 * Script to update all clickCheckbox and clickCheckboxLabel calls in the checkbox test file
 * to use async/await syntax with userEvent
 */

const fs = require('fs');
const path = require('path');

const testFile = '/Users/s0v3r1gn/APEX/tests/form-integration/checkbox-toggle-interactions.test.ts';

function updateTestFile() {
  console.log('🔄 Updating checkbox test file...');

  let content = fs.readFileSync(testFile, 'utf8');

  // Update all clickCheckbox calls to be async and include user parameter
  content = content.replace(
    /clickCheckbox\(container, '([^']+)'\)/g,
    "await clickCheckbox(container, '$1', user)"
  );

  // Update all clickCheckboxLabel calls to be async and include user parameter
  content = content.replace(
    /clickCheckboxLabel\(container, '([^']+)'\)/g,
    "await clickCheckboxLabel(container, '$1', user)"
  );

  // Update all it() function declarations to be async
  content = content.replace(
    /it\('([^']+)', \(\) => \{/g,
    "it('$1', async () => {"
  );

  // Update keyboard event dispatching to use userEvent
  content = content.replace(
    /checkbox\.dispatchEvent\(new KeyboardEvent\('keydown', \{ key: ' ' \}\)\);/g,
    'await user.keyboard(\' \');'
  );

  // Update focus calls to be awaited
  content = content.replace(
    /checkbox\.focus\(\);/g,
    'await user.click(checkbox);'
  );

  fs.writeFileSync(testFile, content, 'utf8');
  console.log('✅ Checkbox test file updated successfully!');
}

updateTestFile();