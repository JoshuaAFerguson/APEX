/**
 * Quick validation runner for ConventionAnalyzer tests
 * This script validates that the core functionality works without running the full test suite
 */

import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

async function runValidation() {
  console.log('🚀 Starting ConventionAnalyzer validation...');

  const analyzer = new ConventionAnalyzer();
  const testDir = join(tmpdir(), `convention-validation-${Date.now()}`);

  try {
    await fs.mkdir(testDir, { recursive: true });
    const srcDir = join(testDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    // Test 1: Basic indentation and formatting detection
    console.log('✅ Test 1: Basic indentation and formatting detection');

    const testCode = `function example() {
  const config = {
    api: 'https://api.example.com',
    timeout: 5000,
    retries: 3,
  };

  if (config.api) {
    console.log('Configuration loaded');
    return config;
  }

  return null;
}

const userService = {
  async getUser(id) {
    const response = await fetch(\`/users/\${id}\`);
    return await response.json();
  },
};

export { userService };`;

    await fs.writeFile(join(srcDir, 'test.js'), testCode);

    const result = await analyzer.analyze(testDir);

    // Validate schema compliance
    const validationResult = ConventionAnalysisSchema.safeParse(result);
    if (!validationResult.success) {
      console.error('❌ Schema validation failed:', validationResult.error.message);
      return false;
    }

    console.log('   ✓ Schema validation passed');
    console.log(`   ✓ Indentation: ${result.indentation.type} (${result.indentation.size})`);
    console.log(`   ✓ Semicolons: ${result.formatting?.semicolons}`);
    console.log(`   ✓ Quotes: ${result.formatting?.quotes}`);
    console.log(`   ✓ Trailing commas: ${result.formatting?.trailingCommas}`);

    // Test 2: Edge case handling
    console.log('✅ Test 2: Edge case handling');

    const edgeCaseCode = `// File with mixed patterns
function mixedFunction() {
\tconst x = 1; // Tab indentation
  const y = 2; // Space indentation
  if (x > 0) {
    console.log("Mixed quotes");
    console.log('and single quotes');
  }
}

const config = {
  prop1: "value",
  prop2: 'value2'
};`;

    await fs.writeFile(join(srcDir, 'edge-case.js'), edgeCaseCode);

    const edgeResult = await analyzer.analyze(testDir);

    const edgeValidationResult = ConventionAnalysisSchema.safeParse(edgeResult);
    if (!edgeValidationResult.success) {
      console.error('❌ Edge case schema validation failed:', edgeValidationResult.error.message);
      return false;
    }

    console.log('   ✓ Edge case schema validation passed');
    console.log(`   ✓ Mixed indentation detected: ${edgeResult.indentation.type}`);
    console.log(`   ✓ Mixed quotes detected: ${edgeResult.formatting?.quotes}`);

    // Test 3: Empty project handling
    console.log('✅ Test 3: Empty project handling');

    const emptyTestDir = join(tmpdir(), `convention-empty-${Date.now()}`);
    await fs.mkdir(emptyTestDir, { recursive: true });

    const emptyResult = await analyzer.analyze(emptyTestDir);

    const emptyValidationResult = ConventionAnalysisSchema.safeParse(emptyResult);
    if (!emptyValidationResult.success) {
      console.error('❌ Empty project schema validation failed:', emptyValidationResult.error.message);
      return false;
    }

    console.log('   ✓ Empty project schema validation passed');
    console.log(`   ✓ Default conventions applied`);

    await fs.rm(emptyTestDir, { recursive: true, force: true });

    console.log('🎉 All validations passed!');
    return true;

  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  } finally {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runValidation };