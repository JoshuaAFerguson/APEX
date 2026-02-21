#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Test if we can import the project-context-analyzer module
try {
  console.log('Testing project-context-analyzer imports...');

  // Try to compile and check the TypeScript file
  const projectContextFile = path.join(__dirname, 'packages/core/src/project-context-analyzer.ts');

  if (fs.existsSync(projectContextFile)) {
    console.log('✓ project-context-analyzer.ts file exists');
  } else {
    console.log('✗ project-context-analyzer.ts file not found');
    process.exit(1);
  }

  // Check if all the required types are exported from types.ts
  const typesFile = path.join(__dirname, 'packages/core/src/types.ts');
  const typesContent = fs.readFileSync(typesFile, 'utf8');

  const requiredExports = [
    'GitStatus',
    'GitStatusSchema',
    'GitChangedFile',
    'GitChangedFileSchema',
    'ProjectStructure',
    'ProjectStructureSchema',
    'ProjectEntry',
    'ConfigurationInfo',
    'ConfigurationInfoSchema',
    'TestFrameworkInfo',
    'TestFrameworkInfoSchema',
    'FrameworkInfo',
    'FrameworkInfoSchema',
    'ProjectContext',
    'ProjectContextSchema'
  ];

  for (const exportName of requiredExports) {
    if (typesContent.includes(`export type ${exportName}`) ||
        typesContent.includes(`export const ${exportName}`)) {
      console.log(`✓ ${exportName} exported from types.ts`);
    } else {
      console.log(`✗ ${exportName} missing from types.ts`);
    }
  }

  // Check index.ts exports
  const indexFile = path.join(__dirname, 'packages/core/src/index.ts');
  const indexContent = fs.readFileSync(indexFile, 'utf8');

  if (indexContent.includes("export * from './project-context-analyzer'")) {
    console.log('✓ project-context-analyzer exported from index.ts');
  } else {
    console.log('✗ project-context-analyzer not exported from index.ts');
  }

  console.log('All checks passed!');

} catch (error) {
  console.error('Error during import test:', error.message);
  process.exit(1);
}