/**
 * ESLint-based Import Detector
 *
 * Uses ESLint with import-related rules to detect missing imports.
 * This detector leverages ESLint's robust parsing and rule system
 * to identify undefined variables that need to be imported.
 *
 * Relevant ESLint rules:
 * - no-undef: Disallow the use of undeclared variables
 * - @typescript-eslint/no-undef: TypeScript-aware version
 * - import/no-unresolved: Ensure imports point to a valid module
 *
 * @module orchestrator/import-auto-fixer/detectors/eslint-detector
 */

import { spawn } from 'child_process';
import type { MissingImport, ImportContext } from '../types';
import { BaseDetector } from './base-detector';

// ============================================================================
// ESLint Output Types
// ============================================================================

/**
 * ESLint JSON output format for a single file
 */
interface ESLintFileResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
}

/**
 * ESLint message format
 */
interface ESLintMessage {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  nodeType?: string;
}

// ============================================================================
// ESLint Detector Implementation
// ============================================================================

/**
 * Options for ESLint detector
 */
export interface ESLintDetectorOptions {
  /** Additional ESLint config to use */
  configPath?: string;
  /** Additional rules to enable */
  additionalRules?: Record<string, number | string | unknown[]>;
  /** Timeout for ESLint execution in milliseconds */
  timeout?: number;
  /** Working directory */
  cwd?: string;
}

/**
 * Import detector that uses ESLint to find missing imports
 *
 * @example
 * ```typescript
 * const detector = new ESLintDetector();
 *
 * // Check if ESLint is available
 * if (await detector.isAvailable()) {
 *   const missing = await detector.detect('/path/to/file.ts', fileContent);
 *   console.log(`Found ${missing.length} missing imports`);
 * }
 * ```
 */
export class ESLintDetector extends BaseDetector {
  readonly id = 'eslint';
  readonly name = 'ESLint Detector';

  private options: ESLintDetectorOptions;
  private cachedAvailability: boolean | null = null;

  constructor(options: ESLintDetectorOptions = {}) {
    super();
    this.options = {
      timeout: 30000,
      ...options,
    };
  }

