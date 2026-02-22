/**
 * Codebase Intelligence Module
 *
 * Provides intelligent code analysis capabilities including:
 * - Tree-sitter based AST parsing
 * - Multi-language support (TypeScript, JavaScript, Python, Go, Java, Rust)
 * - Language detection
 *
 * @example
 * ```typescript
 * import { TreeSitterWrapper, SupportedLanguage } from '@apexcli/orchestrator/codebase-intelligence';
 *
 * const wrapper = TreeSitterWrapper.getInstance();
 * const result = await wrapper.parse('const x = 5;', SupportedLanguage.JavaScript);
 * ```
 */

// Parsers
export * from './parsers/index.js';
