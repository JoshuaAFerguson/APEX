/**
 * @fileoverview MCP Protocol Message Types
 *
 * Defines Zod schemas and TypeScript types for all core MCP (Model Context Protocol)
 * message types following JSON-RPC 2.0. Covers both request params and response result
 * shapes for each protocol method.
 *
 * ## Architecture Decision Record (ADR-025)
 *
 * ### Context
 * APEX needs well-typed representations of MCP protocol messages to communicate
 * with MCP servers. The MCP specification defines JSON-RPC 2.0 based messages for:
 * - Lifecycle (initialize/initialized)
 * - Tools (list/call)
 * - Resources (list/read)
 * - Prompts (list/get)
 * - Logging
 * - Completion
 *
 * ### Decision
 * Define all protocol types in a single cohesive file using Zod schemas with inferred
 * TypeScript types. This approach:
 * 1. Provides runtime validation for protocol messages
 * 2. Generates TypeScript types automatically via z.infer
 * 3. Follows the established pattern from types.ts (Schema + inferred type)
 * 4. Organizes types by protocol method group for maintainability
 * 5. Includes JSON-RPC 2.0 base envelope types for composability
 *
 * ### Consequences
 * - Single source of truth for MCP protocol shapes
 * - Runtime validation available for incoming/outgoing messages
 * - Full TypeScript type safety for protocol handling code
 * - Easy to extend as MCP protocol evolves
 *
 * @module @apex/core/mcp/protocol-types
 */

import { z } from 'zod';

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

/**
 * JSON-RPC 2.0 request ID - can be string or number
 */
export const JsonRpcIdSchema = z.union([z.string(), z.number()]);
export type JsonRpcId = z.infer<typeof JsonRpcIdSchema>;

/**
 * JSON-RPC 2.0 error object
 */
export const JsonRpcErrorSchema = z.object({
  /** Error code */
  code: z.number(),
  /** Human-readable error message */
  message: z.string(),
  /** Optional additional error data */
  data: z.unknown().optional(),
});
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>;

/**
 * JSON-RPC 2.0 request envelope
 */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: JsonRpcIdSchema,
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

/**
 * JSON-RPC 2.0 notification (no id, no response expected)
 */
export const JsonRpcNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});
export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>;

/**
 * JSON-RPC 2.0 success response
 */
export const JsonRpcSuccessResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: JsonRpcIdSchema,
  result: z.unknown(),
});
export type JsonRpcSuccessResponse = z.infer<typeof JsonRpcSuccessResponseSchema>;

/**
 * JSON-RPC 2.0 error response
 */
export const JsonRpcErrorResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: JsonRpcIdSchema.nullable(),
  error: JsonRpcErrorSchema,
});
export type JsonRpcErrorResponse = z.infer<typeof JsonRpcErrorResponseSchema>;

/**
 * JSON-RPC 2.0 response (success or error)
 */
export const JsonRpcResponseSchema = z.union([
  JsonRpcSuccessResponseSchema,
  JsonRpcErrorResponseSchema,
]);
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

// ============================================================================
// MCP Protocol Version & Capabilities
// ============================================================================

/**
 * MCP protocol version string
 */
export const MCPProtocolVersionSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type MCPProtocolVersion = z.infer<typeof MCPProtocolVersionSchema>;

/**
 * Server capabilities advertised during initialization
 */
export const MCPServerCapabilitiesSchema = z.object({
  /** Whether the server supports tool listing and invocation */
  tools: z.object({
    /** Whether tools list may change dynamically */
    listChanged: z.boolean().optional(),
  }).optional(),
  /** Whether the server supports resource listing and reading */
  resources: z.object({
    /** Whether the server supports resource subscriptions */
    subscribe: z.boolean().optional(),
    /** Whether resources list may change dynamically */
    listChanged: z.boolean().optional(),
  }).optional(),
  /** Whether the server supports prompt listing and retrieval */
  prompts: z.object({
    /** Whether prompts list may change dynamically */
    listChanged: z.boolean().optional(),
  }).optional(),
  /** Whether the server supports logging */
  logging: z.object({}).optional(),
  /** Experimental capabilities (non-standard) */
  experimental: z.record(z.string(), z.unknown()).optional(),
});
export type MCPServerCapabilities = z.infer<typeof MCPServerCapabilitiesSchema>;

