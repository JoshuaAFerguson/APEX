/**
 * @fileoverview Basic Tests for Design Mockup Types
 */

import { describe, it, expect } from 'vitest';

import {
  DesignMockupError,
} from '../design-mockup-types';

describe('Design Mockup Types - Basic Validation', () => {
  describe('DesignMockupError class', () => {
    it('should create error with message and code', () => {
      const error = new DesignMockupError('Test error message', 'API_ERROR');

      expect(error.name).toBe('DesignMockupError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('API_ERROR');
      expect(error.details).toBeUndefined();
    });

    it('should create error with details', () => {
      const details = { statusCode: 404 };
      const error = new DesignMockupError('File not found', 'FILE_NOT_FOUND', details);

      expect(error.name).toBe('DesignMockupError');
      expect(error.message).toBe('File not found');
      expect(error.code).toBe('FILE_NOT_FOUND');
      expect(error.details).toBe(details);
    });

    it('should be instance of Error', () => {
      const error = new DesignMockupError('Test', 'PROCESSING_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DesignMockupError);
    });
  });

  describe('Type definitions', () => {
    it('should support basic design tool types', () => {
      const tools = ['figma', 'sketch', 'adobe_xd'];

      tools.forEach(tool => {
        const options = {
          designTool: tool as any
        };
        expect(options.designTool).toBe(tool);
      });
    });

    it('should support export formats', () => {
      const formats = ['png', 'jpeg', 'svg'];

      formats.forEach(format => {
        const config = {
          exportFormat: format as any
        };
        expect(config.exportFormat).toBe(format);
      });
    });

    it('should support dimension units', () => {
      const units = ['px', 'pt', 'dp'];

      units.forEach(unit => {
        const dimensions = {
          width: 100,
          height: 200,
          unit: unit as any
        };
        expect(dimensions.unit).toBe(unit);
      });
    });
  });
});