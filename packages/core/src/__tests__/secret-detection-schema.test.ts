import { describe, it, expect } from 'vitest';
import {
  SecretDetectionSchema,
  SecretDetection
} from '../types';

describe('SecretDetection Schema Tests', () => {
  describe('SecretDetectionSchema Validation', () => {
    it('should parse valid complete secret detection', () => {
      const validDetection = {
        id: 'detection-abc123',
        patternName: 'Test Pattern Name',
        secretType: 'test_type',
        severity: 'high',
        filePath: '/src/example.ts',
        lineNumber: 42,
        columnNumber: 15,
        maskedMatch: 'REDACTED_CONTENT',
        context: 'surrounding code context',
        detectedAt: new Date('2024-01-01T12:00:00Z'),
        acknowledged: false
      };

      expect(() => SecretDetectionSchema.parse(validDetection)).not.toThrow();

      const result = SecretDetectionSchema.parse(validDetection);
      expect(result.id).toBe('detection-abc123');
      expect(result.patternName).toBe('Test Pattern Name');
      expect(result.secretType).toBe('test_type');
      expect(result.severity).toBe('high');
      expect(result.acknowledged).toBe(false);
    });

    it('should parse minimal valid secret detection', () => {
      const minimalDetection = {
        id: 'minimal-detection',
        patternName: 'Minimal Pattern',
        secretType: 'basic_type',
        severity: 'critical',
        maskedMatch: 'HIDDEN_VALUE',
        detectedAt: new Date()
      };

      expect(() => SecretDetectionSchema.parse(minimalDetection)).not.toThrow();

      const result = SecretDetectionSchema.parse(minimalDetection);
      expect(result.acknowledged).toBe(false); // default value
      expect(result.filePath).toBeUndefined();
      expect(result.lineNumber).toBeUndefined();
      expect(result.columnNumber).toBeUndefined();
      expect(result.context).toBeUndefined();
      expect(result.acknowledgmentReason).toBeUndefined();
    });

    it('should validate all severity levels', () => {
      const validSeverities = ['critical', 'high', 'medium', 'low'];

      for (const severity of validSeverities) {
        const detection = {
          id: 'severity-test',
          patternName: 'severity test',
          secretType: 'test',
          severity,
          maskedMatch: 'MASKED',
          detectedAt: new Date()
        };
        expect(() => SecretDetectionSchema.parse(detection)).not.toThrow();
        expect(SecretDetectionSchema.parse(detection).severity).toBe(severity);
      }
    });

    it('should reject invalid severity levels', () => {
      const invalidSeverities = ['extreme', 'severe', 'minor', 'info', 'warning', ''];

      for (const severity of invalidSeverities) {
        const detection = {
          id: 'test',
          patternName: 'test',
          secretType: 'test',
          severity,
          maskedMatch: 'MASKED',
          detectedAt: new Date()
        };
        expect(() => SecretDetectionSchema.parse(detection)).toThrow();
      }
    });

    it('should validate positive line numbers', () => {
      const baseDetection = {
        id: 'line-test',
        patternName: 'test',
        secretType: 'test',
        severity: 'medium',
        maskedMatch: 'MASKED',
        detectedAt: new Date()
      };

      // Valid line numbers
      [1, 10, 100, 999999].forEach(lineNumber => {
        const detection = { ...baseDetection, lineNumber };
        expect(() => SecretDetectionSchema.parse(detection)).not.toThrow();
      });

      // Invalid line numbers
      [0, -1, -100, 1.5, 2.7].forEach(lineNumber => {
        const detection = { ...baseDetection, lineNumber };
        expect(() => SecretDetectionSchema.parse(detection)).toThrow();
      });
    });

    it('should validate positive column numbers', () => {
      const baseDetection = {
        id: 'column-test',
        patternName: 'test',
        secretType: 'test',
        severity: 'medium',
        maskedMatch: 'MASKED',
        detectedAt: new Date()
      };

      // Valid column numbers
      [1, 5, 80, 120, 999].forEach(columnNumber => {
        const detection = { ...baseDetection, columnNumber };
        expect(() => SecretDetectionSchema.parse(detection)).not.toThrow();
      });

      // Invalid column numbers
      [0, -1, -50, 1.3, 4.9].forEach(columnNumber => {
        const detection = { ...baseDetection, columnNumber };
        expect(() => SecretDetectionSchema.parse(detection)).toThrow();
      });
    });

    it('should require all mandatory fields', () => {
      const requiredFields = ['id', 'patternName', 'secretType', 'severity', 'maskedMatch', 'detectedAt'];
      const fullDetection: any = {
        id: 'required-test',
        patternName: 'test pattern',
        secretType: 'test type',
        severity: 'medium',
        maskedMatch: 'MASKED',
        detectedAt: new Date()
      };

      for (const field of requiredFields) {
        const detection = { ...fullDetection };
        delete detection[field];
        expect(() => SecretDetectionSchema.parse(detection)).toThrow();
      }
    });

    it('should validate date field types', () => {
      const baseDetection = {
        id: 'date-test',
        patternName: 'test',
        secretType: 'test',
        severity: 'medium',
        maskedMatch: 'MASKED'
      };

      // Valid dates
      const validDetection = { ...baseDetection, detectedAt: new Date() };
      expect(() => SecretDetectionSchema.parse(validDetection)).not.toThrow();

      // Invalid dates
      const invalidDates = ['2024-01-01', '2024-01-01T10:00:00Z', 1234567890, 'invalid-date', null];
      for (const invalidDate of invalidDates) {
        const detection = { ...baseDetection, detectedAt: invalidDate };
        expect(() => SecretDetectionSchema.parse(detection)).toThrow();
      }
    });

    it('should handle acknowledgment fields correctly', () => {
      const baseDetection = {
        id: 'ack-test',
        patternName: 'test',
        secretType: 'test',
        severity: 'low',
        maskedMatch: 'MASKED',
        detectedAt: new Date()
      };

      // Test acknowledged with reason
      const acknowledgedWithReason = {
        ...baseDetection,
        acknowledged: true,
        acknowledgmentReason: 'False positive detected'
      };
      expect(() => SecretDetectionSchema.parse(acknowledgedWithReason)).not.toThrow();

      // Test acknowledged without reason (should still work)
      const acknowledgedWithoutReason = {
        ...baseDetection,
        acknowledged: true
      };
      expect(() => SecretDetectionSchema.parse(acknowledgedWithoutReason)).not.toThrow();

      // Test not acknowledged with reason (should still work)
      const notAcknowledgedWithReason = {
        ...baseDetection,
        acknowledged: false,
        acknowledgmentReason: 'Still reviewing'
      };
      expect(() => SecretDetectionSchema.parse(notAcknowledgedWithReason)).not.toThrow();
    });
  });

  describe('SecretDetection Type Integration', () => {
    it('should work with TypeScript type annotation', () => {
      const detection: SecretDetection = {
        id: 'type-test',
        patternName: 'Test Pattern',
        secretType: 'test_type',
        severity: 'high',
        maskedMatch: 'REDACTED',
        detectedAt: new Date()
      };

      const parsed = SecretDetectionSchema.parse(detection);
      expect(parsed.id).toBe('type-test');
      expect(parsed.severity).toBe('high');
    });

    it('should properly infer type from schema parse', () => {
      const parsed = SecretDetectionSchema.parse({
        id: 'infer-test',
        patternName: 'Infer Pattern',
        secretType: 'infer_type',
        severity: 'medium',
        maskedMatch: 'REDACTED',
        detectedAt: new Date()
      });

      // TypeScript should infer this as SecretDetection type
      const typedDetection: SecretDetection = parsed;
      expect(typedDetection.id).toBe('infer-test');
    });
  });
});