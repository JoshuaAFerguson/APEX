/**
 * @fileoverview MCPConfigValidator for MCP configuration validation
 *
 * This module provides comprehensive validation for MCP (Model Context Protocol)
 * server configurations. It validates JSON structure, required fields, environment
 * variable availability, and command existence to ensure MCP servers can be properly
 * configured and started.
 *
 * ## Key Features
 * - JSON structure validation using Zod schemas
 * - Required field validation with detailed error messages
 * - Environment variable availability checking
 * - Command existence validation for server executables
 * - Structured validation results with actionable feedback
 *
 * @module @apex/core/validation/mcp-config-validator
 */

import { z } from 'zod';
import { execSync } from 'child_process';
import { access, constants } from 'fs/promises';
import path from 'path';
import {
  MCPConfigSchema,
  MCPServerConfigSchema,
  MCPConnectionConfigSchema,
  MCPEnvironmentVarSchema,
  type MCPConfig,
  type MCPServerConfig,
  type MCPEnvironmentVar,
} from '../types.js';

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Severity levels for validation issues
 */
export const ValidationSeveritySchema = z.enum([
  'error',   // Critical issue that prevents configuration from working
  'warning', // Non-critical issue that may cause problems
  'info',    // Informational message about configuration
]);
export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>;

/**
 * Individual validation issue
 */
