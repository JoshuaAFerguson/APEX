/**
 * Unit Tests for Symbol Extractor Factory
 *
 * Tests the getExtractorForLanguage factory function that returns
 * the appropriate symbol extractor for a given programming language.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getExtractorForLanguage,
  TypeScriptExtractor,
  PythonExtractor,
  ExtractionError,
  type SymbolExtractor,
  hasExtractorSupport
} from '../index.js';
import { SupportedLanguage } from '../../parsers/types.js';

describe('Symbol Extractor Factory', () => {
  beforeEach(() => {
    // Reset singleton instances before each test
    TypeScriptExtractor.resetInstance();
    PythonExtractor.resetInstance();
  });

  afterEach(() => {
    // Clean up after each test
    TypeScriptExtractor.resetInstance();
    PythonExtractor.resetInstance();
  });

  describe('getExtractorForLanguage', () => {
    it('should return TypeScript extractor for TypeScript language', () => {
      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      expect(extractor).toBeInstanceOf(TypeScriptExtractor);
    });

    it('should return TypeScript extractor for TypeScript string', () => {
      const extractor = getExtractorForLanguage('typescript');
      expect(extractor).toBeInstanceOf(TypeScriptExtractor);
    });

    it('should return TypeScript extractor for TSX language', () => {
      const extractor = getExtractorForLanguage(SupportedLanguage.TSX);
      expect(extractor).toBeInstanceOf(TypeScriptExtractor);
    });

    it('should return TypeScript extractor for TSX string', () => {
      const extractor = getExtractorForLanguage('tsx');
      expect(extractor).toBeInstanceOf(TypeScriptExtractor);
    });

    it('should return TypeScript extractor for JavaScript language', () => {
      const extractor = getExtractorForLanguage(SupportedLanguage.JavaScript);
      expect(extractor).toBeInstanceOf(TypeScriptExtractor);
    });

    it('should return TypeScript extractor for JavaScript string', () => {
      const extractor = getExtractorForLanguage('javascript');
      expect(extractor).toBeInstanceOf(TypeScriptExtractor);
    });

    it('should return Python extractor for Python language', () => {
      const extractor = getExtractorForLanguage(SupportedLanguage.Python);
      expect(extractor).toBeInstanceOf(PythonExtractor);
    });

    it('should return Python extractor for Python string', () => {
      const extractor = getExtractorForLanguage('python');
      expect(extractor).toBeInstanceOf(PythonExtractor);
    });

    it('should return same singleton instance for multiple calls with same language', () => {
      const extractor1 = getExtractorForLanguage('typescript');
      const extractor2 = getExtractorForLanguage('typescript');
      expect(extractor1).toBe(extractor2);
    });

    it('should return same singleton instance for different representations of same language', () => {
      const extractor1 = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const extractor2 = getExtractorForLanguage('typescript');
      expect(extractor1).toBe(extractor2);
    });

    it('should throw ExtractionError for unsupported language', () => {
      expect(() => getExtractorForLanguage('java')).toThrow(ExtractionError);
      expect(() => getExtractorForLanguage('java')).toThrow(
        'No symbol extractor available for language: java. Supported languages are: typescript, tsx, javascript, python'
      );
    });

    it('should throw ExtractionError for empty string', () => {
      expect(() => getExtractorForLanguage('')).toThrow(ExtractionError);
    });

    it('should throw ExtractionError for unsupported languages', () => {
      const unsupportedLanguages = ['java', 'cpp', 'rust', 'go', 'ruby', 'php'];

      for (const lang of unsupportedLanguages) {
        expect(() => getExtractorForLanguage(lang)).toThrow(ExtractionError);
        expect(() => getExtractorForLanguage(lang)).toThrow(
          `No symbol extractor available for language: ${lang}`
        );
      }
    });
  });

  describe('hasExtractorSupport', () => {
    it('should return true for supported languages', () => {
      expect(hasExtractorSupport('typescript')).toBe(true);
      expect(hasExtractorSupport('tsx')).toBe(true);
      expect(hasExtractorSupport('javascript')).toBe(true);
      expect(hasExtractorSupport('python')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(hasExtractorSupport('java')).toBe(false);
      expect(hasExtractorSupport('cpp')).toBe(false);
      expect(hasExtractorSupport('rust')).toBe(false);
      expect(hasExtractorSupport('go')).toBe(false);
      expect(hasExtractorSupport('')).toBe(false);
    });
  });

  describe('extractor interface compliance', () => {
    it('should return extractors that implement SymbolExtractor interface', () => {
      const tsExtractor = getExtractorForLanguage('typescript');
      const pyExtractor = getExtractorForLanguage('python');

      // Check that both extractors have the required methods
      expect(typeof tsExtractor.extract).toBe('function');
      expect(typeof tsExtractor.extractFromFile).toBe('function');
      expect(typeof pyExtractor.extract).toBe('function');
      expect(typeof pyExtractor.extractFromFile).toBe('function');
    });

    it('should return extractors with correct method signatures', () => {
      const extractor = getExtractorForLanguage('typescript');

      // The extract method should exist and be a function
      expect(extractor.extract).toBeInstanceOf(Function);
      expect(extractor.extractFromFile).toBeInstanceOf(Function);

      // Check that methods have the expected number of parameters
      expect(extractor.extract.length).toBe(3); // sourceCode, language, options?
      expect(extractor.extractFromFile.length).toBe(2); // filePath, options?
    });
  });
});