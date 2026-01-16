/**
 * Environment Variable Detection System
 *
 * This module provides the EnvVarDetector class for detecting and resolving
 * environment variables from multiple sources including process environment,
 * configuration files, and environment files.
 *
 * @module orchestrator/mcp/env-detector
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { MCPEnvironmentVar } from '@apexcli/core';
import type { EnvVarDetectionResult } from './configurator.js';

/**
 * Environment variable resolution sources in priority order
 */
export type EnvVarSource = 'env' | 'config' | 'user' | 'default';

/**
 * Result of environment variable resolution
 */
export interface EnvVarResolution {
  value: string;
  source: EnvVarSource;
}

/**
 * Environment variable detector that resolves variables from multiple sources
 *
 * Sources are checked in the following priority order:
 * 1. Process environment (process.env)
 * 2. Configuration files (.apex/config.yaml)
 * 3. Environment files (.env, .env.local, .env.development)
 * 4. Template defaults
 */
export class EnvVarDetector {
  private readonly projectPath: string;
  private readonly processEnv: Record<string, string | undefined>;
  private envFileCache: Map<string, Record<string, string>> = new Map();

  constructor(projectPath: string, processEnv: Record<string, string | undefined> = process.env) {
    this.projectPath = projectPath;
    this.processEnv = processEnv;
  }

  /**
   * Detect environment variables for a set of variable definitions
   * @param envVars - Environment variable definitions to check
   * @returns Detection result with found/missing variables and warnings
   */
  async detectEnvironmentVariables(envVars: MCPEnvironmentVar[]): Promise<EnvVarDetectionResult> {
    const variables: MCPEnvironmentVar[] = [];
    const missing: MCPEnvironmentVar[] = [];
    const found: MCPEnvironmentVar[] = [];
    const warnings: Array<{ variable: string; message: string }> = [];

    for (const envVar of envVars) {
      const resolution = this.resolveEnvVariable(envVar.name, ['env', 'config', 'user', 'default']);
      const enrichedVar: MCPEnvironmentVar = { ...envVar };

      if (resolution) {
        enrichedVar.value = resolution.value;
        enrichedVar.source = resolution.source;

        // Validate against pattern if provided
        if (envVar.pattern && !new RegExp(envVar.pattern).test(resolution.value)) {
          warnings.push({
            variable: envVar.name,
            message: `Value does not match expected pattern: ${envVar.pattern}`,
          });
        }

        // Mask sensitive values
        if (envVar.sensitive) {
          enrichedVar.value = this.maskSensitiveValue(resolution.value);
        }

        found.push(enrichedVar);
      } else {
        // Variable not found
        if (envVar.required) {
          missing.push(enrichedVar);
        } else {
          // Optional variable, add with default if available
          if (envVar.defaultValue) {
            enrichedVar.value = envVar.defaultValue;
            enrichedVar.source = 'default';
            found.push(enrichedVar);
          } else {
            missing.push(enrichedVar);
          }
        }
      }

      variables.push(enrichedVar);
    }

    return {
      variables,
      missing,
      found,
      warnings,
    };
  }

  /**
   * Resolve environment variable value from multiple sources
   * @param varName - Variable name to resolve
   * @param sources - Sources to check in order
   * @returns Resolved value and source, or undefined if not found
   */
  resolveEnvVariable(
    varName: string,
    sources: EnvVarSource[] = ['env', 'config', 'user', 'default']
  ): EnvVarResolution | undefined {
    for (const source of sources) {
      const value = this.getValueFromSource(varName, source);
      if (value !== undefined) {
        return { value, source };
      }
    }

    return undefined;
  }

  /**
   * Get environment variable value from a specific source
   * @param varName - Variable name
   * @param source - Source to check
   * @returns Variable value or undefined
   */
  private getValueFromSource(varName: string, source: EnvVarSource): string | undefined {
    switch (source) {
      case 'env':
        return this.processEnv[varName];

      case 'config':
        // TODO: Implement reading from .apex/config.yaml
        // This would require integration with the config loading system
        return undefined;

      case 'user':
        return this.getFromEnvFiles(varName);

      case 'default':
        // Default values are handled in the detectEnvironmentVariables method
        return undefined;

      default:
        return undefined;
    }
  }

