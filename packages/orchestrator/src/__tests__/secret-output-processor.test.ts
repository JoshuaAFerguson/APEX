import { describe, expect, it } from 'vitest';
import type { SecretFinding, SecretDetectionBehavior } from '@apexcli/core';
import { SecretOutputProcessor } from '../secret-output-processor';

describe('SecretOutputProcessor', () => {
  const processor = new SecretOutputProcessor();

  const sampleOutput = [
    'const token = "abc123";',
    'const key = "secret456";',
  ].join('\n');

  const findings: SecretFinding[] = [
    {
      file: 'tool:output',
      line: 1,
      column: 16,
      endColumn: 21,
      secretType: 'token',
      match: 'abc123',
      confidence: 1,
      patternName: 'token-pattern',
      severity: 'high',
      context: 'token = "abc123"',
    },
    {
      file: 'tool:output',
      line: 2,
      column: 14,
      endColumn: 22,
      secretType: 'key',
      match: 'secret456',
      confidence: 1,
      patternName: 'key-pattern',
      severity: 'high',
      context: 'key = "secret456"',
    },
  ];

  const run = (behavior: SecretDetectionBehavior) =>
    processor.processOutput(sampleOutput, findings, behavior);

  it('returns original output for log behavior', () => {
    const result = run('log');

    expect(result.output).toBe(sampleOutput);
    expect(result.wasModified).toBe(false);
    expect(result.shouldBlock).toBe(false);
    expect(result.logLevel).toBe('info');
  });

  it('returns original output for warn behavior', () => {
    const result = run('warn');

    expect(result.output).toBe(sampleOutput);
    expect(result.wasModified).toBe(false);
    expect(result.shouldBlock).toBe(false);
    expect(result.logLevel).toBe('warn');
  });

  it('redacts secrets for mask behavior', () => {
    const result = run('mask');

    expect(result.output).toBe(
      [
        'const token = "[REDACTED]";',
        'const key = "[REDACTED]";',
      ].join('\n')
    );
    expect(result.wasModified).toBe(true);
    expect(result.shouldBlock).toBe(false);
    expect(result.logLevel).toBe('warn');
  });

  it('blocks output for block behavior', () => {
    const result = run('block');

    expect(result.shouldBlock).toBe(true);
    expect(result.blockError).toContain('Tool output blocked');
    expect(result.logLevel).toBe('error');
  });
});
