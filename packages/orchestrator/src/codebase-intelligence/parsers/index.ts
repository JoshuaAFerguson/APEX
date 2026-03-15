/**
 * Parsers Module
 *
 * Exports parsing utilities for source code analysis.
 */

// Tree-sitter wrapper
export {
  TreeSitterWrapper,
  getTreeSitterWrapper
} from './tree-sitter-wrapper.js';

// Value exports (enums, classes, constants, functions)
export {
  SupportedLanguage,
  ParserError,
  UnsupportedLanguageError,
  EXTENSION_LANGUAGE_MAP,
  getSupportedExtensions,
  isExtensionSupported,
  getLanguageForExtension
} from './types.js';

// Type-only exports (interfaces)
export type {
  ParseResult,
  ParseError,
  ParseOptions,
  Position,
  Range,
  ParserState
} from './types.js';

// Re-export tree-sitter types for convenience
export type { Tree, SyntaxNode, Point, TreeCursor } from './types.js';