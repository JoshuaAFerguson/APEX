/**
 * EnvironmentDetector Complex Parsing Tests
 *
 * Tests for complex .env file parsing scenarios, quote handling,
 * and edge cases in variable extraction.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EnvironmentDetector } from '../environment-detector.js';

vi.mock('fs/promises');

describe('EnvironmentDetector Complex Parsing', () => {
  let detector: EnvironmentDetector;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    detector = new EnvironmentDetector(mockProjectPath);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Quote Handling', () => {
    it('should handle different quote combinations correctly', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`DOUBLE_QUOTES="value with spaces"
SINGLE_QUOTES='value with spaces'
NESTED_DOUBLE="value with 'single' quotes"
NESTED_SINGLE='value with "double" quotes'
NO_QUOTES=value_without_spaces
PARTIAL_QUOTE="only start quote
WHITESPACE_VALUE="  spaces around value  "
EMPTY_WITH_SPACES="   "
MIXED_QUOTES="value'
UNCLOSED_SINGLE='unclosed value`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      const doubleQuotes = variables.find(v => v.name === 'DOUBLE_QUOTES');
      expect(doubleQuotes?.value).toBe('value with spaces');

      const singleQuotes = variables.find(v => v.name === 'SINGLE_QUOTES');
      expect(singleQuotes?.value).toBe('value with spaces');

      const nestedDouble = variables.find(v => v.name === 'NESTED_DOUBLE');
      expect(nestedDouble?.value).toBe('value with \'single\' quotes');

      const nestedSingle = variables.find(v => v.name === 'NESTED_SINGLE');
      expect(nestedSingle?.value).toBe('value with "double" quotes');

      const noQuotes = variables.find(v => v.name === 'NO_QUOTES');
      expect(noQuotes?.value).toBe('value_without_spaces');

      const partialQuote = variables.find(v => v.name === 'PARTIAL_QUOTE');
      expect(partialQuote?.value).toBe('"only start quote');

      const whitespaceValue = variables.find(v => v.name === 'WHITESPACE_VALUE');
      expect(whitespaceValue?.value).toBe('  spaces around value  ');

      const emptyWithSpaces = variables.find(v => v.name === 'EMPTY_WITH_SPACES');
      expect(emptyWithSpaces?.value).toBe('   ');

      const mixedQuotes = variables.find(v => v.name === 'MIXED_QUOTES');
      expect(mixedQuotes?.value).toBe('"value\'');

      const unclosedSingle = variables.find(v => v.name === 'UNCLOSED_SINGLE');
      expect(unclosedSingle?.value).toBe('\'unclosed value');
    });

    it('should handle complex quote escaping scenarios', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Quote escaping tests
SIMPLE_ESCAPE="value with \\"escaped\\" quotes"
SINGLE_ESCAPE='value with \\' single quote'
JSON_VALUE='{"key": "value", "number": 123}'
URL_WITH_PARAMS="https://example.com?param1=value1&param2=value2"
SHELL_COMMAND='echo "hello world" > /tmp/test'
MULTILINE_JSON="{
  \\"name\\": \\"test\\",
  \\"value\\": 123
}"
COMPLEX_PATH="/path/with spaces/and'quotes/and\\"double\\"quotes"`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      const simpleEscape = variables.find(v => v.name === 'SIMPLE_ESCAPE');
      expect(simpleEscape?.value).toBe('value with \\"escaped\\" quotes');

      const singleEscape = variables.find(v => v.name === 'SINGLE_ESCAPE');
      expect(singleEscape?.value).toBe('value with \\\' single quote');

      const jsonValue = variables.find(v => v.name === 'JSON_VALUE');
      expect(jsonValue?.value).toBe('{"key": "value", "number": 123}');

      const urlWithParams = variables.find(v => v.name === 'URL_WITH_PARAMS');
      expect(urlWithParams?.value).toBe('https://example.com?param1=value1&param2=value2');

      const shellCommand = variables.find(v => v.name === 'SHELL_COMMAND');
      expect(shellCommand?.value).toBe('echo "hello world" > /tmp/test');

      const complexPath = variables.find(v => v.name === 'COMPLEX_PATH');
      expect(complexPath?.value).toBe('/path/with spaces/and\'quotes/and\\"double\\"quotes');
    });
  });

  describe('Malformed Content Handling', () => {
    it('should handle malformed lines gracefully', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Valid variables
VALID_VAR=value123

# Malformed lines
MISSING_VALUE=
=MISSING_KEY
JUST_A_STRING_NO_EQUALS
KEY_WITH_MULTIPLE_EQUALS=value=with=equals=signs
WHITESPACE_KEY   =   value_with_spaces_around_equals

# Empty and whitespace lines




\t\t

# Special characters in names
KEY-WITH-DASHES=value
KEY_WITH_NUMBERS123=value
KEY.WITH.DOTS=value
UNICODE_KEY_🚀=value

# Very long key
${'VERY_LONG_KEY_NAME_'.repeat(10)}=value_for_long_key

# Special values
EMPTY_VALUE=
ZERO_VALUE=0
FALSE_VALUE=false
NULL_VALUE=null`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // Valid variables should be parsed
      expect(variables.find(v => v.name === 'VALID_VAR')?.value).toBe('value123');
      expect(variables.find(v => v.name === 'MISSING_VALUE')?.value).toBe('');
      expect(variables.find(v => v.name === 'KEY_WITH_MULTIPLE_EQUALS')?.value).toBe('value=with=equals=signs');
      expect(variables.find(v => v.name === 'WHITESPACE_KEY')?.value).toBe('value_with_spaces_around_equals');

      // Special characters should work
      expect(variables.find(v => v.name === 'KEY-WITH-DASHES')?.value).toBe('value');
      expect(variables.find(v => v.name === 'KEY_WITH_NUMBERS123')?.value).toBe('value');
      expect(variables.find(v => v.name === 'KEY.WITH.DOTS')?.value).toBe('value');
      expect(variables.find(v => v.name === 'UNICODE_KEY_🚀')?.value).toBe('value');

      // Very long key should work
      const longKeyName = 'VERY_LONG_KEY_NAME_'.repeat(10);
      expect(variables.find(v => v.name === longKeyName)?.value).toBe('value_for_long_key');

      // Special values should be preserved as strings
      expect(variables.find(v => v.name === 'EMPTY_VALUE')?.value).toBe('');
      expect(variables.find(v => v.name === 'ZERO_VALUE')?.value).toBe('0');
      expect(variables.find(v => v.name === 'FALSE_VALUE')?.value).toBe('false');
      expect(variables.find(v => v.name === 'NULL_VALUE')?.value).toBe('null');

      // Invalid lines should not create variables
      expect(variables.find(v => v.name === '')).toBeUndefined();
      expect(variables.find(v => v.name === 'JUST_A_STRING_NO_EQUALS')).toBeUndefined();
    });

    it('should handle binary and non-text content', async () => {
      // Simulate file with some binary content mixed with valid env vars
      const mockReadFile = vi.mocked(fs.readFile);
      const binaryContent = 'VALID_VAR1=value1\n' +
        '\x00\x01\x02\x03\xFF\xFE\n' + // Binary data
        'VALID_VAR2=value2\n' +
        'CONTROL_CHARS=\x07\x08\x0B\x0C\n' + // Control characters
        'VALID_VAR3=value3\n';
      mockReadFile.mockResolvedValue(binaryContent);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // Should parse valid lines and skip binary content
      expect(variables).toHaveLength(4);
      expect(variables.find(v => v.name === 'VALID_VAR1')?.value).toBe('value1');
      expect(variables.find(v => v.name === 'VALID_VAR2')?.value).toBe('value2');
      expect(variables.find(v => v.name === 'VALID_VAR3')?.value).toBe('value3');

      // Control characters should be preserved in values
      const controlChars = variables.find(v => v.name === 'CONTROL_CHARS');
      expect(controlChars?.value).toBe('\x07\x08\x0B\x0C');
    });
  });

  describe('Large File Scenarios', () => {
    it('should handle files with mixed content efficiently', async () => {
      const lines = [];

      // Add some comments
      for (let i = 0; i < 50; i++) {
        lines.push(`# Comment line ${i}`);
      }

      // Add some empty lines
      for (let i = 0; i < 20; i++) {
        lines.push('');
      }

      // Add valid variables
      for (let i = 0; i < 100; i++) {
        const varName = `VAR_${i.toString().padStart(3, '0')}`;
        const varValue = `value_${i}`;
        lines.push(`${varName}=${varValue}`);
      }

      // Add some invalid lines
      lines.push('INVALID_LINE_NO_EQUALS');
      lines.push('=NO_KEY_VALUE');
      lines.push('');

      // Add more valid variables with quotes
      for (let i = 100; i < 150; i++) {
        const varName = `QUOTED_VAR_${i}`;
        const varValue = `"quoted value ${i}"`;
        lines.push(`${varName}=${varValue}`);
      }

      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(lines.join('\n'));

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // Should only parse the valid variables (100 + 50 = 150)
      expect(variables).toHaveLength(150);

      // Check first and last variables
      expect(variables.find(v => v.name === 'VAR_000')?.value).toBe('value_0');
      expect(variables.find(v => v.name === 'VAR_099')?.value).toBe('value_99');
      expect(variables.find(v => v.name === 'QUOTED_VAR_100')?.value).toBe('quoted value 100');
      expect(variables.find(v => v.name === 'QUOTED_VAR_149')?.value).toBe('quoted value 149');
    });
  });

  describe('Unicode and International Characters', () => {
    it('should handle unicode in variable names and values', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Unicode test file
EMOJI_VAR=🚀🌟✨
CHINESE_VAR=你好世界
RUSSIAN_VAR=Привет мир
ARABIC_VAR=مرحبا بالعالم
JAPANESE_VAR=こんにちは世界
UNICODE_NAME_🚀=rocket_value
ACCENTED_CHARS=café naïve résumé
MATH_SYMBOLS=∑∏∂∆Ω
CURRENCY_SYMBOLS=€£¥₹₽₩
SPECIAL_UNICODE=\u{1F60A}\u{1F44D}\u{1F4A9}`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      expect(variables.find(v => v.name === 'EMOJI_VAR')?.value).toBe('🚀🌟✨');
      expect(variables.find(v => v.name === 'CHINESE_VAR')?.value).toBe('你好世界');
      expect(variables.find(v => v.name === 'RUSSIAN_VAR')?.value).toBe('Привет мир');
      expect(variables.find(v => v.name === 'ARABIC_VAR')?.value).toBe('مرحبا بالعالم');
      expect(variables.find(v => v.name === 'JAPANESE_VAR')?.value).toBe('こんにちは世界');
      expect(variables.find(v => v.name === 'UNICODE_NAME_🚀')?.value).toBe('rocket_value');
      expect(variables.find(v => v.name === 'ACCENTED_CHARS')?.value).toBe('café naïve résumé');
      expect(variables.find(v => v.name === 'MATH_SYMBOLS')?.value).toBe('∑∏∂∆Ω');
      expect(variables.find(v => v.name === 'CURRENCY_SYMBOLS')?.value).toBe('€£¥₹₽₩');
      expect(variables.find(v => v.name === 'SPECIAL_UNICODE')?.value).toBe('😊👍💩');
    });
  });

  describe('File Encoding Scenarios', () => {
    it('should handle different line ending types', async () => {
      const mockReadFile = vi.mocked(fs.readFile);

      // Test with different line endings: \n, \r\n, \r
      const contentWithMixedLineEndings = 'VAR1=value1\nVAR2=value2\r\nVAR3=value3\rVAR4=value4';
      mockReadFile.mockResolvedValue(contentWithMixedLineEndings);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // All variables should be parsed regardless of line ending type
      expect(variables).toHaveLength(4);
      expect(variables.find(v => v.name === 'VAR1')?.value).toBe('value1');
      expect(variables.find(v => v.name === 'VAR2')?.value).toBe('value2');
      expect(variables.find(v => v.name === 'VAR3')?.value).toBe('value3');
      expect(variables.find(v => v.name === 'VAR4')?.value).toBe('value4');
    });
  });
});