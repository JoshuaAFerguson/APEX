/**
 * Unit tests for syntax highlighting utility
 */
import { describe, it, expect } from 'vitest';
import {
  highlightSyntax,
  highlightToolOutput,
  detectContentType,
  stripColors,
  supportsColors,
  DARK_THEME,
  LIGHT_THEME,
  ANSI_COLORS,
  type ContentType,
  type SyntaxHighlightOptions,
} from '../syntax-highlighter.js';

describe('Content Type Detection', () => {
  describe('detectContentType', () => {
    it('should detect JSON from content', () => {
      const jsonContent = '{"key": "value", "number": 123}';
      expect(detectContentType(jsonContent)).toBe('json');

      const arrayContent = '[1, 2, 3, "test"]';
      expect(detectContentType(arrayContent)).toBe('json');
    });

    it('should detect YAML from content', () => {
      const yamlContent = 'key: value\nlist:\n  - item1\n  - item2';
      expect(detectContentType(yamlContent)).toBe('yaml');

      const yamlWithSeparator = '---\nname: test\nversion: 1.0';
      expect(detectContentType(yamlWithSeparator)).toBe('yaml');
    });

    it('should detect XML/HTML from content', () => {
      const xmlContent = '<root><child>value</child></root>';
      expect(detectContentType(xmlContent)).toBe('xml');

      const htmlContent = '<!DOCTYPE html><html><head><title>Test</title></head></html>';
      expect(detectContentType(htmlContent)).toBe('html');
    });

    it('should detect diff content', () => {
      const diffContent = '@@ -1,3 +1,3 @@\n-old line\n+new line';
      expect(detectContentType(diffContent)).toBe('diff');

      const gitDiff = '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new';
      expect(detectContentType(gitDiff)).toBe('diff');
    });

    it('should detect error content', () => {
      const errorContent = 'Error: Something went wrong\n  at function (file.js:10:5)';
      expect(detectContentType(errorContent)).toBe('error');

      const panicContent = 'panic: runtime error: index out of range';
      expect(detectContentType(panicContent)).toBe('error');
    });

    it('should detect shell commands', () => {
      const shellContent = '$ ls -la\n$ cd /home/user';
      expect(detectContentType(shellContent)).toBe('shell');

      const shebangContent = '#!/bin/bash\necho "Hello World"';
      expect(detectContentType(shebangContent)).toBe('shell');
    });

    it('should detect code by patterns', () => {
      const jsContent = 'function test() { return true; }';
      expect(detectContentType(jsContent)).toBe('javascript');

      const pythonContent = 'def test():\n    import os\n    return True';
      expect(detectContentType(pythonContent)).toBe('python');

      const goContent = 'package main\nfunc main() { fmt.Println("hello") }';
      expect(detectContentType(goContent)).toBe('go');

      const rustContent = 'fn main() {\n    let mut x = 5;\n    println!("{}", x);\n}';
      expect(detectContentType(rustContent)).toBe('rust');
    });

    it('should use file extension for detection', () => {
      expect(detectContentType('console.log("test")', { fileExtension: '.js' })).toBe('javascript');
      expect(detectContentType('print("test")', { fileExtension: '.py' })).toBe('python');
      expect(detectContentType('fmt.Println("test")', { fileExtension: '.go' })).toBe('go');
      expect(detectContentType('println!("test")', { fileExtension: '.rs' })).toBe('rust');
      expect(detectContentType('{"test": true}', { fileExtension: '.json' })).toBe('json');
    });

    it('should use file name patterns', () => {
      expect(detectContentType('FROM ubuntu:20.04', { fileName: 'Dockerfile' })).toBe('dockerfile');
      expect(detectContentType('all:\n\tbuild', { fileName: 'Makefile' })).toBe('shell');
      expect(detectContentType('{"name": "test"}', { fileName: 'package.json' })).toBe('json');
      expect(detectContentType('[package]\nname = "test"', { fileName: 'Cargo.toml' })).toBe('toml');
    });

    it('should use explicit contentType', () => {
      expect(detectContentType('random text', { contentType: 'typescript' })).toBe('typescript');
      expect(detectContentType('{"key": "value"}', { contentType: 'yaml' })).toBe('yaml');
    });

    it('should default to plain text', () => {
      expect(detectContentType('just some random text without patterns')).toBe('plain');
      expect(detectContentType('')).toBe('plain');
    });
  });
});

