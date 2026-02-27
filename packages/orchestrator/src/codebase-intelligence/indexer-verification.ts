/**
 * CodebaseIndexer Verification Script
 *
 * Simple verification that the CodebaseIndexer implementation works correctly
 * and can be imported and used without errors.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { CodebaseIndexer } from './indexer.js';

async function verifyCodebaseIndexer(): Promise<void> {
  console.log('🧪 Verifying CodebaseIndexer implementation...');

  let tempDir: string | null = null;

  try {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'indexer-verify-'));
    console.log(`📁 Created temp directory: ${tempDir}`);

    // Create test files
    await fs.writeFile(path.join(tempDir, 'test.ts'), `
/**
 * Test TypeScript file
 */
export interface TestInterface {
  value: number;
}

export class TestClass implements TestInterface {
  constructor(public value: number) {}

  getValue(): number {
    return this.value;
  }
}

export function testFunction(x: number): string {
  return x.toString();
}
    `);

    await fs.writeFile(path.join(tempDir, 'test.js'), `
const utils = {
  add: function(a, b) {
    return a + b;
  },

  multiply: (a, b) => a * b
};

function greet(name) {
  return \`Hello, \${name}!\`;
}

module.exports = { utils, greet };
    `);

    await fs.writeFile(path.join(tempDir, 'test.py'), `
def calculate_sum(numbers):
    """Calculate the sum of a list of numbers"""
    return sum(numbers)

class Calculator:
    def __init__(self, initial_value=0):
        self.value = initial_value

    def add(self, amount):
        self.value += amount
        return self

    def multiply(self, factor):
        self.value *= factor
        return self
    `);

    // Test CodebaseIndexer
    const indexer = CodebaseIndexer.getInstance();
    console.log('✅ Successfully created CodebaseIndexer instance');

    const startTime = Date.now();
    const result = await indexer.indexDirectory(tempDir);
    const endTime = Date.now();

    console.log(`⏱️  Indexing completed in ${endTime - startTime}ms`);

    // Verify results
    console.log('📊 Verification results:');
    console.log(`   Total files: ${result.files.length}`);
    console.log(`   Total symbols: ${result.stats?.totalSymbols || 0}`);
    console.log(`   Total lines: ${result.stats?.totalLines || 0}`);
    console.log(`   Languages: ${Object.keys(result.stats?.languageBreakdown || {}).join(', ')}`);
    console.log(`   Errors: ${result.errors.length}`);

    // Basic assertions
    if (result.files.length !== 3) {
      throw new Error(`Expected 3 files, got ${result.files.length}`);
    }

    if ((result.stats?.totalSymbols || 0) < 5) {
      throw new Error(`Expected at least 5 symbols, got ${result.stats?.totalSymbols || 0}`);
    }

    const languages = Object.keys(result.stats?.languageBreakdown || {});
    const expectedLanguages = ['typescript', 'javascript', 'python'];

    for (const lang of expectedLanguages) {
      if (!languages.includes(lang)) {
        throw new Error(`Expected language '${lang}' not found in results`);
      }
    }

    // Verify file details
    const tsFile = result.files.find((f) => f.path === 'test.ts');
    const jsFile = result.files.find((f) => f.path === 'test.js');
    const pyFile = result.files.find((f) => f.path === 'test.py');

    if (!tsFile || !jsFile || !pyFile) {
      throw new Error('Not all test files were found in results');
    }

    if (tsFile.symbols.length < 3) {
      throw new Error(`TypeScript file should have at least 3 symbols, got ${tsFile.symbols.length}`);
    }

    if (jsFile.symbols.length < 2) {
      throw new Error(`JavaScript file should have at least 2 symbols, got ${jsFile.symbols.length}`);
    }

    if (pyFile.symbols.length < 2) {
      throw new Error(`Python file should have at least 2 symbols, got ${pyFile.symbols.length}`);
    }

    console.log('✅ All verifications passed!');
    console.log('🎉 CodebaseIndexer implementation is working correctly');

    // Test with different options
    console.log('🔧 Testing with different options...');

    const resultWithHashes = await indexer.indexDirectory(tempDir, { computeHashes: true });
    if (!resultWithHashes.files[0].contentHash) {
      throw new Error('Content hash should be computed when requested');
    }

    const resultWithoutHashes = await indexer.indexDirectory(tempDir, { computeHashes: false });
    if (resultWithoutHashes.files[0].contentHash) {
      throw new Error('Content hash should not be computed when disabled');
    }

    console.log('✅ Options testing passed!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    // Clean up
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up temp directory: ${tempDir}`);
      } catch (error) {
        console.warn(`⚠️  Failed to clean up temp directory: ${error}`);
      }
    }

    // Reset singleton
    CodebaseIndexer.resetInstance();
  }
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifyCodebaseIndexer()
    .then(() => {
      console.log('🎯 Verification completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Verification failed:', error);
      process.exit(1);
    });
}

export { verifyCodebaseIndexer };