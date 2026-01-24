import { describe, it, expect } from 'vitest';
import { ErrorClassifier } from '../repair-loop/error-classifier.js';
import type { StageResult } from '../repair-loop/repair-types.js';

function makeStageResult(overrides: Partial<StageResult> = {}): StageResult {
  return {
    stageName: 'implementation',
    agent: 'developer',
    status: 'failed',
    outputs: {},
    artifacts: [],
    summary: '',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0, totalCostCents: 0, executionTimeMs: 0 },
    startedAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  };
}

describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier();

  describe('classify', () => {
    it('should parse TypeScript errors with parenthesized location', () => {
      const error = new Error('src/index.ts(10,5): error TS2322: Type \'string\' is not assignable to type \'number\'');
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].category).toBe('type');
      expect(result[0].fingerprint.code).toBe('TS2322');
      expect(result[0].fingerprint.filePath).toBe('src/index.ts');
      expect(result[0].fingerprint.line).toBe(10);
      expect(result[0].fingerprint.column).toBe(5);
      expect(result[0].severity).toBe('blocking');
      expect(result[0].isRecoverable).toBe(true);
    });

    it('should parse TypeScript errors with colon-separated location', () => {
      const error = new Error('src/utils.ts:25:10 - error TS2339: Property \'foo\' does not exist');
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].category).toBe('type');
      expect(result[0].fingerprint.code).toBe('TS2339');
      expect(result[0].fingerprint.filePath).toBe('src/utils.ts');
      expect(result[0].fingerprint.line).toBe(25);
    });

    it('should parse test failures with FAIL prefix', () => {
      const output = ['FAIL src/utils.test.ts'];
      const result = classifier.classify(new Error('Tests failed'), makeStageResult(), output);

      expect(result.some(e => e.category === 'test')).toBe(true);
      const testError = result.find(e => e.category === 'test');
      expect(testError?.fingerprint.filePath).toBe('src/utils.test.ts');
      expect(testError?.suggestedAgent).toBe('tester');
    });

    it('should parse test assertion errors with stack locations', () => {
      const output = [
        'FAIL src/math.test.ts',
        '  ● add > should add numbers',
        '    expect(received).toBe(expected)',
        '    Expected: 4',
        '    Received: 3',
        '    at Object.<anonymous> (src/math.test.ts:15:20)',
      ];
      const result = classifier.classify(new Error('Tests failed'), makeStageResult(), output);

      const locationErrors = result.filter(e => e.fingerprint.line !== undefined);
      expect(locationErrors.length).toBeGreaterThan(0);
    });

    it('should parse lint errors', () => {
      const output = ['src/app.ts:5:1: error @typescript-eslint/no-unused-vars: x is defined but never used'];
      const result = classifier.classify(new Error('Lint failed'), makeStageResult(), output);

      expect(result.some(e => e.category === 'lint')).toBe(true);
      const lintError = result.find(e => e.category === 'lint');
      expect(lintError?.severity).toBe('degrading');
    });

    it('should parse module not found errors as dependency category', () => {
      const error = new Error("Module not found: Can't resolve 'lodash' in '/project/src'");
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result[0].category).toBe('dependency');
      expect(result[0].severity).toBe('blocking');
    });

    it('should parse Cannot find module errors', () => {
      const error = new Error("Cannot find module '@apexcli/core'");
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result[0].category).toBe('dependency');
    });

    it('should parse syntax errors', () => {
      const error = new Error('SyntaxError: /project/src/file.ts: Unexpected token (10:5)');
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result[0].category).toBe('syntax');
      expect(result[0].fingerprint.filePath).toBe('/project/src/file.ts');
      expect(result[0].fingerprint.line).toBe(10);
    });

    it('should classify EACCES as permission (unrecoverable)', () => {
      const error = new Error('Error: EACCES: permission denied, open /etc/config');
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result[0].category).toBe('permission');
      expect(result[0].isRecoverable).toBe(false);
    });

    it('should classify network errors as unrecoverable', () => {
      const error = new Error('Error: connect ECONNREFUSED 127.0.0.1:5432');
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result[0].category).toBe('network');
      expect(result[0].isRecoverable).toBe(false);
    });

    it('should classify TypeError as runtime (recoverable)', () => {
      const error = new Error("TypeError: Cannot read properties of undefined (reading 'map')");
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result[0].category).toBe('runtime');
      expect(result[0].isRecoverable).toBe(true);
    });

    it('should fallback to unknown category for unrecognized errors', () => {
      const error = new Error('Something completely unexpected happened');
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result.length).toBe(1);
      expect(result[0].category).toBe('unknown');
      expect(result[0].isRecoverable).toBe(true);
    });

    it('should deduplicate errors with the same fingerprint', () => {
      const output = [
        'src/file.ts(10,5): error TS2322: Type \'string\' is not assignable to type \'number\'',
        'src/file.ts(10,5): error TS2322: Type \'string\' is not assignable to type \'number\'',
      ];
      const result = classifier.classify(new Error('tsc failed'), makeStageResult(), output);

      // Should deduplicate to 1
      const tsErrors = result.filter(e => e.fingerprint.code === 'TS2322');
      expect(tsErrors.length).toBe(1);
    });

    it('should include related files from errors', () => {
      const error = new Error('src/service.ts(5,1): error TS2304: Cannot find name \'Foo\'');
      const result = classifier.classify(error, makeStageResult(), []);

      expect(result[0].relatedFiles).toContain('src/service.ts');
    });
  });

  describe('computeFingerprint', () => {
    it('should produce stable hashes for the same error', () => {
      const hash1 = classifier.computeFingerprint('Type error in module', 'src/mod.ts', 'TS2322');
      const hash2 = classifier.computeFingerprint('Type error in module', 'src/mod.ts', 'TS2322');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different messages', () => {
      const hash1 = classifier.computeFingerprint('Error A', 'file.ts');
      const hash2 = classifier.computeFingerprint('Error B', 'file.ts');
      expect(hash1).not.toBe(hash2);
    });

    it('should strip line numbers for stability', () => {
      const hash1 = classifier.computeFingerprint('Error at line 10 in module');
      const hash2 = classifier.computeFingerprint('Error at line 20 in module');
      // "line N" stripped, rest of message identical
      expect(hash1).toBe(hash2);
    });

    it('should strip location patterns for stability', () => {
      const hash1 = classifier.computeFingerprint('Error(10,5): something');
      const hash2 = classifier.computeFingerprint('Error(20,15): something');
      expect(hash1).toBe(hash2);
    });

    it('should produce 16-char hex hashes', () => {
      const hash = classifier.computeFingerprint('test error');
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('areSimilar', () => {
    it('should return true for identical fingerprints', () => {
      const fp = { hash: 'abc123', message: 'error', category: 'type' as const };
      expect(classifier.areSimilar(fp, fp, 0.8)).toBe(true);
    });

    it('should return true for same code and file', () => {
      const a = { hash: 'aaa', message: 'Type X not assignable', category: 'type' as const, code: 'TS2322', filePath: 'src/mod.ts' };
      const b = { hash: 'bbb', message: 'Different message entirely', category: 'type' as const, code: 'TS2322', filePath: 'src/mod.ts' };
      expect(classifier.areSimilar(a, b, 0.8)).toBe(true);
    });

    it('should return true for highly similar messages', () => {
      const a = { hash: 'aaa', message: 'Cannot read property foo of undefined', category: 'runtime' as const };
      const b = { hash: 'bbb', message: 'Cannot read property bar of undefined', category: 'runtime' as const };
      expect(classifier.areSimilar(a, b, 0.6)).toBe(true);
    });

    it('should return false for dissimilar messages at high threshold', () => {
      const a = { hash: 'aaa', message: 'Type error in authentication module', category: 'type' as const };
      const b = { hash: 'bbb', message: 'Network timeout connecting to database', category: 'network' as const };
      expect(classifier.areSimilar(a, b, 0.8)).toBe(false);
    });

    it('should treat identical empty messages as similar', () => {
      const a = { hash: 'aaa', message: '', category: 'unknown' as const };
      const b = { hash: 'bbb', message: '', category: 'unknown' as const };
      // Empty strings tokenize to [''] — same token in both sets → Jaccard = 1.0
      expect(classifier.areSimilar(a, b, 0.8)).toBe(true);
    });
  });
});