describe('Syntax Highlighting', () => {
  describe('highlightSyntax', () => {
    it('should handle empty content', () => {
      const result = highlightSyntax('');
      expect(result.content).toBe('');
      expect(result.highlighted).toBe(false);
      expect(result.lineCount).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('should highlight JSON content', () => {
      const jsonContent = '{"name": "test", "value": 123, "enabled": true, "data": null}';
      const result = highlightSyntax(jsonContent, { contentType: 'json' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('json');
      expect(result.content).toContain(ANSI_COLORS.string); // For strings
      expect(result.content).toContain(ANSI_COLORS.brightMagenta); // For numbers/booleans
      expect(result.content).toContain(ANSI_COLORS.reset); // Reset codes
    });

    it('should highlight YAML content', () => {
      const yamlContent = 'name: test\nversion: 1.0\nenabled: true\ndata: null';
      const result = highlightSyntax(yamlContent, { contentType: 'yaml' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('yaml');
      expect(result.content).toContain(ANSI_COLORS.brightCyan); // For property names
    });

    it('should highlight JavaScript code', () => {
      const jsContent = 'function test() {\n  const x = "hello";\n  return true;\n}';
      const result = highlightSyntax(jsContent, { contentType: 'javascript' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('javascript');
      expect(result.content).toContain(ANSI_COLORS.brightBlue); // For keywords
      expect(result.content).toContain(ANSI_COLORS.brightGreen); // For strings
    });

    it('should highlight TypeScript code', () => {
      const tsContent = 'interface User {\n  name: string;\n  age: number;\n}\nfunction getUser(): User | null { return null; }';
      const result = highlightSyntax(tsContent, { contentType: 'typescript' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('typescript');
      expect(result.content).toContain(ANSI_COLORS.brightBlue); // For keywords
    });

    it('should highlight Python code', () => {
      const pythonContent = 'def test():\n    x = "hello"\n    return True';
      const result = highlightSyntax(pythonContent, { contentType: 'python' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('python');
      expect(result.content).toContain(ANSI_COLORS.brightBlue); // For keywords
    });

    it('should highlight diff content', () => {
      const diffContent = '--- a/file.txt\n+++ b/file.txt\n@@ -1,3 +1,3 @@\n-old line\n+new line\n unchanged';
      const result = highlightSyntax(diffContent, { contentType: 'diff' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('diff');
      expect(result.content).toContain(ANSI_COLORS.brightGreen); // For added lines
      expect(result.content).toContain(ANSI_COLORS.brightRed); // For removed lines
      expect(result.content).toContain(ANSI_COLORS.cyan); // For headers
    });

    it('should highlight error/log content', () => {
      const errorContent = 'ERROR: Something failed\nWARNING: Check this\nINFO: Process started\nSUCCESS: Operation completed';
      const result = highlightSyntax(errorContent, { contentType: 'error' });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('error');
      expect(result.content).toContain(ANSI_COLORS.brightRed); // For errors
      expect(result.content).toContain(ANSI_COLORS.brightYellow); // For warnings
      expect(result.content).toContain(ANSI_COLORS.brightBlue); // For info
      expect(result.content).toContain(ANSI_COLORS.brightGreen); // For success
    });

    it('should not highlight plain text', () => {
      const plainContent = 'This is just plain text without any special formatting';
      const result = highlightSyntax(plainContent, { contentType: 'plain' });

      expect(result.highlighted).toBe(false);
      expect(result.contentType).toBe('plain');
      expect(result.content).toBe(plainContent);
    });

    it('should disable highlighting when colors=false', () => {
      const jsContent = 'function test() { return "hello"; }';
      const result = highlightSyntax(jsContent, { contentType: 'javascript', colors: false });

      expect(result.highlighted).toBe(false);
      expect(result.content).toBe(jsContent);
      expect(result.content).not.toContain(ANSI_COLORS.brightBlue);
    });

    it('should add line numbers when showLineNumbers=true', () => {
      const content = 'line 1\nline 2\nline 3';
      const result = highlightSyntax(content, { showLineNumbers: true });

      expect(result.content).toContain('1 │');
      expect(result.content).toContain('2 │');
      expect(result.content).toContain('3 │');
    });

    it('should truncate lines when maxLines is specified', () => {
      const content = 'line 1\nline 2\nline 3\nline 4\nline 5';
      const result = highlightSyntax(content, { maxLines: 3 });

      expect(result.truncated).toBe(true);
      expect(result.lineCount).toBe(5);
      expect(result.content).toContain('line 1');
      expect(result.content).toContain('line 3');
      expect(result.content).not.toContain('line 4');
      expect(result.content).toContain('2 more lines');
    });

    it('should use custom theme', () => {
      const customTheme = { ...DARK_THEME, keyword: ANSI_COLORS.red };
      const jsContent = 'function test() {}';
      const result = highlightSyntax(jsContent, {
        contentType: 'javascript',
        theme: customTheme
      });

      expect(result.content).toContain(ANSI_COLORS.red); // Custom keyword color
    });

    it('should handle auto-detection with file extension', () => {
      const content = 'console.log("hello");';
      const result = highlightSyntax(content, { fileExtension: '.js' });

      expect(result.contentType).toBe('javascript');
      expect(result.highlighted).toBe(true);
    });
  });

  describe('highlightToolOutput', () => {
    it('should combine truncation and highlighting', () => {
      const longContent = 'x'.repeat(15000); // Longer than default maxLength
      const result = highlightToolOutput(longContent);

      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(15000);
      expect(result.content.length).toBeLessThan(15000);
    });

    it('should preserve content under maxLength', () => {
      const shortContent = 'function test() { return true; }';
      const result = highlightToolOutput(shortContent, {
        fileExtension: '.js',
        maxLength: 1000
      });

      expect(result.truncated).toBe(false);
      expect(result.originalLength).toBe(shortContent.length);
      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe('javascript');
    });

    it('should use custom maxLength', () => {
      const content = 'x'.repeat(200);
      const result = highlightToolOutput(content, { maxLength: 100 });

      expect(result.truncated).toBe(true);
      expect(result.content.length).toBeLessThanOrEqual(100);
    });
  });
});

describe('Language-Specific Highlighting', () => {
  const languages: Array<{ type: ContentType; content: string; expectedKeywords: string[] }> = [
    {
      type: 'go',
      content: 'package main\nfunc main() {\n    var x int = 42\n    if x > 0 {\n        fmt.Println("positive")\n    }\n}',
      expectedKeywords: ['package', 'func', 'var', 'if'],
    },
    {
      type: 'rust',
      content: 'fn main() {\n    let mut x = 5;\n    match x {\n        0 => println!("zero"),\n        _ => println!("other"),\n    }\n}',
      expectedKeywords: ['fn', 'let', 'mut', 'match'],
    },
    {
      type: 'java',
      content: 'public class Test {\n    public static void main(String[] args) {\n        int x = 42;\n        if (x > 0) {\n            System.out.println("positive");\n        }\n    }\n}',
      expectedKeywords: ['public', 'class', 'static', 'void', 'if'],
    },
    {
      type: 'python',
      content: 'def test():\n    x = 42\n    if x > 0:\n        print("positive")\n    return True',
      expectedKeywords: ['def', 'if', 'return', 'True'],
    },
    {
      type: 'csharp',
      content: 'public class Test {\n    public static void Main() {\n        int x = 42;\n        if (x > 0) {\n            Console.WriteLine("positive");\n        }\n    }\n}',
      expectedKeywords: ['public', 'class', 'static', 'void', 'if'],
    },
    {
      type: 'php',
      content: '<?php\nfunction test() {\n    $x = 42;\n    if ($x > 0) {\n        echo "positive";\n    }\n    return true;\n}',
      expectedKeywords: ['function', 'if', 'return', 'echo'],
    },
    {
      type: 'ruby',
      content: 'def test\n  x = 42\n  if x > 0\n    puts "positive"\n  end\n  true\nend',
      expectedKeywords: ['def', 'if', 'end', 'true'],
    },
    {
      type: 'sql',
      content: 'SELECT name, age FROM users WHERE age > 18 ORDER BY name;',
      expectedKeywords: ['SELECT', 'FROM', 'WHERE', 'ORDER'],
    },
    {
      type: 'shell',
      content: 'if [ "$1" = "test" ]; then\n    echo "Test mode"\nelse\n    echo "Normal mode"\nfi',
      expectedKeywords: ['if', 'then', 'else', 'fi'],
    },
  ];

  languages.forEach(({ type, content, expectedKeywords }) => {
    it(`should highlight ${type} code correctly`, () => {
      const result = highlightSyntax(content, { contentType: type });

      expect(result.highlighted).toBe(true);
      expect(result.contentType).toBe(type);

      // Check that keywords are highlighted
      expectedKeywords.forEach(keyword => {
        expect(result.content).toContain(keyword);
        // Should contain the keyword wrapped in ANSI codes
        expect(result.content).toContain(ANSI_COLORS.brightBlue);
      });

      // Should contain reset codes
      expect(result.content).toContain(ANSI_COLORS.reset);
    });
  });
});

describe('Edge Cases and Error Handling', () => {
  it('should handle malformed JSON gracefully', () => {
    const malformedJson = '{"key": value, "missing": quote}';
    const result = highlightSyntax(malformedJson);

    // Should detect as plain text since JSON parsing fails
    expect(result.contentType).toBe('plain');
  });

  it('should handle very long lines', () => {
    const longLine = 'x'.repeat(10000);
    const result = highlightSyntax(longLine, { contentType: 'javascript' });

    expect(result.highlighted).toBe(true);
    expect(result.content).toContain(longLine);
  });

  it('should handle special characters and unicode', () => {
    const unicodeContent = 'const emoji = "🚀 💻 ⭐";\nconst chinese = "你好世界";';
    const result = highlightSyntax(unicodeContent, { contentType: 'javascript' });

    expect(result.highlighted).toBe(true);
    expect(result.content).toContain('🚀');
    expect(result.content).toContain('你好世界');
  });

  it('should handle mixed content types', () => {
    const mixedContent = `
    # This is a comment
    function test() {
      const data = {
        "key": "value"
      };
      return data;
    }
    `;
    const result = highlightSyntax(mixedContent, { contentType: 'javascript' });

    expect(result.highlighted).toBe(true);
    expect(result.contentType).toBe('javascript');
  });

  it('should handle content with existing ANSI codes', () => {
    const contentWithAnsi = `${ANSI_COLORS.red}Error${ANSI_COLORS.reset}: Something failed`;
    const result = highlightSyntax(contentWithAnsi, { contentType: 'error' });

    expect(result.highlighted).toBe(true);
    expect(result.content).toContain(ANSI_COLORS.brightRed);
  });
});

describe('Utility Functions', () => {
  describe('stripColors', () => {
    it('should remove ANSI color codes', () => {
      const coloredText = `${ANSI_COLORS.red}Error${ANSI_COLORS.reset}: ${ANSI_COLORS.blue}Message${ANSI_COLORS.reset}`;
      const stripped = stripColors(coloredText);

      expect(stripped).toBe('Error: Message');
      expect(stripped).not.toContain('\x1b[');
    });

    it('should handle text without ANSI codes', () => {
      const plainText = 'Just plain text';
      const stripped = stripColors(plainText);

      expect(stripped).toBe(plainText);
    });
  });

  describe('supportsColors', () => {
    it('should return a boolean', () => {
      const result = supportsColors();
      expect(typeof result).toBe('boolean');
    });

    // Note: Actual behavior depends on environment, so we just test type
  });
});

describe('Theme Support', () => {
  it('should use DARK_THEME by default', () => {
    const content = 'function test() {}';
    const result = highlightSyntax(content, { contentType: 'javascript' });

    expect(result.content).toContain(DARK_THEME.keyword);
  });

  it('should support LIGHT_THEME', () => {
    const content = 'function test() {}';
    const result = highlightSyntax(content, {
      contentType: 'javascript',
      theme: LIGHT_THEME
    });

    expect(result.content).toContain(LIGHT_THEME.keyword);
    expect(result.content).not.toContain(DARK_THEME.keyword);
  });

  it('should support custom themes', () => {
    const customTheme = {
      ...DARK_THEME,
      keyword: ANSI_COLORS.magenta,
      string: ANSI_COLORS.cyan,
    };

    const content = 'const message = "hello";';
    const result = highlightSyntax(content, {
      contentType: 'javascript',
      theme: customTheme
    });

    expect(result.content).toContain(ANSI_COLORS.magenta); // custom keyword
    expect(result.content).toContain(ANSI_COLORS.cyan); // custom string
  });
});

describe('Performance and Large Content', () => {
  it('should handle large files efficiently', () => {
    const largeContent = Array(1000).fill('function test() { return "line"; }').join('\n');
    const startTime = Date.now();

    const result = highlightSyntax(largeContent, {
      contentType: 'javascript',
      maxLines: 100
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result.highlighted).toBe(true);
    expect(result.truncated).toBe(true);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle deeply nested JSON', () => {
    const nestedJson = JSON.stringify({
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: "deep nesting",
                numbers: [1, 2, 3, 4, 5],
                boolean: true,
                nullValue: null
              }
            }
          }
        }
      }
    }, null, 2);

    const result = highlightSyntax(nestedJson, { contentType: 'json' });

    expect(result.highlighted).toBe(true);
    expect(result.content).toContain(ANSI_COLORS.brightGreen); // strings
    expect(result.content).toContain(ANSI_COLORS.brightMagenta); // numbers/booleans
    expect(result.content).toContain(ANSI_COLORS.brightCyan); // properties
  });
});