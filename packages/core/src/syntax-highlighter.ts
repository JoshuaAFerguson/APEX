/**
 * Syntax highlighting utility for tool outputs with ANSI color support
 *
 * This module provides syntax highlighting for various content types including:
 * - JSON
 * - Code (JavaScript, TypeScript, Python, Go, Rust, etc.)
 * - YAML
 * - Diff output
 * - Error messages
 * - Plain text
 *
 * Supports terminal ANSI colors for CLI output.
 */

/**
 * ANSI color codes and formatting constants for terminal output
 *
 * Provides color codes for foreground/background colors and text formatting
 * for styled console output in terminal environments.
 */
export const ANSI_COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
} as const;

/**
 * Content type classification for syntax highlighting
 */
export type ContentType =
  | 'json'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'yaml'
  | 'xml'
  | 'html'
  | 'css'
  | 'scss'
  | 'sql'
  | 'shell'
  | 'bash'
  | 'powershell'
  | 'diff'
  | 'markdown'
  | 'dockerfile'
  | 'ini'
  | 'toml'
  | 'log'
  | 'error'
  | 'plain';

/**
 * Theme configuration for syntax highlighting
 */
export interface SyntaxTheme {
  keyword: string;
  string: string;
  number: string;
  boolean: string;
  null: string;
  comment: string;
  function: string;
  variable: string;
  type: string;
  operator: string;
  punctuation: string;
  property: string;
  value: string;
  error: string;
  warning: string;
  success: string;
  info: string;
  diff_added: string;
  diff_removed: string;
  diff_header: string;
  line_number: string;
}

/**
 * Default dark theme using ANSI colors
 */
export const DARK_THEME: SyntaxTheme = {
  keyword: ANSI_COLORS.brightBlue,
  string: ANSI_COLORS.brightGreen,
  number: ANSI_COLORS.brightMagenta,
  boolean: ANSI_COLORS.brightMagenta,
  null: ANSI_COLORS.brightMagenta,
  comment: ANSI_COLORS.gray,
  function: ANSI_COLORS.yellow,
  variable: ANSI_COLORS.white,
  type: ANSI_COLORS.cyan,
  operator: ANSI_COLORS.white,
  punctuation: ANSI_COLORS.white,
  property: ANSI_COLORS.brightCyan,
  value: ANSI_COLORS.white,
  error: ANSI_COLORS.brightRed,
  warning: ANSI_COLORS.brightYellow,
  success: ANSI_COLORS.brightGreen,
  info: ANSI_COLORS.brightBlue,
  diff_added: ANSI_COLORS.brightGreen,
  diff_removed: ANSI_COLORS.brightRed,
  diff_header: ANSI_COLORS.cyan,
  line_number: ANSI_COLORS.gray,
};

/**
 * Light theme using ANSI colors
 */
export const LIGHT_THEME: SyntaxTheme = {
  keyword: ANSI_COLORS.blue,
  string: ANSI_COLORS.green,
  number: ANSI_COLORS.magenta,
  boolean: ANSI_COLORS.magenta,
  null: ANSI_COLORS.magenta,
  comment: ANSI_COLORS.gray,
  function: ANSI_COLORS.blue,
  variable: ANSI_COLORS.black,
  type: ANSI_COLORS.cyan,
  operator: ANSI_COLORS.black,
  punctuation: ANSI_COLORS.black,
  property: ANSI_COLORS.blue,
  value: ANSI_COLORS.black,
  error: ANSI_COLORS.red,
  warning: ANSI_COLORS.yellow,
  success: ANSI_COLORS.green,
  info: ANSI_COLORS.blue,
  diff_added: ANSI_COLORS.green,
  diff_removed: ANSI_COLORS.red,
  diff_header: ANSI_COLORS.blue,
  line_number: ANSI_COLORS.gray,
};

/**
 * Options for syntax highlighting
 */
