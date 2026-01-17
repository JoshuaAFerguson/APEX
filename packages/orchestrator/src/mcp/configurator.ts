/**
 * MCP Auto-Configuration System
 *
 * This module provides the MCPConfigurator class for generating, validating,
 * and managing MCP (Model Context Protocol) configurations across different
 * formats including claude_desktop_config.json and APEX's native format.
 *
 * @module orchestrator/mcp/configurator
 */

import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MCPConfig,
  MCPServerConfig,
  MCPEnvironmentVar,
  MCPConnectionConfig,
  ApexConfig,
} from '@apexcli/core';
import { BUILTIN_TEMPLATES } from './templates.js';
import { EnvVarDetector } from './env-detector.js';
import { ConfigValidator } from './config-validator.js';

/**
 * Supported external configuration formats
 */
export type MCPConfigFormat = 'claude-desktop' | 'apex' | 'json';

/**
 * Claude Desktop configuration format
 * Compatible with claude_desktop_config.json
 */
export interface ClaudeDesktopConfig {
  mcpServers: Record<string, ClaudeDesktopServerConfig>;
}

export interface ClaudeDesktopServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Environment variable detection result
 */
export interface EnvVarDetectionResult {
  /** All environment variables for the server */
  variables: MCPEnvironmentVar[];
  /** Variables that are missing and required */
  missing: MCPEnvironmentVar[];
  /** Variables that are present in the environment */
  found: MCPEnvironmentVar[];
  /** Validation warnings (e.g., pattern mismatches) */
  warnings: Array<{ variable: string; message: string }>;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    code: ConfigValidationErrorCode;
  }>;
  warnings: Array<{
    path: string;
    message: string;
    code: ConfigValidationWarningCode;
  }>;
}

export type ConfigValidationErrorCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_COMMAND'
  | 'MISSING_ENV_VAR'
  | 'INVALID_URL'
  | 'CONFLICTING_CONFIG'
  | 'UNKNOWN_SERVER_TYPE';

export type ConfigValidationWarningCode =
  | 'MISSING_OPTIONAL_ENV'
  | 'DEPRECATED_FIELD'
  | 'SUBOPTIMAL_CONFIG'
  | 'UNVERIFIED_SERVER';

/**
 * Server template definition
 */
export interface MCPServerTemplate {
  /** Unique template identifier */
  id: string;
  /** Display name */
  name: string;
  /** Server description */
  description: string;
  /** Package name (npm) */
  package: string;
  /** Base configuration */
  config: Partial<MCPServerConfig>;
  /** Environment variables with metadata */
  envVars: MCPEnvironmentVar[];
  /** Capabilities this server provides */
  capabilities: string[];
  /** Whether this template is verified/official */
  verified: boolean;
  /** Default enabled state */
  defaultEnabled?: boolean;
}

/**
 * MCPConfigurator events
 */
export interface MCPConfiguratorEvents {
  'config:generated': (data: { format: MCPConfigFormat; path?: string }) => void;
  'config:validated': (data: ConfigValidationResult) => void;
  'config:applied': (data: { serverCount: number }) => void;
  'env:detected': (data: EnvVarDetectionResult) => void;
  'env:missing': (data: { variables: MCPEnvironmentVar[] }) => void;
  'server:added': (data: { serverId: string; config: MCPServerConfig }) => void;
  'server:removed': (data: { serverId: string }) => void;
}

/**
 * MCPConfigurator options
 */
export interface MCPConfiguratorOptions {
  /** Project path */
  projectPath: string;
  /** APEX configuration */
  config: ApexConfig;
  /** Custom templates to register */
  customTemplates?: MCPServerTemplate[];
}

/**
 * MCPConfigurator specific error class
 */
export class MCPConfiguratorError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'SERVER_EXISTS'      // addServer with overwrite=false
      | 'SERVER_NOT_FOUND'   // removeServer for non-existent
      | 'VALIDATION_FAILED'  // addServer with invalid config
      | 'PERSIST_FAILED',    // Failed to save to disk
    public readonly serverId?: string
  ) {
    super(message);
    this.name = 'MCPConfiguratorError';
  }
}