/**
 * Client capabilities sent during initialization
 */
export const MCPClientCapabilitiesSchema = z.object({
  /** Whether the client supports roots listing */
  roots: z.object({
    /** Whether the client can notify when roots change */
    listChanged: z.boolean().optional(),
  }).optional(),
  /** Whether the client supports sampling requests */
  sampling: z.object({}).optional(),
  /** Experimental capabilities (non-standard) */
  experimental: z.record(z.string(), z.unknown()).optional(),
});
export type MCPClientCapabilities = z.infer<typeof MCPClientCapabilitiesSchema>;

/**
 * Implementation info shared during initialization
 */
export const MCPImplementationInfoSchema = z.object({
  /** Name of the implementation (e.g., "apex-mcp-client") */
  name: z.string(),
  /** Version of the implementation */
  version: z.string(),
});
export type MCPImplementationInfo = z.infer<typeof MCPImplementationInfoSchema>;

// ============================================================================
// Initialize / Initialized
// ============================================================================

/**
 * Parameters for the 'initialize' request sent from client to server
 */
export const MCPInitializeParamsSchema = z.object({
  /** The protocol version the client supports */
  protocolVersion: MCPProtocolVersionSchema,
  /** Client capabilities */
  capabilities: MCPClientCapabilitiesSchema,
  /** Client implementation info */
  clientInfo: MCPImplementationInfoSchema,
});
export type MCPInitializeParams = z.infer<typeof MCPInitializeParamsSchema>;

/**
 * Result of the 'initialize' request returned by the server
 */
export const MCPInitializeResultSchema = z.object({
  /** The protocol version the server selected */
  protocolVersion: MCPProtocolVersionSchema,
  /** Server capabilities */
  capabilities: MCPServerCapabilitiesSchema,
  /** Server implementation info */
  serverInfo: MCPImplementationInfoSchema,
  /** Optional instructions for the client about using this server */
  instructions: z.string().optional(),
});
export type MCPInitializeResult = z.infer<typeof MCPInitializeResultSchema>;

/**
 * The 'initialized' notification sent from client to server after init handshake.
 * Has no parameters.
 */
export const MCPInitializedNotificationParamsSchema = z.object({}).strict();
export type MCPInitializedNotificationParams = z.infer<typeof MCPInitializedNotificationParamsSchema>;

// ============================================================================
// Tools - List & Call
// ============================================================================

/**
 * Schema for a tool's input definition (JSON Schema subset used by MCP)
 */
export const MCPProtocolToolInputSchemaSchema = z.object({
  type: z.literal('object'),
  /** Property definitions keyed by parameter name */
  properties: z.record(z.string(), z.unknown()).optional(),
  /** List of required parameter names */
  required: z.array(z.string()).optional(),
  /** Additional JSON Schema properties for validation */
  additionalProperties: z.boolean().optional(),
});
export type MCPProtocolToolInputSchema = z.infer<typeof MCPProtocolToolInputSchemaSchema>;

/**
 * Tool definition as returned by tools/list
 */
export const MCPProtocolToolDefinitionSchema = z.object({
  /** Unique tool name */
  name: z.string(),
  /** Human-readable description of the tool */
  description: z.string().optional(),
  /** JSON Schema defining the tool's input parameters */
  inputSchema: MCPProtocolToolInputSchemaSchema,
});
export type MCPProtocolToolDefinition = z.infer<typeof MCPProtocolToolDefinitionSchema>;

/**
 * Parameters for the 'tools/list' request
 */
export const MCPToolsListParamsSchema = z.object({
  /** Optional cursor for pagination */
  cursor: z.string().optional(),
}).optional();
export type MCPToolsListParams = z.infer<typeof MCPToolsListParamsSchema>;

/**
 * Result of the 'tools/list' request
 */
export const MCPToolsListResultSchema = z.object({
  /** Array of available tools */
  tools: z.array(MCPProtocolToolDefinitionSchema),
  /** Optional cursor for next page */
  nextCursor: z.string().optional(),
});
export type MCPToolsListResult = z.infer<typeof MCPToolsListResultSchema>;

/**
 * Content types for tool call results
 */
