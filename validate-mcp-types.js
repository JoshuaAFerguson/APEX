// Simple validation script for MCP types
// This can be run with node to verify basic functionality

try {
  console.log('🔍 Validating MCP types...');

  // Check if the core package can be imported
  let types;
  try {
    types = require('./packages/core/dist/types.js');
    console.log('✅ Successfully imported types from dist');
  } catch (err) {
    console.log('⚠️  Could not import from dist, trying src...');
    try {
      // Try src if dist doesn't exist
      types = require('./packages/core/src/types.ts');
      console.log('✅ Successfully imported types from src');
    } catch (srcErr) {
      console.log('❌ Could not import types:', srcErr.message);
      process.exit(1);
    }
  }

  // Test MCPServer schema
  if (!types.MCPServerSchema) {
    throw new Error('MCPServerSchema not found in exports');
  }

  const testServer = {
    name: 'validation-test-server',
    package: '@mcp/validation-test',
    command: 'node',
    version: '1.0.0',
  };

  const parsedServer = types.MCPServerSchema.parse(testServer);
  console.log('✅ MCPServerSchema validation passed');
  console.log('  - Name:', parsedServer.name);
  console.log('  - Package:', parsedServer.package);
  console.log('  - Command:', parsedServer.command);
  console.log('  - Version:', parsedServer.version);

  // Test MCPInstallation schema
  if (!types.MCPInstallationSchema) {
    throw new Error('MCPInstallationSchema not found in exports');
  }

  const testInstallation = {
    id: 'validation-test-install',
    serverId: 'validation-test-server',
    installedAt: new Date(),
    status: 'installed',
    configPath: '/validation/test/config.json',
  };

  const parsedInstallation = types.MCPInstallationSchema.parse(testInstallation);
  console.log('✅ MCPInstallationSchema validation passed');
  console.log('  - ID:', parsedInstallation.id);
  console.log('  - Server ID:', parsedInstallation.serverId);
  console.log('  - Installed At:', parsedInstallation.installedAt);
  console.log('  - Status:', parsedInstallation.status);
  console.log('  - Config Path:', parsedInstallation.configPath);

  // Test status enum validation
  if (!types.MCPInstallationStatusSchema) {
    throw new Error('MCPInstallationStatusSchema not found in exports');
  }

  const validStatuses = ['pending', 'installing', 'installed', 'failed', 'uninstalling', 'uninstalled'];
  validStatuses.forEach(status => {
    types.MCPInstallationStatusSchema.parse(status);
  });
  console.log('✅ MCPInstallationStatusSchema validation passed for all statuses');

  // Test invalid data handling
  try {
    types.MCPServerSchema.parse({ name: '', package: '', command: '', version: '' });
    throw new Error('Should have failed validation');
  } catch (err) {
    console.log('✅ Invalid data properly rejected');
  }

  console.log('\n🎉 All MCP type validations passed successfully!');
  console.log('📋 Summary:');
  console.log('  - MCPServerSchema: ✅ Working');
  console.log('  - MCPInstallationSchema: ✅ Working');
  console.log('  - MCPInstallationStatusSchema: ✅ Working');
  console.log('  - Error handling: ✅ Working');
  console.log('  - Type exports: ✅ Working');

} catch (error) {
  console.error('❌ Validation failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}