export interface SyntaxHighlightOptions {
  /** Content type (auto-detected if not provided) */
  contentType?: ContentType;
  /** Theme to use (default: DARK_THEME) */
  theme?: SyntaxTheme;
  /** Whether to show line numbers (default: false) */
  showLineNumbers?: boolean;
  /** Maximum number of lines to display (default: unlimited) */
  maxLines?: number;
  /** Whether to enable ANSI colors (default: true) */
  colors?: boolean;
  /** File extension for content type detection */
  fileExtension?: string;
  /** File name for content type detection */
  fileName?: string;
}

/**
 * Result of syntax highlighting
 */
export interface HighlightResult {
  /** The highlighted content */
  content: string;
  /** Detected content type */
  contentType: ContentType;
  /** Whether highlighting was applied */
  highlighted: boolean;
  /** Number of lines in the content */
  lineCount: number;
  /** Whether content was truncated */
  truncated: boolean;
}

/**
 * Language keywords for syntax highlighting
 */
const KEYWORDS: Record<ContentType, string[]> = {
  javascript: [
    'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
    'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this',
    'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield'
  ],
  typescript: [
    'abstract', 'any', 'as', 'asserts', 'async', 'await', 'boolean', 'break', 'case', 'catch',
    'class', 'const', 'continue', 'declare', 'default', 'delete', 'do', 'else', 'enum', 'export',
    'extends', 'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements', 'import',
    'in', 'instanceof', 'interface', 'is', 'keyof', 'let', 'module', 'namespace', 'never', 'new',
    'null', 'number', 'object', 'of', 'package', 'private', 'protected', 'public', 'readonly',
    'return', 'set', 'static', 'string', 'super', 'switch', 'symbol', 'this', 'throw', 'true',
    'try', 'type', 'typeof', 'undefined', 'unknown', 'var', 'void', 'while', 'with', 'yield'
  ],
  python: [
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
    'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
    'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
    'try', 'while', 'with', 'yield'
  ],
  go: [
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough',
    'for', 'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range',
    'return', 'select', 'struct', 'switch', 'type', 'var'
  ],
  rust: [
    'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern', 'false', 'fn',
    'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref',
    'return', 'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type', 'unsafe',
    'use', 'where', 'while', 'async', 'await', 'dyn'
  ],
  java: [
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
    'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final',
    'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int',
    'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public',
    'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
    'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while'
  ],
  c: [
    'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do', 'double', 'else',
    'enum', 'extern', 'float', 'for', 'goto', 'if', 'int', 'long', 'register', 'return',
    'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union', 'unsigned',
    'void', 'volatile', 'while'
  ],
  cpp: [
    'alignas', 'alignof', 'and', 'and_eq', 'asm', 'atomic_cancel', 'atomic_commit',
    'atomic_noexcept', 'auto', 'bitand', 'bitor', 'bool', 'break', 'case', 'catch', 'char',
    'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const', 'consteval', 'constexpr',
    'constinit', 'const_cast', 'continue', 'co_await', 'co_return', 'co_yield', 'decltype',
    'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit', 'export',
    'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long',
    'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or',
    'or_eq', 'private', 'protected', 'public', 'register', 'reinterpret_cast', 'requires',
    'return', 'short', 'signed', 'sizeof', 'static', 'static_assert', 'static_cast', 'struct',
    'switch', 'synchronized', 'template', 'this', 'thread_local', 'throw', 'true', 'try',
    'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void',
    'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'
  ],
  csharp: [
    'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char', 'checked',
    'class', 'const', 'continue', 'decimal', 'default', 'delegate', 'do', 'double', 'else',
    'enum', 'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float', 'for',
    'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface', 'internal', 'is', 'lock',
    'long', 'namespace', 'new', 'null', 'object', 'operator', 'out', 'override', 'params',
    'private', 'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed', 'short',
    'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch', 'this', 'throw', 'true',
    'try', 'typeof', 'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'virtual',
    'void', 'volatile', 'while'
  ],
  php: [
    'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch', 'class', 'clone',
    'const', 'continue', 'declare', 'default', 'die', 'do', 'echo', 'else', 'elseif', 'empty',
    'enddeclare', 'endfor', 'endforeach', 'endif', 'endswitch', 'endwhile', 'eval', 'exit',
    'extends', 'final', 'finally', 'for', 'foreach', 'function', 'global', 'goto', 'if',
    'implements', 'include', 'include_once', 'instanceof', 'insteadof', 'interface', 'isset',
    'list', 'namespace', 'new', 'or', 'print', 'private', 'protected', 'public', 'require',
    'require_once', 'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use',
    'var', 'while', 'xor', 'yield'
  ],
  ruby: [
    'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?', 'do', 'else',
    'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in', 'module', 'next', 'nil', 'not',
    'or', 'redo', 'rescue', 'retry', 'return', 'self', 'super', 'then', 'true', 'undef',
    'unless', 'until', 'when', 'while', 'yield'
  ],
  shell: [
    'case', 'do', 'done', 'elif', 'else', 'esac', 'fi', 'for', 'function', 'if', 'in',
    'select', 'then', 'until', 'while', 'time'
  ],
  bash: [
    'case', 'do', 'done', 'elif', 'else', 'esac', 'fi', 'for', 'function', 'if', 'in',
    'select', 'then', 'until', 'while', 'time', 'coproc', 'declare', 'local', 'readonly',
    'typeset', 'unset'
  ],
  powershell: [
    'begin', 'break', 'catch', 'class', 'continue', 'data', 'define', 'do', 'dynamicparam',
    'else', 'elseif', 'end', 'exit', 'filter', 'finally', 'for', 'foreach', 'from',
    'function', 'if', 'in', 'param', 'process', 'return', 'switch', 'throw', 'trap', 'try',
    'until', 'using', 'var', 'while', 'workflow'
  ],
  sql: [
    'ADD', 'ALL', 'ALTER', 'AND', 'ANY', 'AS', 'ASC', 'BACKUP', 'BETWEEN', 'CASE', 'CHECK',
    'COLUMN', 'CONSTRAINT', 'CREATE', 'DATABASE', 'DEFAULT', 'DELETE', 'DESC', 'DISTINCT',
    'DROP', 'EXEC', 'EXISTS', 'FOREIGN', 'FROM', 'FULL', 'GROUP', 'HAVING', 'IN', 'INDEX',
    'INNER', 'INSERT', 'INTO', 'IS', 'JOIN', 'KEY', 'LEFT', 'LIKE', 'LIMIT', 'NOT', 'NULL',
    'OR', 'ORDER', 'OUTER', 'PRIMARY', 'PROCEDURE', 'RIGHT', 'ROWNUM', 'SELECT', 'SET',
    'TABLE', 'TOP', 'TRUNCATE', 'UNION', 'UNIQUE', 'UPDATE', 'VALUES', 'VIEW', 'WHERE'
  ],
  // Other content types don't have keywords
  json: [],
  yaml: [],
  xml: [],
  html: [],
  css: [],
  scss: [],
  diff: [],
  markdown: [],
  dockerfile: [],
  ini: [],
  toml: [],
  log: [],
  error: [],
  plain: [],
};

