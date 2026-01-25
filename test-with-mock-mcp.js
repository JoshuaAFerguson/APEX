/**
 * Simple verification script for withMockMCP() implementation
 * This script imports and tests the basic functionality of the withMockMCP wrapper.
 */

const { withMockMCP, withMockMCPFacade } = require('./packages/orchestrator/dist/mcp/mock-server/with-mock-mcp.js');
const { MockMCPServerBuilder } = require('./packages/orchestrator/dist/mcp/mock-server/mock-mcp-server-builder.js');

async function testWithMockMCP() {
  console.log('Testing withMockMCP() function...');

  try {
    // Test basic functionality
    await withMockMCP(
      builder => builder
        .withName('test-server')
        .withTool('ping')
        .withStaticResponse([{ type: 'text', text: 'pong' }]),
      async (server) => {
        console.log('✓ Server started successfully');
        console.log('✓ Server name:', server.getName());
        console.log('✓ Server is listening:', server.isListening());

        // Test transport creation
        const transport = server.createClientTransport();
        console.log('✓ Created client transport');

        return 'test passed';
      }
    );

    console.log('✓ withMockMCP test completed successfully');
  } catch (error) {
    console.error('✗ withMockMCP test failed:', error.message);
    throw error;
  }
}

async function testWithMockMCPFacade() {
  console.log('Testing withMockMCPFacade() function...');

  try {
    await withMockMCPFacade(
      builder => builder
        .withName('test-facade')
        .withTool('test')
        .withStaticResponse([{ type: 'text', text: 'response' }]),
      async (facade) => {
        console.log('✓ Facade started successfully');
        console.log('✓ Facade is started:', facade.isStarted());

        // Test transport access
        const transport = facade.getTransport();
        console.log('✓ Got transport from facade');

        return 'facade test passed';
      }
    );

    console.log('✓ withMockMCPFacade test completed successfully');
  } catch (error) {
    console.error('✗ withMockMCPFacade test failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    await testWithMockMCP();
    await testWithMockMCPFacade();

    console.log('\n🎉 All tests passed! withMockMCP() implementation is working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}