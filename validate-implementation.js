// Simple validation script to check if our TypeScript changes are syntactically correct
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating implementation...');

// Check if our files exist
const files = [
  'packages/core/src/mcp/mock-types.ts',
  'packages/core/src/__tests__/mcp-mock-types.test.ts'
];

let allFilesExist = true;
files.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} not found`);
    allFilesExist = false;
  }
});

// Check if our new types are in the mock-types.ts file
const mockTypesContent = fs.readFileSync('packages/core/src/mcp/mock-types.ts', 'utf8');
const requiredExports = [
  'MockDynamicHandler',
  'MockResponseSequence',
  'MockDynamicHandlerSchema',
  'MockResponseSequenceSchema',
  'dynamicHandlers',
  'responseSequences'
];

let allExportsPresent = true;
requiredExports.forEach(exportName => {
  if (mockTypesContent.includes(exportName)) {
    console.log(`✅ ${exportName} found in mock-types.ts`);
  } else {
    console.log(`❌ ${exportName} not found in mock-types.ts`);
    allExportsPresent = false;
  }
});

// Check test file
const testContent = fs.readFileSync('packages/core/src/__tests__/mcp-mock-types.test.ts', 'utf8');
const requiredTestImports = [
  'MockDynamicHandlerSchema',
  'MockResponseSequenceSchema',
  'type MockDynamicHandler',
  'type MockResponseSequence'
];

let allTestImportsPresent = true;
requiredTestImports.forEach(importName => {
  if (testContent.includes(importName)) {
    console.log(`✅ ${importName} found in test imports`);
  } else {
    console.log(`❌ ${importName} not found in test imports`);
    allTestImportsPresent = false;
  }
});

console.log('\n📊 Validation Summary:');
console.log(`Files exist: ${allFilesExist ? '✅' : '❌'}`);
console.log(`Types exported: ${allExportsPresent ? '✅' : '❌'}`);
console.log(`Test imports: ${allTestImportsPresent ? '✅' : '❌'}`);

if (allFilesExist && allExportsPresent && allTestImportsPresent) {
  console.log('\n🎉 Implementation appears to be complete!');
  process.exit(0);
} else {
  console.log('\n❌ Implementation has issues that need to be addressed.');
  process.exit(1);
}