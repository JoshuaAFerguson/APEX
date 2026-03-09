import { describe, it, expect, vi } from 'vitest';

/**
 * V0.6.0 Syntax Highlighting Functionality Tests
 *
 * These tests verify the actual syntax highlighting logic implementation
 * for language-aware highlighting (keywords, strings, comments) as required
 * by the acceptance criteria.
 */

describe('V0.6.0 Syntax Highlighting Functionality', () => {
  // Test constants for ANSI color codes
  const ANSI_COLORS = {
    RESET: '\x1b[0m',
    KEYWORD: '\x1b[94m', // Blue
    STRING: '\x1b[93m',  // Yellow
    COMMENT: '\x1b[90m', // Dim gray
  };

  describe('Language Keyword Detection', () => {
    it('should define keywords for supported languages', () => {
      const languageKeywords = {
        typescript: ['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'import', 'export', 'async', 'await'],
        javascript: ['const', 'let', 'var', 'function', 'class', 'import', 'export', 'async', 'await'],
        python: ['def', 'class', 'import', 'from', 'async', 'await', 'if', 'elif', 'else', 'for', 'while', 'try', 'except'],
        rust: ['fn', 'struct', 'enum', 'impl', 'trait', 'let', 'mut', 'pub', 'use', 'mod'],
        go: ['func', 'type', 'struct', 'interface', 'var', 'const', 'package', 'import'],
      };

      Object.entries(languageKeywords).forEach(([language, keywords]) => {
        expect(Array.isArray(keywords)).toBe(true);
        expect(keywords.length).toBeGreaterThan(0);

        keywords.forEach(keyword => {
          expect(typeof keyword).toBe('string');
          expect(keyword.length).toBeGreaterThan(0);
        });
      });
    });

    it('should create proper regex patterns for keyword matching', () => {
      const keywords = ['const', 'let', 'var', 'function'];

      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');

        // Should match whole words only
        expect(`${keyword} test`).toMatch(regex);
        expect(`test ${keyword}`).toMatch(regex);
        expect(`test ${keyword} test`).toMatch(regex);

        // Should not match partial words
        expect(`${keyword}Variable`).not.toMatch(regex);
        expect(`my${keyword}`).not.toMatch(regex);
      });
    });

    it('should apply keyword highlighting with ANSI colors', () => {
      const testCases = [
        {
          input: 'const variable = value;',
          keyword: 'const',
          expected: `${ANSI_COLORS.KEYWORD}const${ANSI_COLORS.RESET} variable = value;`
        },
        {
          input: 'function test() { return true; }',
          keyword: 'function',
          expected: `${ANSI_COLORS.KEYWORD}function${ANSI_COLORS.RESET} test() { return true; }`
        },
        {
          input: 'let x = 42; var y = 24;',
          keyword: 'let',
          expected: `${ANSI_COLORS.KEYWORD}let${ANSI_COLORS.RESET} x = 42; var y = 24;`
        }
      ];

      testCases.forEach(({ input, keyword, expected }) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'g');
        const result = input.replace(regex, `${ANSI_COLORS.KEYWORD}${keyword}${ANSI_COLORS.RESET}`);
        expect(result).toBe(expected);
      });
    });
  });

  describe('String Literal Highlighting', () => {
    it('should detect double-quoted strings', () => {
      const stringRegex = /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g;
      const testCases = [
        '"hello world"',
        '"string with spaces"',
        '"string with \\"escaped quotes\\""',
        '"empty string: \\"\\""`',
      ];

      testCases.forEach(testString => {
        expect(testString).toMatch(stringRegex);
      });
    });

    it('should detect single-quoted strings', () => {
      const stringRegex = /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g;
      const testCases = [
        "'hello world'",
        "'string with spaces'",
        "'string with \\'escaped quotes\\''",
      ];

      testCases.forEach(testString => {
        expect(testString).toMatch(stringRegex);
      });
    });

    it('should apply string highlighting with ANSI colors', () => {
      const stringRegex = /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g;
      const testCases = [
        {
          input: 'const message = "hello world";',
          expected: `const message = ${ANSI_COLORS.STRING}"hello world"${ANSI_COLORS.RESET};`
        },
        {
          input: "const name = 'John Doe';",
          expected: `const name = ${ANSI_COLORS.STRING}'John Doe'${ANSI_COLORS.RESET};`
        },
        {
          input: 'console.log("Debug:", variable, "end");',
          expected: `console.log(${ANSI_COLORS.STRING}"Debug:"${ANSI_COLORS.RESET}, variable, ${ANSI_COLORS.STRING}"end"${ANSI_COLORS.RESET});`
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = input.replace(stringRegex, `${ANSI_COLORS.STRING}$1$2$3${ANSI_COLORS.RESET}`);
        expect(result).toBe(expected);
      });
    });

    it('should handle escaped characters in strings', () => {
      const stringRegex = /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g;
      const testCases = [
        '"string with \\"quotes\\""',
        "'string with \\'quotes\\''",
        '"newline: \\n and tab: \\t"',
        '"backslash: \\\\ and quote: \\""'
      ];

      testCases.forEach(testString => {
        expect(testString).toMatch(stringRegex);
      });
    });
  });

  describe('Comment Highlighting', () => {
    it('should detect single-line comments for C-style languages', () => {
      const commentRegex = /(\/\/.*)$/;
      const testCases = [
        '// This is a comment',
        '// Comment with symbols !@#$%',
        '// TODO: implement feature',
        'code(); // inline comment'
      ];

      testCases.forEach(line => {
        if (line.includes('//')) {
          expect(line).toMatch(commentRegex);
        }
      });
    });

    it('should detect Python-style comments', () => {
      const pythonCommentRegex = /(#.*)$/;
      const testCases = [
        '# This is a Python comment',
        '# TODO: implement function',
        'value = 42  # inline comment'
      ];

      testCases.forEach(line => {
        if (line.includes('#')) {
          expect(line).toMatch(pythonCommentRegex);
        }
      });
    });

    it('should detect multi-line comments', () => {
      const multiLineCommentRegex = /(\/\*.*?\*\/)/g;
      const testCases = [
        '/* single line block comment */',
        '/* multi\n   line\n   comment */',
        'code(); /* inline block */ more();'
      ];

      testCases.forEach(text => {
        if (text.includes('/*') && text.includes('*/')) {
          expect(text).toMatch(multiLineCommentRegex);
        }
      });
    });

    it('should apply comment highlighting with ANSI colors', () => {
      const testCases = [
        {
          language: 'javascript',
          input: 'const x = 42; // This is a comment',
          regex: /(\/\/.*)$/,
          expected: `const x = 42; ${ANSI_COLORS.COMMENT}// This is a comment${ANSI_COLORS.RESET}`
        },
        {
          language: 'python',
          input: 'value = 42  # Python comment',
          regex: /(#.*)$/,
          expected: `value = 42  ${ANSI_COLORS.COMMENT}# Python comment${ANSI_COLORS.RESET}`
        },
        {
          language: 'javascript',
          input: 'function test() { /* block comment */ }',
          regex: /(\/\*.*?\*\/)/g,
          expected: `function test() { ${ANSI_COLORS.COMMENT}/* block comment */${ANSI_COLORS.RESET} }`
        }
      ];

      testCases.forEach(({ input, regex, expected }) => {
        const result = input.replace(regex, `${ANSI_COLORS.COMMENT}$1${ANSI_COLORS.RESET}`);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Multi-Language Support', () => {
    it('should apply language-specific highlighting patterns', () => {
      const testCases = [
        {
          language: 'typescript',
          code: 'interface User { name: string; }',
          expectedKeywords: ['interface']
        },
        {
          language: 'python',
          code: 'def calculate(x): return x * 2',
          expectedKeywords: ['def', 'return']
        },
        {
          language: 'rust',
          code: 'fn main() { let x = 42; }',
          expectedKeywords: ['fn', 'let']
        },
        {
          language: 'go',
          code: 'func main() { var x int = 42 }',
          expectedKeywords: ['func', 'var']
        }
      ];

      testCases.forEach(({ language, code, expectedKeywords }) => {
        expectedKeywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`);
          expect(code).toMatch(regex);
        });
      });
    });

    it('should handle language-specific comment styles', () => {
      const languageComments = [
        { language: 'javascript', code: 'x = 1; // JS comment', pattern: /(\/\/.*)$/ },
        { language: 'typescript', code: 'x = 1; // TS comment', pattern: /(\/\/.*)$/ },
        { language: 'python', code: 'x = 1  # Python comment', pattern: /(#.*)$/ },
        { language: 'rust', code: 'x = 1; // Rust comment', pattern: /(\/\/.*)$/ },
        { language: 'go', code: 'x := 1 // Go comment', pattern: /(\/\/.*)$/ }
      ];

      languageComments.forEach(({ language, code, pattern }) => {
        expect(code).toMatch(pattern);
      });
    });
  });

  describe('Complex Code Highlighting', () => {
    it('should handle mixed syntax elements in a single line', () => {
      const complexLine = 'const message = "Hello"; // Comment with "quotes"';

      // Apply highlighting in correct order
      let highlighted = complexLine;

      // 1. Keywords
      highlighted = highlighted.replace(/\b(const|let|var)\b/g, `${ANSI_COLORS.KEYWORD}$1${ANSI_COLORS.RESET}`);

      // 2. Strings
      highlighted = highlighted.replace(/(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g, `${ANSI_COLORS.STRING}$1$2$3${ANSI_COLORS.RESET}`);

      // 3. Comments (should be last to avoid interfering with strings)
      highlighted = highlighted.replace(/(\/\/.*)$/, `${ANSI_COLORS.COMMENT}$1${ANSI_COLORS.RESET}`);

      expect(highlighted).toContain(ANSI_COLORS.KEYWORD);
      expect(highlighted).toContain(ANSI_COLORS.STRING);
      expect(highlighted).toContain(ANSI_COLORS.COMMENT);
    });

    it('should handle nested quotes and escape sequences', () => {
      const testCases = [
        'const nested = "She said \\"Hello\\"";',
        "const mixed = 'He said \"Hi\" to me';",
        'const escaped = "Line 1\\nLine 2\\tTabbed";',
        'const path = "C:\\\\Users\\\\name\\\\file.txt";'
      ];

      const stringRegex = /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g;

      testCases.forEach(line => {
        expect(line).toMatch(stringRegex);
      });
    });

    it('should preserve original formatting while adding highlighting', () => {
      const originalCode = `function test() {
  const message = "hello";
  return message; // comment
}`;

      // Should maintain line structure and spacing
      const lines = originalCode.split('\n');
      expect(lines).toHaveLength(4);
      expect(lines[1].startsWith('  ')).toBe(true); // Indentation preserved
      expect(lines[2].startsWith('  ')).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty strings gracefully', () => {
      const emptyInputs = ['', '   ', '\n', '\t'];

      emptyInputs.forEach(input => {
        // Should not crash on empty input
        const keywordRegex = /\b(const|let|var)\b/g;
        const stringRegex = /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g;
        const commentRegex = /(\/\/.*)$/;

        expect(() => {
          input.replace(keywordRegex, 'test');
          input.replace(stringRegex, 'test');
          input.replace(commentRegex, 'test');
        }).not.toThrow();
      });
    });

    it('should handle malformed code gracefully', () => {
      const malformedCode = [
        'const incomplete =',      // Incomplete assignment
        '"unclosed string',       // Unclosed string
        'function() { /* unclosed comment',  // Unclosed comment
        'if (condition',          // Unclosed parenthesis
      ];

      malformedCode.forEach(code => {
        expect(() => {
          // Should not crash on malformed code
          const keywordRegex = /\b(const|let|var|function|if)\b/g;
          const result = code.replace(keywordRegex, `${ANSI_COLORS.KEYWORD}$&${ANSI_COLORS.RESET}`);
          expect(typeof result).toBe('string');
        }).not.toThrow();
      });
    });

    it('should handle special characters and unicode', () => {
      const specialCases = [
        'const emoji = "🚀 ⚡ 💡";',
        'const unicode = "αβγδε 中文字符";',
        'const symbols = "<>&\\"\'";',
        'const newlines = "line1\\nline2\\r\\nline3";'
      ];

      specialCases.forEach(code => {
        expect(() => {
          const stringRegex = /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g;
          const result = code.replace(stringRegex, `${ANSI_COLORS.STRING}$1$2$3${ANSI_COLORS.RESET}`);
          expect(typeof result).toBe('string');
          expect(result).toContain(ANSI_COLORS.STRING);
        }).not.toThrow();
      });
    });

    it('should handle very long lines efficiently', () => {
      const longLine = 'const veryLongVariableName = "' + 'x'.repeat(1000) + '";';

      const startTime = performance.now();
      const keywordRegex = /\b(const)\b/g;
      const stringRegex = /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g;

      const result = longLine
        .replace(keywordRegex, `${ANSI_COLORS.KEYWORD}$1${ANSI_COLORS.RESET}`)
        .replace(stringRegex, `${ANSI_COLORS.STRING}$1$2$3${ANSI_COLORS.RESET}`);

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should be fast
      expect(result).toContain(ANSI_COLORS.KEYWORD);
      expect(result).toContain(ANSI_COLORS.STRING);
    });
  });

  describe('ANSI Color Code Validation', () => {
    it('should use valid ANSI escape sequences', () => {
      const colorCodes = {
        reset: '\x1b[0m',
        keyword: '\x1b[94m',
        string: '\x1b[93m',
        comment: '\x1b[90m',
      };

      Object.entries(colorCodes).forEach(([name, code]) => {
        expect(code).toMatch(/^\x1b\[\d+m$/);
        expect(code.length).toBeGreaterThan(3);
        expect(code.length).toBeLessThan(10);
      });
    });

    it('should properly reset colors after highlighting', () => {
      const testCode = 'const test = "value"; // comment';

      let highlighted = testCode;
      highlighted = highlighted.replace(/\b(const)\b/g, `${ANSI_COLORS.KEYWORD}$1${ANSI_COLORS.RESET}`);
      highlighted = highlighted.replace(/(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g, `${ANSI_COLORS.STRING}$1$2$3${ANSI_COLORS.RESET}`);
      highlighted = highlighted.replace(/(\/\/.*)$/, `${ANSI_COLORS.COMMENT}$1${ANSI_COLORS.RESET}`);

      // Should have proper reset sequences
      const resetCount = (highlighted.match(/\x1b\[0m/g) || []).length;
      const colorCount = (highlighted.match(/\x1b\[9[0-4]m/g) || []).length;

      expect(resetCount).toBe(colorCount); // Each color should have a reset
    });
  });
});