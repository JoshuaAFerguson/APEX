/**
 * Error Classifier for Self-Repair Loop
 *
 * Parses raw errors and stage output into structured ClassifiedError objects.
 * Computes stable fingerprint hashes for deduplication, determines recoverability,
 * and suggests which agent should attempt the repair.
 *
 * @module repair-loop/error-classifier
 */

import { createHash } from 'crypto';
import type { ErrorFingerprint, ErrorCategory } from '@apexcli/core';
import type { ClassifiedError, ErrorSeverity, StageResult } from './repair-types.js';

// ============================================================================
// Error Patterns
// ============================================================================

interface ErrorPattern {
  regex: RegExp;
  category: ErrorCategory;
  extractFile?: (match: RegExpMatchArray) => string | undefined;
  extractLine?: (match: RegExpMatchArray) => number | undefined;
  extractColumn?: (match: RegExpMatchArray) => number | undefined;
  extractCode?: (match: RegExpMatchArray) => string | undefined;
}

const TYPESCRIPT_PATTERNS: ErrorPattern[] = [
  {
    // src/file.ts(10,5): error TS2322: Type 'X' is not assignable to type 'Y'
    regex: /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/m,
    category: 'type',
    extractFile: (m) => m[1],
    extractLine: (m) => parseInt(m[2], 10),
    extractColumn: (m) => parseInt(m[3], 10),
    extractCode: (m) => m[4],
  },
  {
    // src/file.ts:10:5 - error TS2322: Type 'X' is not assignable
    regex: /^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/m,
    category: 'type',
    extractFile: (m) => m[1],
    extractLine: (m) => parseInt(m[2], 10),
    extractColumn: (m) => parseInt(m[3], 10),
    extractCode: (m) => m[4],
  },
];

const TEST_FAILURE_PATTERNS: ErrorPattern[] = [
  {
    // FAIL src/file.test.ts
    regex: /^FAIL\s+(.+\.(?:test|spec)\.[jt]sx?)$/m,
    category: 'test',
    extractFile: (m) => m[1],
  },
  {
    // at Object.<anonymous> (src/file.test.ts:10:5)
    regex: /at\s+(?:Object\.<anonymous>|.+?)\s+\((.+?):(\d+):(\d+)\)/m,
    category: 'test',
    extractFile: (m) => m[1],
    extractLine: (m) => parseInt(m[2], 10),
    extractColumn: (m) => parseInt(m[3], 10),
  },
];

const LINT_PATTERNS: ErrorPattern[] = [
  {
    // /path/to/file.ts:10:5: error @rule-name: message
    regex: /^(.+?):(\d+):(\d+):\s*(?:error|warning)\s+(.+?)(?:\s|:)\s*(.+)$/m,
    category: 'lint',
    extractFile: (m) => m[1],
    extractLine: (m) => parseInt(m[2], 10),
    extractColumn: (m) => parseInt(m[3], 10),
    extractCode: (m) => m[4],
  },
  {
    // ESLint-style: 10:5  error  message  rule-name
    regex: /^\s*(\d+):(\d+)\s+error\s+(.+?)\s{2,}(.+)$/m,
    category: 'lint',
    extractLine: (m) => parseInt(m[1], 10),
    extractColumn: (m) => parseInt(m[2], 10),
    extractCode: (m) => m[4],
  },
];