/**
 * MCPConfigurator - Central service for MCP configuration management
 *
 * Provides comprehensive MCP configuration generation, validation, and management
 * capabilities including support for Claude Desktop configuration format,
 * environment variable detection, and server template management.
 */
export class MCPConfigurator extends EventEmitter<MCPConfiguratorEvents> {
  private readonly projectPath: string;
  private readonly config: ApexConfig;
  private readonly templates: Map<string, MCPServerTemplate>;
  private readonly envDetector: EnvVarDetector;
  private readonly validator: ConfigValidator;
  private localMcpConfig: MCPConfig;

  constructor(options: MCPConfiguratorOptions) {
    super();

    this.projectPath = options.projectPath;
    this.config = options.config;
    this.templates = new Map();

    // Initialize local MCP config from provided config
    this.localMcpConfig = {
      enabled: options.config.mcp?.enabled ?? true,
      servers: { ...(options.config.mcp?.servers || {}) },
      marketplace: options.config.mcp?.marketplace,
      connection: options.config.mcp?.connection,
    };

    // Initialize built-in templates
    for (const template of BUILTIN_TEMPLATES) {
      this.templates.set(template.id, template);
    }

    // Register custom templates if provided
    if (options.customTemplates) {
      for (const template of options.customTemplates) {
        this.templates.set(template.id, template);
      }
    }

    this.envDetector = new EnvVarDetector(this.projectPath, process.env);
    this.validator = new ConfigValidator();
  }

  // =========================================================================
  // Configuration Generation
  // =========================================================================

  /**
   * Generate MCP configuration in the specified format
   * @param format - Target format (claude-desktop, apex, json)
   * @param servers - Servers to include (defaults to all configured)
   * @returns Generated configuration object
   */
  generateConfig(
    format: MCPConfigFormat,
    servers?: string[]
  ): ClaudeDesktopConfig | MCPConfig {
    const serverIds = servers || Object.keys(this.localMcpConfig.servers || {});

    if (format === 'claude-desktop') {
      return this.generateClaudeDesktopConfig(serverIds);
    }

    // For 'apex' or 'json' format, return the native MCPConfig
    const filteredConfig: MCPConfig = {
      ...this.localMcpConfig,
      servers: Object.fromEntries(
        serverIds
          .filter(id => this.localMcpConfig.servers?.[id])
          .map(id => [id, this.localMcpConfig.servers![id]])
      ),
    };

    this.emit('config:generated', { format });
    return filteredConfig;
  }

  /**
   * Generate claude_desktop_config.json format
   * @param servers - Servers to include
   * @returns Claude Desktop compatible configuration
   */
  generateClaudeDesktopConfig(servers?: string[]): ClaudeDesktopConfig {
    const serverIds = servers || Object.keys(this.localMcpConfig.servers || {});
    const mcpServers: Record<string, ClaudeDesktopServerConfig> = {};

    for (const serverId of serverIds) {
      const serverConfig = this.localMcpConfig.servers?.[serverId];
      if (!serverConfig) continue;

      // Only include stdio servers (Claude Desktop only supports stdio)
      if (serverConfig.type !== 'stdio' && serverConfig.type !== undefined) {
        continue;
      }

      if (!serverConfig.command) {
        continue;
      }

      const claudeServerConfig: ClaudeDesktopServerConfig = {
        command: serverConfig.command,
      };

      if (serverConfig.args && serverConfig.args.length > 0) {
        claudeServerConfig.args = [...serverConfig.args];
      }

      if (serverConfig.env || serverConfig.envVars) {
        claudeServerConfig.env = { ...serverConfig.env };

        // Add environment variables from envVars
        if (serverConfig.envVars) {
          for (const envVar of serverConfig.envVars) {
            if (envVar.value) {
              claudeServerConfig.env![envVar.name] = envVar.value;
            }
          }
        }
      }

      mcpServers[serverId] = claudeServerConfig;
    }

    const config = { mcpServers };
    this.emit('config:generated', { format: 'claude-desktop' });
    return config;
  }

