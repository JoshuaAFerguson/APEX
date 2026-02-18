/**
 * Environment Variable Auto-Detection Utility
 *
 * This module provides the EnvironmentDetector class for automatically scanning
 * projects for .env files, detecting common environment variable patterns,
 * and mapping them to MCP server requirements.
 *
 * @module core/environment-detector
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { MCPEnvironmentVar } from './types';

/**
 * Result of environment detection scan
 */
export interface EnvironmentDetectionResult {
  /** Available environment variables found in the project */
  available: DetectedEnvironmentVar[];
  /** Required environment variables from MCP server configs */
  required: MCPEnvironmentVar[];
  /** Variables that are required but missing */
  missing: MCPEnvironmentVar[];
  /** Variables that are available and satisfy requirements */
  satisfied: MCPEnvironmentVar[];
  /** .env files found in the project */
  envFiles: string[];
  /** Warnings about detected issues */
  warnings: Array<{ file: string; message: string }>;
}

/**
 * Detected environment variable from project scanning
 */
export interface DetectedEnvironmentVar {
  /** Variable name */
  name: string;
  /** Variable value (may be masked if sensitive) */
  value: string;
  /** File where the variable was found */
  source: string;
  /** Whether the value appears to be sensitive */
  sensitive: boolean;
  /** Detected pattern/type (e.g., 'api-key', 'url', 'database-url') */
  pattern?: string;
}

/**
 * Common environment variable patterns for auto-detection
 */
const COMMON_ENV_PATTERNS = [
  // API Keys and Tokens
  { pattern: /.*_API_KEY$/, type: 'api-key', sensitive: true },
  { pattern: /.*_ACCESS_TOKEN$/, type: 'access-token', sensitive: true },
  { pattern: /.*_SECRET_KEY$/, type: 'secret-key', sensitive: true },
  { pattern: /.*_SECRET$/, type: 'secret', sensitive: true },
  { pattern: /.*_TOKEN$/, type: 'token', sensitive: true },
  { pattern: /^API_KEY$/, type: 'api-key', sensitive: true },
  { pattern: /^SECRET$/, type: 'secret', sensitive: true },
  { pattern: /^TOKEN$/, type: 'token', sensitive: true },

  // Database URLs
  { pattern: /.*_DATABASE_URL$/, type: 'database-url', sensitive: true },
  { pattern: /.*_DB_URL$/, type: 'database-url', sensitive: true },
  { pattern: /^DATABASE_URL$/, type: 'database-url', sensitive: true },
  { pattern: /^DB_URL$/, type: 'database-url', sensitive: true },

  // Service URLs
  { pattern: /.*_URL$/, type: 'url', sensitive: false },
  { pattern: /.*_ENDPOINT$/, type: 'endpoint', sensitive: false },
  { pattern: /^URL$/, type: 'url', sensitive: false },
  { pattern: /^ENDPOINT$/, type: 'endpoint', sensitive: false },

  // Configuration
  { pattern: /.*_ENV$/, type: 'environment', sensitive: false },
  { pattern: /.*_MODE$/, type: 'mode', sensitive: false },
  { pattern: /^NODE_ENV$/, type: 'environment', sensitive: false },
  { pattern: /^ENV$/, type: 'environment', sensitive: false },

  // Ports and Hosts
  { pattern: /.*_PORT$/, type: 'port', sensitive: false },
  { pattern: /.*_HOST$/, type: 'host', sensitive: false },
  { pattern: /^PORT$/, type: 'port', sensitive: false },
  { pattern: /^HOST$/, type: 'host', sensitive: false },
] as const;

/**
 * Standard .env file names to scan for
 */
const ENV_FILE_NAMES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.test',
  '.env.production',
  '.env.staging',
  '.env.example',
  '.env.template',
] as const;

/**
 * EnvironmentDetector class that scans projects for environment variables
 * and maps them to MCP server requirements
 */
