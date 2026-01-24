import { describe, it, expect } from 'vitest';

/**
 * Comprehensive test to verify all MCP-related Zod schemas and inferred types
 * are properly exported through the core package's index.ts chain.
 *
 * This test validates the acceptance criteria:
 * "All Zod schemas (MCPServerConfigSchema, MCPConnectionConfigSchema, MCPToolSchema,
 *  JsonRpcRequestSchema, MockMCPServerConfigSchema, etc.) and their inferred types
 *  are importable from '@apexcli/core'"
 */

// Test importing ALL MCP schemas and types from types.ts via main index
import {
  // MCP Connection & Configuration Schemas
  MCPConnectionConfigSchema,
  MCPConnectionConfig,
  MCPEnvironmentVarSchema,
  MCPEnvironmentVar,
  MCPServerConfigSchema,
  MCPServerConfig,
  MCPMarketplaceEntrySchema,
  MCPMarketplaceEntry,
  MCPMarketplaceSourceSchema,
  MCPMarketplaceSource,
  MCPMarketplaceSchema,
  MCPMarketplace,
  MCPToolsConfigSchema,
  MCPToolsConfig,
  MCPConfigSchema,
  MCPConfig,
  MCPTemplateSchema,
  MCPTemplate,
  MCPServerTemplateSchema,
  MCPServerSchema,
  MCPServer,
  MCPInstallationStatusSchema,
  MCPInstallationStatus,
  MCPInstallationSchema,
  MCPInstallation,
  InstalledMCPServerSchema,
  InstalledMCPServer,

  // MCP Registry Types
  MCPServerCategorySchema,
  MCPServerCategory,
  MCPRegistryServerSchema,
  MCPRegistryServer,
  MCPRegistryInstallConfigSchema,
  MCPRegistryInstallConfig,
  MCPRegistryInstallationSchema,
  MCPRegistryInstallation,
  MCPInstallStageSchema,
  MCPInstallStage,
  MCPInstallProgressSchema,
  MCPInstallProgress,

  // MCP Connection Management Types
  MCPConnectionStateSchema,
  MCPConnectionState,
  MCPConnectionInfoSchema,
  MCPConnectionInfo,
  MCPConnectionSchema,
  MCPConnectionEventTypeSchema,
  MCPConnectionEventType,
  MCPConnectionEventSchema,
  MCPConnectionEvent,

  // MCP Tool Types
  MCPToolSchemaSchema,
  MCPToolSchema as MCPToolSchemaType,
  MCPToolCapabilitiesSchema,
  MCPToolCapabilities,
  MCPToolSchema,
  MCPTool,
  MCPToolRegistryEntrySchema,
  MCPToolRegistryEntry,
  MCPToolInvocationRequestSchema,
  MCPToolInvocationRequest,
  MCPToolResultContentTypeSchema,
  MCPToolResultContentType,
  MCPToolResultContentSchema,
  MCPToolResultContent,
  MCPToolInvocationResponseSchema,
  MCPToolInvocationResponse,

  // v0.5.0 Feature Development Types
  MCPServerV050Schema,
  MCPServerV050,
  MCPInstallationV050Schema,
  MCPInstallationV050,
  MCPInstallProgressV050Schema,
  MCPInstallProgressV050,

  // Protocol Types (from mcp/protocol-types.ts)
  JsonRpcIdSchema,
  JsonRpcId,
  JsonRpcErrorSchema,
  JsonRpcError,
  JsonRpcRequestSchema,
  JsonRpcRequest,
  JsonRpcNotificationSchema,
  JsonRpcNotification,
  JsonRpcSuccessResponseSchema,
  JsonRpcSuccessResponse,
  JsonRpcErrorResponseSchema,
  JsonRpcErrorResponse,
  JsonRpcResponseSchema,
  JsonRpcResponse,
  MCPProtocolVersionSchema,
  MCPProtocolVersion,
  MCPServerCapabilitiesSchema,
  MCPServerCapabilities,
  MCPClientCapabilitiesSchema,
  MCPClientCapabilities,
  MCPImplementationInfoSchema,
  MCPImplementationInfo,
  MCPInitializeParamsSchema,
  MCPInitializeParams,
  MCPInitializeResultSchema,
  MCPInitializeResult,
  MCPInitializedNotificationParamsSchema,
  MCPInitializedNotificationParams,
  MCPProtocolToolInputSchemaSchema,
  MCPProtocolToolInputSchema,
  MCPProtocolToolDefinitionSchema,
  MCPProtocolToolDefinition,
  MCPToolsListParamsSchema,
  MCPToolsListParams,
  MCPToolsListResultSchema,
  MCPToolsListResult,
  MCPToolResultContentItemSchema,
  MCPToolResultContentItem,
  MCPToolsCallParamsSchema,
  MCPToolsCallParams,
  MCPToolsCallResultSchema,
  MCPToolsCallResult,
  MCPProtocolResourceDefinitionSchema,
  MCPProtocolResourceDefinition,
  MCPProtocolResourceTemplateSchema,
  MCPProtocolResourceTemplate,
  MCPResourcesListParamsSchema,
  MCPResourcesListParams,
  MCPResourcesListResultSchema,
  MCPResourcesListResult,
  MCPResourceContentSchema,
  MCPResourceContent,
  MCPResourcesReadParamsSchema,
  MCPResourcesReadParams,
  MCPResourcesReadResultSchema,
  MCPResourcesReadResult,
  MCPProtocolPromptArgumentSchema,
  MCPProtocolPromptArgument,
  MCPProtocolPromptDefinitionSchema,
  MCPProtocolPromptDefinition,
  MCPPromptsListParamsSchema,
  MCPPromptsListParams,
  MCPPromptsListResultSchema,
  MCPPromptsListResult,
  MCPPromptMessageRoleSchema,
  MCPPromptMessageRole,
  MCPPromptMessageContentSchema,
  MCPPromptMessageContent,
  MCPPromptMessageSchema,
  MCPPromptMessage,
  MCPPromptsGetParamsSchema,
  MCPPromptsGetParams,
  MCPPromptsGetResultSchema,
  MCPPromptsGetResult,
  MCPLogLevelSchema,
  MCPLogLevel,
  MCPLoggingSetLevelParamsSchema,
  MCPLoggingSetLevelParams,
  MCPLogMessageNotificationParamsSchema,
  MCPLogMessageNotificationParams,
  MCPCompletionReferenceSchema,
  MCPCompletionReference,
  MCPCompletionCompleteParamsSchema,
  MCPCompletionCompleteParams,
  MCPCompletionCompleteResultSchema,
  MCPCompletionCompleteResult,
  MCPProtocolMethod,
  MCPProtocolMethodName,
  MCPErrorCode,
  MCPErrorCodeValue,

  // Mock Types (from mcp/mock-types.ts)
  MockTransportTypeSchema,
  MockTransportType,
  MockHttpTransportConfigSchema,
  MockHttpTransportConfig,
  MockSseTransportConfigSchema,
  MockSseTransportConfig,
  MockStdioTransportConfigSchema,
  MockStdioTransportConfig,
  MockMCPServerConfigSchema,
  MockMCPServerConfig,
  MockResponseDelaySchema,
  MockResponseDelay,
  MockErrorInjectionSchema,
  MockErrorInjection,
  MockToolResultContentSchema,
  MockToolResultContent,
  MockToolHandlerSchema,
  MockToolHandler,
  MockNotificationTriggerConditionSchema,
  MockNotificationTriggerCondition,
  MockNotificationTriggerSchema,
  MockNotificationTrigger,
  MockStateTransitionSchema,
  MockStateTransition,
  MockStateBehaviorSchema,
  MockStateBehavior,
  MockStatefulBehaviorConfigSchema,
  MockStatefulBehaviorConfig,
  MockRequestMatcherSchema,
  MockRequestMatcher,
  MockResponseDefinitionSchema,
  MockResponseDefinition,
  MockRequestResponsePairSchema,
  MockRequestResponsePair,
  MockBehaviorConfigSchema,
  MockBehaviorConfig,
  MockScenarioSchema,
  MockScenario,
  MockMCPServerDefinitionSchema,
  MockMCPServerDefinition,
} from '../index.js';