  /**
   * Detect missing imports using ESLint
   */
  async detect(filePath: string, content: string): Promise<MissingImport[]> {
    try {
      const eslintOutput = await this.runESLint(filePath, content);
      const results = this.parseESLintOutput(eslintOutput);
      const missingImports = this.extractMissingImports(results, filePath);

      // Filter out built-in globals and deduplicate
      const filtered = missingImports.filter(imp => !this.isBuiltInGlobal(imp.identifier));
      return this.deduplicateImports(filtered);
    } catch (error) {
      // Log error but return empty array to allow other detectors to try
      console.error(`ESLint detection failed for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Check if ESLint is available
   */
  async isAvailable(): Promise<boolean> {
    if (this.cachedAvailability !== null) {
      return this.cachedAvailability;
    }

    try {
      const result = await this.spawnProcess('npx', ['eslint', '--version'], {
        timeout: 10000,
      });
      this.cachedAvailability = result.exitCode === 0;
    } catch {
      this.cachedAvailability = false;
    }

    return this.cachedAvailability;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Run ESLint on the given content using stdin
   */
  private async runESLint(filePath: string, content: string): Promise<string> {
    const args = this.buildESLintArgs(filePath);

    return new Promise((resolve, reject) => {
      const process = spawn('npx', ['eslint', ...args], {
        cwd: this.options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: globalThis.process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Write content to stdin
      process.stdin?.write(content);
      process.stdin?.end();

      // Set up timeout
      const timeoutId = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('ESLint timed out'));
      }, this.options.timeout!);

      process.on('close', (exitCode) => {
        clearTimeout(timeoutId);

        // ESLint returns 1 when there are linting errors, which is expected
        // It returns 2 for fatal errors
        if (exitCode === 2) {
          reject(new Error(`ESLint fatal error: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Build ESLint command arguments
   */
  private buildESLintArgs(filePath: string): string[] {
    const args: string[] = [
      '--format', 'json',
      '--stdin',
      '--stdin-filename', filePath,
    ];

    // Add config path if specified
    if (this.options.configPath) {
      args.push('--config', this.options.configPath);
    }

    // Enable specific rules for import detection
    args.push('--rule', 'no-undef: error');

    // Add any additional rules
    if (this.options.additionalRules) {
      for (const [rule, config] of Object.entries(this.options.additionalRules)) {
        const configStr = typeof config === 'object' ? JSON.stringify(config) : String(config);
        args.push('--rule', `${rule}: ${configStr}`);
      }
    }

    return args;
  }

  /**
   * Parse ESLint JSON output
   */
  private parseESLintOutput(output: string): ESLintFileResult[] {
    if (!output.trim()) {
      return [];
    }

    try {
      return JSON.parse(output);
    } catch {
      // ESLint may output non-JSON errors first
      // Try to find the JSON array in the output
      const jsonStart = output.indexOf('[');
      if (jsonStart >= 0) {
        try {
          return JSON.parse(output.slice(jsonStart));
        } catch {
          return [];
        }
      }
      return [];
    }
  }

  /**
   * Extract missing imports from ESLint results
   */
  private extractMissingImports(
    results: ESLintFileResult[],
    filePath: string
  ): MissingImport[] {
    const missingImports: MissingImport[] = [];

    for (const result of results) {
      for (const message of result.messages) {
        const missingImport = this.convertMessageToMissingImport(message, filePath);
        if (missingImport) {
          missingImports.push(missingImport);
        }
      }
    }

    return missingImports;
  }

  /**
   * Convert an ESLint message to a MissingImport if applicable
   */
  private convertMessageToMissingImport(
    message: ESLintMessage,
    filePath: string
  ): MissingImport | null {
    // Check if this is a "no-undef" or similar rule
    const isUndefRule = message.ruleId === 'no-undef' ||
                        message.ruleId === '@typescript-eslint/no-undef';

    if (!isUndefRule) {
      return null;
    }

    // Extract the identifier from the message
    // ESLint message format: "'foo' is not defined"
    const identifier = this.extractIdentifierFromMessage(message.message);
    if (!identifier) {
      return null;
    }

    // Determine context from the message and node type
    const context = this.inferContext(message);

    return this.createMissingImport({
      identifier,
      line: message.line,
      column: message.column,
      endLine: message.endLine,
      endColumn: message.endColumn,
      context,
      isTypeOnly: context?.usageType === 'type',
    });
  }

  /**
   * Extract identifier name from ESLint message
   */
  private extractIdentifierFromMessage(message: string): string | null {
    // Pattern: "'identifier' is not defined" or "'identifier' is not defined."
    const match = message.match(/^'([^']+)' is not defined\.?$/);
    if (match) {
      return match[1];
    }

    // Alternative pattern: "identifier is not defined"
    const altMatch = message.match(/^(\w+) is not defined\.?$/);
    if (altMatch) {
      return altMatch[1];
    }

    return null;
  }

  /**
   * Infer import context from ESLint message
   */
  private inferContext(message: ESLintMessage): ImportContext | undefined {
    const nodeType = message.nodeType;

    if (!nodeType) {
      return undefined;
    }

    // Map ESLint node types to our context types
    const context: ImportContext = {
      usageType: 'value',
    };

    switch (nodeType) {
      case 'JSXIdentifier':
        context.usageType = 'jsx';
        break;
      case 'CallExpression':
        context.isFunctionCall = true;
        break;
      case 'NewExpression':
        context.isConstructor = true;
        break;
      case 'MemberExpression':
        context.isPropertyAccess = true;
        break;
      case 'TSTypeReference':
      case 'TSTypeAnnotation':
        context.usageType = 'type';
        break;
      case 'Decorator':
        context.usageType = 'decorator';
        break;
    }

    return context;
  }

  /**
   * Spawn a process and capture output
   */
  private spawnProcess(
    command: string,
    args: string[],
    options: { timeout?: number; cwd?: string } = {}
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: globalThis.process.platform === 'win32',
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timeoutId = options.timeout
        ? setTimeout(() => {
            process.kill('SIGTERM');
            reject(new Error('Process timed out'));
          }, options.timeout)
        : null;

      process.on('close', (exitCode) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve({ exitCode: exitCode ?? 1, stdout, stderr });
      });

      process.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }
}
