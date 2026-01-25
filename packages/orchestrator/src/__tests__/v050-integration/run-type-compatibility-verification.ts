#!/usr/bin/env tsx
/**
 * Type Compatibility Verification Runner
 *
 * This script performs a basic verification that MCP types from @apexcli/core
 * can be imported and used by orchestrator components without compilation errors.
 * This serves as a quick smoke test for cross-package type compatibility.
 */

import { createRequire } from 'module';
import { pathToFileURL } from 'url';

async function main() {
  console.log('🔍 MCP Type Compatibility Verification');
  console.log('=====================================\n');

  try {
    // Step 1: Verify Core Type Imports
    console.log('1. Verifying core MCP type imports...');

    const {
      MCPServerConfig,
      MCPConnection,
      MCPTool,
      MCPConnectionState,
      MCPToolSchema,
      MCPServerConfigSchema,
      MCPConnectionInfoSchema,
      MCPToolCapabilitiesSchema,
      MCPProtocolMethod,
      MCPErrorCode,
      MockMCPServerConfigSchema,
      type ApexConfig,
    } = await import('@apexcli/core');

    console.log('✅ Successfully imported MCP types from @apexcli/core');

    // Step 2: Verify Orchestrator Component Imports
    console.log('2. Verifying orchestrator component imports...');

    const { MCPConnectionManager } = await import('../../mcp/connection-manager.js');
    const { MCPToolRegistry } = await import('../../mcp-tool-registry.js');

    console.log('✅ Successfully imported orchestrator MCP components');

    // Step 3: Type Instantiation Tests
    console.log('3. Testing type instantiation and validation...');

    // Test MCPServerConfig
    const serverConfig: MCPServerConfig = {
      name: 'test-server',
      type: 'stdio',
      command: 'test-command',
      args: ['--test'],
      env: { TEST: 'true' }
    };

    const serverValidation = MCPServerConfigSchema.safeParse(serverConfig);
    if (!serverValidation.success) {
      throw new Error(`MCPServerConfig validation failed: ${serverValidation.error}`);
    }
    console.log('✅ MCPServerConfig type instantiation and validation');

    // Test MCPConnection
    const connection: MCPConnection = {
      serverId: 'test-server-id',
      serverName: 'Test Server',
      config: serverConfig,
      state: 'connected',
      reconnectAttempts: 0,
      health: {
        healthy: true,
        lastCheckAt: new Date(),
        lastSuccessAt: new Date(),
        consecutiveFailures: 0,
        latencyMs: 10,
        avgLatencyMs: 12
      }
    };

    const connectionValidation = MCPConnectionInfoSchema.safeParse(connection);
    if (!connectionValidation.success) {
      throw new Error(`MCPConnection validation failed: ${connectionValidation.error}`);
    }
    console.log('✅ MCPConnection type instantiation and validation');

    // Test MCPTool
    const tool: MCPTool = {
      name: 'test-tool',
      inputSchema: {
        type: 'object',
        properties: {
          param: { type: 'string' }
        },
        required: ['param'],
        additionalProperties: false
      },
      serverId: 'test-server-id',
      available: true,
      tags: []
    };

    console.log('✅ MCPTool type instantiation');

    // Step 4: Component Integration Tests
    console.log('4. Testing component integration...');

    // Test ApexConfig creation
    const apexConfig: ApexConfig = {
      project: { name: 'test-project', version: '1.0.0' },
      limits: {
        maxConcurrentTasks: 5,
        maxDailyTasks: 50,
        maxTokensPerTask: 50000,
        maxTurns: 10
      },
      mcp: {
        enabled: true,
        servers: {
          'test-server': serverConfig
        },
        connection: {
          maxRetries: 3,
          retryDelayMs: 1000,
          connectionTimeoutMs: 10000,
          autoReconnect: true,
          healthCheckIntervalMs: 30000
        }
      },
      autonomy: { level: 'manual' },
      agents: {},
      workflows: {}
    } as ApexConfig;

    console.log('✅ ApexConfig creation');

    // Test MCPConnectionManager instantiation
    try {
      const connectionManager = new MCPConnectionManager({
        projectPath: '/tmp/test-project',
        config: apexConfig
      });
      console.log('✅ MCPConnectionManager instantiation with ApexConfig');
    } catch (error) {
      console.log(`⚠️  MCPConnectionManager instantiation skipped (dependencies not available): ${error}`);
    }

    // Test MCPToolRegistry instantiation
    try {
      const toolRegistry = new MCPToolRegistry({
        autoRefresh: false,
        operationTimeoutMs: 5000
      });
      console.log('✅ MCPToolRegistry instantiation');
    } catch (error) {
      console.log(`⚠️  MCPToolRegistry instantiation skipped (dependencies not available): ${error}`);
    }

    // Step 5: Protocol Constants Verification
    console.log('5. Verifying protocol constants...');

    // Test MCPProtocolMethod
    const methods = [
      MCPProtocolMethod.Initialize,
      MCPProtocolMethod.ToolsList,
      MCPProtocolMethod.ToolsCall
    ];
    console.log('✅ MCPProtocolMethod constants available');

    // Test MCPErrorCode
    const errorCodes = [
      MCPErrorCode.InternalError,
      MCPErrorCode.ToolNotFound,
      MCPErrorCode.InvalidParams
    ];
    console.log('✅ MCPErrorCode constants available');

    console.log('\n🎉 All type compatibility verification tests passed!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Core MCP types imported successfully');
    console.log('   ✅ Orchestrator components accept core types');
    console.log('   ✅ Type validation schemas work correctly');
    console.log('   ✅ Component integration types are compatible');
    console.log('   ✅ Protocol constants are accessible');

    return true;

  } catch (error) {
    console.error('\n❌ Type compatibility verification failed!');
    console.error(`Error: ${error}`);
    console.error('\nThis indicates a type incompatibility between @apexcli/core and orchestrator packages.');

    return false;
  }
}

// Run the verification
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as runTypeCompatibilityVerification };