/**
 * File extension to content type mapping
 */
const EXTENSION_MAP: Record<string, ContentType> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.pyi': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'java', // Kotlin, similar highlighting
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.sh': 'shell',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.fish': 'bash',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.sql': 'sql',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'scss',
  '.diff': 'diff',
  '.patch': 'diff',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.dockerfile': 'dockerfile',
  '.ini': 'ini',
  '.toml': 'toml',
  '.log': 'log',
};

/**
 * File name patterns for content type detection
 */
const FILENAME_PATTERNS: Array<{ pattern: RegExp; type: ContentType }> = [
  { pattern: /^dockerfile$/i, type: 'dockerfile' },
  { pattern: /^makefile$/i, type: 'shell' },
  { pattern: /^rakefile$/i, type: 'ruby' },
  { pattern: /^gemfile$/i, type: 'ruby' },
  { pattern: /^cargo\.toml$/i, type: 'toml' },
  { pattern: /^package\.json$/i, type: 'json' },
  { pattern: /^tsconfig\.json$/i, type: 'json' },
  { pattern: /^\.env/i, type: 'ini' },
  { pattern: /\.config$/i, type: 'ini' },
  { pattern: /\.conf$/i, type: 'ini' },
  { pattern: /\.log$/i, type: 'log' },
];

