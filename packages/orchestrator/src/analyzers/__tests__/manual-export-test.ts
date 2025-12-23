/**
 * Manual Export Test
 *
 * A simple test to verify CrossReferenceValidator can be imported and used
 * This can be compiled with tsc to verify the exports work at compile time.
 */

// Test the import - this will fail at compile time if the export is broken
import {
  CrossReferenceValidator,
  type DocumentationReference,
  type SymbolInfo,
  type SymbolIndex,
  type SymbolExtractionOptions
} from '../index';

// Simple test function
function testExports(): boolean {
  // Test instantiation
  const validator = new CrossReferenceValidator();

  // Test basic functionality
  const testCode = 'export function hello(): string { return "world"; }';
  const symbols = validator.extractSymbols('/test.ts', testCode);

  // Verify we got a symbol
  if (symbols.length !== 1) {
    console.error('Expected 1 symbol, got:', symbols.length);
    return false;
  }

  const symbol = symbols[0];
  if (symbol.name !== 'hello' || !symbol.isExported || symbol.type !== 'function') {
    console.error('Symbol extraction failed:', symbol);
    return false;
  }

  // Test documentation extraction
  const docContent = 'Use `hello()` function for greetings.';
  const refs = validator.extractDocumentationReferences('/doc.md', docContent);

  if (refs.length !== 1) {
    console.error('Expected 1 reference, got:', refs.length);
    return false;
  }

  if (refs[0].symbolName !== 'hello') {
    console.error('Reference extraction failed:', refs[0]);
    return false;
  }

  // Test index operations
  const testIndex: SymbolIndex = {
    byName: new Map([['hello', [symbol]]]),
    byFile: new Map([['/test.ts', [symbol]]]),
    stats: { totalSymbols: 1, totalFiles: 1, byType: { function: 1 } }
  };

  const lookup = validator.lookupSymbol(testIndex, 'hello');
  if (lookup.length !== 1 || lookup[0].name !== 'hello') {
    console.error('Symbol lookup failed:', lookup);
    return false;
  }

  const isValid = validator.validateReference(testIndex, 'hello');
  if (!isValid) {
    console.error('Reference validation failed');
    return false;
  }

  console.log('✅ All manual export tests passed!');
  return true;
}

// Export for potential use in other tests
export { testExports };

// If run directly, execute the test
if (typeof require !== 'undefined' && require.main === module) {
  const success = testExports();
  process.exit(success ? 0 : 1);
}