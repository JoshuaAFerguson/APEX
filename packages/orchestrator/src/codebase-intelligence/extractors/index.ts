/**
 * Symbol Extractors Module
 *
 * Exports symbol extraction utilities for various programming languages.
 * Symbol extractors analyze ASTs to extract structural information like
 * functions, classes, interfaces, and other language constructs.
 *
 * @example
 * ```typescript
 * import {
 *   getExtractorForLanguage,
 *   SymbolKind,
 *   SupportedLanguage
 * } from '@apexcli/orchestrator/codebase-intelligence/extractors';
 *
 * // Use the factory function to get the appropriate extractor
 * const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
 * const result = await extractor.extract(sourceCode, SupportedLanguage.TypeScript);
 *
 * // Or use specific extractors directly
 * const pythonExtractor = PythonExtractor.getInstance();
 * const result = await pythonExtractor.extract(sourceCode, SupportedLanguage.Python);
 * ```
 */

import { TypeScriptExtractor } from './typescript-extractor.js';
import { PythonExtractor } from './python-extractor.js';
import {
  type SymbolExtractor,
  isTypeScriptExtractorLanguage,
  isPythonExtractorLanguage,
  ExtractionError,
  type SupportedLanguage
} from './types.js';

// TypeScript/JavaScript extractor
export {
  TypeScriptExtractor,
  getTypeScriptExtractor
} from './typescript-extractor.js';

// Python extractor
export {
  PythonExtractor,
  getPythonExtractor
} from './python-extractor.js';

// Value exports (enums, classes, constants, functions)
export {
  SymbolKind,
  ExtractionError,
  DEFAULT_EXTRACTION_OPTIONS,
  EXTRACTABLE_NODE_TYPES,
  NODE_TYPE_TO_SYMBOL_KIND,
  TYPESCRIPT_EXTRACTOR_LANGUAGES,
  isTypeScriptExtractorLanguage,
  // Python extractor constants
  PYTHON_EXTRACTOR_LANGUAGES,
  isPythonExtractorLanguage,
  PYTHON_EXTRACTABLE_NODE_TYPES,
  PYTHON_NODE_TYPE_TO_SYMBOL_KIND,
  // Extractor support utilities
  SUPPORTED_EXTRACTOR_LANGUAGES,
  hasExtractorSupport
} from './types.js';

// Type-only exports (interfaces, types)
export type {
  SymbolExtractor,
  ExtractedSymbol,
  ExtractionOptions,
  ExtractionResult,
  SymbolModifier,
  ExportKind,
  ExtractorSupportedLanguage,
  Range,
  ParseError,
  SupportedLanguage
} from './types.js';

/**
 * Factory function to get the appropriate symbol extractor for a language
 *
 * Returns a singleton instance of the extractor that supports the specified language.
 * This is the recommended way to obtain extractors as it automatically selects
 * the correct implementation based on the language.
 *
 * @param language - The programming language to get an extractor for
 * @returns The appropriate SymbolExtractor instance for the language
 * @throws {ExtractionError} If no extractor is available for the language
 *
 * @example
 * ```typescript
 * // Get extractor for TypeScript
 * const tsExtractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
 * const result = await tsExtractor.extract(code, SupportedLanguage.TypeScript);
 *
 * // Get extractor for Python
 * const pyExtractor = getExtractorForLanguage(SupportedLanguage.Python);
 * const result = await pyExtractor.extract(code, SupportedLanguage.Python);
 *
 * // Works with string language identifiers too
 * const extractor = getExtractorForLanguage('javascript');
 * ```
 */
export function getExtractorForLanguage(language: SupportedLanguage | string): SymbolExtractor {
  // Check TypeScript/JavaScript/TSX
  if (isTypeScriptExtractorLanguage(language)) {
    return TypeScriptExtractor.getInstance();
  }

  // Check Python
  if (isPythonExtractorLanguage(language)) {
    return PythonExtractor.getInstance();
  }

  // No extractor available for this language
  throw new ExtractionError(
    `No symbol extractor available for language: ${language}. ` +
    `Supported languages are: typescript, tsx, javascript, python`
  );
}
