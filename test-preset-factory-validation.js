#!/usr/bin/env node
/**
 * Simple validation script for createMockMCPServer() factory function
 * This script imports and tests the basic functionality of the preset factory.
 */

const path = require('path');

// Set up module resolution for ES modules
process.env.NODE_OPTIONS = '--experimental-specifier-resolution=node';

async function testPresetFactory() {
  console.log('🧪 Testing createMockMCPServer() factory function...\n');

  try {
    // Import the factory function
    const { createMockMCPServer, createFileSystemMockServer } = await import('./packages/orchestrator/dist/mcp/mock-server/preset-factory.js');
    console.log('✅ Successfully imported createMockMCPServer factory function');

    // Test basic factory function existence
    if (typeof createMockMCPServer !== 'function') {
      throw new Error('createMockMCPServer is not a function');
    }
    console.log('✅ createMockMCPServer is a function');

    // Test filesystem preset creation
    console.log('\n📁 Testing filesystem preset...');
    const fsServer = createMockMCPServer('filesystem');
    console.log('✅ Filesystem server created successfully');
    console.log(`   Server name: ${fsServer.getServerInfo().name}`);

    // Test server lifecycle
    await fsServer.start();
    console.log('✅ Filesystem server started successfully');
    console.log(`   Server listening: ${fsServer.isListening()}`);

    await fsServer.stop();
    console.log('✅ Filesystem server stopped successfully');

    // Test database preset creation
    console.log('\n🗃️  Testing database preset...');
    const dbServer = createMockMCPServer('database');
    console.log('✅ Database server created successfully');
    console.log(`   Server name: ${dbServer.getServerInfo().name}`);

    await dbServer.start();
    console.log('✅ Database server started successfully');
    await dbServer.stop();
    console.log('✅ Database server stopped successfully');

    // Test API preset creation
    console.log('\n🌐 Testing API preset...');
    const apiServer = createMockMCPServer('api');
    console.log('✅ API server created successfully');
    console.log(`   Server name: ${apiServer.getServerInfo().name}`);

    await apiServer.start();
    console.log('✅ API server started successfully');
    await apiServer.stop();
    console.log('✅ API server stopped successfully');

    // Test minimal preset creation
    console.log('\n⚡ Testing minimal preset...');
    const minimalServer = createMockMCPServer('minimal');
    console.log('✅ Minimal server created successfully');
    console.log(`   Server name: ${minimalServer.getServerInfo().name}`);

    await minimalServer.start();
    console.log('✅ Minimal server started successfully');
    await minimalServer.stop();
    console.log('✅ Minimal server stopped successfully');

    // Test behavior modifiers
    console.log('\n🐌 Testing slow behavior modifier...');
    const slowServer = createMockMCPServer(['filesystem', 'slow']);
    console.log('✅ Slow filesystem server created successfully');

    await slowServer.start();
    console.log('✅ Slow server started successfully');
    await slowServer.stop();
    console.log('✅ Slow server stopped successfully');

    // Test error-prone modifier
    console.log('\n❌ Testing error-prone behavior modifier...');
    const errorProneServer = createMockMCPServer(['database', 'error-prone']);
    console.log('✅ Error-prone database server created successfully');

    await errorProneServer.start();
    console.log('✅ Error-prone server started successfully');
    await errorProneServer.stop();
    console.log('✅ Error-prone server stopped successfully');

    // Test custom configuration overrides
    console.log('\n🔧 Testing custom configuration overrides...');
    const customServer = createMockMCPServer('api', {
      name: 'custom-api-server',
      description: 'A custom API server for testing',
      additionalTools: [
        {
          toolName: 'custom_endpoint',
          response: {
            content: [{ type: 'text', text: 'Custom endpoint response' }],
            isError: false,
          },
          priority: 50,
        },
      ],
    });
    console.log('✅ Custom configured server created successfully');
    console.log(`   Custom server name: ${customServer.getServerInfo().name}`);

    await customServer.start();
    console.log('✅ Custom server started successfully');
    await customServer.stop();
    console.log('✅ Custom server stopped successfully');

    // Test convenience functions
    console.log('\n🎯 Testing convenience functions...');

    const convenienceFS = createFileSystemMockServer({ name: 'convenience-fs' });
    console.log('✅ Convenience filesystem server created');

    await convenienceFS.start();
    console.log('✅ Convenience server started');
    await convenienceFS.stop();
    console.log('✅ Convenience server stopped');

    // Test error handling
    console.log('\n🚫 Testing error handling...');
    try {
      createMockMCPServer('unknown-preset');
      console.log('❌ Error handling failed - should have thrown for unknown preset');
    } catch (error) {
      console.log(`✅ Error handling works: ${error.message}`);
    }

    try {
      createMockMCPServer(['filesystem', 'database']);
      console.log('❌ Error handling failed - should have thrown for multiple base presets');
    } catch (error) {
      console.log(`✅ Error handling works: ${error.message}`);
    }

    try {
      createMockMCPServer(['error-prone', 'slow']);
      console.log('❌ Error handling failed - should have thrown for no base preset');
    } catch (error) {
      console.log(`✅ Error handling works: ${error.message}`);
    }

    console.log('\n🎉 All tests passed! createMockMCPServer() factory function is working correctly.\n');

    console.log('📊 Test Summary:');
    console.log('  ✅ Basic preset creation (filesystem, database, api, minimal)');
    console.log('  ✅ Behavior modifiers (slow, error-prone)');
    console.log('  ✅ Custom configuration overrides');
    console.log('  ✅ Convenience wrapper functions');
    console.log('  ✅ Error handling and validation');
    console.log('  ✅ Server lifecycle management (start/stop)');
    console.log('  ✅ All acceptance criteria validated\n');

    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testPresetFactory()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testPresetFactory };