export const MCPToolResultContentItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    /** Text content */
    text: z.string(),
  }),
  z.object({
    type: z.literal('image'),
    /** Base64 encoded image data */
    data: z.string(),
    /** MIME type of the image */
    mimeType: z.string(),
  }),
  z.object({
    type: z.literal('resource'),
    resource: z.object({
      /** URI of the embedded resource */
      uri: z.string(),
      /** MIME type of the resource */
      mimeType: z.string().optional(),
      /** Text content (for text resources) */
      text: z.string().optional(),
      /** Base64-encoded binary content (for binary resources) */
      blob: z.string().optional(),
    }),
  }),
]);
export type MCPToolResultContentItem = z.infer<typeof MCPToolResultContentItemSchema>;

/**
 * Parameters for the 'tools/call' request
 */
export const MCPToolsCallParamsSchema = z.object({
  /** Name of the tool to invoke */
  name: z.string(),
  /** Arguments to pass to the tool (matches tool's inputSchema) */
  arguments: z.record(z.string(), z.unknown()).optional(),
});
export type MCPToolsCallParams = z.infer<typeof MCPToolsCallParamsSchema>;

/**
 * Result of the 'tools/call' request
 */
export const MCPToolsCallResultSchema = z.object({
  /** Array of content items returned by the tool */
  content: z.array(MCPToolResultContentItemSchema),
  /** Whether the tool call resulted in an error */
  isError: z.boolean().optional(),
});
export type MCPToolsCallResult = z.infer<typeof MCPToolsCallResultSchema>;

// ============================================================================
// Resources - List & Read
// ============================================================================

/**
 * Resource definition as returned by resources/list
 */
export const MCPProtocolResourceDefinitionSchema = z.object({
  /** URI identifying the resource */
  uri: z.string(),
  /** Human-readable name for the resource */
  name: z.string(),
  /** Description of what the resource contains */
  description: z.string().optional(),
  /** MIME type of the resource content */
  mimeType: z.string().optional(),
});
export type MCPProtocolResourceDefinition = z.infer<typeof MCPProtocolResourceDefinitionSchema>;

/**
 * Resource template for parameterized resource URIs
 */
export const MCPProtocolResourceTemplateSchema = z.object({
  /** URI template with parameters (RFC 6570) */
  uriTemplate: z.string(),
  /** Human-readable name for the resource template */
  name: z.string(),
  /** Description of the resource template */
  description: z.string().optional(),
  /** MIME type of the resource content */
  mimeType: z.string().optional(),
});
export type MCPProtocolResourceTemplate = z.infer<typeof MCPProtocolResourceTemplateSchema>;

/**
 * Parameters for the 'resources/list' request
 */
export const MCPResourcesListParamsSchema = z.object({
  /** Optional cursor for pagination */
  cursor: z.string().optional(),
}).optional();
export type MCPResourcesListParams = z.infer<typeof MCPResourcesListParamsSchema>;

/**
 * Result of the 'resources/list' request
 */
export const MCPResourcesListResultSchema = z.object({
  /** Array of available resources */
  resources: z.array(MCPProtocolResourceDefinitionSchema),
  /** Optional resource templates */
  resourceTemplates: z.array(MCPProtocolResourceTemplateSchema).optional(),
  /** Optional cursor for next page */
  nextCursor: z.string().optional(),
});
export type MCPResourcesListResult = z.infer<typeof MCPResourcesListResultSchema>;

/**
 * Resource content item (text or binary)
 */
export const MCPResourceContentSchema = z.object({
  /** URI of the resource */
  uri: z.string(),
  /** MIME type of the content */
  mimeType: z.string().optional(),
  /** Text content (for text-based resources) */
  text: z.string().optional(),
  /** Base64-encoded binary content (for binary resources) */
  blob: z.string().optional(),
});
export type MCPResourceContent = z.infer<typeof MCPResourceContentSchema>;

/**
 * Parameters for the 'resources/read' request
 */
export const MCPResourcesReadParamsSchema = z.object({
  /** URI of the resource to read */
  uri: z.string(),
});
export type MCPResourcesReadParams = z.infer<typeof MCPResourcesReadParamsSchema>;

/**
 * Result of the 'resources/read' request
 */
