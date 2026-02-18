/**
 * @apexcli/browser - Screenshot Validators
 *
 * Migrated from __tests__/test-utils.ts
 */

/**
 * Screenshot validation utilities
 */
export const ScreenshotValidators = {
  /**
   * Check if buffer contains PNG signature
   */
  isPNG: (buffer: Buffer): boolean => {
    return buffer.length >= 4 &&
           buffer[0] === 0x89 &&
           buffer[1] === 0x50 &&
           buffer[2] === 0x4E &&
           buffer[3] === 0x47;
  },

  /**
   * Check if buffer contains JPEG signature
   */
  isJPEG: (buffer: Buffer): boolean => {
    return buffer.length >= 3 &&
           buffer[0] === 0xFF &&
           buffer[1] === 0xD8 &&
           buffer[2] === 0xFF;
  },

  /**
   * Validate screenshot result structure
   */
  isValidResult: (result: any): boolean => {
    return typeof result === 'object' &&
           typeof result.success === 'boolean' &&
           typeof result.duration === 'number' &&
           result.duration >= 0;
  },

  /**
   * Validate successful screenshot result
   */
  isSuccessfulResult: (result: any): boolean => {
    return ScreenshotValidators.isValidResult(result) &&
           result.success === true &&
           Buffer.isBuffer(result.data) &&
           result.data.length > 0 &&
           result.error === undefined;
  },

  /**
   * Validate failed screenshot result
   */
  isFailedResult: (result: any): boolean => {
    return ScreenshotValidators.isValidResult(result) &&
           result.success === false &&
           typeof result.error === 'string' &&
           result.error.length > 0;
  }
};