export class EnvironmentDetector {
  private readonly projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Scan project for .env files and detect environment variables
   * @returns Promise resolving to detected environment variables and files
   */
  async scanProject(): Promise<{
    envFiles: string[];
    variables: DetectedEnvironmentVar[];
    warnings: Array<{ file: string; message: string }>;
  }> {
    const envFiles: string[] = [];
    const variables: DetectedEnvironmentVar[] = [];
    const warnings: Array<{ file: string; message: string }> = [];

    // Scan for .env files
    for (const fileName of ENV_FILE_NAMES) {
      const filePath = path.join(this.projectPath, fileName);

      try {
        await fs.access(filePath);
        envFiles.push(fileName);

        // Parse the .env file
        const fileVariables = await this.parseEnvFile(filePath);
        variables.push(...fileVariables);
      } catch {
        // File doesn't exist, continue
      }
    }

    // Also scan subdirectories for .env files (one level deep)
    try {
      const entries = await fs.readdir(this.projectPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          for (const fileName of ENV_FILE_NAMES) {
            const subFilePath = path.join(this.projectPath, entry.name, fileName);
            try {
              await fs.access(subFilePath);
              const relativePath = path.join(entry.name, fileName);
              envFiles.push(relativePath);

              const fileVariables = await this.parseEnvFile(subFilePath);
              variables.push(...fileVariables.map(v => ({
                ...v,
                source: relativePath,
              })));
            } catch {
              // File doesn't exist, continue
            }
          }
        }
      }
    } catch (error) {
      warnings.push({
        file: this.projectPath,
        message: `Failed to scan subdirectories: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return { envFiles, variables, warnings };
  }

  /**
   * Parse a .env file and extract environment variables
   * @param filePath - Path to the .env file
   * @returns Promise resolving to detected variables
   */
  async parseEnvFile(filePath: string): Promise<DetectedEnvironmentVar[]> {
    const variables: DetectedEnvironmentVar[] = [];
    const source = path.relative(this.projectPath, filePath);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = lines[lineNumber].trim();

        // Skip empty lines and comments
        if (!line || line.startsWith('#')) {
          continue;
        }

        // Parse KEY=VALUE format
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const [, key, value] = match;
          const cleanKey = key.trim();
          let cleanValue = value.trim();

          // Remove quotes if present
          if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
              (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
            cleanValue = cleanValue.slice(1, -1);
          }

          // Detect pattern and sensitivity
          const detectedPattern = this.detectVariablePattern(cleanKey);
          const sensitive = detectedPattern?.sensitive ?? this.isSensitiveValue(cleanValue);

          variables.push({
            name: cleanKey,
            value: sensitive ? this.maskSensitiveValue(cleanValue) : cleanValue,
            source,
            sensitive,
            pattern: detectedPattern?.type,
          });
        }
      }
    } catch (error) {
      // Error reading file - this should have been caught in scanProject
      throw new Error(`Failed to parse .env file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return variables;
  }

  /**
   * Map detected environment variables to MCP server requirements
   * @param detectedVars - Variables detected from project scan
   * @param requiredVars - Required variables from MCP server configs
   * @returns Analysis of missing vs available variables
   */
  async mapToMCPRequirements(
    detectedVars: DetectedEnvironmentVar[],
    requiredVars: MCPEnvironmentVar[]
  ): Promise<{
    missing: MCPEnvironmentVar[];
    satisfied: MCPEnvironmentVar[];
    suggestions: Array<{
      required: MCPEnvironmentVar;
      suggestions: DetectedEnvironmentVar[];
    }>;
  }> {
    const missing: MCPEnvironmentVar[] = [];
    const satisfied: MCPEnvironmentVar[] = [];
    const suggestions: Array<{
      required: MCPEnvironmentVar;
      suggestions: DetectedEnvironmentVar[];
    }> = [];

    // Create a map of detected variables by name for quick lookup
    const detectedMap = new Map<string, DetectedEnvironmentVar>();
    for (const detected of detectedVars) {
      detectedMap.set(detected.name, detected);
    }

    for (const required of requiredVars) {
      const exact = detectedMap.get(required.name);

      if (exact) {
        // Exact match found
        satisfied.push({
          ...required,
          value: exact.value,
          source: 'user' as const, // Since it's from .env files
        });
      } else {
        // No exact match, add to missing
        missing.push(required);

        // Look for similar variables as suggestions
        const similarVars = this.findSimilarVariables(required, detectedVars);
        if (similarVars.length > 0) {
          suggestions.push({
            required,
            suggestions: similarVars,
          });
        }
      }
    }

    return { missing, satisfied, suggestions };
  }

  /**
   * Perform complete environment detection and analysis
   * @param requiredVars - Required variables from MCP server configs
   * @returns Complete analysis result
   */
  async detectEnvironmentVariables(requiredVars: MCPEnvironmentVar[]): Promise<EnvironmentDetectionResult> {
    // Scan project for .env files and variables
    const scanResult = await this.scanProject();

    // Map to MCP requirements
    const mappingResult = await this.mapToMCPRequirements(scanResult.variables, requiredVars);

    return {
      available: scanResult.variables,
      required: requiredVars,
      missing: mappingResult.missing,
      satisfied: mappingResult.satisfied,
      envFiles: scanResult.envFiles,
      warnings: scanResult.warnings,
    };
  }

  /**
   * Detect the pattern/type of an environment variable
   * @param varName - Variable name
   * @returns Detected pattern info or undefined
   */
  private detectVariablePattern(varName: string): { type: string; sensitive: boolean } | undefined {
    for (const { pattern, type, sensitive } of COMMON_ENV_PATTERNS) {
      if (pattern.test(varName)) {
        return { type, sensitive };
      }
    }
    return undefined;
  }

  /**
   * Check if a value appears to be sensitive based on its content
   * @param value - Variable value
   * @returns True if the value appears sensitive
   */
  private isSensitiveValue(value: string): boolean {
    // Common patterns for sensitive values
    const sensitivePatterns = [
      /^sk-[a-zA-Z0-9]+/, // OpenAI API keys
      /^[a-zA-Z0-9]{32,}$/, // Long alphanumeric strings (likely tokens/keys)
      /^[A-Za-z0-9+/]{20,}={0,2}$/, // Base64 encoded (likely secrets)
      /password|secret|key|token/i, // Contains sensitive keywords
      /^[a-f0-9]{40,}$/, // Hexadecimal strings (likely hashes/tokens)
    ];

    return sensitivePatterns.some(pattern => pattern.test(value));
  }

  /**
   * Mask sensitive values for display
   * @param value - Value to mask
   * @returns Masked value
   */
  private maskSensitiveValue(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }

    const start = value.slice(0, 3);
    const end = value.slice(-3);
    const middle = '*'.repeat(Math.min(value.length - 6, 8));

    return `${start}${middle}${end}`;
  }

  /**
   * Find variables similar to a required variable
   * @param required - Required variable to find matches for
   * @param detected - List of detected variables
   * @returns Array of similar variables
   */
  private findSimilarVariables(
    required: MCPEnvironmentVar,
    detected: DetectedEnvironmentVar[]
  ): DetectedEnvironmentVar[] {
    const requiredName = required.name.toLowerCase();
    const similarities: Array<{ variable: DetectedEnvironmentVar; score: number }> = [];

    for (const detectedVar of detected) {
      const detectedName = detectedVar.name.toLowerCase();

      // Calculate similarity score
      let score = 0;

      // Exact substring match
      if (requiredName.includes(detectedName) || detectedName.includes(requiredName)) {
        score += 0.8;
      }

      // Similar patterns (e.g., both contain 'api', 'key', etc.)
      const requiredParts = requiredName.split(/[_-]/);
      const detectedParts = detectedName.split(/[_-]/);

      for (const requiredPart of requiredParts) {
        for (const detectedPart of detectedParts) {
          if (requiredPart === detectedPart) {
            score += 0.3;
          } else if (requiredPart.includes(detectedPart) || detectedPart.includes(requiredPart)) {
            score += 0.1;
          }
        }
      }

      // Pattern type match
      if (required.pattern && detectedVar.pattern && required.pattern === detectedVar.pattern) {
        score += 0.5;
      }

      if (score > 0.3) { // Only include reasonably similar variables
        similarities.push({ variable: detectedVar, score });
      }
    }

    // Sort by similarity score and return top matches
    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.variable);
  }
}