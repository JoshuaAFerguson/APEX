#!/usr/bin/env node
// Quick verification script for MCP v0.5.0 schemas
const fs = require('fs');

try {
  // First check if the types file exists and has the right exports
  const typesPath = '/Users/s0v3r1gn/APEX/packages/core/src/types.ts';
  const typesContent = fs.readFileSync(typesPath, 'utf8');

  console.log('✓ Types file exists');

  // Check for required schema exports
  const requiredSchemas = [
    'MCPServerV050Schema',
    'MCPInstallationV050Schema',
    'MCPInstallProgressV050Schema'
  ];

  let allSchemasFound = true;
  requiredSchemas.forEach(schema => {
    if (typesContent.includes(`export const ${schema}`)) {
      console.log(`✓ Found export: ${schema}`);
    } else {
      console.log(`✗ Missing export: ${schema}`);
      allSchemasFound = false;
    }
  });

  // Check for required type exports
  const requiredTypes = [
    'MCPServerV050',
    'MCPInstallationV050',
    'MCPInstallProgressV050'
  ];

  requiredTypes.forEach(type => {
    if (typesContent.includes(`export type ${type}`)) {
      console.log(`✓ Found type: ${type}`);
    } else {
      console.log(`✗ Missing type: ${type}`);
      allSchemasFound = false;
    }
  });

  // Check for dependency schemas
  const dependencySchemas = [
    'MCPServerCategorySchema',
    'MCPInstallationStatusSchema',
    'MCPInstallStageSchema',
    'MCPServerConfigSchema'
  ];

  dependencySchemas.forEach(schema => {
    if (typesContent.includes(`export const ${schema}`)) {
      console.log(`✓ Found dependency: ${schema}`);
    } else {
      console.log(`✗ Missing dependency: ${schema}`);
      allSchemasFound = false;
    }
  });

  // Check test file exists
  const testPath = '/Users/s0v3r1gn/APEX/packages/core/src/__tests__/mcp-v050-schemas.test.ts';
  if (fs.existsSync(testPath)) {
    console.log('✓ Test file exists');
    const testContent = fs.readFileSync(testPath, 'utf8');

    // Check if test imports all required schemas
    const requiredImports = [
      'MCPServerV050Schema',
      'MCPInstallationV050Schema',
      'MCPInstallProgressV050Schema',
      'MCPServerV050',
      'MCPInstallationV050',
      'MCPInstallProgressV050'
    ];

    requiredImports.forEach(importName => {
      if (testContent.includes(importName)) {
        console.log(`✓ Test imports: ${importName}`);
      } else {
        console.log(`✗ Test missing import: ${importName}`);
        allSchemasFound = false;
      }
    });
  } else {
    console.log('✗ Test file missing');
    allSchemasFound = false;
  }

  console.log('\n' + '='.repeat(50));
  if (allSchemasFound) {
    console.log('✅ MCP v0.5.0 SCHEMAS VERIFICATION PASSED');
    console.log('All required schemas, types, and tests are in place.');
    process.exit(0);
  } else {
    console.log('❌ MCP v0.5.0 SCHEMAS VERIFICATION FAILED');
    console.log('Some required components are missing.');
    process.exit(1);
  }

} catch (error) {
  console.error('Error during verification:', error.message);
  process.exit(1);
}