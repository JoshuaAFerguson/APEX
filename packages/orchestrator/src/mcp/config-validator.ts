/**
 * MCP Configuration Validation System
 *
 * This module provides the ConfigValidator class for validating MCP configurations
 * against business rules, ensuring server configurations are complete and valid.
 *
 * @module orchestrator/mcp/config-validator
 */

import { MCPConfig, MCPServerConfig, MCPConfigSchema, MCPServerConfigSchema } from '@apexcli/core';
import { ZodError } from 'zod';
import type {
  ConfigValidationResult,
  ConfigValidationErrorCode,
  ConfigValidationWarningCode
} from './configurator.js';

/**
 * Validation error or warning
 */
interface ValidationIssue {
  path: string;
  message: string;
  code: ConfigValidationErrorCode | ConfigValidationWarningCode;
  severity: 'error' | 'warning';
}

/**
 * Configuration validator for MCP configurations
 *
 * Validates MCP configurations against schema and business rules,
 * providing detailed error messages and warnings to help users
 * fix configuration issues.
 */
export class ConfigValidator {
  /**
   * Validate complete MCP configuration
   * @param config - MCP configuration to validate
   * @returns Validation result with errors and warnings
   */
  validateConfig(config: MCPConfig): ConfigValidationResult {
    const issues: ValidationIssue[] = [];

    // Schema validation
    try {
      MCPConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof ZodError) {
        for (const issue of error.errors) {
          issues.push({
            path: issue.path.join('.'),
            message: issue.message,
            code: 'MISSING_REQUIRED_FIELD',
            severity: 'error',
          });
        }
      }
    }

    // Business logic validation
    if (config.servers) {
      for (const [serverId, serverConfig] of Object.entries(config.servers)) {
        const serverIssues = this.validateServerConfigInternal(serverConfig, serverId);
        issues.push(...serverIssues);
      }
    }

    // Global validation rules
    this.validateGlobalRules(config, issues);