/**
 * Auto-detect content type from content, file extension, or file name
 */
export function detectContentType(
  content: string,
  options: Pick<SyntaxHighlightOptions, 'fileExtension' | 'fileName' | 'contentType'> = {}
): ContentType {
  // If explicitly provided, use it
  if (options.contentType) {
    return options.contentType;
  }

  // Try file extension detection
  if (options.fileExtension) {
    const ext = options.fileExtension.toLowerCase();
    if (EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  // Try file name pattern matching
  if (options.fileName) {
    for (const { pattern, type } of FILENAME_PATTERNS) {
      if (pattern.test(options.fileName)) {
        return type;
      }
    }
  }

  // Try content-based detection
  const trimmedContent = content.trim();

  // JSON detection
  if ((trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) ||
      (trimmedContent.startsWith('[') && trimmedContent.endsWith(']'))) {
    try {
      JSON.parse(trimmedContent);
      return 'json';
    } catch {
      // Not valid JSON, continue detection
    }
  }

  // YAML detection
  if (trimmedContent.includes(':\n') || trimmedContent.includes(': ') ||
      trimmedContent.startsWith('---') || trimmedContent.includes('\n- ')) {
    return 'yaml';
  }

  // XML/HTML detection
  if (trimmedContent.startsWith('<') && trimmedContent.includes('>')) {
    if (trimmedContent.includes('<!DOCTYPE html') || trimmedContent.includes('<html')) {
      return 'html';
    }
    return 'xml';
  }

  // Diff detection
  if (trimmedContent.includes('@@') || trimmedContent.includes('---') ||
      trimmedContent.includes('+++') || /^[+-]/.test(trimmedContent)) {
    return 'diff';
  }

  // Error detection
  if (/error|exception|traceback|panic|fatal/i.test(trimmedContent)) {
    return 'error';
  }

  // Shell command detection
  if (trimmedContent.startsWith('$') || trimmedContent.startsWith('#!') ||
      /^(cd|ls|mkdir|rm|cp|mv|grep|find|sed|awk)\s/.test(trimmedContent)) {
    return 'shell';
  }

  // Code detection based on common patterns
  if (trimmedContent.includes('function ') || trimmedContent.includes('=>')) {
    return 'javascript';
  }

  if (trimmedContent.includes('def ') || trimmedContent.includes('import ')) {
    return 'python';
  }

  if (trimmedContent.includes('package ') || trimmedContent.includes('func ')) {
    return 'go';
  }

  if (trimmedContent.includes('fn ') || trimmedContent.includes('let mut')) {
    return 'rust';
  }

  // Default to plain text
  return 'plain';
}

/**
 * Escape ANSI sequences and special characters
 */
function escapeAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Apply color to text
 */
function colorize(text: string, color: string, reset = true): string {
  return `${color}${text}${reset ? ANSI_COLORS.reset : ''}`;
}

/**
 * Highlight JSON content
 */
function highlightJson(content: string, theme: SyntaxTheme): string {
  return content
    // Highlight strings
    .replace(/"([^"\\]|\\.)*"/g, (match) => colorize(match, theme.string))
    // Highlight numbers
    .replace(/\b-?\d+\.?\d*\b/g, (match) => colorize(match, theme.number))
    // Highlight booleans
    .replace(/\b(true|false)\b/g, (match) => colorize(match, theme.boolean))
    // Highlight null
    .replace(/\bnull\b/g, (match) => colorize(match, theme.null))
    // Highlight property names (outside of strings)
    .replace(/"([^"]+)"(?=\s*:)/g, (match) => colorize(match, theme.property));
}

/**
 * Highlight YAML content
 */
