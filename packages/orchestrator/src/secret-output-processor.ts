import type { SecretDetectionBehavior, SecretFinding } from '@apexcli/core';

export interface SecretProcessingResult {
  /** The processed output (redacted for mask, error for block, original for log/warn) */
  output: string | Record<string, unknown>;
  /** Whether the output was modified */
  wasModified: boolean;
  /** Whether the tool output should be blocked */
  shouldBlock: boolean;
  /** Error message if blocked */
  blockError?: string;
  /** Log level to use for the detection */
  logLevel: 'info' | 'warn' | 'error';
}

export class SecretOutputProcessor {
  processOutput(
    output: string | Record<string, unknown>,
    findings: SecretFinding[],
    behavior: SecretDetectionBehavior
  ): SecretProcessingResult {
    switch (behavior) {
      case 'log':
        return {
          output,
          wasModified: false,
          shouldBlock: false,
          logLevel: 'info',
        };
      case 'warn':
        return {
          output,
          wasModified: false,
          shouldBlock: false,
          logLevel: 'warn',
        };
      case 'mask': {
        const outputText = this.normalizeOutput(output);
        const redacted = this.redactSecrets(outputText, findings);
        return {
          output: redacted,
          wasModified: true,
          shouldBlock: false,
          logLevel: 'warn',
        };
      }
      case 'block':
        return {
          output,
          wasModified: false,
          shouldBlock: true,
          blockError: `Tool output blocked: ${findings.length} secret(s) detected`,
          logLevel: 'error',
        };
      default:
        return {
          output,
          wasModified: false,
          shouldBlock: false,
          logLevel: 'warn',
        };
    }
  }

  private normalizeOutput(output: string | Record<string, unknown>): string {
    if (typeof output === 'string') {
      return output;
    }

    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }

  private redactSecrets(content: string, findings: SecretFinding[]): string {
    if (findings.length === 0 || content.length === 0) {
      return content;
    }

    const sortedFindings = [...findings].sort((a, b) => {
      if (a.line !== b.line) {
        return b.line - a.line;
      }
      return b.column - a.column;
    });

    const lines = content.split('\n');

    for (const finding of sortedFindings) {
      const lineIndex = finding.line - 1;
      if (lineIndex < 0 || lineIndex >= lines.length) {
        continue;
      }

      const line = lines[lineIndex];
      const startColumn = Math.max(0, finding.column - 1);
      const endColumn = Math.max(startColumn, finding.endColumn - 1);

      if (startColumn >= line.length) {
        continue;
      }

      lines[lineIndex] =
        line.substring(0, startColumn) +
        '[REDACTED]' +
        line.substring(endColumn + 1);
    }

    return lines.join('\n');
  }
}
