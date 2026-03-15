/**
 * Integration Tests for Codebase Intelligence Module
 *
 * Tests the module exports and integration with orchestrator package.
 * Verifies that all exports are properly available and working together.
 */

import { describe, it, expect } from 'vitest';

describe('Codebase Intelligence Module Integration', () => {
  describe('Parser Module Exports', () => {
    it('should export TreeSitterWrapper from parsers index', async () => {
      const { TreeSitterWrapper } = await import('../parsers/index.js');
      expect(TreeSitterWrapper).toBeDefined();
      expect(typeof TreeSitterWrapper).toBe('function');
      expect(TreeSitterWrapper.getInstance).toBeDefined();
      expect(typeof TreeSitterWrapper.getInstance).toBe('function');
    });

    it('should export getTreeSitterWrapper convenience function', async () => {
      const { getTreeSitterWrapper } = await import('../parsers/index.js');
      expect(getTreeSitterWrapper).toBeDefined();
      expect(typeof getTreeSitterWrapper).toBe('function');
    });

    it('should export all type enums and constants', async () => {
      const {
        SupportedLanguage,
        ParserError,
        UnsupportedLanguageError,
        EXTENSION_LANGUAGE_MAP,
        getSupportedExtensions,
        isExtensionSupported,
        getLanguageForExtension
      } = await import('../parsers/index.js');

      expect(SupportedLanguage).toBeDefined();
      expect(SupportedLanguage.TypeScript).toBe('typescript');
      expect(SupportedLanguage.JavaScript).toBe('javascript');

      expect(ParserError).toBeDefined();
      expect(UnsupportedLanguageError).toBeDefined();
      expect(EXTENSION_LANGUAGE_MAP).toBeDefined();
      expect(typeof EXTENSION_LANGUAGE_MAP).toBe('object');

      expect(getSupportedExtensions).toBeDefined();
      expect(typeof getSupportedExtensions).toBe('function');
      expect(isExtensionSupported).toBeDefined();
      expect(typeof isExtensionSupported).toBe('function');
      expect(getLanguageForExtension).toBeDefined();
      expect(typeof getLanguageForExtension).toBe('function');
    });
  });

  describe('Main Codebase Intelligence Index', () => {
    it('should re-export all parsers module exports', async () => {
      const exports = await import('../index.js');

      // Check core classes
      expect(exports.TreeSitterWrapper).toBeDefined();
      expect(exports.getTreeSitterWrapper).toBeDefined();

      // Check enums and types
      expect(exports.SupportedLanguage).toBeDefined();
      expect(exports.ParserError).toBeDefined();
      expect(exports.UnsupportedLanguageError).toBeDefined();

      // Check constants and utilities
      expect(exports.EXTENSION_LANGUAGE_MAP).toBeDefined();
      expect(exports.getSupportedExtensions).toBeDefined();
      expect(exports.isExtensionSupported).toBeDefined();
      expect(exports.getLanguageForExtension).toBeDefined();
    });

    it('should re-export all extractor module exports', async () => {
      const exports = await import('../index.js');

      // Check extractor classes
      expect(exports.TypeScriptExtractor).toBeDefined();
      expect(exports.PythonExtractor).toBeDefined();
      expect(exports.getExtractorForLanguage).toBeDefined();

      // Check extractor types and utilities
      expect(exports.SymbolKind).toBeDefined();
      expect(exports.ExtractionError).toBeDefined();
      expect(exports.hasExtractorSupport).toBeDefined();
    });

    it('should re-export all indexer module exports', async () => {
      const exports = await import('../index.js');

      // Check indexer class and utilities
      expect(exports.CodebaseIndexer).toBeDefined();
      expect(typeof exports.CodebaseIndexer).toBe('function');
      expect(exports.getCodebaseIndexer).toBeDefined();
      expect(typeof exports.getCodebaseIndexer).toBe('function');

      // Verify CodebaseIndexer has expected methods
      expect(exports.CodebaseIndexer.getInstance).toBeDefined();
      expect(typeof exports.CodebaseIndexer.getInstance).toBe('function');
      expect(exports.CodebaseIndexer.resetInstance).toBeDefined();
      expect(typeof exports.CodebaseIndexer.resetInstance).toBe('function');
    });

    it('should work with main orchestrator exports', async () => {
      // Test that exports are available through the main orchestrator package
      // This simulates how consumers would import the functionality
      const orchestratorExports = await import('../../index.js');

      // Check that codebase-intelligence parsers exports are available
      expect(orchestratorExports.TreeSitterWrapper).toBeDefined();
      expect(orchestratorExports.SupportedLanguage).toBeDefined();
      expect(orchestratorExports.ParserError).toBeDefined();
      expect(orchestratorExports.UnsupportedLanguageError).toBeDefined();

      // Check that codebase-intelligence extractors exports are available
      expect(orchestratorExports.TypeScriptExtractor).toBeDefined();
      expect(orchestratorExports.PythonExtractor).toBeDefined();
      expect(orchestratorExports.getExtractorForLanguage).toBeDefined();

      // Check that codebase-intelligence indexer exports are available
      expect(orchestratorExports.CodebaseIndexer).toBeDefined();
      expect(orchestratorExports.getCodebaseIndexer).toBeDefined();
    });
  });

  describe('End-to-End Integration', () => {
    it('should create wrapper instance through orchestrator export', async () => {
      const { TreeSitterWrapper, SupportedLanguage } = await import('../../index.js');

      // Reset any existing instances
      TreeSitterWrapper.resetInstance();

      const wrapper = TreeSitterWrapper.getInstance();
      expect(wrapper).toBeDefined();

      // Test that it can actually parse code
      const result = await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);
      expect(result).toBeDefined();
      expect(result.hasErrors).toBe(false);
      expect(result.language).toBe(SupportedLanguage.JavaScript);

      // Clean up
      wrapper.clearCache();
      TreeSitterWrapper.resetInstance();
    });

    it('should create indexer instance through orchestrator export', async () => {
      const { CodebaseIndexer, getCodebaseIndexer } = await import('../../index.js');

      // Reset any existing instances
      CodebaseIndexer.resetInstance();

      const indexer = CodebaseIndexer.getInstance();
      expect(indexer).toBeDefined();

      // Test convenience function
      const indexer2 = getCodebaseIndexer();
      expect(indexer2).toBeDefined();
      expect(indexer2).toBe(indexer); // Should be same instance

      // Clean up
      CodebaseIndexer.resetInstance();
    });

    it('should create extractor instances through orchestrator export', async () => {
      const { TypeScriptExtractor, PythonExtractor, getExtractorForLanguage, SupportedLanguage } = await import('../../index.js');

      // Test direct extractor access
      const tsExtractor = TypeScriptExtractor.getInstance();
      expect(tsExtractor).toBeDefined();

      const pythonExtractor = PythonExtractor.getInstance();
      expect(pythonExtractor).toBeDefined();

      // Test factory function
      const tsExtractor2 = getExtractorForLanguage(SupportedLanguage.TypeScript);
      expect(tsExtractor2).toBeDefined();
      expect(tsExtractor2).toBe(tsExtractor);

      const pythonExtractor2 = getExtractorForLanguage(SupportedLanguage.Python);
      expect(pythonExtractor2).toBeDefined();
      expect(pythonExtractor2).toBe(pythonExtractor);

      // Clean up
      TypeScriptExtractor.resetInstance();
      PythonExtractor.resetInstance();
    });

    it('should support all languages through orchestrator export', async () => {
      const { TreeSitterWrapper, SupportedLanguage } = await import('../../index.js');

      TreeSitterWrapper.resetInstance();
      const wrapper = TreeSitterWrapper.getInstance();

      const testCases = [
        { code: 'const x: number = 5;', language: SupportedLanguage.TypeScript },
        { code: 'const x = <div>Hello</div>;', language: SupportedLanguage.TSX },
        { code: 'const x = 5;', language: SupportedLanguage.JavaScript },
        { code: 'x = 5', language: SupportedLanguage.Python },
        { code: 'package main\nfunc main() {}', language: SupportedLanguage.Go },
        { code: 'public class Test {}', language: SupportedLanguage.Java },
        { code: 'fn main() {}', language: SupportedLanguage.Rust }
      ];

      for (const testCase of testCases) {
        const result = await wrapper.parse(testCase.code, testCase.language);
        expect(result).toBeDefined();
        expect(result.language).toBe(testCase.language);
        expect(result.tree).toBeDefined();
        expect(result.rootNode).toBeDefined();
      }

      wrapper.clearCache();
      TreeSitterWrapper.resetInstance();
    });

    it('should handle error scenarios through orchestrator export', async () => {
      const { TreeSitterWrapper, SupportedLanguage, UnsupportedLanguageError } = await import('../../index.js');

      TreeSitterWrapper.resetInstance();
      const wrapper = TreeSitterWrapper.getInstance();

      // Test unsupported language error
      await expect(
        wrapper.parse('code', 'unsupported' as SupportedLanguage)
      ).rejects.toThrow(UnsupportedLanguageError);

      wrapper.clearCache();
      TreeSitterWrapper.resetInstance();
    });

    it('should provide utility functions through orchestrator export', async () => {
      const {
        getSupportedExtensions,
        isExtensionSupported,
        getLanguageForExtension,
        SupportedLanguage
      } = await import('../../index.js');

      // Test utility functions
      const extensions = getSupportedExtensions();
      expect(extensions).toBeDefined();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);

      expect(isExtensionSupported('.ts')).toBe(true);
      expect(isExtensionSupported('.txt')).toBe(false);

      expect(getLanguageForExtension('.ts')).toBe(SupportedLanguage.TypeScript);
      expect(getLanguageForExtension('.txt')).toBeNull();
    });
  });

  describe('TypeScript Build Integration', () => {
    it('should have proper type exports available', async () => {
      // This test ensures TypeScript types are properly exported
      // by attempting to import and use type-only exports
      const module = await import('../index.js');

      // These should be available as types at compile time
      // and the module should load without errors
      expect(module).toBeDefined();

      // Test that we can access type information indirectly
      const wrapper = module.TreeSitterWrapper.getInstance();
      const languages = wrapper.getSupportedLanguages();
      expect(languages).toBeDefined();
      expect(Array.isArray(languages)).toBe(true);

      wrapper.clearCache();
      module.TreeSitterWrapper.resetInstance();
    });
  });
});