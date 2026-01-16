// Simple test to check if MCP type imports are working
try {
  const types = require('./packages/core/dist/types.js');

  console.log('Testing MCPTool types...');
  console.log('MCPToolSchema available:', !!types.MCPToolSchema);
  console.log('MCPToolSchemaSchema available:', !!types.MCPToolSchemaSchema);
  console.log('MCPToolCapabilitiesSchema available:', !!types.MCPToolCapabilitiesSchema);
  console.log('MCPToolRegistryEntrySchema available:', !!types.MCPToolRegistryEntrySchema);
  console.log('UnifiedToolRegistryEntrySchema available:', !!types.UnifiedToolRegistryEntrySchema);
  console.log('ToolRegistryStateSchema available:', !!types.ToolRegistryStateSchema);
  console.log('MCPToolInvocationRequestSchema available:', !!types.MCPToolInvocationRequestSchema);
  console.log('MCPToolInvocationResponseSchema available:', !!types.MCPToolInvocationResponseSchema);

  console.log('\nAll MCP tool types are available!');
} catch (error) {
  console.error('Error importing types:', error.message);
  console.log('Build the core package first: npm run build --workspace=@apex/core');
}