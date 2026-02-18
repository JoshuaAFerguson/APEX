/**
 * Tests to verify syntax highlighting examples from README documentation work correctly
 */
import { describe, it, expect } from 'vitest';
import {
  highlightSyntax,
  highlightToolOutput,
  detectContentType,
  stripColors,
  supportsColors,
  ANSI_COLORS,
  DARK_THEME,
  LIGHT_THEME,
  type ContentType,
} from '../syntax-highlighter.js';

describe('README Syntax Highlighting Examples', () => {
  describe('highlightSyntax examples', () => {
    it('should auto-detect and highlight JavaScript code as shown in README', () => {
      const result = highlightSyntax('const message = "Hello World";');

      expect(result.contentType).toBe('javascript');
      expect(result.highlighted).toBe(true);
      expect(result.content).toContain(ANSI_COLORS.brightBlue); // keyword highlighting
      expect(result.content).toContain(ANSI_COLORS.brightGreen); // string highlighting
      expect(result.content).toContain('const');
      expect(result.content).toContain('"Hello World"');
    });

    it('should handle TypeScript with explicit content type and line numbers as in README', () => {
      const tsResult = highlightSyntax('interface User { name: string; }', {
        contentType: 'typescript',
        showLineNumbers: true
      });

      expect(tsResult.contentType).toBe('typescript');
      expect(tsResult.highlighted).toBe(true);
      expect(tsResult.content).toContain('1 │'); // line numbers
      expect(tsResult.content).toContain(ANSI_COLORS.brightBlue); // keyword highlighting
      expect(tsResult.content).toContain('interface');
    });

    it('should highlight Python with file extension detection as in README', () => {
      const pyResult = highlightSyntax('def hello():\n    print("Hello")', {
        fileExtension: '.py',
        maxLines: 10
      });

      expect(pyResult.contentType).toBe('python');
      expect(pyResult.highlighted).toBe(true);
      expect(pyResult.content).toContain(ANSI_COLORS.brightBlue); // keyword highlighting
      expect(pyResult.lineCount).toBe(2);
      expect(pyResult.truncated).toBe(false);
    });

    it('should use light theme as shown in README', () => {
      const jsonData = '{"name": "test", "value": 42}';
      const lightResult = highlightSyntax(jsonData, {
        contentType: 'json',
        theme: LIGHT_THEME,
        colors: true
      });

      expect(lightResult.highlighted).toBe(true);
      expect(lightResult.contentType).toBe('json');
      expect(lightResult.content).toContain(LIGHT_THEME.string); // Light theme string color
      expect(lightResult.content).toContain(LIGHT_THEME.number); // Light theme number color
    });
  });

  describe('highlightToolOutput examples', () => {
    it('should highlight and truncate long JSON output as in README', () => {
      const longJsonOutput = JSON.stringify({
        data: Array(1000).fill({ id: 1, name: 'test', value: 42 }),
        metadata: { count: 1000 }
      }, null, 2);

      const result = highlightToolOutput(longJsonOutput, {
        contentType: 'json',
        maxLength: 5000,
        showLineNumbers: true
      });

      expect(result.contentType).toBe('json');
      expect(result.highlighted).toBe(true);
      expect(result.originalLength).toBe(longJsonOutput.length);
      expect(result.content.length).toBeLessThanOrEqual(5000);
      expect(result.content).toContain('│'); // line numbers
      expect(result.truncated).toBe(result.originalLength > 5000);
    });

    it('should auto-detect from file context as in README', () => {
      const compilerOutput = 'interface User {\n  name: string;\n  age: number;\n}';
      const tsOutput = highlightToolOutput(compilerOutput, {
        fileName: 'src/index.ts',
        maxLines: 50,
        colors: true
      });

      expect(tsOutput.contentType).toBe('typescript');
      expect(tsOutput.highlighted).toBe(true);
      expect(tsOutput.lineCount).toBe(4);
      expect(tsOutput.truncated).toBe(false);
      expect(tsOutput.content).toContain(ANSI_COLORS.brightBlue); // TypeScript keywords
    });
  });

  describe('detectContentType examples', () => {
    it('should detect content types from content as shown in README', () => {
      expect(detectContentType('{ "name": "value" }')).toBe('json');
      expect(detectContentType('function test() { return true; }')).toBe('javascript');
      expect(detectContentType('def main():\n    pass')).toBe('python');
      expect(detectContentType('error: file not found')).toBe('error');
    });

    it('should detect from file extension as in README', () => {
      expect(detectContentType('', { fileExtension: '.rs' })).toBe('rust');
      expect(detectContentType('', { fileName: 'Dockerfile' })).toBe('dockerfile');
    });

    it('should override with explicit type as in README', () => {
      expect(detectContentType('some text', { contentType: 'yaml' })).toBe('yaml');
    });
  });

  describe('Additional utility functions from README', () => {
    it('should strip colors as shown in README', () => {
      const coloredText = '\x1b[32mGreen text\x1b[0m';
      const plain = stripColors(coloredText);

      expect(plain).toBe('Green text');
      expect(plain).not.toContain('\x1b[');
    });

    it('should check color support', () => {
      const hasColors = supportsColors();
      expect(typeof hasColors).toBe('boolean');
    });

    it('should provide ANSI color constants as shown in README', () => {
      const coloredText = `${ANSI_COLORS.brightGreen}Success!${ANSI_COLORS.reset}`;

      expect(coloredText).toContain('\x1b[92m'); // bright green
      expect(coloredText).toContain('\x1b[0m');  // reset
      expect(coloredText).toContain('Success!');
    });

    it('should use predefined themes as shown in README', () => {
      const code = 'const test = "example";';

      const darkThemed = highlightSyntax(code, { theme: DARK_THEME });
      const lightThemed = highlightSyntax(code, { theme: LIGHT_THEME });

      expect(darkThemed.highlighted).toBe(true);
      expect(lightThemed.highlighted).toBe(true);

      // Verify different theme colors are used
      expect(darkThemed.content).toContain(DARK_THEME.keyword);
      expect(lightThemed.content).toContain(LIGHT_THEME.keyword);
      expect(darkThemed.content).not.toEqual(lightThemed.content);
    });
  });

  describe('Comprehensive content type support', () => {
    it('should support all content types mentioned in README', () => {
      const supportedTypes: ContentType[] = [
        'javascript', 'typescript', 'python', 'go', 'rust', 'java', 'c', 'cpp',
        'csharp', 'php', 'ruby', 'shell', 'bash', 'powershell', 'sql', 'json',
        'yaml', 'xml', 'html', 'css', 'scss', 'diff', 'markdown', 'dockerfile',
        'ini', 'toml', 'log', 'error', 'plain'
      ];

      supportedTypes.forEach(type => {
        const result = highlightSyntax('test content', { contentType: type });
        expect(result.contentType).toBe(type);

        // Plain text shouldn't be highlighted, others should be (except when they don't have highlighting rules)
        if (type === 'plain') {
          expect(result.highlighted).toBe(false);
        } else if (['json', 'yaml', 'diff', 'error', 'log'].includes(type) ||
                   ['javascript', 'typescript', 'python', 'go', 'rust', 'java'].includes(type)) {
          expect(result.highlighted).toBe(true);
        }
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty content gracefully', () => {
      const result = highlightSyntax('');
      expect(result.content).toBe('');
      expect(result.highlighted).toBe(false);
      expect(result.lineCount).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('should handle very large content with maxLines', () => {
      const largeContent = Array(100).fill('console.log("line");').join('\n');
      const result = highlightSyntax(largeContent, {
        contentType: 'javascript',
        maxLines: 10
      });

      expect(result.truncated).toBe(true);
      expect(result.lineCount).toBe(100);
      expect(result.content.split('\n').length).toBeLessThanOrEqual(11); // 10 + truncation message
    });

    it('should handle malformed JSON without throwing', () => {
      const malformedJson = '{ "key": value, "missing": }';
      const result = highlightSyntax(malformedJson);

      // Should not crash and should detect as plain text since JSON parsing fails
      expect(result.contentType).toBe('plain');
    });

    it('should handle content with existing ANSI codes', () => {
      const contentWithColors = `${ANSI_COLORS.red}Error:${ANSI_COLORS.reset} Something failed`;
      const result = highlightSyntax(contentWithColors, { contentType: 'error' });

      expect(result.highlighted).toBe(true);
      expect(result.content).toContain(ANSI_COLORS.brightRed); // Error highlighting
    });
  });
});