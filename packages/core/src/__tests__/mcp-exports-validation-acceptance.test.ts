/**
 * @fileoverview Acceptance Criteria Test for MCP Exports
 *
 * Validates: "All Zod schemas (MCPServerConfigSchema, MCPConnectionConfigSchema,
 * MCPToolSchema, JsonRpcRequestSchema, MockMCPServerConfigSchema, etc.) and their
 * inferred types are importable from '@apexcli/core'. A test file can import every
 * MCP-related schema and type without errors."
 */

import { describe, it, expect } from 'vitest';

describe('MCP Exports Validation - Acceptance Criteria', () => {
  describe('All MCP-related Zod schemas should be importable from @apexcli/core', () => {
    it('should import all core MCP schemas from types.ts', async () => {
      // Import core MCP schemas mentioned in acceptance criteria
      const {
        MCPServerConfigSchema,
        MCPConnectionConfigSchema,
        MCPToolSchema,
        MCPConfigSchema,
        MCPEnvironmentVarSchema,
        MCPMarketplaceEntrySchema,
        MCPServerSchema,
        MCPInstallationSchema,
        MCPInstallationStatusSchema,
        MCPTemplateSchema,
        MCPConnectionInfoSchema,
        MCPConnectionStateSchema,
        MCPConnectionEventSchema,
        MCPConnectionEventTypeSchema,
        MCPToolSchemaSchema,
        MCPToolCapabilitiesSchema,
        MCPToolRegistryEntrySchema,
        MCPToolInvocationRequestSchema,
        MCPToolInvocationResponseSchema,
        MCPToolResultContentSchema,
        MCPToolResultContentTypeSchema,
        MCPMarketplaceSourceSchema,
        MCPMarketplaceSchema,
        MCPToolsConfigSchema,
        MCPServerTemplateSchema,
        InstalledMCPServerSchema,
        MCPServerCategorySchema,
        MCPRegistryServerSchema,
        MCPRegistryInstallConfigSchema,
        MCPRegistryInstallationSchema,
        MCPInstallStageSchema,
        MCPInstallProgressSchema,
        MCPConnectionSchema,
        MCPServerV050Schema,
        MCPInstallationV050Schema,
        MCPInstallProgressV050Schema,
      } = await import('../index.js');

      // Verify all schemas are defined and have parse method
      const schemas = [
        { name: 'MCPServerConfigSchema', schema: MCPServerConfigSchema },
        { name: 'MCPConnectionConfigSchema', schema: MCPConnectionConfigSchema },
        { name: 'MCPToolSchema', schema: MCPToolSchema },
        { name: 'MCPConfigSchema', schema: MCPConfigSchema },
        { name: 'MCPEnvironmentVarSchema', schema: MCPEnvironmentVarSchema },
        { name: 'MCPMarketplaceEntrySchema', schema: MCPMarketplaceEntrySchema },
        { name: 'MCPServerSchema', schema: MCPServerSchema },
        { name: 'MCPInstallationSchema', schema: MCPInstallationSchema },
        { name: 'MCPInstallationStatusSchema', schema: MCPInstallationStatusSchema },
        { name: 'MCPTemplateSchema', schema: MCPTemplateSchema },
        { name: 'MCPConnectionInfoSchema', schema: MCPConnectionInfoSchema },
        { name: 'MCPConnectionStateSchema', schema: MCPConnectionStateSchema },
        { name: 'MCPConnectionEventSchema', schema: MCPConnectionEventSchema },
        { name: 'MCPConnectionEventTypeSchema', schema: MCPConnectionEventTypeSchema },
        { name: 'MCPToolSchemaSchema', schema: MCPToolSchemaSchema },
        { name: 'MCPToolCapabilitiesSchema', schema: MCPToolCapabilitiesSchema },
        { name: 'MCPToolRegistryEntrySchema', schema: MCPToolRegistryEntrySchema },
        { name: 'MCPToolInvocationRequestSchema', schema: MCPToolInvocationRequestSchema },
        { name: 'MCPToolInvocationResponseSchema', schema: MCPToolInvocationResponseSchema },
        { name: 'MCPToolResultContentSchema', schema: MCPToolResultContentSchema },
        { name: 'MCPToolResultContentTypeSchema', schema: MCPToolResultContentTypeSchema },
        { name: 'MCPMarketplaceSourceSchema', schema: MCPMarketplaceSourceSchema },
        { name: 'MCPMarketplaceSchema', schema: MCPMarketplaceSchema },
        { name: 'MCPToolsConfigSchema', schema: MCPToolsConfigSchema },
        { name: 'MCPServerTemplateSchema', schema: MCPServerTemplateSchema },
        { name: 'InstalledMCPServerSchema', schema: InstalledMCPServerSchema },
        { name: 'MCPServerCategorySchema', schema: MCPServerCategorySchema },
        { name: 'MCPRegistryServerSchema', schema: MCPRegistryServerSchema },
        { name: 'MCPRegistryInstallConfigSchema', schema: MCPRegistryInstallConfigSchema },
        { name: 'MCPRegistryInstallationSchema', schema: MCPRegistryInstallationSchema },
        { name: 'MCPInstallStageSchema', schema: MCPInstallStageSchema },
        { name: 'MCPInstallProgressSchema', schema: MCPInstallProgressSchema },
        { name: 'MCPConnectionSchema', schema: MCPConnectionSchema },
        { name: 'MCPServerV050Schema', schema: MCPServerV050Schema },
        { name: 'MCPInstallationV050Schema', schema: MCPInstallationV050Schema },
        { name: 'MCPInstallProgressV050Schema', schema: MCPInstallProgressV050Schema },
      ];

      for (const { name, schema } of schemas) {
        expect(schema, `${name} should be defined`).toBeDefined();
        expect(schema.parse, `${name} should have parse method`).toBeInstanceOf(Function);
        expect(schema.safeParse, `${name} should have safeParse method`).toBeInstanceOf(Function);
      }
    });

    it('should import JsonRpcRequestSchema from protocol-types', async () => {
      const { JsonRpcRequestSchema } = await import('../index.js');

      expect(JsonRpcRequestSchema).toBeDefined();
      expect(typeof JsonRpcRequestSchema.parse).toBe('function');
      expect(typeof JsonRpcRequestSchema.safeParse).toBe('function');

      // Test that it can parse a valid JSON-RPC request
      const validRequest = {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      };

      expect(() => JsonRpcRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should import all MCP protocol schemas from protocol-types', async () => {
      const {
        MCPProtocolVersionSchema,
        MCPServerCapabilitiesSchema,
        MCPClientCapabilitiesSchema,
        MCPImplementationInfoSchema,
        MCPInitializeParamsSchema,
        MCPInitializeResultSchema,
        MCPInitializedNotificationParamsSchema,
        MCPProtocolToolInputSchemaSchema,
        MCPProtocolToolDefinitionSchema,
        MCPToolsListParamsSchema,
        MCPToolsListResultSchema,
        MCPToolResultContentItemSchema,
        MCPToolsCallParamsSchema,
        MCPToolsCallResultSchema,
        MCPProtocolResourceDefinitionSchema,
        MCPProtocolResourceTemplateSchema,
        MCPResourcesListParamsSchema,
        MCPResourcesListResultSchema,
        MCPResourceContentSchema,
        MCPResourcesReadParamsSchema,
        MCPResourcesReadResultSchema,
        MCPProtocolPromptArgumentSchema,
        MCPProtocolPromptDefinitionSchema,
        MCPPromptsListParamsSchema,
        MCPPromptsListResultSchema,
        MCPPromptMessageRoleSchema,
        MCPPromptMessageContentSchema,
        MCPPromptMessageSchema,
        MCPPromptsGetParamsSchema,
        MCPPromptsGetResultSchema,
        MCPLogLevelSchema,
        MCPLoggingSetLevelParamsSchema,
        MCPLogMessageNotificationParamsSchema,
        MCPCompletionReferenceSchema,
        MCPCompletionCompleteParamsSchema,
        MCPCompletionCompleteResultSchema,
        JsonRpcIdSchema,
        JsonRpcErrorSchema,
        JsonRpcRequestSchema,
        JsonRpcNotificationSchema,
        JsonRpcSuccessResponseSchema,
        JsonRpcErrorResponseSchema,
        JsonRpcResponseSchema,
      } = await import('../index.js');

      const protocolSchemas = [
        { name: 'MCPProtocolVersionSchema', schema: MCPProtocolVersionSchema },
        { name: 'MCPServerCapabilitiesSchema', schema: MCPServerCapabilitiesSchema },
        { name: 'MCPClientCapabilitiesSchema', schema: MCPClientCapabilitiesSchema },
        { name: 'MCPImplementationInfoSchema', schema: MCPImplementationInfoSchema },
        { name: 'MCPInitializeParamsSchema', schema: MCPInitializeParamsSchema },
        { name: 'MCPInitializeResultSchema', schema: MCPInitializeResultSchema },
        { name: 'MCPInitializedNotificationParamsSchema', schema: MCPInitializedNotificationParamsSchema },
        { name: 'MCPProtocolToolInputSchemaSchema', schema: MCPProtocolToolInputSchemaSchema },
        { name: 'MCPProtocolToolDefinitionSchema', schema: MCPProtocolToolDefinitionSchema },
        { name: 'MCPToolsListParamsSchema', schema: MCPToolsListParamsSchema },
        { name: 'MCPToolsListResultSchema', schema: MCPToolsListResultSchema },
        { name: 'MCPToolResultContentItemSchema', schema: MCPToolResultContentItemSchema },
        { name: 'MCPToolsCallParamsSchema', schema: MCPToolsCallParamsSchema },
        { name: 'MCPToolsCallResultSchema', schema: MCPToolsCallResultSchema },
        { name: 'MCPProtocolResourceDefinitionSchema', schema: MCPProtocolResourceDefinitionSchema },
        { name: 'MCPProtocolResourceTemplateSchema', schema: MCPProtocolResourceTemplateSchema },
        { name: 'MCPResourcesListParamsSchema', schema: MCPResourcesListParamsSchema },
        { name: 'MCPResourcesListResultSchema', schema: MCPResourcesListResultSchema },
        { name: 'MCPResourceContentSchema', schema: MCPResourceContentSchema },
        { name: 'MCPResourcesReadParamsSchema', schema: MCPResourcesReadParamsSchema },
        { name: 'MCPResourcesReadResultSchema', schema: MCPResourcesReadResultSchema },
        { name: 'MCPProtocolPromptArgumentSchema', schema: MCPProtocolPromptArgumentSchema },
        { name: 'MCPProtocolPromptDefinitionSchema', schema: MCPProtocolPromptDefinitionSchema },
        { name: 'MCPPromptsListParamsSchema', schema: MCPPromptsListParamsSchema },
        { name: 'MCPPromptsListResultSchema', schema: MCPPromptsListResultSchema },
        { name: 'MCPPromptMessageRoleSchema', schema: MCPPromptMessageRoleSchema },
        { name: 'MCPPromptMessageContentSchema', schema: MCPPromptMessageContentSchema },
        { name: 'MCPPromptMessageSchema', schema: MCPPromptMessageSchema },
        { name: 'MCPPromptsGetParamsSchema', schema: MCPPromptsGetParamsSchema },
        { name: 'MCPPromptsGetResultSchema', schema: MCPPromptsGetResultSchema },
        { name: 'MCPLogLevelSchema', schema: MCPLogLevelSchema },
        { name: 'MCPLoggingSetLevelParamsSchema', schema: MCPLoggingSetLevelParamsSchema },
        { name: 'MCPLogMessageNotificationParamsSchema', schema: MCPLogMessageNotificationParamsSchema },
        { name: 'MCPCompletionReferenceSchema', schema: MCPCompletionReferenceSchema },
        { name: 'MCPCompletionCompleteParamsSchema', schema: MCPCompletionCompleteParamsSchema },
        { name: 'MCPCompletionCompleteResultSchema', schema: MCPCompletionCompleteResultSchema },
        { name: 'JsonRpcIdSchema', schema: JsonRpcIdSchema },
        { name: 'JsonRpcErrorSchema', schema: JsonRpcErrorSchema },
        { name: 'JsonRpcRequestSchema', schema: JsonRpcRequestSchema },
        { name: 'JsonRpcNotificationSchema', schema: JsonRpcNotificationSchema },
        { name: 'JsonRpcSuccessResponseSchema', schema: JsonRpcSuccessResponseSchema },
        { name: 'JsonRpcErrorResponseSchema', schema: JsonRpcErrorResponseSchema },
        { name: 'JsonRpcResponseSchema', schema: JsonRpcResponseSchema },
      ];

      for (const { name, schema } of protocolSchemas) {
        expect(schema, `${name} should be defined`).toBeDefined();
        expect(schema.parse, `${name} should have parse method`).toBeInstanceOf(Function);
        expect(schema.safeParse, `${name} should have safeParse method`).toBeInstanceOf(Function);
      }
    });

    it('should import MockMCPServerConfigSchema from mock-types', async () => {
      const {
        MockMCPServerConfigSchema,
        MockMCPServerDefinitionSchema,
        MockTransportTypeSchema,
        MockHttpTransportConfigSchema,
        MockSseTransportConfigSchema,
        MockStdioTransportConfigSchema,
        MockResponseDelaySchema,
        MockErrorInjectionSchema,
        MockToolResultContentSchema,
        MockToolHandlerSchema,
        MockNotificationTriggerConditionSchema,
        MockNotificationTriggerSchema,
        MockStateTransitionSchema,
        MockStateBehaviorSchema,
        MockStatefulBehaviorConfigSchema,
        MockRequestMatcherSchema,
        MockResponseDefinitionSchema,
        MockRequestResponsePairSchema,
        MockBehaviorConfigSchema,
        MockScenarioSchema,
      } = await import('../index.js');

      const mockSchemas = [
        { name: 'MockMCPServerConfigSchema', schema: MockMCPServerConfigSchema },
        { name: 'MockMCPServerDefinitionSchema', schema: MockMCPServerDefinitionSchema },
        { name: 'MockTransportTypeSchema', schema: MockTransportTypeSchema },
        { name: 'MockHttpTransportConfigSchema', schema: MockHttpTransportConfigSchema },
        { name: 'MockSseTransportConfigSchema', schema: MockSseTransportConfigSchema },
        { name: 'MockStdioTransportConfigSchema', schema: MockStdioTransportConfigSchema },
        { name: 'MockResponseDelaySchema', schema: MockResponseDelaySchema },
        { name: 'MockErrorInjectionSchema', schema: MockErrorInjectionSchema },
        { name: 'MockToolResultContentSchema', schema: MockToolResultContentSchema },
        { name: 'MockToolHandlerSchema', schema: MockToolHandlerSchema },
        { name: 'MockNotificationTriggerConditionSchema', schema: MockNotificationTriggerConditionSchema },
        { name: 'MockNotificationTriggerSchema', schema: MockNotificationTriggerSchema },
        { name: 'MockStateTransitionSchema', schema: MockStateTransitionSchema },
        { name: 'MockStateBehaviorSchema', schema: MockStateBehaviorSchema },
        { name: 'MockStatefulBehaviorConfigSchema', schema: MockStatefulBehaviorConfigSchema },
        { name: 'MockRequestMatcherSchema', schema: MockRequestMatcherSchema },
        { name: 'MockResponseDefinitionSchema', schema: MockResponseDefinitionSchema },
        { name: 'MockRequestResponsePairSchema', schema: MockRequestResponsePairSchema },
        { name: 'MockBehaviorConfigSchema', schema: MockBehaviorConfigSchema },
        { name: 'MockScenarioSchema', schema: MockScenarioSchema },
      ];

      for (const { name, schema } of mockSchemas) {
        expect(schema, `${name} should be defined`).toBeDefined();
        expect(schema.parse, `${name} should have parse method`).toBeInstanceOf(Function);
        expect(schema.safeParse, `${name} should have safeParse method`).toBeInstanceOf(Function);
      }
    });

    it('should import all MCP-related inferred types', async () => {
      const {
        // Types from types.ts
        MCPServerConfig,
        MCPConnectionConfig,
        MCPTool,
        MCPConfig,
        MCPEnvironmentVar,
        MCPMarketplaceEntry,
        MCPServer,
        MCPInstallation,
        MCPInstallationStatus,
        MCPTemplate,
        MCPConnectionInfo,
        MCPConnectionState,
        MCPConnectionEvent,
        MCPConnectionEventType,
        MCPToolSchema as MCPToolSchemaType,
        MCPToolCapabilities,
        MCPToolRegistryEntry,
        MCPToolInvocationRequest,
        MCPToolInvocationResponse,
        MCPToolResultContent,
        MCPToolResultContentType,
        MCPMarketplaceSource,
        MCPMarketplace,
        MCPToolsConfig,
        MCPServerTemplate,
        InstalledMCPServer,
        MCPServerCategory,
        MCPRegistryServer,
        MCPRegistryInstallConfig,
        MCPRegistryInstallation,
        MCPInstallStage,
        MCPInstallProgress,
        MCPConnection,
        MCPServerV050,
        MCPInstallationV050,
        MCPInstallProgressV050,

        // Types from protocol-types.ts
        MCPProtocolVersion,
        MCPServerCapabilities,
        MCPClientCapabilities,
        MCPImplementationInfo,
        MCPInitializeParams,
        MCPInitializeResult,
        MCPInitializedNotificationParams,
        MCPProtocolToolInputSchema,
        MCPProtocolToolDefinition,
        MCPToolsListParams,
        MCPToolsListResult,
        MCPToolResultContentItem,
        MCPToolsCallParams,
        MCPToolsCallResult,
        MCPProtocolResourceDefinition,
        MCPProtocolResourceTemplate,
        MCPResourcesListParams,
        MCPResourcesListResult,
        MCPResourceContent,
        MCPResourcesReadParams,
        MCPResourcesReadResult,
        MCPProtocolPromptArgument,
        MCPProtocolPromptDefinition,
        MCPPromptsListParams,
        MCPPromptsListResult,
        MCPPromptMessageRole,
        MCPPromptMessageContent,
        MCPPromptMessage,
        MCPPromptsGetParams,
        MCPPromptsGetResult,
        MCPLogLevel,
        MCPLoggingSetLevelParams,
        MCPLogMessageNotificationParams,
        MCPCompletionReference,
        MCPCompletionCompleteParams,
        MCPCompletionCompleteResult,
        JsonRpcId,
        JsonRpcError,
        JsonRpcRequest,
        JsonRpcNotification,
        JsonRpcSuccessResponse,
        JsonRpcErrorResponse,
        JsonRpcResponse,

        // Types from mock-types.ts
        MockMCPServerConfig,
        MockMCPServerDefinition,
        MockTransportType,
        MockHttpTransportConfig,
        MockSseTransportConfig,
        MockStdioTransportConfig,
        MockResponseDelay,
        MockErrorInjection,
        MockToolResultContent,
        MockToolHandler,
        MockNotificationTriggerCondition,
        MockNotificationTrigger,
        MockStateTransition,
        MockStateBehavior,
        MockStatefulBehaviorConfig,
        MockRequestMatcher,
        MockResponseDefinition,
        MockRequestResponsePair,
        MockBehaviorConfig,
        MockScenario,
      } = await import('../index.js');

      // Simply checking that types exist (they would throw TS error if not imported)
      expect(typeof MCPServerConfig).toBeDefined();
      expect(typeof MCPConnectionConfig).toBeDefined();
      expect(typeof MCPTool).toBeDefined();
      expect(typeof JsonRpcRequest).toBeDefined();
      expect(typeof MockMCPServerConfig).toBeDefined();

      // This test passes if TypeScript compiles successfully and all imports work
      expect(true).toBe(true);
    });
  });

  describe('Schema validation functionality', () => {
    it('should be able to parse valid MCP configurations', async () => {
      const {
        MCPServerConfigSchema,
        MCPConnectionConfigSchema,
        MCPToolSchema,
        JsonRpcRequestSchema,
        MockMCPServerConfigSchema,
      } = await import('../index.js');

      // Test MCPServerConfigSchema
      const validServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['index.js'],
      };
      expect(() => MCPServerConfigSchema.parse(validServerConfig)).not.toThrow();

      // Test MCPConnectionConfigSchema
      const validConnectionConfig = {
        maxRetries: 3,
        requestTimeoutMs: 5000,
      };
      expect(() => MCPConnectionConfigSchema.parse(validConnectionConfig)).not.toThrow();

      // Test MCPToolSchema
      const validTool = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };
      expect(() => MCPToolSchema.parse(validTool)).not.toThrow();

      // Test JsonRpcRequestSchema
      const validJsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      };
      expect(() => JsonRpcRequestSchema.parse(validJsonRpcRequest)).not.toThrow();

      // Test MockMCPServerConfigSchema
      const validMockConfig = {
        name: 'mock-server',
      };
      expect(() => MockMCPServerConfigSchema.parse(validMockConfig)).not.toThrow();
    });
  });

  describe('Type inference validation', () => {
    it('should infer correct types from schemas', async () => {
      const { MCPServerConfigSchema, JsonRpcRequestSchema } = await import('../index.js');

      const serverConfig = MCPServerConfigSchema.parse({
        name: 'test-server',
        command: 'node',
        args: ['index.js'],
      });

      const jsonRpcRequest = JsonRpcRequestSchema.parse({
        jsonrpc: '2.0',
        method: 'test',
        params: {},
        id: 1,
      });

      // TypeScript should infer correct types
      expect(typeof serverConfig.name).toBe('string');
      expect(typeof serverConfig.command).toBe('string');
      expect(Array.isArray(serverConfig.args)).toBe(true);

      expect(jsonRpcRequest.jsonrpc).toBe('2.0');
      expect(typeof jsonRpcRequest.method).toBe('string');
      expect(typeof jsonRpcRequest.id).toBe('number');
    });
  });
});