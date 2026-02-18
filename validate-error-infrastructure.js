#!/usr/bin/env node

/**
 * Validation script for MockMCPServer error simulation infrastructure.
 * Tests that all the components are available and working correctly.
 */

console.log('🔍 Validating MockMCPServer error simulation infrastructure...\n');

let successCount = 0;
let errorCount = 0;

function validateStep(description, testFn) {
  try {
    testFn();
    console.log(`✅ ${description}`);
    successCount++;
  } catch (error) {
    console.log(`❌ ${description} - ${error.message}`);
    errorCount++;
  }
}

// Test 1: Core type imports from @apexcli/core
validateStep('Core error types available from @apexcli/core', () => {
  const core = require('./packages/core/dist/index.js');

  // Check that error simulation types are available
  const hasErrorTypes = [
    'MockErrorModeSchema',
    'MockErrorCategorySchema',
    'MockErrorScenarioPresetSchema',
    'MockErrorSimulationConfigSchema'
  ].every(type => core[type] !== undefined);

  if (!hasErrorTypes) {
    throw new Error('Missing error simulation types in core exports');
  }
});

// Test 2: MockMCPServer class available
validateStep('MockMCPServer class available', () => {
  const { MockMCPServer } = require('./packages/orchestrator/dist/mcp/mock-server/mock-mcp-server.js');
  if (typeof MockMCPServer !== 'function') {
    throw new Error('MockMCPServer is not a constructor function');
  }
});

// Test 3: MockMCPServer has error simulation methods
validateStep('MockMCPServer has error simulation API', () => {
  const { MockMCPServer } = require('./packages/orchestrator/dist/mcp/mock-server/mock-mcp-server.js');

  const testConfig = {
    serverConfig: {
      name: 'test-server',
      transport: 'stdio',
      capabilities: {},
    },
    defaultBehavior: {},
    scenarios: [],
  };

  const server = new MockMCPServer(testConfig);

  // Check that error simulation methods exist
  if (typeof server.setErrorMode !== 'function') {
    throw new Error('setErrorMode method not found');
  }
  if (typeof server.clearErrorMode !== 'function') {
    throw new Error('clearErrorMode method not found');
  }
  if (typeof server.getErrorMode !== 'function') {
    throw new Error('getErrorMode method not found');
  }
  if (typeof server.getErrorSimulationState !== 'function') {
    throw new Error('getErrorSimulationState method not found');
  }
  if (typeof server.applyErrorPreset !== 'function') {
    throw new Error('applyErrorPreset method not found');
  }
});

// Test 4: Error presets available (if error-presets.js exists in dist)
validateStep('Error presets infrastructure available', () => {
  let presets;

  try {
    // Try to load from the mock-server index
    const mockServer = require('./packages/orchestrator/dist/mcp/mock-server/index.js');
    presets = mockServer.ERROR_SIMULATION_PRESETS ||
              mockServer.getErrorPreset ||
              mockServer.getAvailablePresets;
  } catch (e) {
    // If that fails, check if we can require error-presets directly
    try {
      presets = require('./packages/orchestrator/dist/mcp/mock-server/error-presets.js');
    } catch (e2) {
      throw new Error(`Error presets not built yet - this is expected if build hasn't run: ${e2.message}`);
    }
  }

  if (!presets) {
    throw new Error('Error presets module structure not found');
  }
});

// Test 5: MockMCPServer can be configured with error mode
validateStep('MockMCPServer can be configured with error mode', () => {
  const { MockMCPServer } = require('./packages/orchestrator/dist/mcp/mock-server/mock-mcp-server.js');

  const testConfig = {
    serverConfig: {
      name: 'test-server',
      transport: 'stdio',
      capabilities: {},
    },
    defaultBehavior: {},
    scenarios: [],
  };

  const server = new MockMCPServer(testConfig);

  // Test setting a simple error mode
  server.setErrorMode({
    mode: 'always_fail',
    category: 'jsonrpc',
    customError: {
      code: -32603,
      message: 'Test error'
    }
  });

  const errorMode = server.getErrorMode();
  if (!errorMode || errorMode.mode !== 'always_fail') {
    throw new Error('Error mode not set correctly');
  }

  // Test clearing error mode
  server.clearErrorMode();
  const clearedMode = server.getErrorMode();
  if (clearedMode !== undefined) {
    throw new Error('Error mode not cleared correctly');
  }
});

// Test 6: Error simulation state tracking
validateStep('Error simulation state tracking works', () => {
  const { MockMCPServer } = require('./packages/orchestrator/dist/mcp/mock-server/mock-mcp-server.js');

  const testConfig = {
    serverConfig: {
      name: 'test-server',
      transport: 'stdio',
      capabilities: {},
    },
    defaultBehavior: {},
    scenarios: [],
  };

  const server = new MockMCPServer(testConfig);

  const initialState = server.getErrorSimulationState();
  if (typeof initialState.requestCount !== 'number' ||
      typeof initialState.errorCount !== 'number' ||
      typeof initialState.successCount !== 'number') {
    throw new Error('Error simulation state structure incorrect');
  }
});

console.log('\n📊 Validation Summary:');
console.log(`   ✅ Passed: ${successCount}`);
console.log(`   ❌ Failed: ${errorCount}`);
console.log(`   📋 Total:  ${successCount + errorCount}`);

if (errorCount === 0) {
  console.log('\n🎉 All validation tests passed! MockMCPServer error simulation infrastructure is ready.');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${errorCount} validation tests failed. Some components may need to be built or fixed.`);
  process.exit(1);
}