    return this.formatValidationResult(issues);
  }

  /**
   * Validate single server configuration
   * @param serverConfig - Server configuration to validate
   * @param serverId - Server identifier for error paths
   * @returns Validation result
   */
  validateServerConfig(serverConfig: MCPServerConfig, serverId?: string): ConfigValidationResult {
    const issues: ValidationIssue[] = [];
    const serverIssues = this.validateServerConfigInternal(serverConfig, serverId || 'server');
    issues.push(...serverIssues);

    return this.formatValidationResult(issues);
  }

  /**
   * Internal server configuration validation
   * @param serverConfig - Server configuration to validate
   * @param serverId - Server identifier for error paths
   * @returns Array of validation issues
   */
  private validateServerConfigInternal(
    serverConfig: MCPServerConfig,
    serverId: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const basePath = `servers.${serverId}`;

    // Schema validation
    try {
      MCPServerConfigSchema.parse(serverConfig);
    } catch (error) {
      if (error instanceof ZodError) {
        for (const issue of error.errors) {
          issues.push({
            path: `${basePath}.${issue.path.join('.')}`,
            message: issue.message,
            code: 'MISSING_REQUIRED_FIELD',
            severity: 'error',
          });
        }
      }
    }

    // Type-specific validation
    this.validateServerType(serverConfig, basePath, issues);

    // Command validation
    this.validateCommand(serverConfig, basePath, issues);

    // URL validation
    this.validateUrl(serverConfig, basePath, issues);

    // Environment variable validation
    this.validateEnvironmentVariables(serverConfig, basePath, issues);

    // Configuration conflicts
    this.validateConfigurationConflicts(serverConfig, basePath, issues);

    // Best practices and warnings
    this.validateBestPractices(serverConfig, basePath, issues);

    return issues;
  }

  /**
   * Validate server type configuration
   */
  private validateServerType(
    serverConfig: MCPServerConfig,
    basePath: string,
    issues: ValidationIssue[]
  ): void {
    const type = serverConfig.type || 'stdio';
    const validTypes = ['stdio', 'http', 'sse', 'sdk'];

    if (!validTypes.includes(type)) {
      issues.push({
        path: `${basePath}.type`,
        message: `Invalid server type '${type}'. Must be one of: ${validTypes.join(', ')}`,
        code: 'UNKNOWN_SERVER_TYPE',
        severity: 'error',
      });
    }
  }

  /**
   * Validate command configuration for stdio servers
   */
  private validateCommand(
    serverConfig: MCPServerConfig,
    basePath: string,
    issues: ValidationIssue[]
  ): void {
    const type = serverConfig.type || 'stdio';

    if (type === 'stdio') {
      if (!serverConfig.command) {
        issues.push({
          path: `${basePath}.command`,
          message: 'Command is required for stdio servers',
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error',
        });
      } else {
        // Validate command exists or is accessible
        this.validateCommandAccessibility(serverConfig.command, basePath, issues);
      }
    }
  }

  /**
   * Validate command accessibility
   */
  private validateCommandAccessibility(
    command: string,
    basePath: string,
    issues: ValidationIssue[]
  ): void {
    // Common commands that should exist
    const commonCommands = ['node', 'npm', 'npx', 'python', 'python3'];

    if (!commonCommands.includes(command) && !command.startsWith('/')) {
      issues.push({
        path: `${basePath}.command`,
        message: `Command '${command}' may not be accessible. Consider using full path or common commands like 'npx'`,
        code: 'INVALID_COMMAND',
        severity: 'warning',
      });
    }

    // Check for potential security issues
    if (command.includes('..') || command.includes(';') || command.includes('|')) {
      issues.push({
        path: `${basePath}.command`,
        message: 'Command contains potentially unsafe characters',
        code: 'INVALID_COMMAND',
        severity: 'error',
      });
    }
  }

  /**
   * Validate URL configuration for http/sse servers
   */
  private validateUrl(
    serverConfig: MCPServerConfig,
    basePath: string,
    issues: ValidationIssue[]
  ): void {
    const type = serverConfig.type || 'stdio';

    if (type === 'http' || type === 'sse') {
      if (!serverConfig.url) {
        issues.push({
          path: `${basePath}.url`,
          message: `URL is required for ${type} servers`,
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error',
        });
      } else {
        // Validate URL format
        try {
          const url = new URL(serverConfig.url);

          // Check protocol
          if (!['http:', 'https:'].includes(url.protocol)) {
            issues.push({
              path: `${basePath}.url`,
              message: 'URL must use HTTP or HTTPS protocol',
              code: 'INVALID_URL',
              severity: 'error',
            });
          }

          // Warn about HTTP in production
          if (url.protocol === 'http:' && url.hostname !== 'localhost' && !url.hostname.startsWith('127.')) {
            issues.push({
              path: `${basePath}.url`,
              message: 'Using HTTP for non-local servers is insecure. Consider using HTTPS',
              code: 'SUBOPTIMAL_CONFIG',
              severity: 'warning',
            });
          }
        } catch {
          issues.push({
            path: `${basePath}.url`,
            message: 'Invalid URL format',
            code: 'INVALID_URL',
            severity: 'error',
          });
        }
      }
    }
  }

  /**
   * Validate environment variables
   */
  private validateEnvironmentVariables(
    serverConfig: MCPServerConfig,
    basePath: string,
    issues: ValidationIssue[]
  ): void {
    // Check for conflicting env definitions
    if (serverConfig.env && serverConfig.envVars) {
      const envKeys = Object.keys(serverConfig.env);
      const envVarKeys = serverConfig.envVars.map(v => v.name);
      const conflicts = envKeys.filter(key => envVarKeys.includes(key));

      if (conflicts.length > 0) {
        issues.push({
          path: `${basePath}.env`,
          message: `Environment variables defined in both 'env' and 'envVars': ${conflicts.join(', ')}`,
          code: 'CONFLICTING_CONFIG',
          severity: 'warning',
        });
      }
    }

    // Validate envVars patterns
    if (serverConfig.envVars) {
      for (const [index, envVar] of serverConfig.envVars.entries()) {
        if (envVar.pattern) {
          try {
            new RegExp(envVar.pattern);
          } catch {
            issues.push({
              path: `${basePath}.envVars.${index}.pattern`,
              message: `Invalid regex pattern for environment variable '${envVar.name}'`,
              code: 'INVALID_COMMAND',
              severity: 'error',
            });
          }
        }

        // Validate required sensitive variables have patterns
        if (envVar.required && envVar.sensitive && !envVar.pattern) {
          issues.push({
            path: `${basePath}.envVars.${index}`,
            message: `Required sensitive variable '${envVar.name}' should have a validation pattern`,
            code: 'SUBOPTIMAL_CONFIG',
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Validate configuration conflicts
   */
  private validateConfigurationConflicts(
    serverConfig: MCPServerConfig,
    basePath: string,
    issues: ValidationIssue[]
  ): void {
    const type = serverConfig.type || 'stdio';

    // Check for type-specific configuration conflicts
    if (type === 'stdio' && serverConfig.url) {
      issues.push({
        path: `${basePath}.url`,
        message: 'URL should not be specified for stdio servers',
        code: 'CONFLICTING_CONFIG',
        severity: 'warning',
      });
    }

    if ((type === 'http' || type === 'sse') && serverConfig.command) {
      issues.push({
        path: `${basePath}.command`,
        message: `Command should not be specified for ${type} servers`,
        code: 'CONFLICTING_CONFIG',
        severity: 'warning',
      });
    }

    if ((type === 'http' || type === 'sse') && serverConfig.args) {
      issues.push({
        path: `${basePath}.args`,
        message: `Args should not be specified for ${type} servers`,
        code: 'CONFLICTING_CONFIG',
        severity: 'warning',
      });
    }
  }

  /**
   * Validate best practices and generate warnings
   */
  private validateBestPractices(
    serverConfig: MCPServerConfig,
    basePath: string,
    issues: ValidationIssue[]
  ): void {
    // Check for empty capabilities
    if (!serverConfig.capabilities || serverConfig.capabilities.length === 0) {
      issues.push({
        path: `${basePath}.capabilities`,
        message: 'Server capabilities are not specified. Consider adding them for better documentation',
        code: 'SUBOPTIMAL_CONFIG',
        severity: 'warning',
      });
    }

    // Check for autoStart on servers that might need env vars
    if (serverConfig.autoStart && serverConfig.envVars?.some(v => v.required)) {
      issues.push({
        path: `${basePath}.autoStart`,
        message: 'Server is set to auto-start but requires environment variables. Ensure they are configured',
        code: 'SUBOPTIMAL_CONFIG',
        severity: 'warning',
      });
    }

    // Check for missing description in envVars
    if (serverConfig.envVars) {
      for (const [index, envVar] of serverConfig.envVars.entries()) {
        if (!envVar.description && envVar.required) {
          issues.push({
            path: `${basePath}.envVars.${index}.description`,
            message: `Required environment variable '${envVar.name}' should have a description`,
            code: 'SUBOPTIMAL_CONFIG',
            severity: 'warning',
          });
        }
      }
    }
  }

  /**
   * Validate global configuration rules
   */
  private validateGlobalRules(config: MCPConfig, issues: ValidationIssue[]): void {
    // Check for duplicate server names
    if (config.servers) {
      const serverNames = Object.values(config.servers).map(s => s.name);
      const duplicates = serverNames.filter((name, index, arr) =>
        arr.indexOf(name) !== index
      );

      if (duplicates.length > 0) {
        issues.push({
          path: 'servers',
          message: `Duplicate server names found: ${[...new Set(duplicates)].join(', ')}`,
          code: 'CONFLICTING_CONFIG',
          severity: 'error',
        });
      }
    }

    // Warn about disabled MCP with configured servers
    if (config.enabled === false && config.servers && Object.keys(config.servers).length > 0) {
      issues.push({
        path: 'enabled',
        message: 'MCP is disabled but servers are configured. They will not be started',
        code: 'SUBOPTIMAL_CONFIG',
        severity: 'warning',
      });
    }
  }

  /**
   * Format validation issues into the result structure
   */
  private formatValidationResult(issues: ValidationIssue[]): ConfigValidationResult {
    const errors = issues
      .filter(issue => issue.severity === 'error')
      .map(issue => ({
        path: issue.path,
        message: issue.message,
        code: issue.code as ConfigValidationErrorCode,
      }));

    const warnings = issues
      .filter(issue => issue.severity === 'warning')
      .map(issue => ({
        path: issue.path,
        message: issue.message,
        code: issue.code as ConfigValidationWarningCode,
      }));

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate Claude Desktop configuration format
   * @param config - Claude Desktop configuration
   * @returns Validation result
   */
  validateClaudeDesktopConfig(config: any): ConfigValidationResult {
    const issues: ValidationIssue[] = [];

    if (!config || typeof config !== 'object') {
      issues.push({
        path: '',
        message: 'Configuration must be an object',
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'error',
      });
      return this.formatValidationResult(issues);
    }

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      issues.push({
        path: 'mcpServers',
        message: 'mcpServers field is required and must be an object',
        code: 'MISSING_REQUIRED_FIELD',
        severity: 'error',
      });
      return this.formatValidationResult(issues);
    }

    // Validate each server
    for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
      if (!serverConfig || typeof serverConfig !== 'object') {
        issues.push({
          path: `mcpServers.${serverId}`,
          message: 'Server configuration must be an object',
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error',
        });
        continue;
      }

      const server = serverConfig as any;

      // Command is required for Claude Desktop (only supports stdio)
      if (!server.command || typeof server.command !== 'string') {
        issues.push({
          path: `mcpServers.${serverId}.command`,
          message: 'Command is required and must be a string',
          code: 'MISSING_REQUIRED_FIELD',
          severity: 'error',
        });
      }

      // Validate args if present
      if (server.args !== undefined && !Array.isArray(server.args)) {
        issues.push({
          path: `mcpServers.${serverId}.args`,
          message: 'Args must be an array of strings',
          code: 'INVALID_COMMAND',
          severity: 'error',
        });
      }

      // Validate env if present
      if (server.env !== undefined && typeof server.env !== 'object') {
        issues.push({
          path: `mcpServers.${serverId}.env`,
          message: 'Environment variables must be an object',
          code: 'INVALID_COMMAND',
          severity: 'error',
        });
      }
    }

    return this.formatValidationResult(issues);
  }
}