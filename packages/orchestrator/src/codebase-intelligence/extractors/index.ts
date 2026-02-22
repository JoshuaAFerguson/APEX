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
 *   PythonExtractor,
 *   TypeScriptExtractor,
 *   SymbolKind,
 *   SupportedLanguage
 * } from '@apexcli/orchestrator/codebase-intelligence/extractors';
 *
 * const pythonExtractor = PythonExtractor.getInstance();
 * const result = await pythonExtractor.extract(sourceCode, SupportedLanguage.Python);
 * ```
 */

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
  // Python extractor constants (for future use)
  PYTHON_EXTRACTOR_LANGUAGES,
  isPythonExtractorLanguage,
  PYTHON_EXTRACTABLE_NODE_TYPES,
  PYTHON_NODE_TYPE_TO_SYMBOL_KIND
} from './types.js';

// Type-only exports (interfaces, types)
export type {
  ExtractedSymbol,
  ExtractionOptions,
  ExtractionResult,
  SymbolModifier,
  ExportKind,
  Range,
  ParseError,
  SupportedLanguage
} from './types.js';