function highlightYaml(content: string, theme: SyntaxTheme): string {
  return content
    // Highlight comments
    .replace(/#.*$/gm, (match) => colorize(match, theme.comment))
    // Highlight strings
    .replace(/(["'])([^"'\\]|\\.)*\1/g, (match) => colorize(match, theme.string))
    // Highlight property names
    .replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm, (match, indent, key) =>
      indent + colorize(key, theme.property) + colorize(':', theme.punctuation))
    // Highlight boolean values
    .replace(/:\s*(true|false)\s*$/gm, (match, bool) =>
      match.replace(bool, colorize(bool, theme.boolean)))
    // Highlight null values
    .replace(/:\s*(null|~)\s*$/gm, (match, nullVal) =>
      match.replace(nullVal, colorize(nullVal, theme.null)))
    // Highlight numbers
    .replace(/:\s*(-?\d+\.?\d*)\s*$/gm, (match, num) =>
      match.replace(num, colorize(num, theme.number)));
}

/**
 * Highlight code using keywords and patterns
 */
function highlightCode(content: string, contentType: ContentType, theme: SyntaxTheme): string {
  let highlighted = content;

  // Get keywords for this language
  const keywords = KEYWORDS[contentType] || [];

  // Highlight comments first (to avoid interfering with other highlighting)
  if (contentType === 'python') {
    highlighted = highlighted.replace(/#.*$/gm, (match) => colorize(match, theme.comment));
  } else if (['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php'].includes(contentType)) {
    // Line comments
    highlighted = highlighted.replace(/\/\/.*$/gm, (match) => colorize(match, theme.comment));
    // Block comments
    highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, (match) => colorize(match, theme.comment));
  } else if (contentType === 'shell' || contentType === 'bash') {
    highlighted = highlighted.replace(/#.*$/gm, (match) => colorize(match, theme.comment));
  } else if (contentType === 'sql') {
    highlighted = highlighted.replace(/--.*$/gm, (match) => colorize(match, theme.comment));
    highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, (match) => colorize(match, theme.comment));
  }

  // Highlight strings
  highlighted = highlighted.replace(/(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g, (match) =>
    colorize(match, theme.string));

  // Highlight template literals (JavaScript/TypeScript)
  if (contentType === 'javascript' || contentType === 'typescript') {
    highlighted = highlighted.replace(/(`)((?:(?!`)[^\\]|\\.)*)(`)/g, (match) =>
      colorize(match, theme.string));
  }

  // Highlight numbers
  highlighted = highlighted.replace(/\b-?\d+\.?\d*\b/g, (match) =>
    colorize(match, theme.number));

  // Highlight booleans and null
  highlighted = highlighted.replace(/\b(true|false|null|undefined|None|nil)\b/g, (match) =>
    colorize(match, theme.boolean));

  // Highlight keywords
  if (keywords.length > 0) {
    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
    highlighted = highlighted.replace(keywordRegex, (match) =>
      colorize(match, theme.keyword));
  }

  // Highlight function calls (basic pattern)
  highlighted = highlighted.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, (match, funcName) =>
    colorize(funcName, theme.function) + colorize('(', theme.punctuation));

  return highlighted;
}

/**
 * Highlight diff content
 */
function highlightDiff(content: string, theme: SyntaxTheme): string {
  return content.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return colorize(line, theme.diff_added);
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return colorize(line, theme.diff_removed);
    } else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
      return colorize(line, theme.diff_header);
    }
    return line;
  }).join('\n');
}

/**
 * Highlight error/log content
 */
function highlightError(content: string, theme: SyntaxTheme): string {
  return content.split('\n').map(line => {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('error') || lowerLine.includes('exception') ||
        lowerLine.includes('panic') || lowerLine.includes('fatal')) {
      return colorize(line, theme.error);
    } else if (lowerLine.includes('warning') || lowerLine.includes('warn')) {
      return colorize(line, theme.warning);
    } else if (lowerLine.includes('info') || lowerLine.includes('debug')) {
      return colorize(line, theme.info);
    } else if (lowerLine.includes('success') || lowerLine.includes('ok')) {
      return colorize(line, theme.success);
    }
    return line;
  }).join('\n');
}

/**
 * Add line numbers to content
 */
function addLineNumbers(content: string, theme: SyntaxTheme, startLine = 1): string {
  const lines = content.split('\n');
  const maxLineNum = startLine + lines.length - 1;
  const padding = String(maxLineNum).length;

  return lines.map((line, index) => {
    const lineNum = startLine + index;
    const paddedLineNum = String(lineNum).padStart(padding, ' ');
    return colorize(`${paddedLineNum} │ `, theme.line_number, false) + line;
  }).join('\n');
}

/**
 * Main syntax highlighting function
 */
export function highlightSyntax(content: string, options: SyntaxHighlightOptions = {}): HighlightResult {
  const {
    theme = DARK_THEME,
    showLineNumbers = false,
    maxLines,
    colors = true,
    fileExtension,
    fileName,
  } = options;

  // Detect content type
  const contentType = detectContentType(content, { fileExtension, fileName, contentType: options.contentType });

  // Handle empty content
  if (!content || content.trim() === '') {
    return {
      content: '',
      contentType,
      highlighted: false,
      lineCount: 0,
      truncated: false,
    };
  }

  let highlighted = content;
  let wasHighlighted = false;

  // Apply syntax highlighting if colors are enabled
  if (colors) {
    switch (contentType) {
      case 'json':
        highlighted = highlightJson(highlighted, theme);
        wasHighlighted = true;
        break;
      case 'yaml':
        highlighted = highlightYaml(highlighted, theme);
        wasHighlighted = true;
        break;
      case 'diff':
        highlighted = highlightDiff(highlighted, theme);
        wasHighlighted = true;
        break;
      case 'error':
      case 'log':
        highlighted = highlightError(highlighted, theme);
        wasHighlighted = true;
        break;
      case 'plain':
        // No highlighting for plain text
        break;
      default:
        // Code highlighting for programming languages
        highlighted = highlightCode(highlighted, contentType, theme);
        wasHighlighted = true;
        break;
    }
  }

  // Handle line truncation
  const lines = highlighted.split('\n');
  let finalContent = highlighted;
  let truncated = false;

  if (maxLines && lines.length > maxLines) {
    finalContent = lines.slice(0, maxLines).join('\n');
    const remainingLines = lines.length - maxLines;
    finalContent += colors
      ? `\n${colorize(`... ${remainingLines} more lines`, theme.comment)}`
      : `\n... ${remainingLines} more lines`;
    truncated = true;
  }

  // Add line numbers if requested
  if (showLineNumbers) {
    finalContent = addLineNumbers(finalContent, theme);
  }

  return {
    content: finalContent,
    contentType,
    highlighted: wasHighlighted,
    lineCount: lines.length,
    truncated,
  };
}

/**
 * Convenience function for highlighting tool output
 * Combines syntax highlighting with the existing truncation utility
 */
export function highlightToolOutput(
  output: string,
  options: SyntaxHighlightOptions & {
    /** Maximum output length before truncation (default: 10000) */
    maxLength?: number;
  } = {}
): HighlightResult & { originalLength: number } {
  const { maxLength = 10000, ...highlightOptions } = options;

  // First truncate if needed (using existing utility)
  let truncatedOutput = output;
  let wasTruncated = false;

  if (output.length > maxLength) {
    const suffix = '... [truncated]';
    truncatedOutput = output.substring(0, maxLength - suffix.length) + suffix;
    wasTruncated = true;
  }

  // Then apply syntax highlighting
  const result = highlightSyntax(truncatedOutput, highlightOptions);

  return {
    ...result,
    truncated: wasTruncated || result.truncated,
    originalLength: output.length,
  };
}

/**
 * Remove all ANSI color codes from text
 */
export function stripColors(text: string): string {
  return escapeAnsi(text);
}

/**
 * Check if terminal supports colors
 */
export function supportsColors(): boolean {
  // Check common environment variables
  if (process.env.FORCE_COLOR) return true;
  if (process.env.NO_COLOR) return false;
  if (process.env.CI && !process.env.GITHUB_ACTIONS) return false;

  // Check if stdout is a TTY
  if (process.stdout && typeof process.stdout.isTTY === 'boolean') {
    return process.stdout.isTTY;
  }

  // Default to true for Node.js environments
  return typeof process !== 'undefined';
}