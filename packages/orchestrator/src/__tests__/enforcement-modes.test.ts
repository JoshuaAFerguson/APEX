/**
 * @fileoverview Tests for enforcement mode logic and behavior
 *
 * Tests enforcement mode mapping and behavior patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecretOutputProcessor } from '../secret-output-processor.js';
import type { SecretFinding, SecretDetectionBehavior } from '@apexcli/core';

describe('Enforcement Modes', () => {
  let processor: SecretOutputProcessor;

  beforeEach(() => {
    processor = new SecretOutputProcessor();
  });

  const createBasicFinding = (): SecretFinding => ({
    file: 'tool:output',
    line: 1,
    column: 0,
    endColumn: 5,
    secretType: 'test',
    match: 'value',
    confidence: 0.9,
    patternName: 'test-pattern',
    severity: 'medium',
    context: 'test context',
  });

  describe('audit mode behavior (log)', () => {
    it('should not modify output in audit mode', () => {
      const testOutput = 'normal output';
      const findings = [createBasicFinding()];

      const result = processor.processOutput(testOutput, findings, 'log');

      expect(result.output).toBe(testOutput);
      expect(result.wasModified).toBe(false);
      expect(result.shouldBlock).toBe(false);
      expect(result.logLevel).toBe('info');
    });
  });

  describe('redact mode behavior (mask)', () => {
    it('should modify output in redact mode', () => {
      const testOutput = 'output with value inside';
      const findings = [createBasicFinding()];

      const result = processor.processOutput(testOutput, findings, 'mask');

      expect(result.wasModified).toBe(true);
      expect(result.shouldBlock).toBe(false);
      expect(result.logLevel).toBe('warn');
    });
  });

  describe('block mode behavior (block)', () => {
    it('should block execution in block mode', () => {
      const testOutput = 'output with value';
      const findings = [createBasicFinding()];

      const result = processor.processOutput(testOutput, findings, 'block');

      expect(result.shouldBlock).toBe(true);
      expect(result.logLevel).toBe('error');
      expect(result.blockError).toBeDefined();
    });
  });

  describe('warn mode behavior', () => {
    it('should warn without blocking or modifying', () => {
      const testOutput = 'test output';
      const findings = [createBasicFinding()];

      const result = processor.processOutput(testOutput, findings, 'warn');

      expect(result.output).toBe(testOutput);
      expect(result.wasModified).toBe(false);
      expect(result.shouldBlock).toBe(false);
      expect(result.logLevel).toBe('warn');
    });
  });

  describe('empty findings handling', () => {
    it('should handle empty findings across all modes', () => {
      const testOutput = 'clean output';
      const emptyFindings: SecretFinding[] = [];
      const modes: SecretDetectionBehavior[] = ['log', 'warn', 'mask', 'block'];

      modes.forEach(mode => {
        const result = processor.processOutput(testOutput, emptyFindings, mode);
        expect(result.shouldBlock).toBe(false);
        expect(result.output).toBe(testOutput);
        expect(result.wasModified).toBe(false);
      });
    });
  });

  describe('enforcement mode mapping', () => {
    it('should correctly map enforcement modes to behaviors', () => {
      // Test the mapping that would be used in resolveSecretDetectionBehavior
      const mappings = {
        'audit': 'log',
        'block': 'block',
        'warn': 'warn'
      };

      Object.entries(mappings).forEach(([enforcement, behavior]) => {
        const testOutput = 'test content';
        const findings = [createBasicFinding()];

        const result = processor.processOutput(testOutput, findings, behavior as SecretDetectionBehavior);

        if (behavior === 'log') {
          expect(result.wasModified).toBe(false);
          expect(result.shouldBlock).toBe(false);
          expect(result.logLevel).toBe('info');
        } else if (behavior === 'block') {
          expect(result.shouldBlock).toBe(true);
          expect(result.logLevel).toBe('error');
        } else if (behavior === 'warn') {
          expect(result.wasModified).toBe(false);
          expect(result.shouldBlock).toBe(false);
          expect(result.logLevel).toBe('warn');
        }
      });
    });
  });
});