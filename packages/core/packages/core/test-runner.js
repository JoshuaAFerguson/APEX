#!/usr/bin/env node

/**
 * Simple test validation script for RepositoryMap types
 * Validates that the types can be imported and basic validation works
 */

console.log('🧪 Testing RepositoryMap Types...\n');

try {
  // Test 1: Import the types
  console.log('✅ Test 1: Importing types...');
  const {
    RepositoryMapSchema,
    CodeSymbolSchema,
    SymbolReferenceSchema,
    ImportEdgeSchema,
    CodeFileSchema,
    SymbolTypeSchema
  } = require('./dist/types.js');
  console.log('   ✓ All types imported successfully');

  // Test 2: Basic schema validation
  console.log('✅ Test 2: Basic schema validation...');

  // Test SymbolType enum
  const validSymbolType = SymbolTypeSchema.parse('function');
  console.log('   ✓ SymbolType validation works:', validSymbolType);

  // Test CodeSymbol
  const symbol = CodeSymbolSchema.parse({
    name: 'testFunction',
    type: 'function',
    filePath: 'test.ts',
    startLine: 1,
    endLine: 5,
  });
  console.log('   ✓ CodeSymbol validation works:', symbol.name);

  // Test SymbolReference
  const reference = SymbolReferenceSchema.parse({
    symbolName: 'testFunction',
    sourceFile: 'src/app.ts',
    targetFile: 'src/utils.ts',
    line: 10,
    column: 15,
  });
  console.log('   ✓ SymbolReference validation works:', reference.symbolName);

  // Test ImportEdge
  const importEdge = ImportEdgeSchema.parse({
    sourceFile: 'src/app.ts',
    targetFile: 'src/utils.ts',
    importedSymbols: ['testFunction'],
  });
  console.log('   ✓ ImportEdge validation works');

  // Test CodeFile
  const codeFile = CodeFileSchema.parse({
    path: 'src/test.ts',
    language: 'typescript',
    symbols: [symbol],
    imports: [importEdge],
  });
  console.log('   ✓ CodeFile validation works:', codeFile.path);

  // Test RepositoryMap
  const repoMap = RepositoryMapSchema.parse({
    rootPath: '/test/project',
    name: 'TestProject',
    files: [codeFile],
    references: [reference],
  });
  console.log('   ✓ RepositoryMap validation works:', repoMap.name);

  // Test 3: Error handling
  console.log('✅ Test 3: Error handling...');
  try {
    CodeSymbolSchema.parse({
      name: '', // Invalid: empty name
      type: 'function',
      filePath: 'test.ts',
      startLine: 1,
      endLine: 5,
    });
    console.log('   ❌ Should have thrown error for empty name');
    process.exit(1);
  } catch (error) {
    console.log('   ✓ Correctly rejected invalid symbol with empty name');
  }

  try {
    SymbolTypeSchema.parse('invalid-type');
    console.log('   ❌ Should have thrown error for invalid symbol type');
    process.exit(1);
  } catch (error) {
    console.log('   ✓ Correctly rejected invalid symbol type');
  }

  // Test 4: Default values
  console.log('✅ Test 4: Default values...');
  const minimalRepo = RepositoryMapSchema.parse({
    rootPath: '/minimal',
  });
  console.log('   ✓ Applied default values:');
  console.log('     - files:', Array.isArray(minimalRepo.files) ? '[]' : 'invalid');
  console.log('     - references:', Array.isArray(minimalRepo.references) ? '[]' : 'invalid');
  console.log('     - version:', minimalRepo.version);

  // Test 5: Complex relationships
  console.log('✅ Test 5: Complex relationships...');
  const complexRepo = RepositoryMapSchema.parse({
    rootPath: '/complex-project',
    files: [
      {
        path: 'src/utils.ts',
        symbols: [
          {
            name: 'helper',
            type: 'function',
            filePath: 'src/utils.ts',
            startLine: 1,
            endLine: 3,
            exported: true,
          }
        ],
        exports: [{ name: 'helper', isDefault: false }],
      },
      {
        path: 'src/main.ts',
        symbols: [
          {
            name: 'main',
            type: 'function',
            filePath: 'src/main.ts',
            startLine: 5,
            endLine: 15,
          }
        ],
        imports: [
          {
            sourceFile: 'src/main.ts',
            targetFile: 'src/utils.ts',
            importedSymbols: ['helper'],
            importType: 'named',
          }
        ],
      }
    ],
    references: [
      {
        symbolName: 'helper',
        sourceFile: 'src/main.ts',
        targetFile: 'src/utils.ts',
        line: 10,
        column: 5,
        symbolType: 'function',
      }
    ],
    stats: {
      totalFiles: 2,
      totalSymbols: 2,
      totalReferences: 1,
      languageBreakdown: { typescript: 2 },
      symbolTypeBreakdown: { function: 2 },
    },
  });
  console.log('   ✓ Complex repository structure validated');
  console.log('     - Files:', complexRepo.files.length);
  console.log('     - References:', complexRepo.references.length);

  console.log('\n🎉 All tests passed! RepositoryMap types are working correctly.\n');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.issues) {
    console.error('Validation issues:', error.issues);
  }
  process.exit(1);
}