export const ValidationIssueSchema = z.object({
  /** Unique identifier for this type of validation issue */
  code: z.string().min(1),
  /** Human-readable message describing the issue */
  message: z.string().min(1),
  /** Severity level of this issue */
  severity: ValidationSeveritySchema,
  /** Path to the configuration field that has the issue (e.g., "servers.myserver.command") */
  path: z.string().optional(),
  /** Suggested action to resolve the issue */
  suggestion: z.string().optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/**
 * Result of MCP configuration validation
 */
export const MCPValidationResultSchema = z.object({
  /** Whether the overall configuration is valid */
  isValid: z.boolean(),
  /** List of validation issues found */
  issues: z.array(ValidationIssueSchema),
  /** Number of errors found */
  errorCount: z.number().min(0),
  /** Number of warnings found */
  warningCount: z.number().min(0),
  /** Number of info messages */
  infoCount: z.number().min(0),
});
export type MCPValidationResult = z.infer<typeof MCPValidationResultSchema>;

// ============================================================================
// Validation Options
// ============================================================================

/**
 * Options for MCP configuration validation
 */
export const MCPValidationOptionsSchema = z.object({
  /** Whether to check if environment variables are actually set */
  checkEnvironmentVars: z.boolean().default(true),
  /** Whether to check if commands exist and are executable */
  checkCommandExistence: z.boolean().default(true),
  /** Whether to validate connection configuration values */
  validateConnectionConfig: z.boolean().default(true),
  /** Additional environment variables to consider as available */
  additionalEnvVars: z.array(z.string()).default([]),
  /** Base directory for resolving relative command paths */
  baseDirectory: z.string().optional(),
});
export type MCPValidationOptions = z.infer<typeof MCPValidationOptionsSchema>;

// ============================================================================
// MCPConfigValidator Class
// ============================================================================

/**
 * Comprehensive validator for MCP configurations
 */
export class MCPConfigValidator {
  private readonly options: MCPValidationOptions;

  constructor(options: Partial<MCPValidationOptions> = {}) {
    this.options = MCPValidationOptionsSchema.parse(options);
  }

  /**
   * Validate a complete MCP configuration
   */
  async validate(config: unknown): Promise<MCPValidationResult> {
    const issues: ValidationIssue[] = [];

    // Step 1: Validate JSON structure using Zod schema
    const structureValidation = this.validateStructure(config);
    issues.push(...structureValidation.issues);

    // If structure validation fails, we can't proceed with detailed validation
    if (!structureValidation.parsedConfig) {
      return this.createResult(issues);
    }

    const parsedConfig = structureValidation.parsedConfig;

    // Step 2: Validate required fields and configuration logic
    const logicIssues = await this.validateConfigurationLogic(parsedConfig);
    issues.push(...logicIssues);

    // Step 3: Validate individual server configurations
    if (parsedConfig.servers) {
      for (const [serverId, serverConfig] of Object.entries(parsedConfig.servers)) {
        const serverIssues = await this.validateServer(serverId, serverConfig);
        issues.push(...serverIssues);
      }
    }

    return this.createResult(issues);
  }

  /**
   * Validate only the JSON structure of the configuration
   */
  validateStructure(config: unknown): {
    issues: ValidationIssue[];
    parsedConfig: MCPConfig | null;
  } {
    const issues: ValidationIssue[] = [];

    try {
      const parsedConfig = MCPConfigSchema.parse(config);
      return { issues, parsedConfig };
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          issues.push({
            code: 'SCHEMA_VALIDATION_ERROR',
            message: `Invalid configuration at ${issue.path.join('.')}: ${issue.message}`,
            severity: 'error',
            path: issue.path.join('.'),
            suggestion: this.getSchemaValidationSuggestion(issue),
          });
        }
      } else {
        issues.push({
          code: 'PARSE_ERROR',
          message: `Failed to parse configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
          suggestion: 'Ensure the configuration is valid JSON/YAML and follows the MCP configuration schema',
        });
      }
      return { issues, parsedConfig: null };
    }
  }

  /**
   * Validate configuration-level logic and constraints
   */
  private async validateConfigurationLogic(config: MCPConfig): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if MCP is enabled but no servers are configured
    if (config.enabled && (!config.servers || Object.keys(config.servers).length === 0)) {
      issues.push({
        code: 'NO_SERVERS_CONFIGURED',
        message: 'MCP is enabled but no servers are configured',
        severity: 'warning',
        path: 'servers',
        suggestion: 'Add at least one server configuration or disable MCP',
      });
    }

    // Validate global connection configuration if present
    if (config.connection && this.options.validateConnectionConfig) {
      const connectionIssues = this.validateConnectionConfig(config.connection, 'connection');
      issues.push(...connectionIssues);
    }

    return issues;
  }

  /**
   * Validate an individual server configuration
   */
  private async validateServer(serverId: string, config: MCPServerConfig): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const basePath = `servers.${serverId}`;

    // Validate required fields
    if (!config.command) {
      issues.push({
        code: 'MISSING_COMMAND',
        message: `Server '${serverId}' is missing required 'command' field`,
        severity: 'error',
        path: `${basePath}.command`,
        suggestion: 'Specify the command to execute the MCP server (e.g., "npx", "node", or path to executable)',
      });
    }

    // Validate command existence if specified
    if (config.command && this.options.checkCommandExistence) {
      const commandIssues = await this.validateCommandExistence(config.command, `${basePath}.command`);
      issues.push(...commandIssues);
    }

    // Validate environment variables
    if (config.envVars && this.options.checkEnvironmentVars) {
      for (let i = 0; i < config.envVars.length; i++) {
        const envVar = config.envVars[i];
        const envIssues = await this.validateEnvironmentVariable(envVar, `${basePath}.envVars[${i}]`);
        issues.push(...envIssues);
      }
    }

    // Validate server-specific connection configuration
    if (config.connection && this.options.validateConnectionConfig) {
      const connectionIssues = this.validateConnectionConfig(config.connection, `${basePath}.connection`);
      issues.push(...connectionIssues);
    }

    // Check for potential issues with server configuration
    if (config.autoStart === false && config.enabled !== false) {
      issues.push({
        code: 'AUTOSTART_DISABLED_BUT_ENABLED',
        message: `Server '${serverId}' has autoStart disabled but is still enabled`,
        severity: 'info',
        path: `${basePath}.autoStart`,
        suggestion: 'Consider setting enabled: false if this server should not be used, or enable autoStart if it should start automatically',
      });
    }

    return issues;
  }

  /**
   * Validate command existence and executability
   */
  private async validateCommandExistence(command: string, configPath: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Check if it's a system command (like npx, node, python)
      if (this.isSystemCommand(command)) {
        try {
          execSync(`which ${command}`, { stdio: 'ignore' });
          return issues; // Command exists in PATH
        } catch {
          issues.push({
            code: 'COMMAND_NOT_FOUND',
            message: `Command '${command}' not found in system PATH`,
            severity: 'error',
            path: configPath,
            suggestion: `Install the required command or provide full path to executable. For common commands: npm install -g for npx, install Node.js for node, etc.`,
          });
          return issues;
        }
      }

      // For file paths, resolve and check existence
      const resolvedPath = this.options.baseDirectory
        ? path.resolve(this.options.baseDirectory, command)
        : path.resolve(command);

      try {
        await access(resolvedPath, constants.F_OK | constants.X_OK);
      } catch {
        issues.push({
          code: 'EXECUTABLE_NOT_FOUND',
          message: `Executable not found or not accessible: ${resolvedPath}`,
          severity: 'error',
          path: configPath,
          suggestion: 'Ensure the file exists and has execute permissions, or use a command available in PATH',
        });
      }
    } catch (error) {
      issues.push({
        code: 'COMMAND_VALIDATION_ERROR',
        message: `Error validating command '${command}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'warning',
        path: configPath,
        suggestion: 'Check command syntax and accessibility',
      });
    }

    return issues;
  }

  /**
   * Validate environment variable configuration and availability
   */
  private async validateEnvironmentVariable(envVar: MCPEnvironmentVar, configPath: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check if required environment variable is available
    if (envVar.required) {
      const isAvailable = process.env[envVar.name] !== undefined ||
                         this.options.additionalEnvVars.includes(envVar.name);

      if (!isAvailable) {
        issues.push({
          code: 'REQUIRED_ENV_VAR_MISSING',
          message: `Required environment variable '${envVar.name}' is not set`,
          severity: 'error',
          path: `${configPath}.name`,
          suggestion: envVar.description
            ? `Set the environment variable: export ${envVar.name}=<value>. ${envVar.description}`
            : `Set the environment variable: export ${envVar.name}=<value>`,
        });
      }
    }

    // Validate default value if provided
    if (envVar.defaultValue !== undefined && typeof envVar.defaultValue !== 'string') {
      issues.push({
        code: 'INVALID_DEFAULT_VALUE',
        message: `Default value for environment variable '${envVar.name}' must be a string`,
        severity: 'error',
        path: `${configPath}.defaultValue`,
        suggestion: 'Provide a string value for the defaultValue field',
      });
    }

    return issues;
  }

  /**
   * Validate connection configuration parameters
   */
  private validateConnectionConfig(connection: any, configPath: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      MCPConnectionConfigSchema.parse(connection);

      // Additional validation for connection parameters
      if (connection.timeout && connection.timeout < 1000) {
        issues.push({
          code: 'TIMEOUT_TOO_LOW',
          message: `Connection timeout of ${connection.timeout}ms may be too low`,
          severity: 'warning',
          path: `${configPath}.timeout`,
          suggestion: 'Consider using a timeout of at least 1000ms (1 second) for reliable connections',
        });
      }

      if (connection.maxConcurrentConnections && connection.maxConcurrentConnections > 100) {
        issues.push({
          code: 'MAX_CONNECTIONS_HIGH',
          message: `Maximum concurrent connections of ${connection.maxConcurrentConnections} is very high`,
          severity: 'warning',
          path: `${configPath}.maxConcurrentConnections`,
          suggestion: 'Consider using a lower value to avoid resource exhaustion',
        });
      }

    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          issues.push({
            code: 'CONNECTION_CONFIG_ERROR',
            message: `Invalid connection configuration at ${issue.path.join('.')}: ${issue.message}`,
            severity: 'error',
            path: `${configPath}.${issue.path.join('.')}`,
            suggestion: 'Check connection configuration against the schema',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Create validation result from issues
   */
  private createResult(issues: ValidationIssue[]): MCPValidationResult {
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    return {
      isValid: errorCount === 0,
      issues,
      errorCount,
      warningCount,
      infoCount,
    };
  }

  /**
   * Check if a command is a system command (not a file path)
   */
  private isSystemCommand(command: string): boolean {
    return !command.includes('/') && !command.includes('\\') && !path.isAbsolute(command);
  }

  /**
   * Generate helpful suggestions for schema validation errors
   */
  private getSchemaValidationSuggestion(issue: z.ZodIssue): string {
    switch (issue.code) {
      case 'invalid_type':
        return `Expected ${issue.expected}, but got ${issue.received}`;
      case 'too_small':
        if (issue.type === 'string') {
          return `String must be at least ${issue.minimum} characters long`;
        }
        return `Value must be at least ${issue.minimum}`;
      case 'too_big':
        if (issue.type === 'string') {
          return `String must be at most ${issue.maximum} characters long`;
        }
        return `Value must be at most ${issue.maximum}`;
      case 'invalid_enum_value':
        return `Value must be one of: ${issue.options?.join(', ')}`;
      default:
        return 'Check the configuration schema for valid values';
    }
  }
}

/**
 * Convenience function to validate MCP configuration
 */
export async function validateMCPConfig(
  config: unknown,
  options?: Partial<MCPValidationOptions>
): Promise<MCPValidationResult> {
  const validator = new MCPConfigValidator(options);
  return await validator.validate(config);
}

/**
 * Convenience function to validate only structure
 */
export function validateMCPConfigStructure(config: unknown): {
  issues: ValidationIssue[];
  parsedConfig: MCPConfig | null;
} {
  const validator = new MCPConfigValidator();
  return validator.validateStructure(config);
}