#!/usr/bin/env node
/**
 * Quick validation script to test MCP exports from the core package
 */

// Test if we can import from the core package index
try {
  const corePackage = require('./packages/core/dist/index.js');

  // List of schemas that should be exported according to acceptance criteria
  const expectedSchemas = [
    'MCPServerConfigSchema',
    'MCPConnectionConfigSchema',
    'MCPToolSchema',
    'JsonRpcRequestSchema',
    'MockMCPServerConfigSchema',
    'MCPConfigSchema',
    'MCPEnvironmentVarSchema',
    'MCPServerSchema',
    'MCPInstallationSchema',
    'MCPInstallationStatusSchema',
    'MCPTemplateSchema',
    'MCPConnectionInfoSchema',
    'MCPConnectionStateSchema',
    'MCPConnectionEventSchema',
    'MCPProtocolVersionSchema',
    'MCPServerCapabilitiesSchema',
    'MCPInitializeParamsSchema',
    'MCPToolsCallParamsSchema',
    'MCPLogLevelSchema',
    'MockMCPServerDefinitionSchema',
  ];

  console.log('Testing MCP schema exports...');

  let missing = [];
  let found = [];

  for (const schema of expectedSchemas) {
    if (corePackage[schema]) {
      found.push(schema);
      // Test that it has parse method
      if (typeof corePackage[schema].parse === 'function') {
        console.log(`✓ ${schema} - exported with parse method`);
      } else {
        console.log(`⚠ ${schema} - exported but no parse method`);
      }
    } else {
      missing.push(schema);
      console.log(`✗ ${schema} - not found`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`Found: ${found.length}/${expectedSchemas.length}`);
  console.log(`Missing: ${missing.length}`);

  if (missing.length > 0) {
    console.log(`Missing schemas: ${missing.join(', ')}`);
    process.exit(1);
  } else {
    console.log('All expected schemas are exported! ✓');
  }

} catch (error) {
  console.error('Error testing exports:', error.message);
  process.exit(1);
}