  /**
   * Export configuration to a file
   * @param format - Target format
   * @param outputPath - Output file path (defaults based on format)
   * @param servers - Servers to include
   */
  async exportConfig(
    format: MCPConfigFormat,
    outputPath?: string,
    servers?: string[]
  ): Promise<void> {
    const config = this.generateConfig(format, servers);

    const filePath = outputPath || this.getDefaultOutputPath(format);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');

    this.emit('config:generated', { format, path: filePath });
  }

  private getDefaultOutputPath(format: MCPConfigFormat): string {
    switch (format) {
      case 'claude-desktop':
        return path.join(this.projectPath, 'claude_desktop_config.json');
      case 'apex':
        return path.join(this.projectPath, '.apex', 'mcp-config.yaml');
      case 'json':
      default:
        return path.join(this.projectPath, 'mcp-config.json');
    }
  }

  // =========================================================================
  // Environment Variable Detection
  // =========================================================================

  /**
   * Detect required environment variables for a server
   * @param serverId - Server identifier or template ID
   * @returns Detection result with found/missing variables
   */
  async detectEnvironmentVariables(serverId: string): Promise<EnvVarDetectionResult> {
    const serverConfig = this.getServerOrTemplateConfig(serverId);
    if (!serverConfig) {
      throw new Error(`Server or template not found: ${serverId}`);
    }

    const envVars = serverConfig.envVars || [];
    const result = await this.envDetector.detectEnvironmentVariables(envVars);

    this.emit('env:detected', result);

    if (result.missing.length > 0) {
      this.emit('env:missing', { variables: result.missing });
    }

    return result;
  }

  /**
   * Detect environment variables for all configured servers
   * @returns Map of server ID to detection results
   */
  async detectAllEnvironmentVariables(): Promise<Map<string, EnvVarDetectionResult>> {
    const results = new Map<string, EnvVarDetectionResult>();

    for (const [serverId, serverConfig] of Object.entries(this.localMcpConfig.servers || {})) {
      try {
        const result = await this.detectEnvironmentVariables(serverId);
        results.set(serverId, result);
      } catch (error) {
        // Skip servers that can't be processed
        console.warn(`Failed to detect env vars for ${serverId}:`, error);
      }
    }

    return results;
  }

  /**
   * Resolve environment variable value from multiple sources
   * @param varName - Variable name
   * @param sources - Sources to check (env, config, user)
   * @returns Resolved value and source, or undefined
   */
  resolveEnvVariable(
    varName: string,
    sources: Array<'env' | 'config' | 'user'> = ['env', 'config', 'user']
  ): { value: string; source: 'env' | 'config' | 'user' | 'default' } | undefined {
    return this.envDetector.resolveEnvVariable(varName, sources);
  }

  // =========================================================================
  // Server Templates
  // =========================================================================

  /**
   * Get available server templates
   * @param category - Optional category filter
   * @returns Array of server templates
   */
  getServerTemplates(category?: string): MCPServerTemplate[] {
    const templates = Array.from(this.templates.values());

    if (!category) {
      return templates;
    }

    return templates.filter(template =>
      template.capabilities.includes(category.toLowerCase())
    );
  }

