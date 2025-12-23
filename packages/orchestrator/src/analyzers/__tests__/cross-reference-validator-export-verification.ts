/**
 * Export Verification for CrossReferenceValidator
 *
 * This TypeScript file serves as a compile-time verification that
 * CrossReferenceValidator can be imported from the analyzers index
 * and that all type exports are working correctly.
 */

// Test import from analyzers index - this should compile without errors
import {
  CrossReferenceValidator,
  type DocumentationReference,
  type SymbolInfo,
  type SymbolIndex,
  type SymbolExtractionOptions
} from '../index';

// Test direct import - this should also work
import {
  CrossReferenceValidator as DirectCrossReferenceValidator,
  type DocumentationReference as DirectDocumentationReference,
  type SymbolInfo as DirectSymbolInfo,
  type SymbolIndex as DirectSymbolIndex,
  type SymbolExtractionOptions as DirectSymbolExtractionOptions
} from '../cross-reference-validator';

// Verify types are the same (this is a compile-time check)
type TypeCheck1 = CrossReferenceValidator extends DirectCrossReferenceValidator ? true : false;
type TypeCheck2 = DocumentationReference extends DirectDocumentationReference ? true : false;
type TypeCheck3 = SymbolInfo extends DirectSymbolInfo ? true : false;
type TypeCheck4 = SymbolIndex extends DirectSymbolIndex ? true : false;
type TypeCheck5 = SymbolExtractionOptions extends DirectSymbolExtractionOptions ? true : false;

// These should all be true if types match correctly
const typeChecks: [TypeCheck1, TypeCheck2, TypeCheck3, TypeCheck4, TypeCheck5] = [true, true, true, true, true];

/**
 * Function to verify runtime functionality
 */
export function verifyExportFunctionality(): boolean {
  try {
    // Test instantiation from index import
    const validator = new CrossReferenceValidator();

    // Test instantiation from direct import
    const directValidator = new DirectCrossReferenceValidator();

    // Verify they're the same class
    if (validator.constructor !== directValidator.constructor) {
      console.error('Import sources produce different constructor functions');
      return false;
    }

    // Test basic functionality
    const testCode = `
export function testFunction(): void {}
export class TestClass {
  public method(): string { return 'test'; }
}
export interface TestInterface {
  prop: string;
}
`;

    const symbols = validator.extractSymbols('/test/file.ts', testCode);

    // Verify we got expected symbols
    if (!Array.isArray(symbols) || symbols.length === 0) {
      console.error('Symbol extraction failed');
      return false;
    }

    const functionSymbol = symbols.find(s => s.type === 'function' && s.name === 'testFunction');
    const classSymbol = symbols.find(s => s.type === 'class' && s.name === 'TestClass');
    const interfaceSymbol = symbols.find(s => s.type === 'interface' && s.name === 'TestInterface');

    if (!functionSymbol || !classSymbol || !interfaceSymbol) {
      console.error('Missing expected symbols');
      return false;
    }

    // Verify exported status
    if (!functionSymbol.isExported || !classSymbol.isExported || !interfaceSymbol.isExported) {
      console.error('Symbols not marked as exported');
      return false;
    }

    // Test documentation reference extraction
    const docContent = `
# Test Documentation
Use \`testFunction()\` for processing.
The \`TestClass\` provides functionality.
See \`TestInterface\` for types.
`;

    const references = validator.extractDocumentationReferences('/test/doc.md', docContent);

    if (!Array.isArray(references) || references.length === 0) {
      console.error('Documentation reference extraction failed');
      return false;
    }

    const functionRef = references.find(r => r.symbolName === 'testFunction');
    const classRef = references.find(r => r.symbolName === 'TestClass');

    if (!functionRef || !classRef) {
      console.error('Missing expected documentation references');
      return false;
    }

    // Test symbol index operations
    const testIndex: SymbolIndex = {
      byName: new Map([['testFunction', [functionSymbol]]]),
      byFile: new Map([['/test/file.ts', [functionSymbol]]]),
      stats: {
        totalSymbols: 1,
        totalFiles: 1,
        byType: { function: 1 }
      }
    };

    // Test lookup operations
    const lookupResult = validator.lookupSymbol(testIndex, 'testFunction');
    if (!lookupResult || lookupResult.length !== 1) {
      console.error('Symbol lookup failed');
      return false;
    }

    // Test validation
    const isValid = validator.validateReference(testIndex, 'testFunction');
    if (!isValid) {
      console.error('Reference validation failed');
      return false;
    }

    const isInvalid = validator.validateReference(testIndex, 'nonExistentFunction');
    if (isInvalid) {
      console.error('Invalid reference validation should have failed');
      return false;
    }

    // Test documentation validation
    const brokenLinks = validator.validateDocumentationReferences(testIndex, references);

    // Most references should be broken since we only have testFunction in the index
    const expectedBrokenCount = references.filter(r => r.symbolName !== 'testFunction').length;
    if (brokenLinks.length !== expectedBrokenCount) {
      console.error(`Expected ${expectedBrokenCount} broken links, got ${brokenLinks.length}`);
      return false;
    }

    console.log('✅ All export verification checks passed');
    return true;

  } catch (error) {
    console.error('❌ Export verification failed:', error);
    return false;
  }
}

/**
 * Example usage demonstrating the exported functionality
 */
export function demonstrateUsage(): void {
  const validator = new CrossReferenceValidator();

  // Define extraction options
  const options: SymbolExtractionOptions = {
    extensions: ['.ts', '.tsx'],
    include: ['src/**/*'],
    exclude: ['node_modules/**', '**/*.test.*'],
    includePrivate: false,
    includeMembers: true
  };

  // Example symbol extraction (would normally read from file system)
  const code = 'export class ExampleClass { public method(): void {} }';
  const symbols: SymbolInfo[] = validator.extractSymbols('/example.ts', code);

  // Example documentation processing
  const docContent = 'Use `ExampleClass` for examples.';
  const references: DocumentationReference[] = validator.extractDocumentationReferences('/doc.md', docContent);

  // Example index creation and validation
  const index: SymbolIndex = {
    byName: new Map(),
    byFile: new Map(),
    stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
  };

  // Add symbols to index
  for (const symbol of symbols) {
    if (!index.byName.has(symbol.name)) {
      index.byName.set(symbol.name, []);
    }
    index.byName.get(symbol.name)!.push(symbol);
  }

  // Validate references
  const brokenLinks = validator.validateDocumentationReferences(index, references);

  console.log(`Processed ${symbols.length} symbols, ${references.length} references, found ${brokenLinks.length} broken links`);
}

// Export verification for testing
export const exportVerification = {
  verifyExportFunctionality,
  demonstrateUsage,
  CrossReferenceValidator,
  typeChecks
};

// If running as a script, perform verification
if (require.main === module) {
  const success = verifyExportFunctionality();
  process.exit(success ? 0 : 1);
}