  /**
   * Get environment variable from .env files
   * @param varName - Variable name
   * @returns Variable value or undefined
   */
  private getFromEnvFiles(varName: string): string | undefined {
    const envFiles = [
      '.env.local',
      '.env.development',
      '.env',
    ];

    for (const envFile of envFiles) {
      const envVars = this.loadEnvFile(envFile);
      if (envVars && envVars[varName]) {
        return envVars[varName];
      }
    }

    return undefined;
  }

  /**
   * Load environment variables from a .env file
   * @param filename - Environment file name
   * @returns Environment variables or undefined if file doesn't exist
   */
  private loadEnvFile(filename: string): Record<string, string> | undefined {
    if (this.envFileCache.has(filename)) {
      return this.envFileCache.get(filename);
    }

    try {
      const filePath = path.join(this.projectPath, filename);
      const content = require('fs').readFileSync(filePath, 'utf-8');
      const envVars = this.parseEnvFile(content);
      this.envFileCache.set(filename, envVars);
      return envVars;
    } catch {
      // File doesn't exist or can't be read
      this.envFileCache.set(filename, {});
      return undefined;
    }
  }

  /**
   * Parse .env file content into environment variables
   * @param content - File content
   * @returns Parsed environment variables
   */
  private parseEnvFile(content: string): Record<string, string> {
    const envVars: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        const cleanKey = key.trim();
        let cleanValue = value.trim();

        // Remove quotes if present
        if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
            (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
          cleanValue = cleanValue.slice(1, -1);
        }

        envVars[cleanKey] = cleanValue;
      }
    }

    return envVars;
  }

  /**
   * Mask sensitive environment variable values for display
   * @param value - Value to mask
   * @returns Masked value
   */
  private maskSensitiveValue(value: string): string {
    if (value.length <= 8) {
      return '***';
    }

    const start = value.slice(0, 3);
    const end = value.slice(-3);
    const middle = '*'.repeat(Math.min(value.length - 6, 8));

    return `${start}${middle}${end}`;
  }

  /**
   * Check if all required environment variables are available
   * @param envVars - Environment variable definitions
   * @returns True if all required variables are available
   */
  async areAllRequiredVariablesAvailable(envVars: MCPEnvironmentVar[]): Promise<boolean> {
    const detection = await this.detectEnvironmentVariables(envVars);
    return detection.missing.filter(v => v.required).length === 0;
  }

  /**
   * Get missing required environment variables
   * @param envVars - Environment variable definitions
   * @returns Array of missing required variables
   */
  async getMissingRequiredVariables(envVars: MCPEnvironmentVar[]): Promise<MCPEnvironmentVar[]> {
    const detection = await this.detectEnvironmentVariables(envVars);
    return detection.missing.filter(v => v.required);
  }

  /**
   * Validate environment variable against its pattern
   * @param envVar - Environment variable definition
   * @param value - Value to validate
   * @returns True if value is valid or no pattern is specified
   */
  validateEnvironmentVariable(envVar: MCPEnvironmentVar, value: string): boolean {
    if (!envVar.pattern) {
      return true;
    }

    try {
      return new RegExp(envVar.pattern).test(value);
    } catch {
      // Invalid regex pattern
      return false;
    }
  }

  /**
   * Generate environment variable setup instructions
   * @param envVars - Environment variables that need to be set
   * @returns Setup instructions for different platforms
   */
  generateSetupInstructions(envVars: MCPEnvironmentVar[]): {
    bash: string[];
    powershell: string[];
    envFile: string[];
  } {
    const bash: string[] = [];
    const powershell: string[] = [];
    const envFile: string[] = [];

    for (const envVar of envVars) {
      const placeholder = envVar.sensitive ? '<your-secret-value>' : '<your-value>';
      const description = envVar.description ? ` # ${envVar.description}` : '';

      bash.push(`export ${envVar.name}="${placeholder}"${description}`);
      powershell.push(`$env:${envVar.name}="${placeholder}"${description}`);
      envFile.push(`${envVar.name}=${placeholder}${description}`);
    }

    return { bash, powershell, envFile };
  }

  /**
   * Clear cached environment files (useful for testing or config changes)
   */
  clearCache(): void {
    this.envFileCache.clear();
  }
}