/**
 * Syntax Highlighter Utility
 *
 * Simple token-based syntax highlighting using regex patterns.
 * Designed for MVP with future extensibility for Prism.js integration.
 */

import type { SupportedLanguage } from '../types'

/**
 * Token pattern definition for syntax highlighting
 */
interface TokenPattern {
  pattern: RegExp
  className: string
  languages?: SupportedLanguage[]
}

/**
 * Token patterns for common language constructs
 * Ordered by priority (more specific patterns first)
 */
const TOKEN_PATTERNS: TokenPattern[] = [
  // Strings (double and single quoted, template literals)
  {
    pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g,
    className: 'diff-string'
  },

  // Comments (single line)
  {
    pattern: /\/\/.*$|#.*$/gm,
    className: 'diff-comment'
  },

  // Block comments (/* */ style)
  {
    pattern: /\/\*[\s\S]*?\*\//g,
    className: 'diff-comment',
    languages: ['javascript', 'typescript', 'jsx', 'tsx', 'css', 'java']
  },

  // Numbers (integers, floats, hex, binary)
  {
    pattern: /\b(?:0x[a-fA-F0-9]+|0b[01]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g,
    className: 'diff-number'
  },

  // JavaScript/TypeScript keywords
  {
    pattern: /\b(const|let|var|function|return|if|else|for|while|class|interface|type|import|export|from|async|await|new|this|true|false|null|undefined|try|catch|throw|finally|switch|case|default|break|continue|extends|implements|static|private|public|protected|readonly)\b/g,
    className: 'diff-keyword',
    languages: ['javascript', 'typescript', 'jsx', 'tsx']
  },

  // Python keywords
  {
    pattern: /\b(def|class|import|from|return|if|elif|else|for|while|try|except|raise|with|as|True|False|None|and|or|not|in|is|lambda|yield|async|await|global|nonlocal|assert|del|pass|break|continue)\b/g,
    className: 'diff-keyword',
    languages: ['python']
  },

  // Go keywords
  {
    pattern: /\b(func|package|import|return|if|else|for|range|switch|case|type|struct|interface|var|const|go|defer|chan|select|make|new|true|false|nil|break|continue|fallthrough|goto)\b/g,
    className: 'diff-keyword',
    languages: ['go']
  },

  // Rust keywords
  {
    pattern: /\b(fn|let|mut|const|pub|mod|use|struct|enum|impl|trait|match|if|else|for|while|loop|return|async|await|move|self|Self|true|false|None|Some|Ok|Err|break|continue|where|unsafe|extern)\b/g,
    className: 'diff-keyword',
    languages: ['rust']
  },

  // Java keywords
  {
    pattern: /\b(class|interface|extends|implements|public|private|protected|static|final|abstract|void|int|long|double|float|boolean|char|byte|short|String|return|if|else|for|while|do|switch|case|default|try|catch|finally|throw|throws|new|this|super|true|false|null|break|continue)\b/g,
    className: 'diff-keyword',
    languages: ['java']
  },

  // CSS properties and values
  {
    pattern: /\b(?:color|background|margin|padding|border|width|height|display|position|top|left|right|bottom|font|text|line|white|z-index|opacity|transform|transition|animation|flex|grid|cursor|pointer|none|block|inline|absolute|relative|fixed|center|left|right|bold|normal|italic|underline|transparent|inherit|auto|hover|focus|active|before|after)(?=\s*:|\b)/g,
    className: 'diff-property',
    languages: ['css']
  },

  // HTML tags
  {
    pattern: /<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s+[^>]*)?>|&[a-zA-Z0-9]+;/g,
    className: 'diff-tag',
    languages: ['html']
  },

  // JSON keys
  {
    pattern: /"([^"]+)"(?=\s*:)/g,
    className: 'diff-property',
    languages: ['json']
  },

  // Function calls and method names
  {
    pattern: /\b([a-zA-Z_]\w*)\s*(?=\()/g,
    className: 'diff-function'
  },

  // Types and classes (capitalized identifiers)
  {
    pattern: /\b[A-Z][a-zA-Z0-9_]*\b/g,
    className: 'diff-type'
  },

  // Constants (ALL_CAPS with underscores)
  {
    pattern: /\b[A-Z][A-Z0-9_]*\b/g,
    className: 'diff-constant'
  },
]

/**
 * Apply syntax highlighting to a line of code
 *
 * @param content - Raw line content to highlight
 * @param language - Programming language for context-aware highlighting
 * @returns HTML string with syntax highlighting spans
 */
export function highlightLine(content: string, language: SupportedLanguage): string {
  if (!content.trim() || language === 'text' || language === 'unknown') {
    return escapeHtml(content)
  }

  // Create token map for non-overlapping highlights
  const tokens: Array<{ start: number; end: number; className: string }> = []

  for (const { pattern, className, languages } of TOKEN_PATTERNS) {
    // Skip if pattern doesn't apply to this language
    if (languages && !languages.includes(language)) continue

    // Reset pattern state to avoid lastIndex issues
    pattern.lastIndex = 0

    let match
    while ((match = pattern.exec(content)) !== null) {
      const start = match.index
      const end = start + match[0].length

      // Check for overlap with existing tokens
      const hasOverlap = tokens.some(
        t => (start >= t.start && start < t.end) || (end > t.start && end <= t.end)
      )

      if (!hasOverlap) {
        tokens.push({ start, end, className })
      }

      // Prevent infinite loop on zero-length matches
      if (match[0].length === 0) {
        pattern.lastIndex++
      }
    }
  }

  // Sort tokens by start position
  tokens.sort((a, b) => a.start - b.start)

  // Build highlighted string
  let result = ''
  let lastEnd = 0

  for (const token of tokens) {
    // Add unhighlighted content before this token
    if (token.start > lastEnd) {
      result += escapeHtml(content.slice(lastEnd, token.start))
    }

    // Add highlighted token
    result += `<span class="${token.className}">${escapeHtml(content.slice(token.start, token.end))}</span>`
    lastEnd = token.end
  }

  // Add remaining content
  if (lastEnd < content.length) {
    result += escapeHtml(content.slice(lastEnd))
  }

  return result
}

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param text - Text to escape
 * @returns HTML-safe text
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Check if content appears to contain code
 *
 * @param content - Content to analyze
 * @returns True if content looks like code
 */
export function looksLikeCode(content: string): boolean {
  if (!content.trim()) return false

  // Simple heuristics for code detection
  const codeIndicators = [
    /[{}()[\];]/,              // Common code punctuation
    /\b(?:function|class|if|for|while|return|import|const|let|var)\b/i, // Keywords
    /^\s*(?:\/\/|#|\/\*).*$/m, // Comments
    /=>/,                      // Arrow functions
    /\w+\s*\([^)]*\)/,        // Function calls
  ]

  return codeIndicators.some(pattern => pattern.test(content))
}

/**
 * Get appropriate CSS class prefix for highlighting theme
 *
 * @param theme - Theme preference
 * @returns CSS class prefix
 */
export function getThemePrefix(theme: 'dark' | 'light' | 'auto' = 'auto'): string {
  if (theme === 'auto') {
    // Use CSS media query or system preference
    return ''
  }
  return theme === 'light' ? 'light-' : ''
}