/**
 * MCP (Model Context Protocol) Type Exports
 *
 * This file re-exports all MCP-related types and schemas from the main types file,
 * providing a dedicated interface for MCP functionality in the APEX system.
 *
 * Used by the orchestrator package for MCP server management, connection handling,
 * tool discovery, and integration with the Claude Agent SDK.
 */

// Re-export all MCP types from types.ts for clean consumption by orchestrator
export {
  // MCP Configuration (v0.5.0)
  MCPConnectionConfigSchema,
  type MCPConnectionConfig,
  MCPEnvironmentVarSchema,
  type MCPEnvironmentVar,
  MCPServerConfigSchema,
  type MCPServerConfig,
  MCPMarketplaceEntrySchema,
  type MCPMarketplaceEntry,
  MCPMarketplaceSourceSchema,
  type MCPMarketplaceSource,
  MCPMarketplaceSchema,
  type MCPMarketplace,
  MCPToolsConfigSchema,
  type MCPToolsConfig,
  MCPConfigSchema,
  type MCPConfig,

  // MCP Server Templates
  MCPTemplateSchema,
  type MCPTemplate,
  MCPServerTemplateSchema, // Backwards compatibility alias
  type MCPServerTemplate,   // Backwards compatibility alias

  // MCP Server Definitions
  MCPServerSchema,
  type MCPServer,
  MCPInstallationStatusSchema,
  type MCPInstallationStatus,
  MCPInstallationSchema,
  type MCPInstallation,
  InstalledMCPServerSchema,
  type InstalledMCPServer,

  // MCP Registry Types (v0.5.0)
  MCPServerCategorySchema,
  type MCPServerCategory,
  MCPRegistryServerSchema,
  type MCPRegistryServer,
  MCPRegistryInstallConfigSchema,
  type MCPRegistryInstallConfig,
  MCPRegistryInstallationSchema,
  type MCPRegistryInstallation,
  MCPInstallStageSchema,
  type MCPInstallStage,
  MCPInstallProgressSchema,
  type MCPInstallProgress,

  // MCP Connection Management Types (v0.5.0)
  MCPConnectionStateSchema,
  type MCPConnectionState,
  MCPConnectionInfoSchema,
  type MCPConnectionInfo,
  MCPConnectionSchema,    // Backwards compatibility alias
  type MCPConnection,     // Backwards compatibility alias
  MCPConnectionEventTypeSchema,
  type MCPConnectionEventType,
  MCPConnectionEventSchema,
  type MCPConnectionEvent,

  // MCP Tool Types (v0.5.0)
  MCPToolSchemaSchema,           // JSON Schema for MCP tool parameters
  type MCPToolSchema,            // Type for JSON Schema objects
  MCPToolCapabilitiesSchema,
  type MCPToolCapabilities,
  MCPToolSchema as MCPToolDefinitionSchema, // MCP Tool definition schema (for full tool metadata) - aliased to avoid conflict
  type MCPTool,
  MCPToolRegistryEntrySchema,
  type MCPToolRegistryEntry,
  MCPToolInvocationRequestSchema,
  type MCPToolInvocationRequest,
  MCPToolResultContentTypeSchema,
  type MCPToolResultContentType,
  MCPToolResultContentSchema,
  type MCPToolResultContent,
  MCPToolInvocationResponseSchema,
  type MCPToolInvocationResponse,

  // MCP Types for v0.5.0 Feature Development
  MCPServerV050Schema,
  type MCPServerV050,
  MCPInstallationV050Schema,
  type MCPInstallationV050,
  MCPInstallProgressV050Schema,
  type MCPInstallProgressV050,
} from './types';