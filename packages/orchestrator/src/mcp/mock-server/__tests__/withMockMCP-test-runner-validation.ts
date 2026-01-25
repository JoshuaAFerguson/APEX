/**
 * @fileoverview Test Runner Validation for withMockMCP()
 *
 * This script validates the withMockMCP() implementation by running basic
 * functionality tests to ensure the wrapper function is working correctly.
 */

import { withMockMCP, withMockMCPFacade } from '../with-mock-mcp.js';

async function validateBasicFunctionality(): Promise<boolean> {
  console.log('🧪 Validating withMockMCP() basic functionality...');

  try {
    // Test 1: Basic server lifecycle
    await withMockMCP(
      builder => builder
        .withName('validation-server')
        .withTool('test_tool')
        .withStaticResponse([{ type: 'text', text: 'validation response' }]),
      async (server) => {
        if (!server.isListening()) {
          throw new Error('Server should be listening');
        }
        if (server.getName() !== 'validation-server') {
          throw new Error('Server name mismatch');
        }
      }
    );
    console.log('✅ Basic server lifecycle - PASS');

    // Test 2: Cleanup on failure
    let capturedServer: any = null;
    try {
      await withMockMCP(
        builder => builder.withName('failure-test').withTool('test').withStaticResponse([]),
        async (server) => {
          capturedServer = server;
          throw new Error('Intentional failure');
        }
      );
    } catch (error) {
      if (!capturedServer || capturedServer.isListening()) {
        throw new Error('Server should be cleaned up after failure');
      }
    }
    console.log('✅ Cleanup on failure - PASS');

    // Test 3: Facade functionality
    await withMockMCPFacade(
      builder => builder.withName('facade-test').withTool('test').withStaticResponse([]),
      async (facade) => {
        if (!facade.isListening()) {
          throw new Error('Facade should be listening');
        }
        const transport = facade.getTransport();
        if (!transport) {
          throw new Error('Facade should provide transport');
        }
      }
    );
    console.log('✅ Facade functionality - PASS');

    // Test 4: Options handling
    await withMockMCP(
      builder => builder.withName('options-test').withTool('test').withStaticResponse([]),
      async (server) => {
        if (server.isListening()) {
          throw new Error('Server should not be listening with autoStart: false');
        }
      },
      { autoStart: false }
    );
    console.log('✅ Options handling - PASS');

    return true;
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

async function validateAcceptanceCriteria(): Promise<boolean> {
  console.log('📋 Validating acceptance criteria...');

  try {
    // Requirement 1: Wrapper function handles server lifecycle
    let lifecycleTest = false;
    await withMockMCP(
      builder => builder.withName('lifecycle').withTool('test').withStaticResponse([]),
      async (server) => {
        lifecycleTest = server.isListening();
      }
    );
    if (!lifecycleTest) throw new Error('Lifecycle management failed');
    console.log('✅ Requirement 1: Server lifecycle handling - PASS');

    // Requirement 2: Provides server instance to test callback
    let instanceTest = false;
    await withMockMCP(
      builder => builder.withName('instance').withTool('test').withStaticResponse([]),
      async (server) => {
        instanceTest = typeof server.createClientTransport === 'function';
      }
    );
    if (!instanceTest) throw new Error('Server instance provision failed');
    console.log('✅ Requirement 2: Server instance provision - PASS');

    // Requirement 3: Works with async tests
    let asyncTest = false;
    await withMockMCP(
      builder => builder.withName('async').withTool('test').withStaticResponse([]),
      async (server) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncTest = true;
      }
    );
    if (!asyncTest) throw new Error('Async test support failed');
    console.log('✅ Requirement 3: Async test support - PASS');

    // Requirement 4: Cleanup happens even on test failure
    let cleanupTest = null;
    try {
      await withMockMCP(
        builder => builder.withName('cleanup').withTool('test').withStaticResponse([]),
        async (server) => {
          cleanupTest = server;
          throw new Error('Test failure');
        }
      );
    } catch (error) {
      if (!cleanupTest || cleanupTest.isListening()) {
        throw new Error('Cleanup on failure failed');
      }
    }
    console.log('✅ Requirement 4: Cleanup on failure - PASS');

    return true;
  } catch (error) {
    console.error('❌ Acceptance criteria validation failed:', error);
    return false;
  }
}

// Export for potential external usage
export async function runWithMockMCPValidation(): Promise<void> {
  console.log('🚀 Starting withMockMCP() validation suite...\n');

  const basicTests = await validateBasicFunctionality();
  console.log('');

  const acceptanceTests = await validateAcceptanceCriteria();
  console.log('');

  if (basicTests && acceptanceTests) {
    console.log('🎉 ALL VALIDATIONS PASSED - withMockMCP() is working correctly!');
  } else {
    console.log('💥 VALIDATION FAILED - withMockMCP() has issues that need to be addressed.');
    throw new Error('withMockMCP() validation failed');
  }
}

// Run validation if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWithMockMCPValidation().catch(error => {
    console.error('Validation suite failed:', error);
    process.exit(1);
  });
}