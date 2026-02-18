/**
 * @fileoverview Unit tests for GrepTool
 *
 * Tests the GrepTool class functionality including:
 * - Parameter validation
 * - Pattern validation
 * - Path resolution
 * - Security validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { GrepTool, type GrepToolInput } from '../grep-tool.js';
import type { ToolExecutionContext, ValidationResult } from '../../base-tool.js';

describe('GrepTool', () => {
  let tool: GrepTool;

  beforeEach(() => {
    tool = new GrepTool();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a GrepTool instance with correct configuration', () => {
      expect(tool.name).toBe('Grep');
      expect(tool.category).toBe('search');
      expect(tool.enabled).toBe(true);

      const definition = tool.getDefinition();
      expect(definition.name).toBe('Grep');
      expect(definition.category).toBe('search');
      expect(definition.dangerous).toBe(false);
      expect(definition.permissions).toEqual(['read']);
      expect(definition.parameters?.required).toEqual(['pattern']);
    });

    it('should have correct parameter schema', () => {
      const definition = tool.getDefinition();
      const properties = definition.parameters?.properties;

      expect(properties).toBeDefined();
      expect(properties?.pattern).toEqual({
        type: 'string',
        description: 'The regular expression pattern to search for in file contents',
      });
      expect(properties?.output_mode).toEqual({
        type: 'string',
        enum: ['content', 'files_with_matches', 'count'],
        description: expect.stringContaining('Output mode'),
      });
    });

    it('should have appropriate examples', () => {
      const definition = tool.getDefinition();
      expect(definition.examples).toHaveLength(4);
      expect(definition.examples?.[0]).toEqual({
        name: 'Search for TODO comments',
        description: 'Find all TODO and FIXME comments in the codebase',
        input: { pattern: 'TODO|FIXME', output_mode: 'content' },
      });
    });
  });

  describe('validate', () => {
    describe('pattern validation', () => {
      it('should accept valid regex patterns', () => {
        const validPatterns = [
          'function',
          'TODO|FIXME',
          'async\\s+function',
          'interface\\s+\\w+',
          'import.*from',
          '\\bclass\\b',
          '^export',
        ];

        for (const pattern of validPatterns) {
          const result = tool.validate({ pattern });
          expect(result.valid).toBe(true);
        }
      });

      it('should reject empty patterns', () => {
        const inputs: GrepToolInput[] = [
          { pattern: '' },
          { pattern: '   ' },
          { pattern: '\t\n' },
        ];

        for (const input of inputs) {
          const result = tool.validate(input);
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('pattern cannot be empty');
        }
      });

      it('should reject invalid regex patterns', () => {
        const invalidPatterns = [
          '[',
          '(',
          '*',
          '?',
          '+',
          '{',
          '(?',
          '[abc',
          '(abc',
        ];

        for (const pattern of invalidPatterns) {
          const result = tool.validate({ pattern });
          expect(result.valid).toBe(false);
          expect(result.errors?.[0]).toMatch(/invalid regular expression/);
        }
      });

      it('should warn about dangerous patterns', () => {
        const dangerousPatterns = ['.*', '.+', '.*.*', '.+.+'];

        for (const pattern of dangerousPatterns) {
          const result = tool.validate({ pattern });
          expect(result.valid).toBe(true);
          expect(result.warnings).toContain('pattern may cause catastrophic backtracking and poor performance');
        }
      });

      it('should warn about very broad patterns', () => {
        const broadPatterns = ['.', '.*', '.+'];

        for (const pattern of broadPatterns) {
          const result = tool.validate({ pattern });
          expect(result.valid).toBe(true);
          expect(result.warnings).toContain('very broad pattern will match most lines and may be slow');
        }
      });
    });

    describe('path validation', () => {
      it('should accept valid paths', () => {
        const validPaths = [
          '.',
          './src',
          '/absolute/path',
          '../relative',
          'src/components',
        ];

        for (const path of validPaths) {
          const result = tool.validate({ pattern: 'test', path });
          expect(result.valid).toBe(true);
        }
      });

      it('should reject empty paths', () => {
        const emptyPaths = ['', '   ', '\t\n'];

        for (const path of emptyPaths) {
          const result = tool.validate({ pattern: 'test', path });
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('path cannot be empty if specified');
        }
      });

      it('should warn about path traversal attempts', () => {
        const suspiciousPaths = ['../../../etc', '../../home'];

        for (const path of suspiciousPaths) {
          const result = tool.validate({ pattern: 'test', path });
          expect(result.valid).toBe(true);
          expect(result.warnings).toContain('relative path contains ".." - ensure this is intentional');
        }
      });

      it('should warn about system directories', () => {
        const systemPaths = ['/etc/passwd', '/proc/version', '/sys/class', 'C:\\Windows\\System32'];

        for (const path of systemPaths) {
          const result = tool.validate({ pattern: 'test', path });
          expect(result.valid).toBe(true);
          expect(result.warnings).toContain('accessing system directories - use caution');
        }
      });

      it('should warn when path is outside working directory', () => {
        const context: ToolExecutionContext = {
          workingDirectory: '/home/user/project',
        };

        const result = tool.validate({ pattern: 'test', path: '/home/user/other' }, context);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('search path is outside the working directory');
      });
    });

    describe('context lines validation', () => {
      it('should accept valid context line values', () => {
        const validInputs = [
          { pattern: 'test', '-A': 3 },
          { pattern: 'test', '-B': 5 },
          { pattern: 'test', '-C': 2 },
          { pattern: 'test', '-A': 0 },
        ];

        for (const input of validInputs) {
          const result = tool.validate(input);
          expect(result.valid).toBe(true);
        }
      });

      it('should reject negative context line values', () => {
        const invalidInputs = [
          { pattern: 'test', '-A': -1 },
          { pattern: 'test', '-B': -5 },
          { pattern: 'test', '-C': -2 },
        ];

        for (const input of invalidInputs) {
          const result = tool.validate(input);
          expect(result.valid).toBe(false);
          expect(result.errors?.some(e => e.includes('must be a non-negative integer'))).toBe(true);
        }
      });

      it('should reject non-integer context line values', () => {
        const invalidInputs = [
          { pattern: 'test', '-A': 3.14 },
          { pattern: 'test', '-B': 2.5 },
          { pattern: 'test', '-C': 1.1 },
        ];

        for (const input of invalidInputs) {
          const result = tool.validate(input);
          expect(result.valid).toBe(false);
          expect(result.errors?.some(e => e.includes('must be a non-negative integer'))).toBe(true);
        }
      });

      it('should warn about very large context line values', () => {
        const largeInputs = [
          { pattern: 'test', '-A': 100 },
          { pattern: 'test', '-B': 75 },
          { pattern: 'test', '-C': 80 },
        ];

        for (const input of largeInputs) {
          const result = tool.validate(input);
          expect(result.valid).toBe(true);
          expect(result.warnings?.some(w => w.includes('very large and may impact performance'))).toBe(true);
        }
      });

      it('should warn when context lines used with non-content mode', () => {
        const inputs = [
          { pattern: 'test', output_mode: 'files_with_matches' as const, '-A': 2 },
          { pattern: 'test', output_mode: 'count' as const, '-B': 3 },
          { pattern: 'test', output_mode: 'files_with_matches' as const, '-n': true },
        ];

        for (const input of inputs) {
          const result = tool.validate(input);
          expect(result.valid).toBe(true);
          expect(result.warnings?.some(w => w.includes('only work with output_mode "content"'))).toBe(true);
        }
      });
    });

    describe('output mode validation', () => {
      it('should accept valid output modes', () => {
        const validModes = ['content', 'files_with_matches', 'count'] as const;

        for (const mode of validModes) {
          const result = tool.validate({ pattern: 'test', output_mode: mode });
          expect(result.valid).toBe(true);
        }
      });

      it('should reject invalid output modes', () => {
        // Type assertion to test runtime validation
        const result = tool.validate({ pattern: 'test', output_mode: 'invalid' as any });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('output_mode must be one of: content, files_with_matches, count');
      });
    });

    describe('head limit and offset validation', () => {
      it('should accept valid head_limit values', () => {
        const validInputs = [
          { pattern: 'test', head_limit: 10 },
          { pattern: 'test', head_limit: 0 },
          { pattern: 'test', head_limit: 1000 },
        ];

        for (const input of validInputs) {
          const result = tool.validate(input);
          expect(result.valid).toBe(true);
        }
      });

      it('should accept valid offset values', () => {
        const validInputs = [
          { pattern: 'test', offset: 5 },
          { pattern: 'test', offset: 0 },
          { pattern: 'test', offset: 100 },
        ];

        for (const input of validInputs) {
          const result = tool.validate(input);
          expect(result.valid).toBe(true);
        }
      });

      it('should reject negative head_limit values', () => {
        const result = tool.validate({ pattern: 'test', head_limit: -1 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('head_limit must be a non-negative integer');
      });

      it('should reject negative offset values', () => {
        const result = tool.validate({ pattern: 'test', offset: -5 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('offset must be a non-negative integer');
      });

      it('should reject non-integer head_limit values', () => {
        const result = tool.validate({ pattern: 'test', head_limit: 3.14 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('head_limit must be a non-negative integer');
      });

      it('should reject non-integer offset values', () => {
        const result = tool.validate({ pattern: 'test', offset: 2.5 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('offset must be a non-negative integer');
      });
    });

    describe('glob and type filtering validation', () => {
      it('should accept valid glob patterns', () => {
        const validGlobs = ['*.js', '**/*.ts', '*.{ts,tsx}', 'src/**/*.js'];

        for (const glob of validGlobs) {
          const result = tool.validate({ pattern: 'test', glob });
          expect(result.valid).toBe(true);
        }
      });

      it('should accept valid file types', () => {
        const validTypes = ['js', 'ts', 'py', 'rust', 'go', 'java'];

        for (const type of validTypes) {
          const result = tool.validate({ pattern: 'test', type });
          expect(result.valid).toBe(true);
        }
      });

      it('should warn when both glob and type are specified', () => {
        const result = tool.validate({ pattern: 'test', glob: '*.js', type: 'ts' });
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('both glob and type specified - type filter will take precedence');
      });
    });

    describe('base validation integration', () => {
      it('should call parent validate method', () => {
        const spy = vi.spyOn(Object.getPrototypeOf(GrepTool.prototype), 'validate');
        tool.validate({ pattern: 'test' });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      });

      it('should return base validation errors if invalid', () => {
        // Test with invalid parameters type
        const result = tool.validate(null as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Parameters must be an object');
      });

      it('should merge warnings with base validation warnings', () => {
        // This would require mocking base validation to return warnings
        const result = tool.validate({ pattern: '.*', path: '/etc/passwd' });
        expect(result.valid).toBe(true);
        expect(result.warnings).toEqual(expect.arrayContaining([
          'pattern may cause catastrophic backtracking and poor performance',
          'very broad pattern will match most lines and may be slow',
          'accessing system directories - use caution',
        ]));
      });
    });
  });

  describe('getDefinition', () => {
    it('should return cached definition on subsequent calls', () => {
      const definition1 = tool.getDefinition();
      const definition2 = tool.getDefinition();
      expect(definition1).toBe(definition2); // Same reference
    });

    it('should include all required tool metadata', () => {
      const definition = tool.getDefinition();

      expect(definition.name).toBe('Grep');
      expect(definition.description).toContain('powerful search tool');
      expect(definition.category).toBe('search');
      expect(definition.permissions).toEqual(['read']);
      expect(definition.dangerous).toBe(false);
      expect(definition.enabled).toBe(true);
      expect(definition.version).toBe('1.0.0');
      expect(definition.tags).toContain('search');
      expect(definition.tags).toContain('ripgrep');
    });
  });
});