export const MCPResourcesReadResultSchema = z.object({
  /** Array of resource contents (may return multiple for composite resources) */
  contents: z.array(MCPResourceContentSchema),
});
export type MCPResourcesReadResult = z.infer<typeof MCPResourcesReadResultSchema>;

// ============================================================================
// Prompts - List & Get
// ============================================================================

/**
 * Prompt argument definition
 */
export const MCPProtocolPromptArgumentSchema = z.object({
  /** Argument name */
  name: z.string(),
  /** Description of the argument */
  description: z.string().optional(),
  /** Whether this argument is required */
  required: z.boolean().optional(),
});
export type MCPProtocolPromptArgument = z.infer<typeof MCPProtocolPromptArgumentSchema>;

/**
 * Prompt definition as returned by prompts/list
 */
export const MCPProtocolPromptDefinitionSchema = z.object({
  /** Unique prompt name */
  name: z.string(),
  /** Description of the prompt */
  description: z.string().optional(),
  /** Arguments the prompt accepts */
  arguments: z.array(MCPProtocolPromptArgumentSchema).optional(),
});
export type MCPProtocolPromptDefinition = z.infer<typeof MCPProtocolPromptDefinitionSchema>;

/**
 * Parameters for the 'prompts/list' request
 */
export const MCPPromptsListParamsSchema = z.object({
  /** Optional cursor for pagination */
  cursor: z.string().optional(),
}).optional();
export type MCPPromptsListParams = z.infer<typeof MCPPromptsListParamsSchema>;

/**
 * Result of the 'prompts/list' request
 */
export const MCPPromptsListResultSchema = z.object({
  /** Array of available prompts */
  prompts: z.array(MCPProtocolPromptDefinitionSchema),
  /** Optional cursor for next page */
  nextCursor: z.string().optional(),
});
export type MCPPromptsListResult = z.infer<typeof MCPPromptsListResultSchema>;

/**
 * Role for prompt messages
 */
export const MCPPromptMessageRoleSchema = z.enum(['user', 'assistant']);
export type MCPPromptMessageRole = z.infer<typeof MCPPromptMessageRoleSchema>;

/**
 * Content types for prompt messages
 */
export const MCPPromptMessageContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    /** Text content */
    text: z.string(),
  }),
  z.object({
    type: z.literal('image'),
    /** Base64 encoded image data */
    data: z.string(),
    /** MIME type of the image */
    mimeType: z.string(),
  }),
  z.object({
    type: z.literal('resource'),
    resource: z.object({
      /** URI of the embedded resource */
      uri: z.string(),
      /** MIME type of the resource */
      mimeType: z.string().optional(),
      /** Text content */
      text: z.string().optional(),
      /** Base64-encoded binary content */
      blob: z.string().optional(),
    }),
  }),
]);
export type MCPPromptMessageContent = z.infer<typeof MCPPromptMessageContentSchema>;

/**
 * A message within a prompt result
 */
export const MCPPromptMessageSchema = z.object({
  /** Role of the message sender */
  role: MCPPromptMessageRoleSchema,
  /** Content of the message */
  content: MCPPromptMessageContentSchema,
});
export type MCPPromptMessage = z.infer<typeof MCPPromptMessageSchema>;

/**
 * Parameters for the 'prompts/get' request
 */
export const MCPPromptsGetParamsSchema = z.object({
  /** Name of the prompt to retrieve */
  name: z.string(),
  /** Arguments to pass to the prompt template */
  arguments: z.record(z.string(), z.string()).optional(),
});
export type MCPPromptsGetParams = z.infer<typeof MCPPromptsGetParamsSchema>;

/**
 * Result of the 'prompts/get' request
 */
export const MCPPromptsGetResultSchema = z.object({
  /** Optional description for this prompt instance */
  description: z.string().optional(),
  /** Array of messages forming the prompt */
  messages: z.array(MCPPromptMessageSchema),
});
export type MCPPromptsGetResult = z.infer<typeof MCPPromptsGetResultSchema>;

// ============================================================================
// Logging
// ============================================================================

/**
 * Log levels following the MCP specification
 */
export const MCPLogLevelSchema = z.enum([
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'alert',
  'emergency',
]);
export type MCPLogLevel = z.infer<typeof MCPLogLevelSchema>;