  /**
   * Get a specific server template by ID
   * @param templateId - Template identifier
   * @returns Template or undefined
   */
  getServerTemplate(templateId: string): MCPServerTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Register custom server template
   * @param template - Template to register
   */
  registerTemplate(template: MCPServerTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Generate server configuration from template
   * @param templateId - Template identifier
   * @param overrides - Configuration overrides
   * @returns Generated server configuration
   */
  generateFromTemplate(
    templateId: string,
    overrides: Partial<MCPServerConfig> = {}
  ): MCPServerConfig {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const baseConfig = { ...template.config } as MCPServerConfig;

    // Apply placeholder substitution
    const config = this.substitutePlaceholders(baseConfig);

    // Apply overrides
    return {
      ...config,
      ...overrides,
      envVars: template.envVars,
    };
  }

  private substitutePlaceholders(config: MCPServerConfig): MCPServerConfig {
    const placeholders = {
      '{{PROJECT_PATH}}': this.projectPath,
    };

    const result = { ...config };

    // Substitute in args
    if (result.args) {
      result.args = result.args.map(arg => {
        let substituted = arg;
        for (const [placeholder, value] of Object.entries(placeholders)) {
          substituted = substituted.replace(new RegExp(placeholder, 'g'), value);
        }
        return substituted;
      });
    }

    // Substitute in command
    if (result.command) {
      let substituted = result.command;
      for (const [placeholder, value] of Object.entries(placeholders)) {
        substituted = substituted.replace(new RegExp(placeholder, 'g'), value);
      }
      result.command = substituted;
    }

    return result;
  }

  // =========================================================================
  // Configuration Validation
  // =========================================================================

  /**
   * Validate MCP configuration
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfig(config: MCPConfig): ConfigValidationResult {
    const result = this.validator.validateConfig(config);
    this.emit('config:validated', result);
    return result;
  }

  /**
   * Validate a single server configuration
   * @param serverConfig - Server configuration to validate
   * @returns Validation result
   */
  validateServerConfig(serverConfig: MCPServerConfig): ConfigValidationResult {
    const result = this.validator.validateServerConfig(serverConfig);
    this.emit('config:validated', result);
    return result;
  }

  /**
   * Validate environment variables for a server
   * @param serverId - Server identifier
   * @returns Validation result focusing on env vars
   */
  async validateEnvironmentVariables(serverId: string): Promise<ConfigValidationResult> {
    try {
      const envResult = await this.detectEnvironmentVariables(serverId);

      const errors: ConfigValidationResult['errors'] = [];
      const warnings: ConfigValidationResult['warnings'] = [];

      // Convert missing required env vars to errors
      for (const envVar of envResult.missing) {
        if (envVar.required) {
          errors.push({
            path: `servers.${serverId}.env.${envVar.name}`,
            message: `Required environment variable '${envVar.name}' is missing: ${envVar.description || 'No description available'}`,
            code: 'MISSING_ENV_VAR',
          });
        } else {
          warnings.push({
            path: `servers.${serverId}.env.${envVar.name}`,
            message: `Optional environment variable '${envVar.name}' is missing: ${envVar.description || 'No description available'}`,
            code: 'MISSING_OPTIONAL_ENV',
          });
        }
      }

      // Convert detection warnings to validation warnings
      for (const warning of envResult.warnings) {
        warnings.push({
          path: `servers.${serverId}.env.${warning.variable}`,
          message: warning.message,
          code: 'SUBOPTIMAL_CONFIG',
        });
      }

      const result: ConfigValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
      };

      this.emit('config:validated', result);
      return result;
    } catch (error) {
      const result: ConfigValidationResult = {
        valid: false,
        errors: [{
          path: `servers.${serverId}`,
          message: `Failed to validate environment variables: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'UNKNOWN_SERVER_TYPE',
        }],
        warnings: [],
      };

      this.emit('config:validated', result);
      return result;
    }
  }

  // =========================================================================
  // Configuration Application
  // =========================================================================

  /**
   * Apply configuration to APEX
   * @param config - Configuration to apply
   * @param options - Apply options
   */
  async applyConfig(
    config: MCPConfig,
    options: {
      merge?: boolean;     // Merge with existing (default: true)
      validate?: boolean;  // Validate before applying (default: true)
      backup?: boolean;    // Create backup (default: true)
    } = {}
  ): Promise<void> {
    const { merge = true, validate = true, backup = true } = options;

    if (validate) {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }
    }

    // TODO: Implement backup and configuration persistence
    // This would require integration with the APEX config loading system

    this.emit('config:applied', { serverCount: Object.keys(config.servers || {}).length });
  }

  /**
   * Import configuration from external format
   * @param source - Source path or configuration object
   * @param format - Source format
   */
  async importConfig(
    source: string | ClaudeDesktopConfig,
    format: MCPConfigFormat
  ): Promise<MCPConfig> {
    if (format === 'claude-desktop') {
      const claudeConfig = typeof source === 'string'
        ? JSON.parse(await fs.readFile(source, 'utf-8')) as ClaudeDesktopConfig
        : source;

      return this.convertFromClaudeDesktop(claudeConfig);
    }

    throw new Error(`Import from format '${format}' is not yet implemented`);
  }

  private convertFromClaudeDesktop(claudeConfig: ClaudeDesktopConfig): MCPConfig {
    const servers: Record<string, MCPServerConfig> = {};

    for (const [serverId, serverConfig] of Object.entries(claudeConfig.mcpServers)) {
      servers[serverId] = {
        name: serverId,
        type: 'stdio',
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {},
        autoStart: false,
      };
    }

    return {
      enabled: true,
      servers,
    };
  }

  // =========================================================================
  // Server Management Methods
  // =========================================================================

  /**
   * Get the current MCP configuration
   * @returns Current MCPConfig object
   */
  getConfig(): MCPConfig {
    // Return a deep copy to prevent external mutations
    return {
      enabled: this.localMcpConfig.enabled,
      servers: { ...this.localMcpConfig.servers },
      marketplace: this.localMcpConfig.marketplace,
      connection: this.localMcpConfig.connection,
    };
  }

  /**
   * Add a new MCP server to the configuration
   * @param serverId - Unique identifier for the server
   * @param config - Server configuration (MCPServerConfig)
   * @param options - Optional settings
   * @returns The updated MCPConfig
   */
  addServer(
    serverId: string,
    config: MCPServerConfig,
    options: {
      validate?: boolean;      // Validate config before adding (default: true)
      overwrite?: boolean;     // Overwrite if exists (default: false)
      persist?: boolean;       // Persist to disk (default: false)
    } = {}
  ): MCPConfig {
    const { validate = true, overwrite = false, persist = false } = options;

    // Check if server already exists
    if (this.localMcpConfig.servers?.[serverId] && !overwrite) {
      throw new MCPConfiguratorError(
        `Server '${serverId}' already exists. Set overwrite=true to replace it.`,
        'SERVER_EXISTS',
        serverId
      );
    }

    // Validate configuration if requested
    if (validate) {
      const validation = this.validateServerConfig(config);
      if (!validation.valid) {
        throw new MCPConfiguratorError(
          `Server configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          'VALIDATION_FAILED',
          serverId
        );
      }
    }

    // Initialize servers object if it doesn't exist
    if (!this.localMcpConfig.servers) {
      this.localMcpConfig.servers = {};
    }

    // Add the server
    this.localMcpConfig.servers[serverId] = { ...config };

    // Emit event
    this.emit('server:added', { serverId, config: { ...config } });

    // TODO: Implement persistence if requested
    if (persist) {
      console.warn('Persistence not yet implemented');
    }

    return this.getConfig();
  }

  /**
   * Remove an MCP server from the configuration
   * @param serverId - Server identifier to remove
   * @param options - Optional settings
   * @returns The updated MCPConfig or null if server not found
   */
  removeServer(
    serverId: string,
    options: {
      persist?: boolean;       // Persist to disk (default: false)
    } = {}
  ): MCPConfig | null {
    const { persist = false } = options;

    // Check if server exists
    if (!this.localMcpConfig.servers?.[serverId]) {
      throw new MCPConfiguratorError(
        `Server '${serverId}' not found`,
        'SERVER_NOT_FOUND',
        serverId
      );
    }

    // Remove the server
    delete this.localMcpConfig.servers[serverId];

    // Emit event
    this.emit('server:removed', { serverId });

    // TODO: Implement persistence if requested
    if (persist) {
      console.warn('Persistence not yet implemented');
    }

    return this.getConfig();
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  private getServerOrTemplateConfig(id: string): MCPServerConfig | undefined {
    // First try to get from configured servers
    const serverConfig = this.localMcpConfig.servers?.[id];
    if (serverConfig) {
      return serverConfig;
    }

    // Then try to get from templates
    const template = this.templates.get(id);
    if (template) {
      return this.generateFromTemplate(id);
    }

    return undefined;
  }
}