const BUILD_PATTERNS: ErrorPattern[] = [
  {
    // Module not found: Can't resolve 'X' in '/path'
    regex: /Module not found:\s*(?:Can't resolve|Error:)\s*'(.+?)'/m,
    category: 'dependency',
  },
  {
    // SyntaxError: /path/file.ts: Unexpected token (10:5)
    regex: /SyntaxError:\s*(.+?):\s*(.+?)\s*\((\d+):(\d+)\)/m,
    category: 'syntax',
    extractFile: (m) => m[1],
    extractLine: (m) => parseInt(m[3], 10),
    extractColumn: (m) => parseInt(m[4], 10),
  },
  {
    // Cannot find module 'X'
    regex: /Cannot find module\s+'(.+?)'/m,
    category: 'dependency',
  },
];

const RUNTIME_PATTERNS: ErrorPattern[] = [
  {
    // TypeError: Cannot read properties of X
    regex: /(TypeError|ReferenceError|RangeError):\s*(.+)/m,
    category: 'runtime',
  },
  {
    // Error: ENOENT: no such file or directory
    regex: /Error:\s*ENOENT.*?'(.+?)'/m,
    category: 'runtime',
    extractFile: (m) => m[1],
  },
  {
    // Error: EACCES: permission denied
    regex: /Error:\s*EACCES/m,
    category: 'permission',
  },
  {
    // Error: connect ECONNREFUSED
    regex: /Error:\s*(?:connect\s+)?(?:ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH)/m,
    category: 'network',
  },
];

// Categories that are not recoverable by the repair loop
const UNRECOVERABLE_CATEGORIES: ErrorCategory[] = ['permission', 'network', 'config'];

// ============================================================================
// ErrorClassifier Class
// ============================================================================

export class ErrorClassifier {
  /**
   * Classify an error and stage output into structured ClassifiedError objects.
   * Attempts to parse multiple error formats and returns all identified errors.
   */
  classify(
    error: Error,
    stageResult: StageResult,
    stageOutput: string[],
  ): ClassifiedError[] {
    const output = this.buildOutputString(error, stageResult, stageOutput);
    const errors: ClassifiedError[] = [];

    // Try each parser in order of specificity
    errors.push(...this.parseTypeScriptErrors(output));
    errors.push(...this.parseTestFailures(output));
    errors.push(...this.parseLintErrors(output));
    errors.push(...this.parseBuildErrors(output));

    // If no specific errors found, classify the raw error
    if (errors.length === 0) {
      errors.push(...this.parseRuntimeErrors(error, output));
    }

    // Deduplicate by fingerprint hash
    const seen = new Set<string>();
    return errors.filter((e) => {
      if (seen.has(e.fingerprint.hash)) return false;
      seen.add(e.fingerprint.hash);
      return true;
    });
  }

  /**
   * Compute a stable hash for an error. Strips line numbers that may shift
   * between runs to produce consistent fingerprints for the "same" error.
   */
  computeFingerprint(message: string, filePath?: string, code?: string): string {
    // Normalize: strip line/column numbers from message, lowercase
    const normalized = message
      .replace(/\(\d+,\d+\)/g, '')
      .replace(/:\d+:\d+/g, '')
      .replace(/line \d+/gi, '')
      .trim()
      .toLowerCase();

    const parts = [normalized];
    if (filePath) parts.push(filePath);
    if (code) parts.push(code);

    return createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 16);
  }

  /**
   * Determine if two fingerprints represent the "same" error based on
   * message similarity using Jaccard index on word tokens.
   */
  areSimilar(a: ErrorFingerprint, b: ErrorFingerprint, threshold: number): boolean {
    // Same hash = definitely the same
    if (a.hash === b.hash) return true;

    // Same error code in same file = same error
    if (a.code && a.code === b.code && a.filePath && a.filePath === b.filePath) {
      return true;
    }

    // Fall back to message similarity
    const tokensA = new Set(a.message.toLowerCase().split(/\s+/));
    const tokensB = new Set(b.message.toLowerCase().split(/\s+/));

    const intersection = new Set([...tokensA].filter((t) => tokensB.has(t)));
    const union = new Set([...tokensA, ...tokensB]);

    if (union.size === 0) return false;
    return intersection.size / union.size >= threshold;
  }

  // --------------------------------------------------------------------------
  // Private Parsers
  // --------------------------------------------------------------------------

  private parseTypeScriptErrors(output: string): ClassifiedError[] {
    const results: ClassifiedError[] = [];

    for (const pattern of TYPESCRIPT_PATTERNS) {
      const globalRegex = new RegExp(pattern.regex.source, 'gm');
      let match: RegExpExecArray | null;

      while ((match = globalRegex.exec(output)) !== null) {
        const filePath = pattern.extractFile?.(match);
        const line = pattern.extractLine?.(match);
        const column = pattern.extractColumn?.(match);
        const code = pattern.extractCode?.(match);
        const message = match[0];

        results.push(this.buildClassifiedError(
          message, 'type', filePath, line, column, code, 'developer',
        ));
      }
    }

    return results;
  }

  private parseTestFailures(output: string): ClassifiedError[] {
    const results: ClassifiedError[] = [];

    // Look for FAIL lines first to identify failing test files
    const failRegex = /^FAIL\s+(.+\.(?:test|spec)\.[jt]sx?)$/gm;
    let match: RegExpExecArray | null;

    while ((match = failRegex.exec(output)) !== null) {
      const filePath = match[1];
      results.push(this.buildClassifiedError(
        `Test suite failed: ${filePath}`, 'test', filePath,
        undefined, undefined, undefined, 'tester',
      ));
    }

    // Look for assertion errors with locations - be more specific to avoid false positives
    // Only match lines that are actually part of test assertion failures, not general stack traces
    const assertRegex = /(?:expect|assert|should).*\n.*at\s+(?:Object\.<anonymous>|.+?)\s+\((.+?):(\d+):(\d+)\)|at\s+(?:Object\.<anonymous>|.+?)\s+\((.+\.(?:test|spec)\.[jt]sx?):(\d+):(\d+)\)/gm;
    while ((match = assertRegex.exec(output)) !== null) {
      // Use the first matched group (assertion context) or the test file context
      const filePath = match[1] || match[4];
      const line = parseInt(match[2] || match[5], 10);
      const column = parseInt(match[3] || match[6], 10);

      // Only include if it's a test file or contains actual test assertion keywords
      if (filePath && (filePath.includes('.test.') || filePath.includes('.spec.') ||
          output.includes('expect') || output.includes('assert') || output.includes('should'))) {
        // Skip dist/compiled files - focus on source files
        if (!filePath.includes('/dist/') && !filePath.includes('node_modules')) {
          results.push(this.buildClassifiedError(
            `Test assertion failed at ${filePath}:${line}`, 'test',
            filePath, line, column, undefined, 'tester',
          ));
        }
      }
    }

    // Look for "Expected"/"Received" patterns (Jest/Vitest)
    const expectRegex = /Expected:\s*(.+)\s*\n\s*Received:\s*(.+)/gm;
    while ((match = expectRegex.exec(output)) !== null) {
      results.push(this.buildClassifiedError(
        `Expected: ${match[1].trim()}, Received: ${match[2].trim()}`,
        'test', undefined, undefined, undefined, undefined, 'tester',
      ));
    }

    return results;
  }

  private parseLintErrors(output: string): ClassifiedError[] {
    const results: ClassifiedError[] = [];

    for (const pattern of LINT_PATTERNS) {
      const globalRegex = new RegExp(pattern.regex.source, 'gm');
      let match: RegExpExecArray | null;

      while ((match = globalRegex.exec(output)) !== null) {
        const filePath = pattern.extractFile?.(match);
        const line = pattern.extractLine?.(match);
        const column = pattern.extractColumn?.(match);
        const code = pattern.extractCode?.(match);
        const message = match[0];

        results.push(this.buildClassifiedError(
          message, 'lint', filePath, line, column, code, 'developer',
        ));
      }
    }

    return results;
  }

  private parseBuildErrors(output: string): ClassifiedError[] {
    const results: ClassifiedError[] = [];

    for (const pattern of BUILD_PATTERNS) {
      const globalRegex = new RegExp(pattern.regex.source, 'gm');
      let match: RegExpExecArray | null;

      while ((match = globalRegex.exec(output)) !== null) {
        const filePath = pattern.extractFile?.(match);
        const line = pattern.extractLine?.(match);
        const column = pattern.extractColumn?.(match);
        const code = pattern.extractCode?.(match);
        const message = match[0];
        const category = pattern.category;

        results.push(this.buildClassifiedError(
          message, category, filePath, line, column, code, 'developer',
        ));
      }
    }

    return results;
  }

  private parseRuntimeErrors(error: Error, output: string): ClassifiedError[] {
    const results: ClassifiedError[] = [];

    // Try runtime patterns against both the error message and full output
    const combined = `${error.message}\n${error.stack || ''}\n${output}`;

    for (const pattern of RUNTIME_PATTERNS) {
      const match = pattern.regex.exec(combined);
      if (match) {
        const filePath = pattern.extractFile?.(match);
        const category = pattern.category;

        results.push(this.buildClassifiedError(
          error.message, category, filePath,
          undefined, undefined, undefined,
          category === 'runtime' ? 'developer' : 'devops',
        ));
        return results; // Return first runtime match
      }
    }

    // Fallback: unknown error
    results.push(this.buildClassifiedError(
      error.message, 'unknown', undefined,
      undefined, undefined, undefined, 'developer',
    ));

    return results;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private buildOutputString(
    error: Error,
    stageResult: StageResult,
    stageOutput: string[],
  ): string {
    const parts: string[] = [];
    if (error.message) parts.push(error.message);
    if (error.stack) parts.push(error.stack);
    if (stageResult.error) parts.push(stageResult.error);
    if (stageResult.summary) parts.push(stageResult.summary);
    parts.push(...stageOutput);
    return parts.join('\n');
  }

  private buildClassifiedError(
    message: string,
    category: ErrorCategory,
    filePath?: string,
    line?: number,
    column?: number,
    code?: string,
    suggestedAgent: string = 'developer',
  ): ClassifiedError {
    const hash = this.computeFingerprint(message, filePath, code);
    const fingerprint: ErrorFingerprint = { hash, message, category, filePath, line, column, code };

    return {
      fingerprint,
      category,
      severity: this.determineSeverity(category),
      isRecoverable: !UNRECOVERABLE_CATEGORIES.includes(category),
      suggestedAgent,
      relatedFiles: filePath ? [filePath] : [],
    };
  }

  private determineSeverity(category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case 'syntax':
      case 'type':
      case 'build':
      case 'dependency':
      case 'test':
      case 'runtime':
        return 'blocking';
      case 'lint':
        return 'degrading';
      default:
        return 'blocking';
    }
  }
}