describe('MCP Exports Comprehensive', () => {
  describe('Main types.ts MCP Schema Exports', () => {
    it('exports all MCP connection and configuration schemas', () => {
      // Connection & Environment
      expect(MCPConnectionConfigSchema).toBeDefined();
      expect(typeof MCPConnectionConfigSchema.parse).toBe('function');
      expect(MCPEnvironmentVarSchema).toBeDefined();
      expect(typeof MCPEnvironmentVarSchema.parse).toBe('function');

      // Server Configuration
      expect(MCPServerConfigSchema).toBeDefined();
      expect(typeof MCPServerConfigSchema.parse).toBe('function');
      expect(MCPConfigSchema).toBeDefined();
      expect(typeof MCPConfigSchema.parse).toBe('function');

      // Marketplace
      expect(MCPMarketplaceEntrySchema).toBeDefined();
      expect(MCPMarketplaceSourceSchema).toBeDefined();
      expect(MCPMarketplaceSchema).toBeDefined();

      // Tools Config
      expect(MCPToolsConfigSchema).toBeDefined();
      expect(typeof MCPToolsConfigSchema.parse).toBe('function');
    });

    it('exports all MCP template and server schemas', () => {
      expect(MCPTemplateSchema).toBeDefined();
      expect(typeof MCPTemplateSchema.parse).toBe('function');
      expect(MCPServerTemplateSchema).toBeDefined();
      expect(MCPServerSchema).toBeDefined();
      expect(typeof MCPServerSchema.parse).toBe('function');
    });

    it('exports all MCP installation schemas', () => {
      expect(MCPInstallationStatusSchema).toBeDefined();
      expect(typeof MCPInstallationStatusSchema.parse).toBe('function');
      expect(MCPInstallationSchema).toBeDefined();
      expect(typeof MCPInstallationSchema.parse).toBe('function');
      expect(InstalledMCPServerSchema).toBeDefined();
      expect(typeof InstalledMCPServerSchema.parse).toBe('function');
    });

    it('exports all MCP registry schemas', () => {
      expect(MCPServerCategorySchema).toBeDefined();
      expect(MCPRegistryServerSchema).toBeDefined();
      expect(MCPRegistryInstallConfigSchema).toBeDefined();
      expect(MCPRegistryInstallationSchema).toBeDefined();
      expect(MCPInstallStageSchema).toBeDefined();
      expect(MCPInstallProgressSchema).toBeDefined();
    });

    it('exports all MCP connection management schemas', () => {
      expect(MCPConnectionStateSchema).toBeDefined();
      expect(MCPConnectionInfoSchema).toBeDefined();
      expect(MCPConnectionSchema).toBeDefined();
      expect(MCPConnectionEventTypeSchema).toBeDefined();
      expect(MCPConnectionEventSchema).toBeDefined();
    });

    it('exports all MCP tool-related schemas', () => {
      expect(MCPToolSchemaSchema).toBeDefined();
      expect(MCPToolCapabilitiesSchema).toBeDefined();
      expect(MCPToolSchema).toBeDefined();
      expect(MCPToolRegistryEntrySchema).toBeDefined();
      expect(MCPToolInvocationRequestSchema).toBeDefined();
      expect(MCPToolResultContentTypeSchema).toBeDefined();
      expect(MCPToolResultContentSchema).toBeDefined();
      expect(MCPToolInvocationResponseSchema).toBeDefined();
    });

    it('exports all v0.5.0 feature development schemas', () => {
      expect(MCPServerV050Schema).toBeDefined();
      expect(MCPInstallationV050Schema).toBeDefined();
      expect(MCPInstallProgressV050Schema).toBeDefined();
    });
  });

  describe('Protocol types.ts Schema Exports', () => {
    it('exports all JSON-RPC schemas', () => {
      expect(JsonRpcIdSchema).toBeDefined();
      expect(JsonRpcErrorSchema).toBeDefined();
      expect(JsonRpcRequestSchema).toBeDefined();
      expect(JsonRpcNotificationSchema).toBeDefined();
      expect(JsonRpcSuccessResponseSchema).toBeDefined();
      expect(JsonRpcErrorResponseSchema).toBeDefined();
      expect(JsonRpcResponseSchema).toBeDefined();
    });

    it('exports all MCP protocol schemas', () => {
      expect(MCPProtocolVersionSchema).toBeDefined();
      expect(MCPServerCapabilitiesSchema).toBeDefined();
      expect(MCPClientCapabilitiesSchema).toBeDefined();
      expect(MCPImplementationInfoSchema).toBeDefined();
      expect(MCPInitializeParamsSchema).toBeDefined();
      expect(MCPInitializeResultSchema).toBeDefined();
      expect(MCPInitializedNotificationParamsSchema).toBeDefined();
    });

    it('exports all protocol constants', () => {
      expect(MCPProtocolMethod).toBeDefined();
      expect(typeof MCPProtocolMethod).toBe('object');
      expect(MCPErrorCode).toBeDefined();
      expect(typeof MCPErrorCode).toBe('object');
    });
  });

  describe('Mock types.ts Schema Exports', () => {
    it('exports all mock transport schemas', () => {
      expect(MockTransportTypeSchema).toBeDefined();
      expect(MockHttpTransportConfigSchema).toBeDefined();
      expect(MockSseTransportConfigSchema).toBeDefined();
      expect(MockStdioTransportConfigSchema).toBeDefined();
    });

    it('exports all mock server configuration schemas', () => {
      expect(MockMCPServerConfigSchema).toBeDefined();
      expect(typeof MockMCPServerConfigSchema.parse).toBe('function');
      expect(MockResponseDelaySchema).toBeDefined();
      expect(MockErrorInjectionSchema).toBeDefined();
      expect(MockBehaviorConfigSchema).toBeDefined();
    });

    it('exports all mock scenario and testing schemas', () => {
      expect(MockRequestResponsePairSchema).toBeDefined();
      expect(MockScenarioSchema).toBeDefined();
      expect(MockMCPServerDefinitionSchema).toBeDefined();
      expect(typeof MockMCPServerDefinitionSchema.parse).toBe('function');
    });
  });

  describe('Inferred Type Exports', () => {
    it('exports all MCP configuration types', () => {
      // Test that the types can be used in type annotations
      const testConfig: MCPConfig = {
        servers: {},
      };
      const testConnectionConfig: MCPConnectionConfig = {
        transport: 'stdio',
        command: 'node',
        args: ['--test'],
      };
      const testServerConfig: MCPServerConfig = {
        command: 'node',
        args: ['--server'],
      };

      expect(testConfig).toBeDefined();
      expect(testConnectionConfig).toBeDefined();
      expect(testServerConfig).toBeDefined();
    });

    it('exports all protocol message types', () => {
      const testRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'test',
        method: 'initialize',
      };

      const testInitParams: MCPInitializeParams = {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      };

      const testToolCall: MCPToolsCallParams = {
        name: 'test-tool',
      };

      expect(testRequest).toBeDefined();
      expect(testInitParams).toBeDefined();
      expect(testToolCall).toBeDefined();
    });

    it('exports all mock server types', () => {
      const testMockConfig: MockMCPServerConfig = {
        name: 'test-mock',
        transport: 'stdio',
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'test-server', version: '1.0.0' },
      };

      const testMockBehavior: MockBehaviorConfig = {
        recordRequests: true,
        maxRecordedRequests: 100,
      };

      expect(testMockConfig).toBeDefined();
      expect(testMockBehavior).toBeDefined();
    });
  });

  describe('Schema Functionality', () => {
    it('validates that all exported schemas work correctly', () => {
      // Test JSON-RPC schemas
      const validRequest = {
        jsonrpc: '2.0' as const,
        id: 'test-123',
        method: 'test-method',
      };
      expect(() => JsonRpcRequestSchema.parse(validRequest)).not.toThrow();

      // Test MCP config schemas
      const validServerConfig = {
        command: 'node',
        args: ['--test'],
      };
      expect(() => MCPServerConfigSchema.parse(validServerConfig)).not.toThrow();

      // Test MCP tool schema
      const validToolSchema = {
        type: 'object' as const,
        properties: { param: { type: 'string' } },
        required: ['param'],
      };
      expect(() => MCPToolSchemaSchema.parse(validToolSchema)).not.toThrow();

      // Test mock server config
      const validMockConfig = {
        name: 'test-server',
        transport: 'stdio' as const,
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'test', version: '1.0.0' },
      };
      expect(() => MockMCPServerConfigSchema.parse(validMockConfig)).not.toThrow();
    });

    it('properly rejects invalid data in schemas', () => {
      // Test invalid JSON-RPC request
      const invalidRequest = {
        jsonrpc: '1.0', // Wrong version
        id: 'test',
        method: 'test',
      };
      expect(() => JsonRpcRequestSchema.parse(invalidRequest)).toThrow();

      // Test invalid MCP server config
      const invalidServerConfig = {
        // Missing required command
        args: ['--test'],
      };
      expect(() => MCPServerConfigSchema.parse(invalidServerConfig)).toThrow();

      // Test invalid mock config
      const invalidMockConfig = {
        // Missing required name
        transport: 'stdio',
        protocolVersion: '2024-11-05',
      };
      expect(() => MockMCPServerConfigSchema.parse(invalidMockConfig)).toThrow();
    });
  });

  describe('Complete Export Coverage', () => {
    it('ensures no MCP schemas are missing from exports', () => {
      // This test verifies that all the schemas we expect are actually exported
      // If any schema is missing, the imports at the top of this file will fail
      expect(true).toBe(true); // If we reach this point, all imports succeeded
    });

    it('validates import paths work correctly', () => {
      // Verify that schemas can be imported from the main package entry point
      // and that they function as expected
      expect(typeof MCPServerConfigSchema.parse).toBe('function');
      expect(typeof JsonRpcRequestSchema.parse).toBe('function');
      expect(typeof MockMCPServerConfigSchema.parse).toBe('function');
    });
  });
});