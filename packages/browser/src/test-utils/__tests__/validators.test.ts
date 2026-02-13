/**
 * @apexcli/browser - Validators Test Suite
 *
 * Comprehensive tests for screenshot validation utilities
 */

import { describe, it, expect } from 'vitest';
import { ScreenshotValidators } from '../validators.js';

describe('ScreenshotValidators', () => {
  describe('isPNG', () => {
    it('should return true for valid PNG signature', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(ScreenshotValidators.isPNG(pngBuffer)).toBe(true);
    });

    it('should return true for PNG buffer with minimal signature', () => {
      const minimalPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(ScreenshotValidators.isPNG(minimalPngBuffer)).toBe(true);
    });

    it('should return true for PNG buffer with additional data', () => {
      const largePngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47,  // PNG signature
        0x0D, 0x0A, 0x1A, 0x0A,  // PNG header continuation
        ...Array(100).fill(0x00)  // Additional data
      ]);
      expect(ScreenshotValidators.isPNG(largePngBuffer)).toBe(true);
    });

    it('should return false for invalid PNG signature - wrong first byte', () => {
      const invalidBuffer = Buffer.from([0x88, 0x50, 0x4E, 0x47]);
      expect(ScreenshotValidators.isPNG(invalidBuffer)).toBe(false);
    });

    it('should return false for invalid PNG signature - wrong second byte', () => {
      const invalidBuffer = Buffer.from([0x89, 0x51, 0x4E, 0x47]);
      expect(ScreenshotValidators.isPNG(invalidBuffer)).toBe(false);
    });

    it('should return false for invalid PNG signature - wrong third byte', () => {
      const invalidBuffer = Buffer.from([0x89, 0x50, 0x4F, 0x47]);
      expect(ScreenshotValidators.isPNG(invalidBuffer)).toBe(false);
    });

    it('should return false for invalid PNG signature - wrong fourth byte', () => {
      const invalidBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x48]);
      expect(ScreenshotValidators.isPNG(invalidBuffer)).toBe(false);
    });

    it('should return false for buffer too short', () => {
      const shortBuffer = Buffer.from([0x89, 0x50, 0x4E]);
      expect(ScreenshotValidators.isPNG(shortBuffer)).toBe(false);
    });

    it('should return false for empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      expect(ScreenshotValidators.isPNG(emptyBuffer)).toBe(false);
    });

    it('should return false for JPEG signature', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(ScreenshotValidators.isPNG(jpegBuffer)).toBe(false);
    });

    it('should return false for random data', () => {
      const randomBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33]);
      expect(ScreenshotValidators.isPNG(randomBuffer)).toBe(false);
    });

    it('should return false for all zeros', () => {
      const zeroBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(ScreenshotValidators.isPNG(zeroBuffer)).toBe(false);
    });

    it('should return false for all ones', () => {
      const onesBuffer = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
      expect(ScreenshotValidators.isPNG(onesBuffer)).toBe(false);
    });
  });

  describe('isJPEG', () => {
    it('should return true for valid JPEG signature', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(ScreenshotValidators.isJPEG(jpegBuffer)).toBe(true);
    });

    it('should return true for JPEG buffer with minimal signature', () => {
      const minimalJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
      expect(ScreenshotValidators.isJPEG(minimalJpegBuffer)).toBe(true);
    });

    it('should return true for JPEG JFIF signature', () => {
      const jfifBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(ScreenshotValidators.isJPEG(jfifBuffer)).toBe(true);
    });

    it('should return true for JPEG EXIF signature', () => {
      const exifBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]);
      expect(ScreenshotValidators.isJPEG(exifBuffer)).toBe(true);
    });

    it('should return true for JPEG with additional data', () => {
      const largeJpegBuffer = Buffer.from([
        0xFF, 0xD8, 0xFF,  // JPEG signature
        ...Array(100).fill(0x00)  // Additional data
      ]);
      expect(ScreenshotValidators.isJPEG(largeJpegBuffer)).toBe(true);
    });

    it('should return false for invalid JPEG signature - wrong first byte', () => {
      const invalidBuffer = Buffer.from([0xFE, 0xD8, 0xFF]);
      expect(ScreenshotValidators.isJPEG(invalidBuffer)).toBe(false);
    });

    it('should return false for invalid JPEG signature - wrong second byte', () => {
      const invalidBuffer = Buffer.from([0xFF, 0xD7, 0xFF]);
      expect(ScreenshotValidators.isJPEG(invalidBuffer)).toBe(false);
    });

    it('should return false for invalid JPEG signature - wrong third byte', () => {
      const invalidBuffer = Buffer.from([0xFF, 0xD8, 0xFE]);
      expect(ScreenshotValidators.isJPEG(invalidBuffer)).toBe(false);
    });

    it('should return false for buffer too short', () => {
      const shortBuffer = Buffer.from([0xFF, 0xD8]);
      expect(ScreenshotValidators.isJPEG(shortBuffer)).toBe(false);
    });

    it('should return false for empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      expect(ScreenshotValidators.isJPEG(emptyBuffer)).toBe(false);
    });

    it('should return false for PNG signature', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      expect(ScreenshotValidators.isJPEG(pngBuffer)).toBe(false);
    });

    it('should return false for random data', () => {
      const randomBuffer = Buffer.from([0x12, 0x34, 0x56]);
      expect(ScreenshotValidators.isJPEG(randomBuffer)).toBe(false);
    });

    it('should return false for all zeros', () => {
      const zeroBuffer = Buffer.from([0x00, 0x00, 0x00]);
      expect(ScreenshotValidators.isJPEG(zeroBuffer)).toBe(false);
    });
  });

  describe('isValidResult', () => {
    it('should return true for valid result object', () => {
      const validResult = {
        success: true,
        duration: 100
      };
      expect(ScreenshotValidators.isValidResult(validResult)).toBe(true);
    });

    it('should return true for valid result with success false', () => {
      const validResult = {
        success: false,
        duration: 250
      };
      expect(ScreenshotValidators.isValidResult(validResult)).toBe(true);
    });

    it('should return true for valid result with zero duration', () => {
      const validResult = {
        success: true,
        duration: 0
      };
      expect(ScreenshotValidators.isValidResult(validResult)).toBe(true);
    });

    it('should return true for valid result with additional properties', () => {
      const validResult = {
        success: true,
        duration: 100,
        data: Buffer.from([]),
        error: undefined,
        extra: 'property'
      };
      expect(ScreenshotValidators.isValidResult(validResult)).toBe(true);
    });

    it('should return false for null', () => {
      expect(ScreenshotValidators.isValidResult(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(ScreenshotValidators.isValidResult(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(ScreenshotValidators.isValidResult('not an object')).toBe(false);
    });

    it('should return false for number', () => {
      expect(ScreenshotValidators.isValidResult(123)).toBe(false);
    });

    it('should return false for array', () => {
      expect(ScreenshotValidators.isValidResult([])).toBe(false);
    });

    it('should return false for missing success property', () => {
      const invalidResult = {
        duration: 100
      };
      expect(ScreenshotValidators.isValidResult(invalidResult)).toBe(false);
    });

    it('should return false for non-boolean success property', () => {
      const invalidResult = {
        success: 'true',
        duration: 100
      };
      expect(ScreenshotValidators.isValidResult(invalidResult)).toBe(false);
    });

    it('should return false for missing duration property', () => {
      const invalidResult = {
        success: true
      };
      expect(ScreenshotValidators.isValidResult(invalidResult)).toBe(false);
    });

    it('should return false for non-number duration property', () => {
      const invalidResult = {
        success: true,
        duration: '100'
      };
      expect(ScreenshotValidators.isValidResult(invalidResult)).toBe(false);
    });

    it('should return false for negative duration', () => {
      const invalidResult = {
        success: true,
        duration: -100
      };
      expect(ScreenshotValidators.isValidResult(invalidResult)).toBe(false);
    });

    it('should return false for NaN duration', () => {
      const invalidResult = {
        success: true,
        duration: NaN
      };
      expect(ScreenshotValidators.isValidResult(invalidResult)).toBe(false);
    });

    it('should return false for Infinity duration', () => {
      const invalidResult = {
        success: true,
        duration: Infinity
      };
      expect(ScreenshotValidators.isValidResult(invalidResult)).toBe(false);
    });
  });

  describe('isSuccessfulResult', () => {
    it('should return true for valid successful result', () => {
      const successfulResult = {
        success: true,
        duration: 100,
        data: Buffer.from([1, 2, 3]),
        error: undefined
      };
      expect(ScreenshotValidators.isSuccessfulResult(successfulResult)).toBe(true);
    });

    it('should return true for successful result without error property', () => {
      const successfulResult = {
        success: true,
        duration: 100,
        data: Buffer.from([1, 2, 3])
      };
      expect(ScreenshotValidators.isSuccessfulResult(successfulResult)).toBe(true);
    });

    it('should return true for successful result with large data buffer', () => {
      const successfulResult = {
        success: true,
        duration: 100,
        data: Buffer.from(Array(1000).fill(255)),
        error: undefined
      };
      expect(ScreenshotValidators.isSuccessfulResult(successfulResult)).toBe(true);
    });

    it('should return false for result with success false', () => {
      const failedResult = {
        success: false,
        duration: 100,
        data: Buffer.from([1, 2, 3]),
        error: undefined
      };
      expect(ScreenshotValidators.isSuccessfulResult(failedResult)).toBe(false);
    });

    it('should return false for result without data', () => {
      const resultWithoutData = {
        success: true,
        duration: 100,
        error: undefined
      };
      expect(ScreenshotValidators.isSuccessfulResult(resultWithoutData)).toBe(false);
    });

    it('should return false for result with non-Buffer data', () => {
      const resultWithInvalidData = {
        success: true,
        duration: 100,
        data: [1, 2, 3],
        error: undefined
      };
      expect(ScreenshotValidators.isSuccessfulResult(resultWithInvalidData)).toBe(false);
    });

    it('should return false for result with empty Buffer data', () => {
      const resultWithEmptyData = {
        success: true,
        duration: 100,
        data: Buffer.from([]),
        error: undefined
      };
      expect(ScreenshotValidators.isSuccessfulResult(resultWithEmptyData)).toBe(false);
    });

    it('should return false for result with error property set', () => {
      const resultWithError = {
        success: true,
        duration: 100,
        data: Buffer.from([1, 2, 3]),
        error: 'Some error'
      };
      expect(ScreenshotValidators.isSuccessfulResult(resultWithError)).toBe(false);
    });

    it('should return false for result with null error (still defined)', () => {
      const resultWithNullError = {
        success: true,
        duration: 100,
        data: Buffer.from([1, 2, 3]),
        error: null
      };
      expect(ScreenshotValidators.isSuccessfulResult(resultWithNullError)).toBe(false);
    });

    it('should return false for invalid result structure', () => {
      const invalidResult = {
        success: true,
        duration: -100,
        data: Buffer.from([1, 2, 3])
      };
      expect(ScreenshotValidators.isSuccessfulResult(invalidResult)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(ScreenshotValidators.isSuccessfulResult(null)).toBe(false);
    });
  });

  describe('isFailedResult', () => {
    it('should return true for valid failed result', () => {
      const failedResult = {
        success: false,
        duration: 100,
        error: 'Screenshot failed'
      };
      expect(ScreenshotValidators.isFailedResult(failedResult)).toBe(true);
    });

    it('should return true for failed result with additional properties', () => {
      const failedResult = {
        success: false,
        duration: 250,
        error: 'Timeout occurred',
        data: null,
        extra: 'property'
      };
      expect(ScreenshotValidators.isFailedResult(failedResult)).toBe(true);
    });

    it('should return true for failed result with long error message', () => {
      const failedResult = {
        success: false,
        duration: 100,
        error: 'A very long error message that describes exactly what went wrong during the screenshot process and provides detailed information about the failure'
      };
      expect(ScreenshotValidators.isFailedResult(failedResult)).toBe(true);
    });

    it('should return false for result with success true', () => {
      const successfulResult = {
        success: true,
        duration: 100,
        error: 'This should not be here'
      };
      expect(ScreenshotValidators.isFailedResult(successfulResult)).toBe(false);
    });

    it('should return false for result without error', () => {
      const resultWithoutError = {
        success: false,
        duration: 100
      };
      expect(ScreenshotValidators.isFailedResult(resultWithoutError)).toBe(false);
    });

    it('should return false for result with non-string error', () => {
      const resultWithInvalidError = {
        success: false,
        duration: 100,
        error: 123
      };
      expect(ScreenshotValidators.isFailedResult(resultWithInvalidError)).toBe(false);
    });

    it('should return false for result with empty error string', () => {
      const resultWithEmptyError = {
        success: false,
        duration: 100,
        error: ''
      };
      expect(ScreenshotValidators.isFailedResult(resultWithEmptyError)).toBe(false);
    });

    it('should return false for result with null error', () => {
      const resultWithNullError = {
        success: false,
        duration: 100,
        error: null
      };
      expect(ScreenshotValidators.isFailedResult(resultWithNullError)).toBe(false);
    });

    it('should return false for result with undefined error', () => {
      const resultWithUndefinedError = {
        success: false,
        duration: 100,
        error: undefined
      };
      expect(ScreenshotValidators.isFailedResult(resultWithUndefinedError)).toBe(false);
    });

    it('should return false for invalid result structure', () => {
      const invalidResult = {
        success: false,
        duration: -100,
        error: 'Error message'
      };
      expect(ScreenshotValidators.isFailedResult(invalidResult)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(ScreenshotValidators.isFailedResult('failed')).toBe(false);
    });
  });

  describe('Integration and edge cases', () => {
    it('should handle both PNG and JPEG validation consistently', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);

      expect(ScreenshotValidators.isPNG(pngBuffer)).toBe(true);
      expect(ScreenshotValidators.isJPEG(pngBuffer)).toBe(false);

      expect(ScreenshotValidators.isJPEG(jpegBuffer)).toBe(true);
      expect(ScreenshotValidators.isPNG(jpegBuffer)).toBe(false);
    });

    it('should validate complete successful screenshot workflow', () => {
      const pngData = Buffer.from([0x89, 0x50, 0x4E, 0x47, ...Array(100).fill(0)]);
      const result = {
        success: true,
        duration: 150,
        data: pngData,
        error: undefined
      };

      expect(ScreenshotValidators.isValidResult(result)).toBe(true);
      expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(true);
      expect(ScreenshotValidators.isFailedResult(result)).toBe(false);
      expect(ScreenshotValidators.isPNG(result.data)).toBe(true);
    });

    it('should validate complete failed screenshot workflow', () => {
      const result = {
        success: false,
        duration: 75,
        error: 'Page not found'
      };

      expect(ScreenshotValidators.isValidResult(result)).toBe(true);
      expect(ScreenshotValidators.isSuccessfulResult(result)).toBe(false);
      expect(ScreenshotValidators.isFailedResult(result)).toBe(true);
    });

    it('should handle very large buffers for image validation', () => {
      const largePngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47]),
        Buffer.alloc(1024 * 1024) // 1MB of zeros
      ]);

      expect(ScreenshotValidators.isPNG(largePngBuffer)).toBe(true);
      expect(ScreenshotValidators.isJPEG(largePngBuffer)).toBe(false);
    });

    it('should handle buffers with correct signature but corrupted later', () => {
      const corruptedBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, // Valid PNG signature
        ...Array(100).fill(0xFF)  // Corrupted data
      ]);

      // Should still validate signature correctly
      expect(ScreenshotValidators.isPNG(corruptedBuffer)).toBe(true);
    });

    it('should handle edge case durations', () => {
      expect(ScreenshotValidators.isValidResult({
        success: true,
        duration: Number.MAX_SAFE_INTEGER
      })).toBe(true);

      expect(ScreenshotValidators.isValidResult({
        success: true,
        duration: 0.1
      })).toBe(true);

      expect(ScreenshotValidators.isValidResult({
        success: true,
        duration: Number.EPSILON
      })).toBe(true);
    });
  });
});