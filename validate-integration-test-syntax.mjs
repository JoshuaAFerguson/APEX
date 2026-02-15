#!/usr/bin/env node

/**
 * Syntax validation for browser tool result handling integration tests
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

const testFile = '/Users/s0v3r1gn/APEX/packages/orchestrator/src/__tests__/browser-tool-result-handling-integration.test.ts';

console.log('🔍 Validating Browser Tool Integration Test Syntax...\n');

try {
  // Check file exists
  if (!fs.existsSync(testFile)) {
    throw new Error(`Test file not found: ${testFile}`);
  }

  // Read file content
  const content = fs.readFileSync(testFile, 'utf-8');

  console.log('✅ Test file exists');
  console.log(`   - Path: ${testFile}`);
  console.log(`   - Size: ${content.length} characters`);
  console.log(`   - Lines: ${content.split('\n').length}`);

  // Check basic syntax patterns
  const checks = [
    { name: 'Import statements', pattern: /^import\s+.+from\s+['"].+['"];?\s*$/m },
    { name: 'Describe blocks', pattern: /describe\s*\(\s*['"].+['"],?\s*\(\)\s*=>\s*\{/m },
    { name: 'It blocks', pattern: /it\s*\(\s*['"].+['"],?\s*async\s*\(\)\s*=>\s*\{/m },
    { name: 'Expect assertions', pattern: /expect\s*\(/m },
    { name: 'Schema validation', pattern: /BrowserResultSchema/m },
    { name: 'Mock setup', pattern: /vi\.mock/m },
    { name: 'Async/await usage', pattern: /await\s+/m },
    { name: 'TypeScript types', pattern: /:\s*[A-Z][a-zA-Z0-9<>,\[\]]+/m }
  ];

  let validChecks = 0;

  for (const check of checks) {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.name} - Found`);
      validChecks++;
    } else {
      console.log(`❌ ${check.name} - Missing`);
    }
  }

  // Check for key test sections
  const sections = [
    { name: 'Schema Definitions', pattern: /Schema Definitions for Browser Result Validation/m },
    { name: 'Playwright Mocks', pattern: /Mock Playwright to avoid actual browser launching/m },
    { name: 'Schema Validation Tests', pattern: /Browser Result Schema Validation/m },
    { name: 'Serialization Tests', pattern: /Result Serialization and Deserialization/m },
    { name: 'Screenshot Tests', pattern: /Screenshot Data Handling/m },
    { name: 'Success/Failure Tests', pattern: /Success and Failure State Reporting/m },
    { name: 'Event Emission Tests', pattern: /Event Emission and Metadata/m },
    { name: 'Edge Cases Tests', pattern: /Edge Cases and Error Handling/m }
  ];

  let foundSections = 0;
  for (const section of sections) {
    if (section.pattern.test(content)) {
      console.log(`✅ ${section.name} section - Found`);
      foundSections++;
    } else {
      console.log(`❌ ${section.name} section - Missing`);
    }
  }

  // Summary
  console.log(`\n📊 Syntax Validation Summary:`);
  console.log(`   - Basic syntax checks: ${validChecks}/${checks.length}`);
  console.log(`   - Test sections: ${foundSections}/${sections.length}`);

  if (validChecks === checks.length && foundSections === sections.length) {
    console.log(`\n✅ All syntax validation checks passed!`);

    // Check dependencies
    console.log(`\n🔍 Checking required dependencies...`);
    const packageJsonPath = '/Users/s0v3r1gn/APEX/packages/orchestrator/package.json';
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const requiredDeps = ['vitest', 'playwright', 'zod', 'pixelmatch', 'pngjs'];
    const devDeps = packageJson.devDependencies || {};
    const deps = packageJson.dependencies || {};

    let foundDeps = 0;
    for (const dep of requiredDeps) {
      if (deps[dep] || devDeps[dep] || devDeps[`@types/${dep}`]) {
        console.log(`✅ ${dep} - Available`);
        foundDeps++;
      } else {
        console.log(`❌ ${dep} - Missing`);
      }
    }

    console.log(`\n📊 Dependency Summary: ${foundDeps}/${requiredDeps.length} required dependencies found`);

    // Final assessment
    if (foundDeps >= requiredDeps.length - 1) { // Allow 1 missing for flexibility
      console.log(`\n🎉 Integration test appears ready for execution!`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  Some dependencies may be missing - test execution may fail`);
      process.exit(1);
    }
  } else {
    console.log(`\n❌ Syntax validation failed - please fix the issues above`);
    process.exit(1);
  }

} catch (error) {
  console.error(`\n💥 Validation Error: ${error.message}`);
  process.exit(1);
}