/**
 * Parameters for the 'logging/setLevel' request
 */
export const MCPLoggingSetLevelParamsSchema = z.object({
  /** The log level to set */
  level: MCPLogLevelSchema,
});
export type MCPLoggingSetLevelParams = z.infer<typeof MCPLoggingSetLevelParamsSchema>;

/**
 * Parameters for 'notifications/message' (log message from server)
 */
export const MCPLogMessageNotificationParamsSchema = z.object({
  /** The log level of this message */
  level: MCPLogLevelSchema,
  /** The logger name/source */
  logger: z.string().optional(),
  /** The log message data (can be any JSON value) */
  data: z.unknown(),
});
export type MCPLogMessageNotificationParams = z.infer<typeof MCPLogMessageNotificationParamsSchema>;

// ============================================================================
// Completion
// ============================================================================

/**
 * Reference types for completion requests
 */
export const MCPCompletionReferenceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ref/prompt'),
    /** Name of the prompt being referenced */
    name: z.string(),
  }),
  z.object({
    type: z.literal('ref/resource'),
    /** URI of the resource being referenced */
    uri: z.string(),
  }),
]);
export type MCPCompletionReference = z.infer<typeof MCPCompletionReferenceSchema>;

/**
 * Parameters for the 'completion/complete' request
 */
export const MCPCompletionCompleteParamsSchema = z.object({
  /** What is being completed */
  ref: MCPCompletionReferenceSchema,
  /** The argument being completed */
  argument: z.object({
    /** Name of the argument */
    name: z.string(),
    /** Current value of the argument (partial input) */
    value: z.string(),
  }),
});
export type MCPCompletionCompleteParams = z.infer<typeof MCPCompletionCompleteParamsSchema>;

/**
 * Result of the 'completion/complete' request
 */
export const MCPCompletionCompleteResultSchema = z.object({
  completion: z.object({
    /** Array of completion suggestion values */
    values: z.array(z.string()),
    /** Total number of available completions (may exceed values.length) */
    total: z.number().optional(),
    /** Whether there are more completions beyond what's returned */
    hasMore: z.boolean().optional(),
  }),
});
export type MCPCompletionCompleteResult = z.infer<typeof MCPCompletionCompleteResultSchema>;

// ============================================================================
// Protocol Method Names (Constants)
// ============================================================================

/**
 * All standard MCP protocol method names
 */
export const MCPProtocolMethod = {
  // Lifecycle
  Initialize: 'initialize',
  Initialized: 'notifications/initialized',

  // Tools
  ToolsList: 'tools/list',
  ToolsCall: 'tools/call',

  // Resources
  ResourcesList: 'resources/list',
  ResourcesRead: 'resources/read',
  ResourcesSubscribe: 'resources/subscribe',
  ResourcesUnsubscribe: 'resources/unsubscribe',

  // Prompts
  PromptsList: 'prompts/list',
  PromptsGet: 'prompts/get',

  // Logging
  LoggingSetLevel: 'logging/setLevel',

  // Completion
  CompletionComplete: 'completion/complete',

  // Notifications (server → client)
  NotificationMessage: 'notifications/message',
  NotificationToolsListChanged: 'notifications/tools/list_changed',
  NotificationResourcesListChanged: 'notifications/resources/list_changed',
  NotificationPromptsListChanged: 'notifications/prompts/list_changed',
  NotificationResourcesUpdated: 'notifications/resources/updated',
} as const;

export type MCPProtocolMethodName = (typeof MCPProtocolMethod)[keyof typeof MCPProtocolMethod];

// ============================================================================
// Standard MCP Error Codes
// ============================================================================

/**
 * Standard MCP error codes (extends JSON-RPC 2.0 error codes)
 */
export const MCPErrorCode = {
  // JSON-RPC 2.0 standard errors
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,

  // MCP-specific errors
  /** The requested resource was not found */
  ResourceNotFound: -32002,
  /** The requested tool was not found */
  ToolNotFound: -32004,
  /** The tool execution failed */
  ToolExecutionError: -32005,
} as const;

export type MCPErrorCodeValue = (typeof MCPErrorCode)[keyof typeof MCPErrorCode];
