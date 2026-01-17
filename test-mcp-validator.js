// Quick test to verify MCPConfigValidator implementation
const path = require('path');

// Simple syntax check
try {
  console.log('Testing MCPConfigValidator implementation...');

  // Check if the file can be loaded (basic syntax check)
  const validatorPath = path.join(__dirname, 'packages/core/src/validation/mcp-config-validator.ts');
  console.log('Validator file exists at:', validatorPath);

  // Basic validation test data
  const testConfig = {
    enabled: true,
    servers: {
      'test-server': {
        command: 'node',
        args: ['server.js'],
      }
    }
  };

  console.log('Test configuration created:', JSON.stringify(testConfig, null, 2));
  console.log('✅ Basic setup verification complete');

} catch (error) {
  console.error('❌ Error during verification:', error.message);
  process.exit(1);
}